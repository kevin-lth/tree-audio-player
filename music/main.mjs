import * as HTTP from 'http';

import { newURL, bodylessResponse, bodyResponse } from './utils.mjs';
import { testAll } from './tests.mjs';

import * as html from './html/main.mjs';
import * as assets from './assets/main.mjs';
import * as api from './api/main.mjs';

const OK = 200, badRequest = 400, notFound = 404, methodNotAllowed = 405, notAcceptable = 406;

// Deal with a request.
export async function handle(request, response) {
    response.setHeader('X-Content-Type-Options', 'nosniff'); // We set the mime type in each case, so we can afford to not rely on the browser's sniffing methods. The reason not to let it sniff files is that since user uploads are possible, we don't want people to craft malicious files (for instance, HTML) that are technically valid image or audio files that get converted properly without being modified.
    response.setHeader('X-XSS-Protection', '1; mode=block'); // XSS is a serious issue that needs to be tackled since users input values, even if they are technically sanitized. We let the browser block rendering as that sets a red flag to the end user that something is wrong.
    response.setHeader('X-Frame-Options', 'deny'); // We don't use i-frames at all, so we don't need to use sameorigin.
    response.setHeader('Content-Security-Policy', 'default-src \'self\';'); // Feel free to change the CSP if you actually need to move assets to a different server for instance. However, beware of possible loopholes in your setup.
    // response.setHeader('Strict-Transport-Security', 'max-age=31536000'); // TODO: Uncomment this when you are on your real server and you are sure you can serve HTTPS without issues
    response.setHeader('Content-Type', 'text/plain; charset=utf-8'); // This will be changed by the different parts if necessary. However, setting it now allows us to remove it from every error clause.
    let url = newURL(request.url);
    if (url === null) { 
        console.log("[Request (Music)] Invalid URL:", request.url);
        bodylessResponse(badRequest, '', response);
        return;
    }
    
    // The URL is a mutable object, so if we want to log it we have to do it here
    console.log("[Request (Music)] Method:", request.method);
    console.log("[Request (Music)] Processed URL:", url);
    console.log("[Request (Music)] Headers:", request.headers);
    
    switch (url.paths[0]) {
        case 'html': // This is the root
            url.shift();
        case '':
            await html.handle(url, request, response);
            break;
        case 'assets':
            url.shift();
            await assets.handle(url, request, response);
            break;
        case 'api':
            url.shift();
            await api.handle(url, request, response); // We redirect the request to the API
            break;
        default:
            bodylessResponse(notFound, '', response);
    }
}

testAll();

