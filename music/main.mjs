import * as HTTP from 'http';

import { newURL, bodylessResponse, bodyResponse } from './utils.mjs';
import { testAll } from './tests.mjs';

import * as html from './html/main.mjs';
import * as assets from './assets/main.mjs';
import * as api from './api/main.mjs';

const OK = 200, badRequest = 400, notFound = 404, methodNotAllowed = 405, notAcceptable = 406;

// Deal with a request.
export async function handle(request, response) {
    // Before anything, we check the URL to see if we should pass the request somewhere else.
    // TODO: Set mandatory headers
    response.setHeader('Content-Type', 'text/plain'); // This will be changed by the different parts if necessary. However, setting it now allows us to remove it from every error clause.
    let url = newURL(request.url);
    if (url === null) { 
        console.log("[Request (Music)] Invalid URL:", request.url);
        bodylessResponse(badRequest, '', response);
        return;
    }
    // Node already lowercases the header, as well as remove duplicate entries. Nothing to do in that regard
    
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

