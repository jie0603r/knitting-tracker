const CACHE_NAME = 'knitting-counter-v2'; // 升級為 v2 版本
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './config.js',
  './manifest.json'
];

// 1. 安裝 Service Worker 並快取新資源
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制讓新的 Service Worker 立即跳過等待並生效
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('PWA: 正在快取新版靜態資源 (v2)...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. 啟用新版並自動清除舊版快取 (v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('PWA: 清除過期舊快取:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // 讓新版 Service Worker 立即控制頁面
  );
});

// 3. 攔截網路請求，無網路時優先使用快取
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