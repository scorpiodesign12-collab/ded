/* Service worker: хранит саму страницу, чтобы сайт открывался без интернета.
   Видео тут НЕ кэшируются: они лежат в памяти сайта (IndexedDB), это делает index.html. */
const CACHE = 'grandpa-shell-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(self.registration.scope)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate') return; // только открытие страницы; видео и всё остальное идут как обычно
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(req, { ignoreSearch: true })) || (await cache.match(self.registration.scope));
    try {
      const net = fetch(req);
      // есть сохранённая копия и сеть тормозит: через 6 секунд открываем копию
      const res = cached
        ? await Promise.race([net, new Promise((_, no) => setTimeout(no, 6000))])
        : await net;
      if (res && res.ok) {
        cache.put(req.url.split('#')[0], res.clone()).catch(() => {});
        cache.put(self.registration.scope, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      if (cached) return cached;
      return new Response('Нет интернета', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
