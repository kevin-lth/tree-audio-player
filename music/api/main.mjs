import { newParameters, newAcceptHeader, newAuthorizationHeader, newCookieHeader, newInt, newBoolean, bodylessResponse, bodyResponse, parseRequestBody } from './../utils.mjs'
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
        cover: category_cover,
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
    // We open a connection if we don't have one or the previous one is closed.
    if (connection === undefined || !connection.available) { connection = await newConnection(); }
    let acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) { bodylessResponse(badRequest, response); return; }
    let method = request.headers[':method'];
    let session = await getSession(request);
    console.log(`[Request (API)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (API)] URL Parameters: ', url.parameters);
    
    // We check to see if the client accepts a JSON and set every response to be a JSON
    // There is one exception to this content-type, however it will be dealt in the function responsible for this type of request
    if (!acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'json' })) { bodylessResponse(notAcceptable, response); return; }
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
                if (url.shift() === '') { await result(method, session, url.parameters, request, response); }
                else { bodylessResponse(notFound, response); }
                processed = true;
            } else { currentRoutes = result; } // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
        } else { bodylessResponse(notFound, response); processed = true; }
    }
}

async function getSession(request) {
    // We have 2 ways to obtain the currently used token, and the first one takes precedent over the second:
    // 1) Check the Authorization header. It HAS to be of type Bearer and must be followed by a session token.
    // 2) Check the cookies.
    let authorization = newAuthorizationHeader(request.headers['authorization']);
    let cookies = newCookieHeader(request.headers['cookie']);
    let token = null;
    if (authorization !== null && authorization.type === 'Bearer') { token = authorization.token; }
    else if (cookies !== null && cookies['token'] !== undefined) { token = cookies['token']; }
    
    if (token === null || !connection.available ) { return null; }
    else { return await connection.getSessionFromToken(token); }
}

// TODO : Every function below (and more) properly

async function status(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (method === 'HEAD') { bodylessResponse(OK, response); }
    else { 
        let body = "{ username: null }"; // Unnecessary to stringify each time to same object
        if (session !== null) {
            let account = await connection.getAccount(session.account_id);
            if (account !== null) { body = JSON.stringify({ username: account.username }); }
        }
        bodyResponse(OK, body, response);
    }
}

async function register(method, session, parameters, request, response) {
    const validMethods = ['POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (!allowRegistration && !(session !== null && session.is_admin) ) { bodylessResponse(badRequest, response); return; }
    // We have to get the request's body. We ignore the URL's parameters.
    let body_parameters = await parseRequestBody(request);
    if (body_parameters === null) { bodylessResponse(badRequest, response); return; }
    
    let account = newAccount(body_parameters['username'], body_parameters['password']);
    if (account === null) { bodylessResponse(badRequest, response); } 
    else {
        let account_id = await connection.createAccount(account), status_code;
        if (account_id !== -1) { status_code = OK } else { status_code = internalServerError }
        bodylessResponse(status_code, response);
    }
}

async function login(method, session, parameters, request, response) { // We ignore the URL Parameters intentionally, as the password would be visible on-screen (via the URL) by the end-user.
    const validMethods = ['POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    // We have to get the request's body. We ignore the URL's parameters.
    let body_parameters = await parseRequestBody(request);
    if (body_parameters === null) { bodylessResponse(badRequest, response); return; }
    
    let account = newAccount(body_parameters['username'], body_parameters['password']);
    if (account === null) { bodylessResponse(unauthorized, response); return; }
    // Check is the account's ID if the credentials are valid, -1 otherwise
    let check = await connection.checkAccountCredentials(account);
    if (check !== -1) {
        // If the login is successful, we want to revoke the previous session on the server-side.
        if (session !== null) { connection.revokeSession(session.session_id); }
        let token = await connection.createSession(check);
        // 172800 seconds = 2 weeks
        response.setHeader('Set-Cookie', `token=${token}; Max-Age=172800; Secure; HttpOnly`);
        bodyResponse(OK, JSON.stringify({ token }), response);
    } else { bodylessResponse(unauthorized, response); }
}

async function logout(method, session, parameters, request, response) {
    const validMethods = ['POST']; // We do not allow the GET and HEAD method here, even if the POST requires no parameters (we won't even bother getting them)
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        let done = await connection.revokeSession(session.session_id), status_code;
        if (done) { status_code = OK; } else { status_code = internalServerError; }
        bodylessResponse(status_code, response);
    } else { bodylessResponse(unauthorized, response); }
}

async function category_cover(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        const category_id = newInt(parameters['id']);
        if (category_id === null) { bodylessResponse(badRequest, response); return; }
        // TODO
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

async function category_resource(method, session, parameters, request, response) {
    // Technically not necessary if we were to use the switch-case to handle invalid methods. However, this isn't a major concern 
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }

    if (session !== null) {
        // TODO
        const category_id = newInt(parameters['id']);
        switch (method) {
            case 'HEAD': case 'GET': case 'PUT': case 'DELETE':
                // We need the category's ID
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                break;
            case 'HEAD': case 'GET':
                // We treat them similarly, HEAD being the same as GET but without the body
                // If we find undefined (aka the value wasn't sent by the client), we apply a default value.
                if (parameters['include_children'] === undefined) { parameters['include_children'] = false }
                if (parameters['only_direct_children'] === undefined) { parameters['only_direct_children'] = true } 
                let include_children = newBoolean(parameters['include_children']), only_direct_children = newBoolean(parameters['only_direct_children']);
                if (include_children === null || only_direct_children === null) { bodylessResponse(badRequest, response); return; }
                break;
            case 'PUT':
                break;
            case 'DELETE':
                break;
            case 'POST':
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

async function music_file(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        // TODO
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

async function music_resource(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        // TODO
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

