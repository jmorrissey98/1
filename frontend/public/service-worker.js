// Service Worker for My Coach Developer PWA
// Handles offline caching and background sync

// IMPORTANT: Update this version number on every deployment to bust caches
const SW_VERSION = 'v2024022415'; // Format: vYYYYMMDDHH
const CACHE_NAME = `mcd-cache-${SW_VERSION}`;
const DYNAMIC_CACHE = `mcd-dynamic-${SW_VERSION}`;

// Static assets to cache on install (DO NOT include index.html - must always be fresh)
const STATIC_ASSETS = [
  '/manifest.json',
  '/mcd-favicon-32.png',
  '/mcd-icon-192.png',
  '/mcd-icon-384.png',
  '/mcd-icon-512.png',
  '/mcd-logo.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing service worker...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW ${SW_VERSION}] Caching static assets`);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log(`[SW ${SW_VERSION}] Skip waiting to activate immediately`);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean ALL old caches aggressively
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating service worker...`);
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
            .map((key) => {
              console.log(`[SW ${SW_VERSION}] Deleting old cache:`, key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log(`[SW ${SW_VERSION}] Claiming all clients`);
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients to reload for the new version
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION });
          });
        });
      })
  );
});

// Fetch event - NETWORK FIRST for HTML, cache-first only for images/fonts
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip ALL API requests - let them go directly to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // ALWAYS use network-first for navigation requests (HTML pages)
  // This ensures users always get the latest index.html
  if (request.mode === 'navigate' || request.destination === 'document' || 
      url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML - always fetch fresh
          return response;
        })
        .catch(() => {
          // Only use cache as absolute last resort for offline
          console.log(`[SW ${SW_VERSION}] Network failed, trying cache for:`, url.pathname);
          return caches.match(request)
            .then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // For JS/CSS bundles with hashes, use cache-first (they're immutable)
  if (url.pathname.match(/\.(js|css)$/) && url.pathname.match(/\.[a-f0-9]{8}\./)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // For images and other static assets, use cache-first with background update
  if (request.destination === 'image' || request.destination === 'font' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          // Fetch in background to update cache
          const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          }).catch(() => null);

          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        })
    );
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request))
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
