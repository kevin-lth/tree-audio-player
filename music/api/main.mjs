import { newConnection } from './database.mjs';
import { getCategoryCover } from './file.mjs';

import { newParameters, newAcceptHeader, newAuthorizationHeader, newCookieHeader, newInt, newBoolean, bodylessResponse, bodyResponse, parseRequestBody } from './../utils.mjs'
import { newAccount, newIDlessCategory, newCategory, newMusic } from '../common/models.mjs';

let OK = 200, badRequest = 400, unauthorized = 401, forbidden = 403, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;
let allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

let routes = {
    account: {
        status: account_status,
        register: account_register,
        login: account_login,
        logout: account_logout,
    },
    category: {
        cover: category_cover,
        resource: category_resource,
        public: category_public,
        personal: category_personal,
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
    // End everything if we have no connection.
    if (!connection.available) { bodylessResponse(internalServerError, response); return; }
    
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

async function account_status(method, session, parameters, request, response) {
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

async function account_register(method, session, parameters, request, response) {
    // TODO : Implement better mitigation to limit account creation
    if (!allowRegistration && session !== null) { bodylessResponse(notFound, response); return; }
    const validMethods = ['POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
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

async function account_login(method, session, parameters, request, response) { // We ignore the URL Parameters intentionally, as the password would be visible on-screen (via the URL) by the end-user.
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

async function account_logout(method, session, parameters, request, response) {
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
        const category = await connection.getCategory(category_id);
        if (category === null) { bodylessResponse(badRequest, response); return; }
        switch (method) {
            case 'HEAD': case 'GET':
                break;
            case 'POST':
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

async function category_resource(method, session, parameters, request, response) {
    // Technically not necessary if we were to use the switch-case to handle invalid methods. However, this isn't a major concern 
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }

    if (session !== null) {
        let done;
        let category_id = newInt(parameters['id']); // Can't be a constant in the case of POST
        switch (method) {
            case 'HEAD': case 'GET':
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                // We treat them similarly, HEAD being the same as GET but without the body
                // If we find undefined (aka the value wasn't sent by the client), we apply a default value.
                if (parameters['include_children'] === undefined) { parameters['include_children'] = false }
                if (parameters['only_direct_children'] === undefined) { parameters['only_direct_children'] = true } 
                let include_children = newBoolean(parameters['include_children']), only_direct_children = newBoolean(parameters['only_direct_children']);
                if (include_children === null || only_direct_children === null) { bodylessResponse(badRequest, response); return; }
                // We can't cut corners here, unfortunately. Since HEAD means GET without the body, we have to go through with the database request to be consistent.
                // For instance, if the category doesn't exist, we have to throw an error regardless of the HTTP method.
                // First of all, let's check that this session has the right to access this category.
                const category = await connection.getCategory(category_id, include_children, only_direct_children);
                let status_code;
                if (category === null) { status_code = badRequest; }
                else { status_code = OK; }
                if (method === 'HEAD' || status_code !== OK) { bodylessResponse(status_code, response); }
                else { bodyResponse(status_code, JSON.stringify(category), response) } // Has to be GET
                break;
            case 'PUT':
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
            case 'POST': 
                // We need to check that we are either an admin or
                let body_parameters = await parseRequestBody(request);
                if (body_parameters === null) { bodylessResponse(badRequest, response); return; }
                // We ignore the ID if it is included in the body; we want it in the URL
                let updated_category = newIDlessCategory(body_parameters['full_name'], body_parameters['short_name'], body_parameters['is_public'], session.account_id, undefined);
                if (updated_category === null) { bodylessResponse(badRequest, response); return; }
                // The reason for checking the parent ID right now is to avoid doing any operation on the DB if it happens that the session isn't allowed to do it
                let parent_category_id = newInt(body_parameters['parent_id']); // -1 means no parent
                if (parent_category_id !== null && parent_category_id !== -1 &&
                    !(await connection.checkCategoryOwnership(parent_category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                
                if (method === 'POST') {
                    category_id = await connection.createCategory(updated_category);
                    done = category_id !== -1;
                }
                else { done = await connection.updateCategory(category_id, updated_category); }
                
                if (done && parent_category_id !== null) {
                    // We also need to handle adding / changing the parent here if specified.
                    let current_parent_category = await connection.getParentCategory(category_id);
                    if (parent_category_id === -1 && current_parent_category !== null) { done = await connection.unbindCategoryFromParent(category_id); }
                    else if (parent_category_id !== -1 && (current_parent_category === null || parent_category_id !== current_parent_category.id)) { done = await connection.bindCategoryToParent(category_id, parent_category_id); }
                }
                
                if (done) { bodylessResponse(OK, response); return; }
                else { bodylessResponse(internalServerError, response); return; }
                break;
            case 'DELETE':
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                done = await connection.deleteCategory(category_id);
                if (done) { bodylessResponse(OK, response); return; }
                else { bodylessResponse(internalServerError, response); return; }
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
        bodyResponse(OK, '{}', response);
    } else { bodylessResponse(unauthorized, response); }
}

async function category_public(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        const categories = await connection.getAllPublicCategories();
        if (categories === null) { bodylessResponse(internalServerError, response); return; }
        else {
            if (method === 'GET') { bodyResponse(OK, JSON.stringify(categories), response); return; }
            else { bodylessResponse(OK, response); return; }
        }
    } else { bodylessResponse(unauthorized, response); }
}

async function category_personal(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        const category_id = newInt(parameters['id']);
        switch (method) {
            case 'HEAD': case 'GET':
                const categories = await connection.getAllPersonalCategories(session.account_id);
                if (categories === null) { bodylessResponse(internalServerError, response); return; }
                else {
                    if (method === 'GET') { bodyResponse(OK, JSON.stringify(categories), response); return; }
                    else { bodylessResponse(OK, response); return; }
                }
                break;
            case 'POST':
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                else {
                    let done = await connection.grantCategoryAccess(category_id, session.account_id);
                    if (!done) { bodylessResponse(internalServerError, response); return; }
                    else { bodylessResponse(OK, response); return; }
                }
                break;
            case 'DELETE':
                if (category_id === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                else {
                    let done = await connection.revokeCategoryAccess(category_id, session.account_id);
                    if (!done) { bodylessResponse(internalServerError, response); return; }
                    else { bodylessResponse(OK, response); return; }
                }
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
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

