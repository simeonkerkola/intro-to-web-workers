"use strict";

// Making sure the sw gets updated after changes
const version = 1;
let isOnline = false;
let isLoggedIn = false;
const cacheName = `ramblings-${version}`;

const urlsToCache = {
  loggedOut: [
    "/",
    "/about",
    "/contact",
    "/404",
    "/login",
    "/offline",
    "js/blog.js",
    "js/home.js",
    "js/login.js",
    "js/add-post.js",
    "/css/styles.css",
    "/images/logo.gif",
    "/images/offline.png"
  ]
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);

main().catch(console.error);

// *********************************

async function main() {
  await sendMessage({ requestStatusUpdate: true });
}

async function onInstall() {
  console.log(`Service worker (${version}) is installed.`);
  self.skipWaiting();
}

async function sendMessage(msg) {
  // list of service worker Client objects (each is a promise)
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  return Promise.all(
    allClients.map(client => {
      // Make a message channel
      const chan = new MessageChannel();
      // Listen for messages on port1
      chan.port1.onmessage = onMessage;

      // Send the message to port2
      return client.postMessage(msg, [chan.port2]);
    })
  );
}

function onMessage({ data }) {
  if (data.statusUpdate) {
    // destructure and assign to the variables defined on the top
    ({ isLoggedIn, isOnline } = data.statusUpdate);
    console.log("Service worker status update", {
      isOnline,
      isLoggedIn,
      version
    });
  }
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
