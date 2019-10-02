(function Blog() {
  "use strict";

  let offlineIcon;
  let isOnline = "onLine" in navigator ? navigator.onLine : true;
  let isLoggedIn = /isLoggedIn=1/.test(document.cookie.toString() || "");
  const usingSW = "serviceWorker" in navigator;
  let swRegistration;
  let svcworker;

  initServiceWorker().catch(console.error);
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
    if (data.requestStatusUpdates) {
      const port = e.ports && evt.ports[0];
      console.log("Received status update!");
      sendStatusUpdate(port);
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

    window.addEventListener("online", function online() {
      offlineIcon.classList.add("hidden");
      sendStatusUpdate();
      console.log("online");
      isOnline = true;
    });

    window.addEventListener("offline", function offline() {
      offlineIcon.classList.remove("hidden");
      sendStatusUpdate();
      console.log("offline");
      isOnline = false;
    });
  }
})();
