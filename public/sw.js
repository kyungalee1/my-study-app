/* eslint-disable no-restricted-globals */
/** PWA 설치용 경량 서비스 워커 (Vercel 빌드 호환) */
const CACHE = 'study-app-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.open(CACHE).then(c => c.match(event.request))),
  );
});
