import { newParameters, newAcceptHeader, newAuthorizationHeader, newCookieHeader, parseRequestBody } from './../utils.mjs'
import { newConnection } from './database.mjs';

import { newAccount } from '../common/models.mjs';

let OK = 200, badRequest = 400, unauthorized = 401, forbidden = 403, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;
let allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

let routes = {
    status: status,
    account: {
        register: register,
        login: login,
        logout: logout
    },
    category: {
        resource: category_resource,
    },
    music: {
        file: music_file,
        resource: music_resource,
    }
};

let connection;

// Deal with a request.
export async function handle(url, request, response) {
    if (connection === undefined || !connection.available) {
        // We open a connection if we don't have one or the previous one is closed.
        connection = await newConnection();
    }
    let acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) {
        error(badRequest, response);
        return;
    }
    let method = request.headers[':method'];
    let session = await getSession(request);
    console.log(`[Request (API)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (API)] URL Parameters: ', url.parameters);
    // We check to see if the client accepts a JSON and set every response to be a JSON
    // There is one exception to this content-type, however it will be dealt in the function responsible for this type of request
    if (!acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'json' })) {
        error(notAcceptable, response);
        return;
    }
    response.setHeader('Content-Type', 'application/json');

    let currentRoutes = routes;
    let processed = false;
    while (!processed) {
        let path = url.shift();
        let result = currentRoutes[path];
        if (result !== undefined && result !== null) {
            if (result instanceof Function) {
                // We recognize that this is the end of a route, but we still have to check if the URL ends here as well.
                // We could support having routes that corresponds to incomplete URL, however since this isn't necessary with this configuration

                // We could check directly the length of the array of the path and its first value. Since we won't be using this URL again, we can just read shift the array and see if it is empty
                if (url.shift() === '') { 
                    await result(method, session, url.parameters, request, response);
                    processed = true;
                } else {
                    error(notFound, response);
                    processed = true;
                }
            } else {
                // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
                currentRoutes = result;
            }
        } else {
            error(notFound, response);
            processed = true;
        }
    }
}

function error(errorCode, response) {
    response.statusCode = errorCode;
    response.end();
}

async function getSession(request) {
    // We have 2 ways to obtain the currently used token, and the first one takes precedent over the second:
    // 1) Check the Authorization header. It HAS to be of type Bearer and must be followed by a session token.
    // 2) Check the cookies.
    let authorization = newAuthorizationHeader(request.headers['authorization']);
    let cookies = newCookieHeader(request.headers['cookie']);
    let token = null;
    if (authorization !== null && authorization.type === 'Bearer') {
        token = authorization.token;
    } else if (cookies !== null && cookies['token'] !== undefined) {
        token = cookies['token'];
    }
    if (token === null || !connection.available ) { return null; }
    console.log(token);
    return await connection.getSessionFromToken(token);
}

// TODO : Every function below (and more) properly

async function status(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    response.statusCode = OK;
    if (method !== 'HEAD') {
        if (session !== null) {
            console.log(session);
            let account = await connection.getAccount(session.account_id);
            if (account !== null) {
                response.write(JSON.stringify({ username: account.username }));
            } else {
                response.write(JSON.stringify({ username: null})); // Shouldn't happen.
            }
        } else {
            response.write(JSON.stringify({ username: null}));
        }
    }
    response.end();
}

async function register(method, session, parameters, request, response) {
    const validMethods = ['POST'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    if (!allowRegistration && !(session !== null && session.is_admin) ) {
        response.statusCode = badRequest;
        response.end();
        return;
    }
    // We have to get the request's body. We ignore the URL's parameters.
    let body_parameters = await parseRequestBody(request);
    if (body_parameters === null) {
        response.statusCode = badRequest;
        response.end();
        return;
    }
    let account = newAccount(body_parameters['username'], body_parameters['password']);
    if (account === null) {
        response.statusCode = badRequest;
        response.end(); 
    } else {
        let done = await connection.createAccount(account);
        if (done) { response.statusCode = OK }
        else { response.statusCode = internalServerError }
        response.end()
    }
}

async function login(method, session, parameters, request, response) { // We ignore the URL Parameters intentionally, as the password would be visible on-screen (via the URL) by the end-user.
    const validMethods = ['POST'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    // We have to get the request's body. We ignore the URL's parameters.
    let body_parameters = await parseRequestBody(request);
    if (body_parameters === null) {
        response.statusCode = badRequest;
        response.end();
        return;
    }
    
    let account = newAccount(body_parameters['username'], body_parameters['password']);
    if (account === null) { response.statusCode = unauthorized; response.end(); return; }
    // Check is the account's ID if the credentials are valid, -1 otherwise
    let check = await connection.checkAccountCredentials(account);
    if (check !== -1) {
        if (session !== null) {
            // If the login is successful, we want to revoke the previous session on the server-side.
            connection.revokeSession(session.session_id);
        }
        let token = await connection.createSession(check);
        response.statusCode = OK;
        // 172800 seconds = 2 weeks
        response.setHeader('Set-Cookie', `token=${token}; Max-Age=172800; Secure; HttpOnly`);
        response.write(JSON.stringify({ token }));
        response.end();
    } else { response.statusCode = unauthorized; response.end(); return; }
}

async function logout(method, session, parameters, request, response) {
    const validMethods = ['POST']; // We do not allow the GET and HEAD method here, even if the POST requires no parameters (we won't even bother getting them)
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    if (session !== null) {
        let done = await connection.revokeSession(session.session_id);
        if (done) { response.statusCode = OK; }
        else { response.statusCode = internalServerError; }
        response.end();
    } else {
        response.statusCode = unauthorized;
        response.end();
    }
}

async function category_resource(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

async function music_file(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

async function music_resource(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { response.statusCode = methodNotAllowed; response.end(); return; }
    
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

