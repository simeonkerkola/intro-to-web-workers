"use strict";

importScripts("/js/external/idb-keyval-iife.min.js");

// Making sure the sw gets updated after changes
const version = 9;
let isOnline = false;
let isLoggedIn = false;
const cacheName = `ramblings-${version}`;
let allPostsCaching = false;

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
  return cacheAllPosts();
}

async function onInstall() {
  console.log(`Service worker (v ${version}) is installed.`);
  self.skipWaiting();
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

  // spin off background caching of all past posts (over time)
  cacheAllPosts(/*forceReload=*/ true).catch(console.error);
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

async function cacheAllPosts(forceReload = true) {
  // is already caching posts?
  if (allPostsCaching) return;
  allPostsCaching = true;
  await delay(5000);

  const cache = await caches.open(cacheName);
  let postIDs;

  try {
    if (isOnline) {
      let fetchOptions = {
        method: "GET",
        cache: "no-store",
        credentials: "omit"
      };
      let res = await fetch("/api/get-posts", fetchOptions);
      if (res && res.ok) {
        await cache.put("/api/get-posts", res.clone());
        postIDs = await res.json();
      }
    } else {
      let res = await cache.match("/api/get-posts");
      if (res) {
        let resCopy = res.clone();
        postIDs = await res.json();
      }
      // caching not started yet, try to start again later
      else {
        allPostsCaching = false;
        return cacheAllPosts(forceReload);
      }
    }
  } catch (err) {
    console.error(err);
  }
  if (postIDs && postIDs.length) {
    return cachePost(postIDs.shift());
  } else {
    allPostsCaching = false;
  }
  // **************************
  async function cachePost(postID) {
    const postURL = `/post/${postID}`;
    let needCaching = true;

    if (forceReload) {
      let res = await cache.match(postURL);
      if (res) {
        needCaching = false;
      }
    }
    if (needCaching) {
      await delay(10000);
      if (isOnline) {
        try {
          let fetchOptions = {
            method: "GET",
            cache: "no-store",
            credentials: "omit"
          };
          let res = await fetch(postURL, fetchOptions);
          if (res && res.ok) {
            await cache.put(postURL, res.clone());
            needCaching = false;
          }
        } catch (err) {}

        // Failed, try caching this post again?
        if (needCaching) return cachePost(postID);
      }
    }

    // any more posts to cache?
    if (postIDs.length) return cachePost(postIDs.shift());
    else allPostsCaching = false;
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
    // are we making an API request?
    if (/^\/api\/.+$/.test(reqURL)) {
      let fetchOptions = {
        credentials: "same-origin",
        cache: "no-store"
      };

      // We only want to cache the GET requests
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ false,
        /*checkCacheFirst=*/ false,
        /*checkCacheLast=*/ true,
        /*useRequestDirectly=*/ true
      );
      if (res) {
        if (req.method == "GET") {
          // response can only be used once, so we need to clone it to the cache, and return the original
          await cache.put(reqURL, res.clone());
        }
        // clear offline backup of succesful post?
        else if (reqURL == "/api/add-post") {
          await idbKeyval.del("add-post-backup");
        }
        return res;
      }

      return notFoundResponse();
    }
    // are we requesting a page?
    else if (req.headers.get("Accept").includes("text/html")) {
      // login-aware requests?
      if (/^\/(?:login|logout|add-post)$/.test(reqURL)) {
        let res;

        if (reqURL == "/login") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store",
              redirect: "manual"
            };
            res = await safeRequest(reqURL, req, fetchOptions);
            if (res) {
              if (res.type == "opaqueredirect") {
                return Response.redirect("/add-post", 307);
              }
              return res;
            }
            if (isLoggedIn) {
              return Response.redirect("/add-post", 307);
            }
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            return Response.redirect("/add-post", 307);
          } else {
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          }
        } else if (reqURL == "/logout") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store",
              redirect: "manual"
            };
            res = await safeRequest(reqURL, req, fetchOptions);
            if (res) {
              if (res.type == "opaqueredirect") {
                return Response.redirect("/", 307);
              }
              return res;
            }
            if (isLoggedIn) {
              isLoggedIn = false;
              await sendMessage("force-logout");
              await delay(100);
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            isLoggedIn = false;
            await sendMessage("force-logout");
            await delay(100);
            return Response.redirect("/", 307);
          } else {
            return Response.redirect("/", 307);
          }
        } else if (reqURL == "/add-post") {
          if (isOnline) {
            let fetchOptions = {
              method: req.method,
              headers: req.headers,
              credentials: "same-origin",
              cache: "no-store"
            };
            res = await safeRequest(
              reqURL,
              req,
              fetchOptions,
              /*cacheResponse=*/ true
            );
            if (res) {
              return res;
            }
            res = await cache.match(isLoggedIn ? "/add-post" : "/login");
            if (res) {
              return res;
            }
            return Response.redirect("/", 307);
          } else if (isLoggedIn) {
            res = await cache.match("/add-post");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          } else {
            res = await cache.match("/login");
            if (res) {
              return res;
            }
            return cache.match("/offline");
          }
        }
      }
      // otherwise, just use "network-and-cache"
      else {
        let fetchOptions = {
          method: req.method,
          headers: req.headers,
          cache: "no-store"
        };
        let res = await safeRequest(
          reqURL,
          req,
          fetchOptions,
          /*cacheResponse=*/ false,
          /*checkCacheFirst=*/ false,
          /*checkCacheLast=*/ true
        );
        if (res) {
          if (!res.headers.get("X-Not-Found")) {
            await cache.put(reqURL, res.clone());
          }
          return res;
        }

        // otherwise, return an offline-friendly page
        return cache.match("/offline");
      }
    }
    // all other files use "cache-first"
    else {
      let fetchOptions = {
        method: req.method,
        headers: req.headers,
        cache: "no-store"
      };
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ true,
        /*checkCacheFirst=*/ true
      );
      if (res) {
        return res;
      }

      // otherwise, force a network-level 404 response
      return notFoundResponse();
    }
  }
}

async function safeRequest(
  reqURL,
  req,
  options,
  cacheResponse = false,
  checkCacheFirst = false,
  checkCacheLast = false,
  useRequestDirectly = false
) {
  var cache = await caches.open(cacheName);
  var res;
  if (checkCacheFirst) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }

  if (isOnline) {
    try {
      if (useRequestDirectly) {
        res = await fetch(req, options);
      } else {
        res = await fetch(req.url, options);
      }

      // Handle redirects from the server
      if (res && (res.ok || res.type == "opaqueredirect")) {
        if (cacheResponse) {
          await cache.put(reqURL, res.clone());
        }
        return res;
      }
    } catch (err) {}
  }

  if (checkCacheLast) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }
}

function notFoundResponse() {
  return new Response("", {
    status: 404,
    statusText: "Not Found"
  });
}

function delay(ms) {
  return new Promise(function c(res) {
    setTimeout(res, ms);
  });
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
