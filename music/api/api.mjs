import { newConnection } from './database.mjs';
import { getAudioFormats, getCategoryCoverStream, getDefaultCategoryCoverStream, processCategoryCover, getMusicFile, processMusicFile, deleteTempFile } from './file.mjs';

const OK = 200, accepted = 202, partialContent = 206, badRequest = 400, unauthorized = 401, forbidden = 403, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;
const allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

const default_audio_format = 'ogg|opus-96';

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
        if (!(await __prepareConnection())) { return newAPIResponse(null, internalServerError); } // We don't use checkSession because we want a normal response if the server works but the session doesn't exist
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse(null, unauthorized); }
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
                console.log('[API] Problem encountered when updating a category : it exists, but the update failed. However, the updated values were checked beforehand... Please check the database for any issues.');
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
    
    return { getSessionStatus, getAccountProfile, registerAccount, loginAccount, logoutAccount, addCategory, getCategory, updateCategory, deleteCategory };

}

