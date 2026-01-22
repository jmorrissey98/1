// Service Worker for My Coach Developer PWA
// Handles offline caching and background sync

const CACHE_NAME = 'mcd-cache-v1';
const DYNAMIC_CACHE = 'mcd-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32x32.png',
  '/pwa-icon-192.png',
  '/pwa-icon-384.png',
  '/pwa-icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // API requests - network only, don't cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return offline response for API calls
        return new Response(
          JSON.stringify({ error: 'offline', message: 'You are offline' }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // For navigation requests (HTML pages), use network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache, then to offline page
          return caches.match(request)
            .then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // For static assets, use cache-first
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          // Return cached and update in background
          fetch(request).then((response) => {
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, response);
            });
          }).catch(() => {});
          return cached;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Cache valid responses
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline fallback for images
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#e2e8f0" width="100" height="100"/><text fill="#94a3b8" x="50" y="50" text-anchor="middle" dy=".3em">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Listen for sync events (for background sync)
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_NOW') {
    syncOfflineData().then(() => {
      // Notify all clients that sync is complete
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_COMPLETE' });
        });
      });
    });
  }
});

// Sync offline data function
async function syncOfflineData() {
  console.log('[SW] Starting offline data sync...');
  
  // Get the offline queue from IndexedDB or notify main thread
  // The actual sync logic is handled in the main app
  // This just triggers the sync process
  
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});
