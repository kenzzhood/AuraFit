const cacheName = "aurafit-store-v1";
const precache = ["/", "/kiosk", "/catalog/blue-kurta.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precache)));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => response))
  );
});
