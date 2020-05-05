import { newAcceptHeader, newAuthorizationHeader, newCookieHeader } from './../utils.mjs'
import { newConnection } from './database.mjs';

import { newAccount } from '../common/models.mjs';

let OK = 200, badRequest = 400, forbidden = 403, notFound = 404, notAcceptable = 406;

let routes = {
    status: status,
    account: {
        login: login,
        logout: logout
    },
    category: {
        resource: category_resource,
    },
    music: {
        download: music_download,
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
        error(400, response);
        return;
    }
    let method = request.headers[':method'];
    let session = get_session(request);
    console.log(`[Request (API)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (API)] Parameters: ', url.parameters);
    // We check to see if the client accepts a JSON and set every response to be a JSON
    // There is one exception to this content-type, however it will be dealt in the function responsible for this type of request
    if (!acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'json' })) {
        error(406, response);
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
                    result(method, session, url.parameters, response);
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

// TODO
function get_session(request) {
    // We have 2 ways to obtain the current used session, and the first one takes precedent over the second:
    // 1) Check the Authorization header. It HAS to be of type Bearer and must be followed by a session token.
    // 2) Check the cookies.
    let authorization = newAuthorizationHeader(request.headers['authorization']);
    let cookies = newCookieHeader(request.headers['cookie']);
    console.log(cookies);
    if (authorization !== null && authorization.type === 'Bearer') {
        return authorization.token;
    } else if (cookies !== null && cookies['token'] !== undefined) {
        return cookies['token'];
    } else {
        return null;
    }
}

function check_session(session) {
    if (session === undefined || session === null || session === '') { return false; }
    // TODO: check the database for the session's existence and to obtain the account's id
    
	return true;
}

// TODO : Every function below (and more) properly

function status(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}


function login(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

function logout(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

function category_resource(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

function music_download(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

function music_resource(method, session, parameters, response) {
    response.statusCode = 200;
    response.write(JSON.stringify({}));
    response.end();
}

