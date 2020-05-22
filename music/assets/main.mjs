import { newMimeType, newAcceptHeader, bodylessResponse, bodyResponse, 
    bodylessStreamResponse, getToken, bodyStreamResponse, getRequestBody } from '../utils.mjs';
import { getAsset } from '../file_utils.mjs';


const OK = 200, notFound = 404, methodNotAllowed = 405, notAcceptable = 406, internalServerError = 500;

const known_assets = {
    'main.js': { url: "main.js", mime_type: "text/javascript" },
    'main.css': { url: "main.css", mime_type: "text/css" },
    'logo.svg': { url: "logo.svg", mime_type: "image/svg+xml" },
}

// Deals with a request.
export async function handle(url, request, response) {
    const acceptTypes = newAcceptHeader(request.headers['accept']);
    if (acceptTypes === null) { bodylessResponse(badRequest, '', response); return; }
    
    const method = request.headers[':method'];
    if (method !== 'HEAD' && method !== 'GET') { bodylessResponse(methodNotAllowed, '', response); }
    const token = await getToken(request);
    console.log(`[Request (Assets)] ${method} /${url.paths.join('/')}`);
    console.log('[Request (Assets)] URL Parameters: ', url.parameters);

    let currentRoutes = known_assets;
    let processed = false;
    while (!processed) {
        let path = url.shift();
        let result = currentRoutes[path];
        if (result !== undefined && result !== null) {
            if (result.url !== undefined && result.mime_type !== undefined) {
                // We recognize that this is the end of a route, but we still have to check if the URL ends here as well.
                // We could support having routes that corresponds to incomplete URL, however since this isn't necessary with this configuration
                // We could check directly the length of the array of the path and its first value. Since we won't be using this URL again, we can just read shift the array and see if it is empty
                if (url.shift() === '') { await streamAsset(result, method, acceptTypes, request, response); }
                else { bodylessResponse(notFound, '', response); }
                processed = true;
            } else { currentRoutes = result; } // The route is still incomplete. We can go on shifting the array, as the path will be empty if it reaches the end
        } else { bodylessResponse(notFound, '', response); processed = true; }
    }
}

async function streamAsset(asset, method, acceptTypes, request, response) {
    if (!acceptTypes.isAccepted(newMimeType(asset.mime_type))) { bodylessResponse(notAcceptable, '', response); }
    else {
        response.setHeader('Cache-Control', 'public, max-age=86400'); // The max-age should be changed after all the assets are finished. It doesn't even matter right now as navigators usually won't cache anything from a server with self-signed certificates
        const stream = await getAsset(asset);
        if (stream === null) { bodylessResponse(internalServerError, '', response); }
        else if (method === 'HEAD') { bodylessStreamResponse(OK, stream, response); }
        else { bodyStreamResponse(OK, stream, request, response); }
    }
}