const alphanumeric = /^\w+$/, alphanumericOrEmpty = /^\w*$/, alphanumericAndNonWebCharacters = /^[\w|\h|\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~]+$/;;
const URlMaxLength = 2000, acceptMaxLength = 250, authorizationMaxLength = 250, cookieMaxLength = 1000, maxPayloadSize = 1e6;
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
    let endPath = paths[paths.length - 1].split('?');
    if (endPath.length > 2) { return null; } // We can only have one ? to specify the parameters
    let file = endPath[0].split('.');
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
    let parameters = {};
    let endPathParameters = urlencoded_parameters.split('&');
    for (let i = 0; i < endPathParameters.length; i++) {
        let data = endPathParameters[i].split('=');
        if (data.length !== 2 || data[0].match(alphanumericAndNonWebCharacters) === null || data[1].match(alphanumericAndNonWebCharacters) === null) { return null; }
        parameters[data[0]] = data[1]; // It is important that parameters remain case sensitive ! (e.g. passwords)
    }
    return parameters;
}

export function newAcceptHeader(accept) {
    if (accept === undefined || accept === null || accept === '' || accept.length > acceptMaxLength) { return null; }
    let array = accept.split(',');
    let acceptedContentArray = [];
    for (let i = 0; i < array.length; i++) {
        let acceptValue = array[i].split(';');
        if (acceptValue.length === 0) { return null; }
        // We ignore the order of the client for now... We focus on checking it accepts the content we want to send
        let acceptedContent = acceptValue[0].split('/');
        if (acceptedContent.length !== 2) { return null; }
        acceptedContentArray.push({ mimeType: acceptedContent[0], mimeSubtype: acceptedContent[1] });
    }
    
    function isAccepted(contentType) {
        for (let i = 0; i < acceptedContentArray.length; i++) {
            let mimeType = acceptedContentArray[i].mimeType, mimeSubtype = acceptedContentArray[i].mimeSubtype;
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
    let array = authorization.split(' ');
    if (array.length !== 2 || validAuthorizationMethod.indexOf(array[0]) === -1 || array[1].match(alphanumeric)) { return null; }
    
    return { type: array[0], token: array[1] };
}

export function newCookieHeader(cookie) {
    if (cookie === undefined || cookie === null || cookie === '' || cookie.length > cookieMaxLength) { return null; }
    let array = cookie.split(';');
    let cookies = {};
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
    response.statusCode = status_code;
    response.write(body);
    response.end();
}

//
// Request body
//

// This is a promise that fetches the body from the client. Useful for POST requests for example.
export function getRequestBody(request) {
    return new Promise((resolve, reject) => { 
        // We have to read the body to obtain the parameters.
        const chunks = [];
        let size = 0;
        request.on('data', chunk => { 
            chunks.push(chunk);
            size += chunk.length;
            if (size >= maxPayloadSize) {
                // We destroy the connection : it might be someone trying to overflow the server's memory to attack it
                request.connection.destroy();
                reject(new Error('[Request (API)] Max payload size reached, request aborted !'));
            }
        });
        request.on('end', () => {
            if (!request.complete) {
                response.statusCode = badRequest;
                response.end();
                reject(new Error('[Request (API)] Request aborted by the client !'));
            } else {
                const data = Buffer.concat(chunks);
                resolve(data);
            }
        }); 
    });
}

// Parses the body if it is URL-Encoded or a JSON object.
export async function parseRequestBody(request) {
    try {
        let body = (await getRequestBody(request)).toString();
        // There are 3 options : the body is invalid, the data is in JSON or the data is URL-Encoded.
        let type = request.headers['content-type'];
        switch (type) {
            case 'application/json':
                return JSON.parse(body);
            case 'application/x-www-form-urlencoded':
                let parameters = newParameters(body);
                if (parameters === null) { throw new Error('Invalid Body Content Type !'); }
                return parameters;
            default:
                throw new Error('Invalid POST Content Type !');
        }
    } catch (error) {
        console.log('[Request (API)] Error when processing request body : ', error);
        return null;
    }
}

