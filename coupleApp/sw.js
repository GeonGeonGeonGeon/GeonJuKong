const CACHE = 'geonjukong-shell-v4';
const SHELL = ['./', './index.html', './styles.css', './config.js', './src/app.js', './src/core.js', './src/storage.js', './src/backend.js', './src/google.js', './src/platform.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // 인증 응답, API, OAuth 콜백과 사용자의 파일은 캐시에 저장하지 않습니다.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !SHELL.some(item => new URL(item, self.registration.scope).pathname === url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); } return response; }).catch(() => caches.match(event.request)));
});
self.addEventListener('push', event => {
  // 외부 payload를 그대로 표시하지 않아 잠금 화면에 대화가 노출되지 않습니다.
  event.waitUntil(self.registration.showNotification('GeonJuKong', { body: '너에게 새로운 메시지가 도착했어요.', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'geonjukong-message' }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('./#chat', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(item => item.url.startsWith(self.registration.scope));
    if (client) { await client.navigate(target); await client.focus(); } else await self.clients.openWindow(target);
  }));
});
