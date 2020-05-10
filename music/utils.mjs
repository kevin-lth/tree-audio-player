const alphanumeric = /^\w+$/, alphanumericOrEmpty = /^\w*$/, alphanumericAndNonWebCharacters = /^[\w|\h|\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~]+$/;;
const URlMaxLength = 2000, acceptMaxLength = 250, authorizationMaxLength = 250, cookieMaxLength = 1000;
const validAuthorizationMethod = ['Bearer'];

// Returns null if the URL is invalid or an object representing the URL if the URL is valid
// Probably doable with only RegEx
export function newURL(url) {
    // A valid URL has the following format : '/(alphanumeric)/(alphanumeric)/(alphanumeric)[.alphanumeric][?key=value&key2=value2]'
    if (url === undefined || url === null || url.length > URlMaxLength) { return null; }
    let paths = url.split('/');
    // We transform everything to lower case
    paths = paths.map((path) => path.toLowerCase());
    if (paths.length < 2 || paths[0] !== '') { return null; } // There must be a slash, and there must be nothing before the first slash
    for (let i = 1; i < paths.length - 1; i++) {
        if (paths[i].match(alphanumeric) === null) { return null; } // All intermediate text between slashes must be alphanumeric and lower-case
    }
    const endPath = paths[paths.length - 1].split('?');
    if (endPath.length > 2) { return null; } // We can only have one ? to specify the parameters
    const file = endPath[0].split('.');
    if (file.length > 2) { return null; } // The file may or may not have an extension. It may even be the empty string
    for (let i = 1; i < file.length - 1; i++) {
        if (file[i].match(alphanumeric) === null) { return null; }
    }
    if (file.length === 2 && (file[0] === '' || file[1] === '')) { return null; } // We want to hide every file that starts or ends with a '.', therefore we invalidate the URL if that's the case
    let parameters = {};
    if (endPath.length === 2) { parameters = newParameters(endPath[1]); }
    if (parameters === null) { return null; }
    paths.shift(); // The first element of the array is always empty, we do not need it
    paths.pop(); paths.push(endPath[0]); // The last element still contains the parameters, so we replace the last element with the same string without what comes after the ?
    
    function shift() {
        if (paths.length === 1) {
            paths.push(''); // This adds a slash at the end of each URL effectively
        }
        return paths.shift();
    }
    
    return { paths, parameters, shift };
}

export function newParameters(urlencoded_parameters) {
    const endPathParameters = urlencoded_parameters.split('&'), parameters = {};
    for (let i = 0; i < endPathParameters.length; i++) {
        const data = endPathParameters[i].split('=');
        if (data.length !== 2 || data[0].match(alphanumericAndNonWebCharacters) === null || data[1].match(alphanumericAndNonWebCharacters) === null) { return null; }
        parameters[data[0]] = data[1]; // It is important that parameters remain case sensitive ! (e.g. passwords)
    }
    return parameters;
}

export function newMimeType(mime_type) {
    const acceptedContent = mime_type.split('/');
    if (acceptedContent.length !== 2) { return null; }
    else { return { mimeType: acceptedContent[0], mimeSubtype: acceptedContent[1] }; }
}

export function newAcceptHeader(accept) {
    if (accept === undefined || accept === null || accept === '' || accept.length > acceptMaxLength) { return null; }
    const array = accept.split(','), acceptedContentArray = [];
    for (let i = 0; i < array.length; i++) {
        const acceptValue = array[i].split(';');
        if (acceptValue.length === 0) { return null; }
        // We ignore the order of the client for now... We focus on checking it accepts the content we want to send
        const acceptedContent = newMimeType(acceptValue[0]);
        if (acceptedContent === null) { return null; }
        acceptedContentArray.push(acceptedContent);
    }
    
    function isAccepted(contentType) {
        for (let i = 0; i < acceptedContentArray.length; i++) {
            const mimeType = acceptedContentArray[i].mimeType, mimeSubtype = acceptedContentArray[i].mimeSubtype;
            if ((mimeType === contentType.mimeType || mimeType === '*') && (mimeSubtype === contentType.mimeSubtype || mimeSubtype === '*')) {
                return true;
            }
        }
        return false;
    }
    
    return { accept: acceptedContentArray, isAccepted };
}

