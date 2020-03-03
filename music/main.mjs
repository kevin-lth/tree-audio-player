import * as HTTP from 'http';

import { newURL } from './utils.mjs';
import { testAll } from './tests.mjs';

// Deal with a request.
export async function handle(request, response) {
  // Before anything, we check the URL to see if we should pass the request somewhere else.
  let url = newURL(request.url);
  
  
  console.log("Method:", request.method);
  console.log("URL:", request.url);
  console.log("Processed URL:", url);
  console.log("Headers:", request.headers);
  await reply(response);
}

// Send a reply.
async function reply(response) {
  let hdrs = { 'Content-Type': 'text/plain' };
  response.writeHead(200, hdrs);  // 200 = OK
  response.write("OK");
  response.end();
}

testAll();
