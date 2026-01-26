const CACHE_NAME = 'rolimbox-v6';
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png'
];

// Audio files cached separately (non-critical)
const AUDIO_ASSETS = [
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
		caches.open(CACHE_NAME).then(async (cache) => {
			// Cache critical assets first (must succeed)
			await cache.addAll(STATIC_ASSETS);
			// Cache audio assets individually (non-blocking, failures are ok)
			for (const asset of AUDIO_ASSETS) {
				try {
					await cache.add(asset);
				} catch (e) {
					console.warn('Failed to cache audio asset:', asset, e);
				}
			}
		})
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

	// Skip non-HTTP(S) schemes
	const url = new URL(event.request.url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

	// Handle navigation requests (opening the app)
	// Network-first for navigation to ensure fresh auth state
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Cache successful navigation responses
					if (response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
					}
					return response;
				})
				.catch(() => {
					// Only use cached version when offline
					return caches.match('/').then((cached) => {
						if (cached) return cached;
						return new Response('Offline', { status: 503 });
					});
				})
		);
		return;
	}

	// Network-first for API and auth routes
	if (url.pathname.startsWith('/api/') ||
	    url.pathname === '/login' ||
	    url.pathname === '/register' ||
	    url.pathname === '/logout') {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request))
		);
		return;
	}

	// Cache-first for SvelteKit immutable assets (hashed filenames)
	if (url.pathname.startsWith('/_app/')) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				if (cached) return cached;
				return fetch(event.request).then((response) => {
					if (response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	// Cache-first for static assets
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			return fetch(event.request).then((response) => {
				// Cache successful responses
				if (response.status === 200) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				return response;
			}).catch(() => {
				// Return cached root for HTML requests as fallback
				if (event.request.headers.get('accept')?.includes('text/html')) {
					return caches.match('/');
				}
				return new Response('Offline', { status: 503 });
			});
		})
	);
});
