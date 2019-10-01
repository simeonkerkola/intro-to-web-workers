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

    // controllerchange, New service worker has taken control over the page
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      function onController() {
        svcworker = navigator.serviceWorker.controller;
      }
    );
  }

  function ready() {
    offlineIcon = document.getElementById("connectivity-status");

    if (!isOnline) {
      offlineIcon.classList.remove("hidden");
    }

    window.addEventListener("online", function online() {
      offlineIcon.classList.add("hidden");
      isOnline = true;
    });

    window.addEventListener("offline", function offline() {
      offlineIcon.classList.remove("hidden");
      isOnline = false;
    });
  }
})();
