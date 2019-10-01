(function Blog() {
  "use strict";

  let offlineIcon;
  let isOnline = "onLine" in navigator ? navigator.onLine : true;
  let isLoggedIn = /isLoggedIn=1/.test(document.cookie.toString() || "");
  const usingSW = "serviceWorker" in navigator;
  let swrRgistration;
  let svworker;

  initServiceWorker().catch(console.error);
  document.addEventListener("DOMContentLoaded", ready, false);

  // **********************************

  async function initServiceWorker() {
    swrRgistration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    });
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