export function newAuthorizationHeader(authorization) {
    if (authorization === undefined || authorization === null || authorization === '' || authorization.length > authorizationMaxLength) { return null; }
    const array = authorization.split(' ');
    if (array.length !== 2 || validAuthorizationMethod.indexOf(array[0]) === -1 || array[1].match(alphanumeric)) { return null; }
    
    return { type: array[0], token: array[1] };
}

export function newCookieHeader(cookie) {
    if (cookie === undefined || cookie === null || cookie === '' || cookie.length > cookieMaxLength) { return null; }
    const array = cookie.split(';'), cookies = {};
    for (let i = 0; i < array.length; i++) {
        let cookieValue = array[i].split('=');
        if (cookieValue.length !== 2) { return null; }
        cookies[cookieValue[0].trim()] = cookieValue[1].trim();
    }
    return cookies;
}

export function newInt(number) {
    if (number === undefined || number === null || number === '' || isNaN(number)) { return null; }
    else { return parseInt(number); }
}

export function newBoolean(boolean) {
    if (boolean === undefined || boolean === null || (boolean !== true && boolean !== 'true' && boolean !== false && boolean !== 'false')) { return null; }
    else if (boolean === 'true') { return true; } else if (boolean === 'false') { return false; } 
    else { return boolean };
}

export function bodylessResponse(status_code, response) {
    response.statusCode = status_code;
    response.end();
}

export function bodyResponse(status_code, body, response) {
    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.statusCode = status_code;
    response.write(body);
    response.end();
}

//
// Request body
//

import fs from 'fs';
import Busboy from 'busboy';
import crypto from 'crypto';

const temp_dir = './temp/';

async function __promise__getRequestBody(request) {
    return new Promise((resolve, reject) => {
        try {
            const busboy = new Busboy({ headers: request.headers, limits: { fields: 100, files: 2, fileSize: 10e6 } });
            const data = { rawData: {} };
            
            function getFieldValue(field) {
                if (data['rawData'][field]['type'] !== 'field') { return null; }
                else { return data['rawData'][field]['value']; }
            }

            function getFileName(file) {
                if (data['rawData'][file]['type'] !== 'file') { return null; }
                else { return data['rawData'][file]['value']; }
            }
            
            data['getFieldValue'] = getFieldValue;
            data['getFileName'] = getFileName;
            const stream_promises = [];
            busboy.on('field', (fieldname, value, fieldname_truncated, val_truncated, encoding, mime_type) => {
                data.rawData[fieldname] = { type: 'field', value, encoding, mime_type };
            });
            busboy.on('file', (fieldname, stream, filename, encoding, mime_type) => {
                const temp_name = crypto.randomBytes(32).toString('hex').slice(0, 32);
                // We will save the file in a temporary directory. We ignore the filename for security reasons.
                // We use piping to directly save the file instead of keeping it into memory
                let file = fs.createWriteStream(temp_dir + temp_name);
                stream.pipe(file);
                data.rawData[fieldname] = { type: 'file', value: temp_name, encoding, mime_type };
                
                let stream_promise = new Promise((resolve, reject) => { stream.on('close', () => { resolve(); }); });
                
                stream_promises.push(stream_promise); // We store the streams to make sure to not end the promise before the files are saved on the disk
            });
            busboy.on('finish', () => {
                Promise.all(stream_promises).then(() => { resolve(data); });
            });
            request.pipe(busboy);
        } catch (error) { reject(error); }
    });
}

export async function getRequestBody(request) {
    try {
        return await __promise__getRequestBody(request);
    } catch (error) {
        console.log('[Request (Body)] Error when obtaining request body : ', error);
        return null;
    }
}

