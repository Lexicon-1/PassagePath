const CACHE_NAME = "passage-path-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=unit1",
  "./app.js?v=g5app1",
  "./data/content.js?v=passagepath",
  "./data/selections.js?v=unit1",
  "./data/unit2-selections.js?v=unit2",
  "./data/unit3-selections.js?v=unit3",
  "./data/unit4-selections.js?v=unit4",
  "./data/unit5-selections.js?v=unit5",
  "./data/grade5-unit1-selections.js?v=g5u1",
  "./data/selection-unit-labels.js?v=unit-labels",
  "./data/grade5-unlock.js?v=g5unlock3",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
