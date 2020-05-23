import { getAPI } from './api.mjs';

import { newMimeType, newAcceptHeader, newRangeHeader, newETagHeader, bodylessResponse, 
    bodyResponse, bodylessStreamResponse, bodyStreamResponse, getToken, getRequestBody } from './../utils.mjs'
import { newAccount, newIDlessCategory, newIDlessMusic, newInt, newBoolean } from '../common/models.mjs';

const OK = 200, notModified = 304, badRequest = 400, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, preconditionFailed = 412;
const allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

const accept_image = newAcceptHeader('image/*'), accept_audio = newAcceptHeader('audio/*,application/octet-stream');

let routes = {
    account: {
        status: handleAccountStatus,
        profile: handleAccountProfile,
        register: handleAccountRegister,
        login: handleAccountLogin,
        logout: handleAccountLogout,
    },
    category: {
        resource: handleCategoryResource,
        cover: handleCategoryCover,
        public: handleCategoryPublic,
        personal: handleCategoryPersonal,
        music: handleCategoryMusic,
    },
    music: {
        resource: handleMusicResource,
        file: handleMusicFile,
    }
};

let API = getAPI();

// Deals with a request.
export async function handle(url, request, response) {
    const acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) { bodylessResponse(badRequest, '', response); return; }
    else if (!acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'json' })) { bodylessResponse(notAcceptable, '', response); return; }
    // Except for 2 specific requests, we will send JSON in the body
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
        
    const method = request.headers[':method'];
    const token = await getToken(request);

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
                else { bodylessResponse(notFound, '', response); }
                processed = true;
            } else { currentRoutes = result; } // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
        } else { bodylessResponse(notFound, '', response); processed = true; }
    }
}

// The functions below are responsible for obtaining the information required from the request, building some objects if needed and passing them on to the API.

