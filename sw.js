const CACHE_NAME = 'knitting-counter-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './config.js',
  './manifest.json'
];

// 1. 安裝 Service Worker 並快取檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('PWA: 正在快取靜態資源...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. 攔截網路請求，無網路時優先使用快取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});