import { newRender } from '../common/render.mjs';
import { newBindings } from '../common/bindings/server_bindings.mjs';

import { newMimeType, newAcceptHeader, newInt, newBoolean, bodylessResponse, bodyResponse, 
    bodylessStreamResponse, getToken, bodyStreamResponse, getRequestBody } from './../utils.mjs';

const OK = 200, badRequest = 400, notFound = 404, methodNotAllowed = 405, notAcceptable = 406;

let routes = {
    '': handleHome,
    login: handleLogin,
    category: {
        public: handleCategoryPublic,
        personal: handleCategoryPersonal,
        details: handleCategoryDetails,
        edit: handleCategoryEdit,
    },
    playlist: handlePlaylist,
    settings: handleSettings,
    about: handleAbout,
};

const render = newRender(newBindings());

// Deals with a request.
export async function handle(url, request, response) {
    const acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) { bodylessResponse(badRequest, '', response); return; }
    // We use XHTML if we can, HTML otherwise
    if (acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'xhtml+xml' })) { response.setHeader('Content-Type', 'application/xhtml+xml; charset=utf-8'); }
    else if (acceptTypes.isAccepted({ mimeType: 'text', mimeSubtype: 'html' })) { response.setHeader('Content-Type', 'text/html; charset=utf-8'); }
    else { bodylessResponse(notAcceptable, '', response); }
    
    const method = request.headers[':method'];
    const token = await getToken(request);
    console.log(`[Request (HTML)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (HTML)] URL Parameters: ', url.parameters);

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
                if (url.shift() === '') { await result(method, token, url.parameters, request, response); }
                else { response.setHeader('Content-Type', 'text/plain'); bodylessResponse(notFound, '', response); } // We need to reset the content-type because XHTML validation will make the browser crash with an empty body
                processed = true;
            } else { currentRoutes = result; } // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
        } else { response.setHeader('Content-Type', 'text/plain'); bodylessResponse(notFound, '', response); processed = true; }
    }
}

async function handleHome(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderHome(token), response);
}

async function handleLogin(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderLogin(token), response);
}

async function handleCategoryPublic(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderCategoryPublic(token), response);
}

async function handleCategoryPersonal(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderCategoryPersonal(token), response);
}

// TODO: Parameters
async function handleCategoryDetails(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderCategoryDetails(token), response);
}


// TODO: Parameters
async function handleCategoryEdit(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderCategoryEdit(token), response);
}

async function handlePlaylist(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderPlaylist(token), response);
}


async function handleSettings(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderSettings(token), response);
}


async function handleAbout(method, token, parameters, request, response) {
    bodyResponse(OK, await render.renderAbout(token), response);
}

