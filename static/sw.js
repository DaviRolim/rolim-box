const CACHE_NAME = 'rolimbox-v3';
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	// Audio files
	'/audio/voice/go.mp3',
	'/audio/voice/halfway.mp3',
	'/audio/voice/half-emom.mp3',
	'/audio/voice/one-minute.mp3',
	'/audio/voice/thirty-seconds.mp3',
	'/audio/voice/ten-seconds.mp3',
	'/audio/voice/time.mp3',
	'/audio/voice/next-round.mp3',
	'/audio/voice/work.mp3',
	'/audio/voice/rest.mp3'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((name) => caches.delete(name))
			);
		})
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') return;
	// Skip non-HTTP(S) schemes (e.g. chrome-extension://), which Cache API can't store
	const url = new URL(event.request.url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

	// Network-first for API and dynamic routes
	if (event.request.url.includes('/api/') ||
	    event.request.url.includes('/login') ||
	    event.request.url.includes('/register') ||
	    event.request.url.includes('/logout')) {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request))
		);
		return;
	}

	// Cache-first for static assets
	event.respondWith(
		caches.match(event.request).then((cached) => {
			return cached || fetch(event.request).then((response) => {
				// Cache successful responses
				if (response.status === 200) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				return response;
			});
		})
	);
});
