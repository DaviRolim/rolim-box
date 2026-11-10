/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * RolimBox service worker: makes the installed app open and work without a connection.
 *
 *  - Every built file (JS, CSS, fonts) and every static file (icons, voice cues) is stored at
 *    install time, so all screens are available offline, not only the ones already visited.
 *  - The HTML of app pages is stored as it is visited. Offline, a page opens from that copy;
 *    a page never visited falls back to Today, and the app navigates on from there.
 *  - API calls are never stored here. WoDs and PRs live in IndexedDB (see $lib/db/indexeddb.ts).
 */
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const ASSETS = `rolimbox-assets-${version}`;
const PAGES = `rolimbox-pages-${version}`;
const SHELL = '/dashboard';

const precache = [...build, ...files].filter((path) => !path.endsWith('-bkp.mp3'));
const precached = new Set(precache);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(ASSETS);
			const audio = precache.filter((path) => path.startsWith('/audio/'));
			const critical = precache.filter((path) => !path.startsWith('/audio/'));
			await cache.addAll(critical);
			// Voice cues are nice to have: one missing file must not block the install.
			await Promise.all(audio.map((path) => cache.add(path).catch(() => {})));
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== ASSETS && key !== PAGES) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

function isAppPage(response: Response): boolean {
	if (!response.ok || response.redirected) return false;
	if (!(response.headers.get('content-type') ?? '').includes('text/html')) return false;
	const path = new URL(response.url).pathname;
	return !['/login', '/register', '/logout'].includes(path) && !path.startsWith('/join/');
}

async function storePage(request: Request | string, response: Response): Promise<void> {
	if (!isAppPage(response)) return;
	const cache = await caches.open(PAGES);
	await cache.put(request, response.clone());
}

async function navigate(request: Request): Promise<Response> {
	try {
		const response = await fetch(request);
		void storePage(request, response).catch(() => {});
		return response;
	} catch {
		const cache = await caches.open(PAGES);
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;

		const url = new URL(request.url);
		if (url.pathname !== SHELL && (await cache.match(SHELL))) {
			return Response.redirect(SHELL, 302);
		}
		return new Response(OFFLINE_PAGE, {
			status: 503,
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		});
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	if (precached.has(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(ASSETS);
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
				const response = await fetch(request);
				if (response.ok) void cache.put(url.pathname, response.clone());
				return response;
			})()
		);
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(navigate(request));
	}
});

// The app asks for Today to be stored right after sign-in, so the very first offline open works.
sw.addEventListener('message', (event) => {
	const data = event.data as { type?: string } | null;
	if (data?.type !== 'warm') return;
	event.waitUntil(
		fetch(SHELL, { credentials: 'include' })
			.then((response) => storePage(SHELL, response))
			.catch(() => {})
	);
});

// The service worker cannot see the language cookie, but the page it serves can: both texts
// are in the page and a tiny script picks the saved one (English unless PT was chosen).
// "Sem sinal." is the app's voice and stays Portuguese in both.
const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline - RolimBox</title>
<script>
	try {
		var m = document.cookie.match(/(?:^|;\\s*)rolimbox-lang=([^;]*)/);
		var lang = (m && m[1]) || localStorage.getItem('rolimbox:lang');
		if (lang === 'pt') {
			document.documentElement.lang = 'pt-BR';
			document.title = 'Sem internet - RolimBox';
		}
	} catch (e) {}
</script>
<style>
	body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-end;
		background: #0c0c0d; color: #f3efe6; font: 500 18px/1.4 system-ui, sans-serif; }
	main { padding: 24px; border-top: 12px solid #ffc400; }
	h1 { margin: 0 0 12px; font: 900 56px/0.9 Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; }
	p { margin: 0 0 24px; color: #c4c0b6; max-width: 32ch; }
	a { display: block; padding: 20px; background: #ff2e93; color: #0c0c0d; font-weight: 800;
		text-align: center; text-transform: uppercase; text-decoration: none; }
	html[lang='pt-BR'] [lang='en'], html:not([lang='pt-BR']) [lang='pt-BR'] { display: none; }
</style>
</head>
<body>
<main>
	<h1>Sem sinal.</h1>
	<p lang="en">RolimBox has not been opened on this phone with a connection yet, so there is nothing saved to show. Connect once and it will work offline afterwards.</p>
	<p lang="pt-BR">O RolimBox ainda não foi aberto neste celular com internet, então não tem nada salvo pra mostrar. Conecta uma vez e depois ele funciona offline.</p>
	<a href="/dashboard"><span lang="en">Try again</span><span lang="pt-BR">Tentar de novo</span></a>
</main>
</body>
</html>`;
