import * as HTTP from 'http';

import { newURL } from './utils.mjs';
import { testAll } from './tests.mjs';
import * as api from './api/main.mjs'

let OK = 200, badRequest = 400, forbidden = 403, notFound = 404;

// Deal with a request.
export async function handle(request, response) {
    // Before anything, we check the URL to see if we should pass the request somewhere else.
    let url = newURL(request.url);
    if (url === null) { 
        error(badRequest, response);
        return;
    }
    // Node already lowercases the header, as well as remove duplicate. Nothing to do in that regard
    
    switch (url.paths[0]) {
        case '':
            // We know from URL validation that this HAS to be the last fragment of the URL if it is empty
            // In other words, the URL has to be '/'
            console.log('main');
            break;
        case 'api':
            // We redirect the request to the API
            // TODO
            console.log('api');
            break;
        default:
            error(notFound, response);
            return; // No break, as it is unaccessible anyway
    }
    console.log("[Request (Music)] Method:", request.method);
    console.log("[Request (Music)] URL:", request.url);
    console.log("[Request (Music)] Processed URL:", url);
    console.log("[Request (Music)] Headers:", request.headers);
    ok(response);
}

function error(errorCode, response) {
    let hdrs = { 'Content-Type': 'text/plain' };
    response.writeHead(errorCode, hdrs);
    response.write("Error " + errorCode);
    response.end();
}

// Send a reply.
function ok(response) {
    let hdrs = { 'Content-Type': 'text/plain' };
    response.writeHead(200, hdrs);  // 200 = OK
    response.write("OK");
    response.end();
}

testAll();
