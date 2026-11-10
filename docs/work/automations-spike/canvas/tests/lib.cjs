const { chromium, devices } = require('playwright');
const path = require('path');
const mdi = require(process.env.ICONIFY_MDI_JSON || '../../../../../apps/admin/node_modules/@iconify/json/json/mdi.json');

// The admin loads Iconify icons from the public API at runtime; serve them from the local @iconify/json so the run is offline.
async function routeIcons(context) {
	await context.route(/api\.(iconify\.design|simplesvg\.com|unisvg\.com)/, async (route) => {
		const url = new URL(route.request().url());
		const names = (url.searchParams.get('icons') || '').split(',');
		const icons = {};
		for (const n of names) if (mdi.icons[n]) icons[n] = mdi.icons[n];
		await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ prefix: 'mdi', icons, width: 24, height: 24 }) });
	});
}

async function open(browser, url, contextOptions = {}, { dark = false } = {}) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...contextOptions });
	await routeIcons(context);
	if (dark) await context.addInitScript(() => localStorage.setItem('fb-theme-appearance', 'dark'));
	else await context.addInitScript(() => localStorage.setItem('fb-theme-appearance', 'light'));
	const page = await context.newPage();
	const errors = [];
	page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
	page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
	const failed = [];
	page.on('requestfailed', (r) => failed.push(r.url()));
	page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
	await page.goto(url);
	await page.waitForSelector('.vue-flow__node', { timeout: 20000 });
	await page.waitForTimeout(800);
	return { context, page, errors, failed };
}

const results = [];
function check(name, ok, detail = '') {
	results.push({ name, ok: !!ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const nodeSel = (id) => `.vue-flow__node[data-id="${id}"]`;
const handleSel = (id, port) => `.vue-flow__node[data-id="${id}"] .vue-flow__handle[data-handleid="${port}"]`;
async function center(page, sel) {
	const b = await page.locator(sel).boundingBox();
	if (!b) throw new Error('no box for ' + sel);
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const graph = (page) => page.evaluate(() => window.__automationSpike.getGraph());
const canvasGraph = (page) => page.evaluate(() => window.__automationSpike.getCanvasGraph());
const viewport = (page) => page.evaluate(() => window.__automationSpike.getViewport());

async function mouseDrag(page, from, to, steps = 12) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 5, from.y + 5, { steps: 2 });
	await page.mouse.move(to.x, to.y, { steps });
	await page.waitForTimeout(80);
	await page.mouse.up();
	await page.waitForTimeout(250);
}

// Real touch events through CDP (Playwright's touchscreen API only taps).
async function touchDrag(page, from, to, steps = 12) {
	const cdp = await page.context().newCDPSession(page);
	const pt = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
	await page.waitForTimeout(60);
	for (let i = 1; i <= steps; i++) {
		const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(p) });
		await page.waitForTimeout(20);
	}
	await page.waitForTimeout(80);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await page.waitForTimeout(300);
	await cdp.detach();
}

async function pinch(page, c, startGap, endGap, steps = 10) {
	const cdp = await page.context().newCDPSession(page);
	const pts = (gap) => [
		{ x: Math.round(c.x - gap / 2), y: Math.round(c.y), id: 1 },
		{ x: Math.round(c.x + gap / 2), y: Math.round(c.y), id: 2 },
	];
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(startGap) });
	for (let i = 1; i <= steps; i++) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(startGap + ((endGap - startGap) * i) / steps) });
		await page.waitForTimeout(20);
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await page.waitForTimeout(300);
	await cdp.detach();
}

module.exports = { chromium, devices, open, check, results, nodeSel, handleSel, center, graph, canvasGraph, viewport, mouseDrag, touchDrag, pinch, routeIcons };
