"use strict";

// Making sure the sw gets updated after changes
const version = 1;

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);

main().catch(console.error);

// *********************************

async function main() {
  console.log(`Service worker (${version}) is starting...`);
}

async function onInstall() {
  console.log(`Service worker (${version}) is installed.`);
  self.skipWaiting();
}

function onActivate(e) {
  // Tell the browser not to shut us down, ie if the user leaves the site, while still activating
  e.waitUntil(handleActivation());
}
async function handleActivation() {
  // Claim all the open clients (ie. multiple tabs of the site)
  await clients.claim();
  console.log(`Service worker (${version}) is activated.`);
}
