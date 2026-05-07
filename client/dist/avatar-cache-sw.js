const AVATAR_CACHE_NAME = "holobox-avatar-videos-v1";
const CACHE_AVATAR_VIDEOS = "CACHE_AVATAR_VIDEOS";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      deleteOldAvatarCaches(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== CACHE_AVATAR_VIDEOS || !Array.isArray(event.data.urls)) {
    return;
  }

  event.waitUntil(cacheAvatarVideos(event.data.urls));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isAvatarVideoRequest(request) || request.headers.has("range")) {
    return;
  }

  event.respondWith(networkFirst(request));
});

function isAvatarVideoRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);
  return request.destination === "video" || url.pathname.endsWith(".mp4");
}

async function cacheAvatarVideos(urls) {
  const cache = await caches.open(AVATAR_CACHE_NAME);

  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok && response.status === 200) {
        await cache.put(url, response.clone());
      }
    }),
  );
}

async function networkFirst(request) {
  const cache = await caches.open(AVATAR_CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok && response.status === 200) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function deleteOldAvatarCaches() {
  const cacheKeys = await caches.keys();
  const oldAvatarCaches = cacheKeys.filter(
    (key) => key.startsWith("holobox-avatar-videos-") && key !== AVATAR_CACHE_NAME,
  );

  await Promise.all(oldAvatarCaches.map((key) => caches.delete(key)));
}
