import * as HTTP2 from 'http2';
import * as fs from 'fs';

import * as music from './music/main.mjs';

// Please replace both the key and the certificate with ones provided by a Certificate Authority if used on a production server
// Self-signed certificate are acceptable for development purposes only
const options = {
    // Synchronous file read is intentional here, as we cannot start the server without having both the key and the certificate
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
}

// Start the server on this port
start(8180, options);

// Provide a service to localhost only.
function start(port, options) {
    let service = HTTP2.createSecureServer(options, handle);
    service.listen(port, 'localhost');
    console.log("Server started at localhost:" + port);
}

// Deal with a request by redirecting everything to the music module. This may be modified to only redirect to this module on a specific URL for instance
async function handle(request, response) {
    // We add a few headers for every response for security purposes.
    // TODO
    await music.handle(request, response);
}
