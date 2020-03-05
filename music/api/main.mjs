let OK = 200, badRequest = 400, forbidden = 403, notFound = 404;

// Deal with a request.
export async function handle(url, request, response) {
    console.log('API !');
    console.log(url);
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

