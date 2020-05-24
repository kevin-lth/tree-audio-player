import { newConnection } from './database.mjs';
import { getCategoryCoverStream, getDefaultCategoryCoverStream, processCategoryCover, getMusicFileWithFormat, processMusicFile } from '../file_utils.mjs';

const OK = 200, accepted = 202, partialContent = 206, badRequest = 400, unauthorized = 401, forbidden = 403, notFound = 404, internalServerError = 500;
const allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

const default_music_format = 'ogg|opus-96';

function newAPIResponse(response, http_code) {
    return { response, http_code }
}

let connection = null;

async function __prepareConnection() {
    if (!(connection !== null && connection.available)) { connection = await newConnection(); }
    return connection !== null && connection.available;
}

export function getAPI() {

    // Putting this check here allows us to remove it from all API calls which check the session - that is most of them
    async function __checkSession(token) {
        if (!(await __prepareConnection())) { return newAPIResponse(null, internalServerError); }
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse(null, unauthorized); }
        else { return newAPIResponse(session, OK); }
    }

    // Returns the username if the token is valid.
    async function getSessionStatus(token) {
        if (!(await __prepareConnection())) { return newAPIResponse(null, internalServerError); } // We don't use checkSession because we want a normal response if the server works but the session doesn't exist
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse({ username: null }, OK); }
        else {
            const account = await connection.getAccount(session.account_id);
            if (account === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse({ username: account.username }, OK); } 
        }
    }

    async function getAccountProfile(token, account_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const account = await connection.getAccount(account_id);
            if (account === null) { return newAPIResponse(null, notFound); }
            else { return newAPIResponse({ username: account.username }, OK); } 
        }
    }

    async function registerAccount(token, account) {
        if (!allowRegistration) { return newAPIResponse(null, notFound); }
        
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const account_id = await connection.createAccount(account);
            if (account_id === -1) { return newAPIResponse(null, forbidden); } // The account must already exist
            else { return newAPIResponse({ id : account_id }, OK); }
        }
    }

    async function loginAccount(token, account) {
        if (!(await __prepareConnection())) { return newAPIResponse(null, internalServerError); }
        const valid_account_id = await connection.checkAccountCredentials(account);
        if (valid_account_id === -1) { return newAPIResponse(null, unauthorized); }
        else {
            const session = await connection.getSessionFromToken(token);
            if (session !== null) { 
                const revoked = await connection.revokeSession(session.session_id);
                if (!revoked) { return newAPIResponse(null, internalServerError); }
            }
            const new_token = await connection.createSession(valid_account_id);
            if (new_token === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse({ token: new_token }, OK); }
            
        }
    }

    async function logoutAccount(token) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const done = await connection.revokeSession(session.session_id);
            if (!done) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    async function addCategory(token, id_less_category, parent_category_id = undefined) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (parent_category_id !== undefined && 
                !(await connection.checkCategoryOwnership(parent_category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const category_id = await connection.createCategory(id_less_category, session.account_id);
            if (category_id === -1) { return newAPIResponse(null, badRequest); }
            else {
                if (parent_category_id !== undefined && parent_category_id !== -1) { // We also need to handle adding the parent.
                    const done = await connection.bindCategoryToParent(category_id, parent_category_id);
                    if (!done) { // Let's try to clean things and remove the category we just created..
                        const cleaned = await connection.deleteCategory(category_id);
                        if (!cleaned) { console.log('[API] Problem encountered when adding a category : setting its parent failed, and deleting it also failed. This should not occur, please check the database for any issues.'); }
                        return newAPIResponse(null, badRequest);
                    }
                }
                return newAPIResponse({ id : category_id }, OK);
            }
        }
    }
    
    async function getCategory(token, category_id, include_children = false, only_direct_children = true) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            else {
                const category = await connection.getCategory(category_id, include_children, only_direct_children);
                if (category === null) { return newAPIResponse(null, notFound); }
                else { return newAPIResponse(category, OK); }
            }
        }
    }
    
    async function updateCategory(token, category_id, id_less_updated_category, parent_category_id = undefined) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryOwnership(category_id, session.account_id)) ||
                (parent_category_id !== undefined && !(await connection.checkCategoryOwnership(parent_category_id, session.account_id)))) 
                    { return newAPIResponse(null, unauthorized); }
            const previous_category = await connection.getCategory(category_id); // We take the category just in case the parent ID is invalid and we have to rollback
            if (previous_category === null) { return newAPIResponse(null, badRequest); }
            const updated = await connection.updateCategory(category_id, id_less_updated_category);
            if (!updated) { // This should not occur unless something is wrong with the database
                console.log('[API] Problem encountered when updating a category : the category exists, but its update failed. However, the updated values were checked beforehand... Please check the database for any issues.');
                return newAPIResponse(null, badRequest);
            }
            else { 
                if (parent_category_id !== null) {
                    let done;
                    const previous_parent_category = await connection.getParentCategory(category_id);
                    if (parent_category_id === -1 && previous_parent_category !== null) 
                        { done = await connection.unbindCategoryFromParent(category_id); }
                    else if (parent_category_id !== -1 && (previous_parent_category === null || parent_category_id !== previous_parent_category.id)) 
                        { done = await connection.bindCategoryToParent(category_id, parent_category_id); }
                    if (!done) { // Huh oh. Sure, the update went through, but changing the parent didn't work... Let's try rolling back the update.
                        const cleaned = await connection.updateCategory(category_id, previous_category);
                        if (!cleaned) { console.log('[API] Problem encountered when updating a category : setting its parent failed, and re-updating it with its previous values also did. This should not occur, please check the database for any issues.'); }
                        return newAPIResponse(null, badRequest);
                    }
                }
                return newAPIResponse(null, OK);
            }
        }
    }
    
    async function deleteCategory(token, category_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const done = await connection.deleteCategory(category_id);
            if (!done) { return newAPIResponse(null, badRequest); }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    async function getCategoryCover(token, category_id, range = null) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const cover_url = await connection.getCategoryCoverURL(category_id);
            let cover;
            if (cover_url === null) { return newAPIResponse(null, notFound); } // Shouldn't happen, except if we are an admin and are looking at an invalid category
            else if (cover_url === undefined) { cover = await getDefaultCategoryCoverStream(range); }
            else { cover = await getCategoryCoverStream(cover_url, range); }
            if (cover === null) { // The URL is known by the database but the file doesn't exist : there was most likely outside tampering.
                console.log('[API] Problem encountered when getting a category cover : the URL is known by the database but the corresponding file doesn\'t exist. This should not occur, please check both the database and your file system for any issues.');
                return newAPIResponse(null, internalServerError);
            } else {
                let status_code = OK;
                if (cover.partial) { status_code = partialContent; }
                return newAPIResponse(cover, status_code);
            }
            
        }
    }
    
    async function setCategoryCover(token, category_id, temporary_url) { // EasyImage requires a URL. We could ask for a stream and try a work around but that would defeat the way we handle the request's body.
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryOwnership(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const cover_url = await processCategoryCover(temporary_url);
            if (cover_url === null) { return newAPIResponse(null, badRequest); }
            else {
                const done = await connection.setCategoryCoverURL(category_id, cover_url);
                if (!done) { return newAPIResponse(null, internalServerError); }
                else { return newAPIResponse(null, OK); }
            }
        }
    }
    
    async function getPublicCategories(token) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const categories = await connection.getAllPublicCategories();
            if (categories === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse(categories, OK); }
        }
    }
    
    async function addPersonalCategory(token, category_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const done = await connection.grantCategoryAccess(category_id, session.account_id);
            if (!done) { return newAPIResponse(null, badRequest); }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    async function getPersonalCategories(token) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const categories = await connection.getAllPersonalCategories(session.account_id);
            if (categories === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse(categories, OK); }
        }
    }
    
    // Revoking the personal access only does something if the account is not the owner of the category : this method won't fail even in this case.
    async function revokePersonalCategory(token, category_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const done = await connection.revokeCategoryAccess(category_id, session.account_id); // We won't check for access : the DELETE won't do anything if you don't have access anyway
            if (!done) { return newAPIResponse(null, badRequest); }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    async function getOwnedCategories(token) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const categories = await connection.getAllOwnedCategories(session.account_id);
            if (categories === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse(categories, OK); }
        }
    }
    
    async function getAllCategoryMusics(token, category_id, include_all_children = false) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryAccess(category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const musics = await connection.getAllMusics(category_id, include_all_children);
            if (musics === null) { return newAPIResponse(null, badRequest); }
            else { return newAPIResponse(musics, OK); }
        }
    }
    async function addMusic(token, id_less_music) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (!(await connection.checkCategoryOwnership(id_less_music.category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
            const music_id = await connection.createMusic(id_less_music, session.account_id);
            if (music_id === -1) { return newAPIResponse(null, badRequest); }
            else { return newAPIResponse({ id : music_id }, OK); }
        }
    }

    async function getMusic(token, music_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            // This is awkward : to check if we have access to the music, we have to check the category... and to do that, we need to get the music itself. 
            const music = await connection.getMusic(music_id);
            if (music === null) { return newAPIResponse(null, notFound); }
            else { 
                if (!(await connection.checkCategoryAccess(music.category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
                else { return newAPIResponse(music, OK); }
            }
        }
    }
    
    async function updateMusic(token, music_id, id_less_updated_music) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const previous_music = await connection.getMusic(music_id);
            if (previous_music === null) { return newAPIResponse(null, badRequest); }
            if (!(await connection.checkCategoryOwnership(previous_music.category_id, session.account_id)) ||
                !(await connection.checkCategoryOwnership(id_less_updated_music.category_id, session.account_id))) 
                    { return newAPIResponse(null, unauthorized); }
            const updated = await connection.updateMusic(music_id, id_less_updated_music);
            if (!updated) { // This should not occur unless something is wrong with the database
                console.log('[API] Problem encountered when updating a music : the music exists, but its update failed. However, the updated values were checked beforehand... Please check the database for any issues.');
                return newAPIResponse(null, badRequest);
            }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    async function deleteMusic(token, music_id) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const music = await connection.getMusic(music_id);
            if (music === null) { return newAPIResponse(null, notFound); }
            else { 
                if (!(await connection.checkCategoryAccess(music.category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
                else {
                    const done = await connection.deleteMusic(music_id);
                    if (!done) { return newAPIResponse(null, badRequest); }
                    else { return newAPIResponse(null, OK); }
                }
            }
        }
    }
    
    async function getMusicFile(token, music_id, format = null, range = null) {
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            if (format === undefined || format === null) { format = default_music_format; }
            const music = await connection.getMusic(music_id);
            if (music === null) { return newAPIResponse(null, notFound); }
            else { 
                if (!(await connection.checkCategoryAccess(music.category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
                const formats_and_urls = await connection.getMusicFormatsAndURLs(music_id);
                if (formats_and_urls === null) { return newAPIResponse(null, notFound); }
                const file_url = formats_and_urls[format];
                if (file_url === undefined || file_url === null) { return newAPIResponse(null, notFound); }
                let file = await getMusicFileWithFormat(file_url, range, format);
                if (file === null) { // The URL is known by the database but the file doesn't exist : there was most likely outside tampering.
                    console.log('[API] Problem encountered when getting a music file : the URL is known by the database but the corresponding file doesn\'t exist. This should not occur, please check both the database and your file system for any issues.');
                    return newAPIResponse(null, internalServerError);
                } else {
                    let status_code = OK;
                    if (file.partial) { status_code = partialContent; }
                    return newAPIResponse(file, status_code);
                }
            } 
        }
    }
    
    async function setMusicFile(token, music_id, temporary_url, execute_before_processing = (temporary_api_response) => {}) { // This function allows us to handle cases where a response cannot wait: for instance, in the case of an HTTP response.
        const check_session = await __checkSession(token);
        if (check_session.response === null) { return check_session; }
        else {
            const session = check_session.response;
            const music = await connection.getMusic(music_id);
            if (music === null) { return newAPIResponse(null, notFound); }
            else { 
                if (!(await connection.checkCategoryOwnership(music.category_id, session.account_id))) { return newAPIResponse(null, unauthorized); }
                const temporary_api_response = newAPIResponse(null, accepted);
                execute_before_processing(temporary_api_response);
                const file_urls = await processMusicFile(temporary_url);
                if (file_urls === null) { return newAPIResponse(null, internalServerError); }
                else {
                    const keys = Object.keys(file_urls);
                    for (let i = 0; i < keys.length; i++) {
                        let done = await connection.removeMusicFormat(music_id, keys[i]);
                        if (done) { done = await connection.addMusicFormatAndURL(music_id, keys[i], file_urls[keys[i]]); }
                        if (!done) { return newAPIResponse(null, internalServerError); }
                    }
                    return newAPIResponse(null, OK);
                }

            }
        }
    }
    
    return { getSessionStatus, getAccountProfile, registerAccount, loginAccount, logoutAccount, addCategory, getCategory, updateCategory, deleteCategory, getCategoryCover, setCategoryCover, getPublicCategories, addPersonalCategory, getPersonalCategories, revokePersonalCategory, getOwnedCategories, getAllCategoryMusics, addMusic, getMusic, updateMusic, deleteMusic, getMusicFile, setMusicFile };

}

