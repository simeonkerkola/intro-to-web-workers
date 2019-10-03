"use strict";

// Making sure the sw gets updated after changes
const version = 6;
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
    "/css/style.css",
    "/images/logo.gif",
    "/images/offline.png"
  ]
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);
self.addEventListener("fetch", onFetch);

main().catch(console.error);

// *********************************

async function main() {
  await sendMessage({ requestStatusUpdate: true });
  await cacheLoggedOutFiles();
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

function onFetch(e) {
  e.respondWith(router(e.request));
}

async function router(req) {
  const url = new URL(req.url);
  const reqURL = url.pathname;
  const cache = await caches.open(cacheName);

  // Only cache the resources from our server
  if (url.origin == location.origin) {
    let res;
    try {
      let fetchOptions = {
        credentials: "omit",
        cache: "no-store",
        method: req.method,
        headers: req.headers
      };

      res = await fetch(reqURL, fetchOptions);
      if (res && res.ok) {
        // response can only be used once, so we need to clone it to the cache, and return the original
        await cache.put(reqURL, res.clone());
        return res;
      }
    } catch (err) {}

    // If request fails, ie. client offline, try to get it from the cache
    res = await cache.match(reqURL);
    if (res) return res.clone();
  }
  // TODO: Figure out CORS requests
}

function onActivate(e) {
  // Tell the browser not to shut us down, ie if the user leaves the site, while still activating
  e.waitUntil(handleActivation());
}
async function handleActivation() {
  await clearCaches();

  // Claim all the open clients (ie. multiple tabs of the site)
  await clients.claim();
  await cacheLoggedOutFiles(/* forceReload */ true);
  console.log(`Service worker (${version}) is activated.`);
}

async function clearCaches() {
  const cacheNames = await caches.keys();
  const oldNames = cacheNames.filter(name => {
    if (/^ramblings-\d+$/.test(name)) {
      let [, cacheVersion] = name.match(/^ramblings-(\d+)$/);

      cacheVersion = cacheVersion != null ? Number(cacheVersion) : cacheVersion;
      return cacheVersion > 0 && cacheVersion != version;
    }
  });

  return Promise.all(oldNames.map(cacheName => caches.delete(cacheName)));
}

async function cacheLoggedOutFiles(forceReload = false) {
  // caches = storage mechanism for Request / Response object
  const cache = await caches.open(cacheName);

  return Promise.all(
    urlsToCache.loggedOut.map(async url => {
      try {
        let res;
        if (!forceReload) {
          res = await cache.match(url);
          if (res) {
            return res;
          }
        }

        let fetchOptions = {
          method: "GET",
          cache: "no-cache", // Tell the browser not to cache this, we want fresh results
          credentials: "omit" // Strip off the cookies, since this is a logged out resourses
        };
        res = await fetch(url, fetchOptions);
        if (res.ok) {
          // If we were to put the response to the cache and return it to the browser,
          // res can only be used once, so we'd have to .clone() it to the cache, and the return the original.
          await cache.put(url, res);
        }
      } catch (err) {}
    })
  );
}
