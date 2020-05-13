import { getAPI } from './api.mjs';
import { getAudioFormats, getCategoryCoverStream, getDefaultCategoryCoverStream, processCategoryCover, getMusicFile, processMusicFile } from './file.mjs';

import { newParameters, newMimeType, newAcceptHeader, newAuthorizationHeader, newCookieHeader, newRangeHeader, newInt, newBoolean, 
    bodylessResponse, bodyResponse, bodylessStreamResponse, bodyStreamResponse, getRequestBody } from './../utils.mjs'
import { newAccount, newIDlessCategory, newCategory, newIDlessMusic, newMusic } from '../common/models.mjs';

const OK = 200, accepted = 202, partialContent = 206, unauthorized = 401, forbidden = 403, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;
const badRequest = 400, notFound = 404;
const allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

const accept_image = newAcceptHeader('image/*'), accept_audio = newAcceptHeader('audio/*,application/octet-stream');

const default_audio_format = 'ogg|opus-96';

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
        personal: handle_category_personal,
        music: handle_category_music,
    },
    music: {
        resource: handle_music_resource,
        file: handle_music_file,
    }
};

let API = getAPI();

// Deal with a request.
export async function handle(url, request, response) {   
    let acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) { bodylessResponse(badRequest, '', response); return; }
    else if (!(acceptTypes.isAccepted({ mimeType: 'application', mimeSubtype: 'json' }) 
        && acceptTypes.isAccepted({ mimeType: 'image', mimeSubtype: '*' })
        && acceptTypes.isAccepted({ mimeType: 'audio', mimeSubtype: '*' }) )) { bodylessResponse(notAcceptable, '', response); return; }
    // Except for 2 specific requests, we will send JSON in the body
    response.setHeader('Content-Type', 'application/json');
        
    const method = request.headers[':method'];
    const token = await getToken(request);
    console.log(`[Request (API)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (API)] URL Parameters: ', url.parameters);

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
                else { bodylessResponse(notFound, response); }
                processed = true;
            } else { currentRoutes = result; } // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
        } else { bodylessResponse(notFound, '', response); processed = true; }
    }
}

// We have 2 ways to obtain the currently used token, and the first one takes precedent over the second:
// 1) Check the Authorization header. It HAS to be of type Bearer and must be followed by a session token.
// 2) Check the cookies.
async function getToken(request) {
    const authorization = newAuthorizationHeader(request.headers['authorization']), cookies = newCookieHeader(request.headers['cookie']);
    if (authorization !== null && authorization.type === 'Bearer') { return authorization.token; }
    else if (cookies !== null && cookies['token'] !== undefined) { return cookies['token']; }
    else { return null; }
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
                response.setHeader('Set-Cookie', `token=${api_response.response.token}; Max-Age=1209600; Secure; HttpOnly`); // 1209600 seconds = 2 weeks
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
            const range = newRangeHeader(request.headers['range']); // If it is null, we just send the whole file, so this is a valid case.
            api_response = await API.getCategoryCover(token, category_id, range);
            if (api_response.response === null) { bodylessResponse(api_response.http_code, '', response); }
            else if (method === 'HEAD') { bodylessStreamResponse(api_response.http_code, api_response.response, response); } // No JSON : the util function handles everything
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

async function handle_category_personal(method, token, parameters, request, response) {
    `const validMethods = ['HEAD', 'GET', 'POST', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        const category_id = newInt(parameters['id']);
        switch (method) {
            case 'HEAD': case 'GET':
                const categories = await connection.getAllPersonalCategories(session.account_id);
                if (categories === null) { bodylessResponse(internalServerError, response); return; }
                else {
                    if (method === 'GET') { bodyResponse(OK, JSON.stringify(categories), response); return; }
                    else { bodylessResponse(OK, JSON.stringify(categories), response); return; }
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
    } else { bodylessResponse(unauthorized, response); }`
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
            api_response = await API.addPersonalCategory(token, category_id); // TODO
            break;
        case 'DELETE':
            if (category_id === null) { bodylessResponse(badRequest, '', response); return; }
            api_response = await API.deletePersonalCategory(token, category_id); // TODO
            break;
        default:
            bodylessResponse(methodNotAllowed, '', response);
    }
}

async function handle_category_music(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        if (parameters['include_all_children'] === undefined) { parameters['include_all_children'] = false; }
        const category_id = newInt(parameters['id']), include_all_children = newBoolean(parameters['include_all_children']);
        if (category_id === null || include_all_children == null) { bodylessResponse(badRequest, response); return; }
        const musics = await connection.getAllMusics(category_id, include_all_children);
        if (musics === null) { bodylessResponse(internalServerError, response); return; }
        else {
            if (method === 'GET') { bodyResponse(OK, JSON.stringify(musics), response); return; }
            else { bodylessResponse(OK, JSON.stringify(musics), response); return; }
        }
    } else { bodylessResponse(unauthorized, response); }
}

async function handle_music_resource(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        let done;
        let music_id = newInt(parameters['id']); // Can't be a constant in the case of POST
        let music = null;
        let category_id = null;
        switch (method) {
            case 'HEAD': case 'GET':
                if (music_id === null) { bodylessResponse(badRequest, response); return; }
                music = await connection.getMusic(music_id);
                if (music === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryAccess(music.category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }

                if (method === 'GET') { bodyResponse(OK, JSON.stringify(music), response); }
                else { bodylessResponse(OK, JSON.stringify(music), response) } // Has to be HEAD
                break;
            case 'PUT':
                if (music_id === null) { bodylessResponse(badRequest, response); return; }
                music = await connection.getMusic(music_id);
                if (music === null) { bodylessResponse(badRequest, response); return; }
                category_id = music.category_id;
            case 'POST': 
                let data = await getRequestBody(request);
                if (data === null) { bodylessResponse(badRequest, response); return; }
                
                if (category_id === null) { category_id = data.getFieldValue('category_id'); }
                if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                let tags = [];
                try {
                    tags = JSON.parse(data.getFieldValue('tags'));
                } catch (error) { bodylessResponse(badRequest, response); return; }
                let updated_music = newIDlessMusic(data.getFieldValue('full_name'), category_id, data.getFieldValue('track'), tags);
                if (updated_music === null) { bodylessResponse(badRequest, response); return; }
                
                if (method === 'POST') {
                    music_id = await connection.createMusic(updated_music);
                    done = music_id !== -1;
                }
                else { done = await connection.updateMusic(music_id, updated_music); }
                
                if (done) { bodylessResponse(OK, response); return; }
                else { bodylessResponse(internalServerError, response); return; }
                break;
            case 'DELETE':
                if (music_id === null) { bodylessResponse(badRequest, response); return; }
                music = await connection.getMusic(music_id);
                if (music === null) { bodylessResponse(badRequest, response); return; }
                if (!(await connection.checkCategoryOwnership(music.category_id, session.account_id))) { bodylessResponse(unauthorized, response); return; }
                done = await connection.deleteMusic(music_id);
                if (done) { bodylessResponse(OK, response); return; }
                else { bodylessResponse(internalServerError, response); return; }
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
    } else { bodylessResponse(unauthorized, response); }
}

async function handle_music_file(method, session, parameters, request, response) {
    const validMethods = ['HEAD', 'GET', 'POST'];
    if (validMethods.indexOf(method) === -1) { bodylessResponse(methodNotAllowed, response); return; }
    
    if (session !== null) {
        const music_id = newInt(parameters['id']);
        if (music_id === null) { bodylessResponse(badRequest, response); return; }
        switch (method) {
            case 'HEAD': case 'GET':
                let format = parameters['format'];
                if (format === undefined) { format = default_audio_format; }
                const range = newRangeHeader(request.headers['range']);
                const formats_and_urls = await connection.getMusicFormatsAndURLs(music_id);
                if (formats_and_urls === null) { bodylessResponse(notFound, response); return; }
                const url = formats_and_urls[format];
                if (url === undefined || url === null) { bodylessResponse(notFound, response); return; }
                const file = await getMusicFile(url, range, format);
                
                if (file === null) { bodylessResponse(notFound, response); return; }
                let status_code;
                if (file.partial) { status_code = partialContent; }
                else { status_code = OK; }
                if (method === 'GET') { bodyStreamResponse(status_code, file, request, response); }
                else { bodylessStreamResponse(status_code, file, response); }
                break;
            case 'POST':
                const data = await getRequestBody(request);
                if (data === null) { bodylessResponse(badRequest, response); return; }
                const file_data = data.rawData['file'];
                if (file_data === undefined || file_data === null || !accept_audio.isAccepted(newMimeType(file_data['mime_type']))) { 
                    bodylessResponse(badRequest, response); await deleteTempFile(data.getFileName('file')); return;
                }
                // The processing takes a while... we will answer the client immediately.
                bodylessResponse(accepted, response);
                
                const result = await processMusicFile(data.getFileName('file'));
                if (result === null) { await deleteTempFile(data.getFileName('file')); return; } // No response necessary
                
                const keys = Object.keys(result);
                for (let i = 0; i < keys.length; i++) {
                    await connection.removeMusicFormat(music_id, keys[i]);
                    await connection.addMusicFormatAndURL(music_id, keys[i], result[keys[i]]);
                }
                // We delete the temporary file regardless of the outcome.
                await deleteTempFile(data.getFileName('file'));
                break;
            default:
                bodylessResponse(internalServerError, response); return; // Should not happen. Just in case...
        }
    } else { bodylessResponse(unauthorized, response); }
}