async function handleAccountStatus(method, token, parameters, request, response) {
    let api_response;
    switch (method) {
        case 'HEAD': case 'GET':
            api_response = await API.getSessionStatus(token);
            if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleAccountProfile(method, token, parameters, request, response) {
    let api_response;
    const account_id = newInt(parameters['id']);
    switch (method) {
        case 'HEAD': case 'GET':
            if (account_id === null) { bodylessResponse(badRequest, '', response); return; }
            
            api_response = await API.getAccountProfile(token, account_id);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleAccountRegister(method, token, parameters, request, response) {
    // TODO : Implement better mitigation to limit account creation
    let api_response;
    switch (method) {
        case 'POST':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, '', response); return; }
            const account = newAccount(data.getFieldValue('username'), data.getFieldValue('password'));
            if (account === null) { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; } 
            
            api_response = await API.registerAccount(token, account);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            await data.deleteAllTemporaryFiles(); // Just in case the client upload files
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleAccountLogin(method, token, parameters, request, response) { 
    let api_response;
    switch (method) {
        case 'POST':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, '', response); return; }
            const account = newAccount(data.getFieldValue('username'), data.getFieldValue('password'));
            if (account === null) { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; } 
            
            api_response = await API.loginAccount(token, account);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else {
                response.setHeader('Set-Cookie', `token=${api_response.response.token}; Max-Age=1209600; Path=/; Secure; HttpOnly`); // 1209600 seconds = 2 weeks
                bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response);
            }
            await data.deleteAllTemporaryFiles();
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleAccountLogout(method, token, parameters, request, response) {
    let api_response;
    switch (method) {
        case 'POST':
            api_response = await API.logoutAccount(token);
            if (api_response.response === OK) { response.setHeader('Set-Cookie', `token=${token}; Max-Age=0; Path=/, Secure; HttpOnly`); }
            bodylessResponse(api_response.http_code, '', response);
            break;
        default: // We reject HEAD and GET to prevent normal users to logout by error simply by going to the URL
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleCategoryResource(method, token, parameters, request, response) {
    let api_response;
    const category_id = newInt(parameters['id']); // It is used for every method except POST, so we factorize it here
    switch (method) {
        case 'HEAD': case 'GET':
            // If we find undefined (aka the value wasn't sent by the client), we apply a default value.
            if (parameters['include_children'] === undefined) { parameters['include_children'] = false }
            if (parameters['only_direct_children'] === undefined) { parameters['only_direct_children'] = true } 
            const include_children = newBoolean(parameters['include_children']), only_direct_children = newBoolean(parameters['only_direct_children']);
            if (category_id === null || include_children === null || only_direct_children === null) { bodylessResponse(badRequest, '', response); return; }
            
            api_response = await API.getCategory(token, category_id, include_children, only_direct_children);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        case 'POST': case 'PUT':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, '', response); return; }
            const id_less_category = newIDlessCategory(data.getFieldValue('full_name'), data.getFieldValue('short_name'), data.getFieldValue('is_public'), undefined);
            const parent_category_id = newInt(data.getFieldValue('parent_id'));
            if (id_less_category === null || (data.getFieldValue('parent_id') !== null && parent_category_id === null)) 
                { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; }
            
            if (method === 'POST') { api_response = await API.addCategory(token, id_less_category, parent_category_id); }
            else if (category_id !== null) { api_response = await API.updateCategory(token, category_id, id_less_category, parent_category_id); }
            else { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; } // Method is PUT, but category_id is invalid
            
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'POST') { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); } // We need to send back the new category's ID
            else { bodylessResponse(api.response.http_code, '', response); }
            await data.deleteAllTemporaryFiles();
            break;
        case 'DELETE':
            if (category_id === null) { bodylessResponse(badRequest, '', response); return; }
            api_response = await API.deleteCategory(token, category_id);
            bodylessResponse(api_response.http_code, '', response);
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleCategoryCover(method, token, parameters, request, response) {
    let api_response;
    const category_id = newInt(parameters['id']); // We use the ID for every method, so we might as well do the check here.
    if (category_id === null) { bodylessResponse(badRequest, '', response); return; }
    switch (method) {
        case 'HEAD': case 'GET':
            const acceptTypes = newAcceptHeader(request.headers['accept']);
            const ifNoneMatch = newETagHeader(request.headers['if-none-match']);
            if (!acceptTypes.isAccepted({ mimeType: 'image', mimeSubtype: 'png' })) { bodylessResponse(notAcceptable, '', response); return; }
            const range = newRangeHeader(request.headers['range']); // If it is null, we just send the whole file, so this is a valid case.
            api_response = await API.getCategoryCover(token, category_id, range);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessStreamResponse(api_response.http_code, api_response.response, response); } // No JSON : the util function handles everything
            else if (ifNoneMatch === api_response.response.etag) { bodylessStreamResponse(notModified, api_response.response, response); } // The cached version is valid : no need to send it again.
            else { bodyStreamResponse(api_response.http_code, api_response.response, request, response); }
            break;
        case 'POST':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, response); return; }
            const cover_file = data.getFileName('cover');
            if (cover_file === null || !accept_image.isAccepted(newMimeType(data['rawData']['cover']['mime_type']))) 
                { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; }
            
            api_response = await API.setCategoryCover(token, category_id, cover_file);
            bodylessResponse(api_response.http_code, '', response);
            await data.deleteAllTemporaryFiles();
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleCategoryPublic(method, token, parameters, request, response) {
    let api_response;
    switch (method) {
        case 'HEAD': case 'GET':
            api_response = await API.getPublicCategories(token);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleCategoryPersonal(method, token, parameters, request, response) {
    let api_response;
    const category_id = newInt(parameters['id']);
    switch (method) {
        case 'HEAD': case 'GET':
            api_response = await API.getPersonalCategories(token);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        case 'POST':
            if (category_id === null) { bodylessResponse(badRequest, '', response); return; }
            api_response = await API.addPersonalCategory(token, category_id);
            bodylessResponse(api_response.http_code, '', response);
            break;
        case 'DELETE':
            if (category_id === null) { bodylessResponse(badRequest, '', response); return; }
            api_response = await API.revokePersonalCategory(token, category_id);
            bodylessResponse(api_response.http_code, '', response);
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleCategoryMusic(method, token, parameters, request, response) {
    let api_response;
    switch (method) {
        case 'HEAD': case 'GET':
            if (parameters['include_all_children'] === undefined) { parameters['include_all_children'] = false; }
            const category_id = newInt(parameters['id']), include_all_children = newBoolean(parameters['include_all_children']);
            
            api_response = await API.getAllCategoryMusics(token, category_id, include_all_children);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleMusicResource(method, token, parameters, request, response) {
    let api_response;
    const music_id = newInt(parameters['id']); // It is used for every method except POST, so we factorize it here
    switch (method) {
        case 'HEAD': case 'GET':
            if (music_id === null) { bodylessResponse(badRequest, '', response); return; }
            
            api_response = await API.getMusic(token, music_id);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            else { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); }
            break;
        case 'POST': case 'PUT':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, '', response); return; }
            let tags = [];
            try {
                const tags_value = data.getFieldValue('tags');
                if (tags_value !== null) { tags = JSON.parse(tags_value); }
            } catch (error) { console.log(error); bodylessResponse(badRequest, '', response); return; }
            const id_less_music = newIDlessMusic(data.getFieldValue('full_name'), data.getFieldValue('category_id'), data.getFieldValue('track'), tags);
            if (id_less_music === null) { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; }
            
            if (method === 'POST') { api_response = await API.addMusic(token, id_less_music); }
            else if (music_id !== null) { api_response = await API.updateMusic(token, music_id, id_less_music); }
            else { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; } // Method is PUT, but music_id is invalid
            
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'POST') { bodyResponse(api_response.http_code, JSON.stringify(api_response.response), response); } // We need to send back the new music's ID
            else { bodylessResponse(api.response.http_code, '', response); }
            await data.deleteAllTemporaryFiles();
            break;
        case 'DELETE':
            if (music_id === null) { bodylessResponse(badRequest, '', response); return; }
            api_response = await API.deleteMusic(token, music_id);
            bodylessResponse(api_response.http_code, '', response);
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handleMusicFile(method, token, parameters, request, response) {
    let api_response;
    const music_id = newInt(parameters['id']); // We use the ID for every method, so we might as well do the check here.
    if (music_id === null) { bodylessResponse(badRequest, '', response); return; }
    switch (method) {
        case 'HEAD': case 'GET':
            const acceptTypes = newAcceptHeader(request.headers['accept']);
            const ifNoneMatch = newETagHeader(request.headers['if-none-match']);
            if (!acceptTypes.isAccepted({ mimeType: 'audio', mimeSubtype: '*' })) { bodylessResponse(notAcceptable, '', response); return; }
            const range = newRangeHeader(request.headers['range']); // If it is null, we just send the whole file, so this is a valid case.
            const format = parameters['format']; // If there is no value, it will be undefined - the API will pick the default format if this is the case
            api_response = await API.getMusicFile(token, music_id, format, range);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessStreamResponse(api_response.http_code, api_response.response, response); } // No JSON : the util function handles everything
            else if (ifNoneMatch === api_response.response.etag) { bodylessStreamResponse(notModified, api_response.response, response); } // The cached version is valid : no need to send it again.
            else { bodyStreamResponse(api_response.http_code, api_response.response, request, response); }
            break;
        case 'POST':
            const data = await getRequestBody(request);
            if (data === null) { bodylessResponse(badRequest, response); return; }
            const music_file = data.getFileName('file');
            if (music_file === null || !accept_audio.isAccepted(newMimeType(data['rawData']['file']['mime_type']))) 
                { bodylessResponse(badRequest, '', response); await data.deleteAllTemporaryFiles(); return; }
            function execute_before_processing(temporary_api_response) { bodylessResponse(temporary_api_response.http_code, '', response); }
            
            api_response = await API.setMusicFile(token, music_id, music_file, execute_before_processing);
            await data.deleteAllTemporaryFiles();
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

