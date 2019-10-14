(function Blog(global) {
  "use strict";

  let offlineIcon;
  let isOnline = "onLine" in navigator && navigator.onLine;
  let isLoggedIn = /isLoggedIn=1/.test(document.cookie.toString() || "");
  const usingSW = "serviceWorker" in navigator;
  let swRegistration;
  let svcworker;

  if (usingSW) {
    initServiceWorker().catch(console.error);
  }

  function isBlogOnline() {
    return isOnline;
  }
  global.isBlogOnline = isBlogOnline;
  document.addEventListener("DOMContentLoaded", ready, false);

  // **********************************

  async function initServiceWorker() {
    // special handling for service-worker (virtual path) in server.js
    swRegistration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    });

    svcworker =
      swRegistration.installing ||
      swRegistration.waiting ||
      swRegistration.active;

    sendStatusUpdate(svcworker);

    // controllerchange, New service worker has taken control over the page
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      function onController() {
        svcworker = navigator.serviceWorker.controller;
        sendStatusUpdate(svcworker);
      }
    );

    navigator.serviceWorker.addEventListener("message", onSWMessage);
  }

  function onSWMessage(e) {
    const { data } = e;
    console.log({ data });
    if (data.requestStatusUpdates) {
      const port = e.ports && evt.ports[0];
      sendStatusUpdate(port);
    } else if (data == "force-logout") {
      document.cookie = "isLoggedIn=";
      isLoggedIn = false;
      sendStatusUpdate();
    }
  }

  function sendStatusUpdate(target) {
    sendSWMessage({ statusUpdate: { isOnline, isLoggedIn } }, target);
  }

  async function sendSWMessage(msg, target) {
    if (target) {
      target.postMessage(msg);
    } else if (svcworker) {
      svcworker.postMessage(msg);
    } else {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }

  function ready() {
    offlineIcon = document.getElementById("connectivity-status");

    if (!isOnline) {
      offlineIcon.classList.remove("hidden");
    }

    window.addEventListener(
      "online",
      function online() {
        offlineIcon.classList.add("hidden");
        console.log("online new2", navigator.onLine);
        isOnline = true;
        sendStatusUpdate();
      },
      false
    );

    window.addEventListener(
      "offline",
      function offline() {
        offlineIcon.classList.remove("hidden");
        console.log("offline new", navigator.onLine);
        isOnline = false;
        sendStatusUpdate();
      },
      false
    );
  }
})(window);
