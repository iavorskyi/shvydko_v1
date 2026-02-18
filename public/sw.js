const CACHE_NAME = 'shvydkochytach-v2';
const STATIC_ASSETS = [
  '/',
  '/home',
  '/exercises',
  '/exercises/schulte',
  '/exercises/peripheral',
  '/exercises/rsvp',
  '/library',
  '/profile',
  '/settings',
  '/parent',
  '/auth/login',
  '/auth/register',
  '/onboarding',
  '/manifest.json',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  // Never cache API routes — they must always hit the server
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response and cache it
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline - try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return cached home page
          if (event.request.mode === 'navigate') {
            return caches.match('/home');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Listen for sync messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_PENDING') {
    // Notify all clients to process sync queue
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PROCESS_SYNC_QUEUE' });
      });
    });
  }
});
