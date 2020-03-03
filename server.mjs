import * as music from './music/main.mjs';

// Start the server on this port
import * as HTTP from 'http';
start(8180);

// Provide a service to localhost only.
function start(port) {
  let service = HTTP.createServer(handle);
  service.listen(port, 'localhost');
  console.log("Visit localhost:" + port);
}

// Deal with a request by redirecting everything to the music module. This may be modified to only redirect to this module on a specific URL for instance
async function handle(request, response) {
  await music.handle(request, response);
}
