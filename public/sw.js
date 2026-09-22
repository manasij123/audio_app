// Shruti service worker: caches the app shell so the app opens offline.
// Audio never goes through here — it is played from IndexedDB blobs via blob: URLs.
const CACHE = 'shruti-shell-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./', { cache: 'no-cache' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put('./', res);
      // Pre-cache the hashed bundles referenced by index.html.
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/?(?:assets\/[^"]+|[\w-]+\.png|manifest\.webmanifest))"/g)].map((m) => m[1]);
      await cache.addAll([...new Set([...assets, './logo.webp', './icon-192.png', './icon-512.png'])]);
      // Fonts are referenced from the stylesheet, not index.html.
      for (const css of assets.filter((a) => a.endsWith('.css'))) {
        const cssUrl = new URL(css, self.registration.scope);
        const text = await (await cache.match(css)).text();
        const fonts = [...text.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => new URL(m[1].replace(/["']/g, ''), cssUrl).href);
        await cache.addAll([...new Set(fonts)]);
      }
    })().then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Stale-while-revalidate for same-origin GETs; navigations fall back to the cached shell.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = req.mode === 'navigate' ? './' : req;
      const hit = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) {
        event.waitUntil(network);
        return hit;
      }
      return (await network) || Response.error();
    })(),
  );
});
