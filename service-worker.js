const CACHE_NAME = "virtual-cube-timer-v7";
const BASE_PATH = "/virtual-cube/";

const CACHE_URLS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}style.css`,
  `${BASE_PATH}cube.js`,
  `${BASE_PATH}scramble.js`,
  `${BASE_PATH}timer.js`,
  `${BASE_PATH}script.js`,
  `${BASE_PATH}firebase-config.js`,
  `${BASE_PATH}online.js`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icon.svg`,
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(CACHE_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isFirebase = requestUrl.hostname.includes("firebase") ||
    requestUrl.hostname.includes("googleapis") ||
    requestUrl.hostname.includes("gstatic");

  if (isFirebase && !requestUrl.href.includes("firebasejs")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          const copy = response.clone();

          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }

          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match(`${BASE_PATH}index.html`);
          }

          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
