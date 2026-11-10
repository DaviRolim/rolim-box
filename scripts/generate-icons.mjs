/**
 * Draw the app icons from the RolimBox mark (the same paths as src/lib/components/ui/Logo.svelte).
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes static/favicon.svg, static/favicon.png and static/icons/*.png. Uses the Chromium that
 * Playwright already installs for the e2e tests, so no image library is needed.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const PINK = '#ff2e93';
const INK = '#0c0c0d';
const HOUSE = 'M3 19 24 3l21 16v26H3z';
const R =
	'M14.5 40V19h11.2a6.6 6.6 0 0 1 2.6 12.7L33 40h-6.1l-4-7h-2.8v7zm5.6-16.2v4.6h5a2.3 2.3 0 0 0 0-4.6z';

/** `scale` is how much of the square the mark fills (maskable icons need a wide safe margin). */
function icon(scale) {
	const size = 48 * scale;
	const offset = (48 - size) / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
	<rect width="48" height="48" fill="${INK}"/>
	<g transform="translate(${offset} ${offset - 0.6 * scale}) scale(${scale})">
		<path d="${HOUSE}" fill="${PINK}"/>
		<path d="${R}" fill="${INK}" fill-rule="evenodd"/>
	</g>
</svg>`;
}

mkdirSync('static/icons', { recursive: true });
writeFileSync('static/favicon.svg', icon(0.8));

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(path, pixels, scale) {
	await page.setViewportSize({ width: pixels, height: pixels });
	await page.setContent(
		`<style>html,body{margin:0}svg{display:block;width:${pixels}px;height:${pixels}px}</style>${icon(scale)}`
	);
	await page.screenshot({ path });
	console.log(`wrote ${path}`);
}

await png('static/favicon.png', 64, 0.84);
await png('static/icons/icon-192.png', 192, 0.74);
await png('static/icons/icon-512.png', 512, 0.74);
await png('static/icons/icon-maskable-512.png', 512, 0.56);
await png('static/icons/apple-touch-icon.png', 180, 0.7);

await browser.close();
