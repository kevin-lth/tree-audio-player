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
    
    let url = newURL(request.url);
    if (url === null) { 
        console.log("[Request (Music)] Invalid URL:", request.url);
        error(badRequest, response);
        return;
    }
    // Node already lowercases the header, as well as remove duplicate entries. Nothing to do in that regard
    
    // The URL is a mutable object, so if we want to log it we have to do it here
    console.log("[Request (Music)] Method:", request.method);
    console.log("[Request (Music)] Processed URL:", url);
    console.log("[Request (Music)] Headers:", request.headers);
    
    switch (url.paths[0]) {
        case '': // This is the root
            await html.handle(url, request, response);
            break;
        case 'assets':
            url.shift();
            await assets.handle(url, request, response);
        case 'api':
            url.shift();
            await api.handle(url, request, response); // We redirect the request to the API
            break;
        default:
            response.setHeader('Content-Type', 'text/plain');
            bodylessResponse(notFound, '', response);
    }
}

testAll();

