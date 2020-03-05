let OK = 200, badRequest = 400, forbidden = 403, notFound = 404;

let routes = {
    account: {
        login: login,
        logout: logout
    },
    category: {
    },
    music: {
    }
};

// Deal with a request.
export async function handle(url, request, response) {
    let acceptTypes = request.headers['accept'];
    let method = request.headers[':method'];
    let session = ''; // TODO
    
    console.log(`[Request (API)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (API)] Parameters: ', url.parameters);
    
    let currentRoutes = routes;
    let processed = false;
    while (!processed) {
        let path = url.shift();
        let result = currentRoutes[path];
        if (result !== undefined && result !== null) {
            if (result instanceof Function) {
                // We recognize that this is the end of a route, but we still have to check if the URL ends here as well.
                // We could support having routes that corresponds to incomplete URL, however since this isn't necessary with this configuration

                // We could check directly the length of the array of the path and its first value. Since we won't be using this URL again, we can just read shift the array and see if it is empty
                if (url.shift() === '') { 
                    result(method, session, url.parameters, response);
                    processed = true;
                } else {
                    error(badRequest, response);
                    processed = true;
                }
            } else {
                // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
                currentRoutes = result;
            }
        } else {
            error(badRequest, response);
            processed = true;
        }
    }
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

function login(method, session, parameters, response) {
    console.log('login');
    ok(response);
}

function logout(method, session, parameters, response) {
    console.log('logout');
    ok(response);
}

