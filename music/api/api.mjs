import { newConnection } from './database.mjs';
import { getAudioFormats, getCategoryCoverStream, getDefaultCategoryCoverStream, processCategoryCover, getMusicFile, processMusicFile, deleteTempFile } from './file.mjs';

import { newParameters, newMimeType, newAcceptHeader, newAuthorizationHeader, newCookieHeader, newRangeHeader } from './../utils.mjs'
import { newAccount, newIDlessCategory, newCategory, newIDlessMusic, newMusic } from '../common/models.mjs';

const OK = 200, accepted = 202, partialContent = 206, badRequest = 400, unauthorized = 401, forbidden = 403, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;
const allowRegistration = true; // /!\ You should turn this off unless proper security is in place to avoid spam (e.g. email verification), this is only here for testing purposes.

const accept_image = newAcceptHeader('image/*'), accept_audio = newAcceptHeader('audio/*,application/octet-stream');

const default_audio_format = 'ogg|opus-96';

function newAPIResponse(response, http_code) {
    return { response, http_code }
}

let connection = null;

async function prepareConnection() {
    if (!(connection !== null && connection.available)) { connection = await newConnection(); }
    return connection !== null && connection.available;
}

export function getAPI() {

    // Returns the username if the token is valid.
    async function getAccountStatus(token) {
        if (!(await prepareConnection())) { return newAPIResponse(null, internalServerError); }
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse({ username: null }, OK); }
        else {
            const account = await connection.getAccount(session.account_id);
            if (account === null) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse({ username: account.username }, OK); } 
        }
    }

    async function registerAccount(token, account) {
        if (!(await prepareConnection())) { return newAPIResponse(null, internalServerError); }
        if (!allowRegistration) { return newAPIResponse(null, notFound); }
        
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse(null, unauthorized); }
        else {
            const account_id = await connection.createAccount(account);
            if (account_id === -1) { return newAPIResponse(null, forbidden); } // The account must already exist
            else { return newAPIResponse(account_id, OK); }
        }
    }

    async function loginAccount(token, account) {
        if (!(await prepareConnection())) { return newAPIResponse(null, internalServerError); }
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
        if (!(await prepareConnection())) { return newAPIResponse(null, internalServerError); }
        const session = await connection.getSessionFromToken(token);
        if (session === null) { return newAPIResponse(null, unauthorized); }
        else {
            const done = await connection.revokeSession(session.session_id);
            if (!done) { return newAPIResponse(null, internalServerError); }
            else { return newAPIResponse(null, OK); }
        }
    }
    
    return { getAccountStatus, registerAccount, loginAccount, logoutAccount };

}
