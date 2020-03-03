import * as HTTP from 'http';

import { newURL } from './utils.mjs';
import { testAll } from './tests.mjs';
import * as api from './api/main.mjs'

let OK = 200, badRequest = 400;

// Deal with a request.
export async function handle(request, response) {
    // Before anything, we check the URL to see if we should pass the request somewhere else.
    let url = newURL(request.url);
    if (url === null) { 
        error(badRequest, response);
        return;
    }
    if (url[0] === 'api') {
        // We redirect the request to the API
        // TODO
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
