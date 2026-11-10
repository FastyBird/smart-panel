// AU-0 spike: dark mode, phone read-only, sub-path hosting, screenshots.
// Usage: node modes.cjs [rootUrl] [ingressUrl] [relativeBaseUrl]
const L = require('./lib.cjs');
const { check, nodeSel, handleSel, center, graph, viewport, touchDrag, pinch, mouseDrag } = L;
const ROOT = process.argv[2] || 'http://localhost:3904/spike.html';
const INGRESS = process.argv[3] || 'http://localhost:3905/api/hassio_ingress/abc/spike.html';
const RELATIVE = process.argv[4] || 'http://localhost:3906/api/hassio_ingress/xyz/spike.html';
const OUT = __dirname;
const tablet = { ...L.devices['iPad Pro 11 landscape'], deviceScaleFactor: 2 }; delete tablet.defaultBrowserType;
const phone = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: L.devices['iPhone 13'].userAgent };

const probe = (page) => page.evaluate(() => {
	const resolve = (prop, value) => { const el = document.createElement('div'); el.style[prop] = value; document.body.appendChild(el); const v = getComputedStyle(el)[prop]; el.remove(); return v; };
	const cs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
	return {
		htmlDark: document.documentElement.classList.contains('dark'),
		actual: {
			canvasBg: cs('.automation-canvas', 'backgroundColor'),
			nodeBg: cs('.automation-node-card', 'backgroundColor'),
			nodeText: cs('.automation-node-card .el-text', 'color'),
			edge: cs('.vue-flow__edge[data-id="e1"] .vue-flow__edge-path', 'stroke'),
			edgeYes: cs('.vue-flow__edge[data-id="e2"] .vue-flow__edge-path', 'stroke'),
			arrow: (() => { const m = [...document.querySelectorAll('.vue-flow__arrowhead')].find((x) => x.id.includes('secondary')); return m ? getComputedStyle(m.querySelector('polyline')).fill : null; })(),
			arrowYes: (() => { const m = [...document.querySelectorAll('.vue-flow__arrowhead')].find((x) => x.id.includes('success')); return m ? getComputedStyle(m.querySelector('polyline')).fill : null; })(),
			markerRef: getComputedStyle(document.querySelector('.vue-flow__edge[data-id="e2"] .vue-flow__edge-path')).markerEnd,
			dots: cs('.vue-flow__background pattern circle', 'fill'),
			dotsAttr: document.querySelector('.vue-flow__background pattern circle')?.getAttribute('fill'),
			controlBg: cs('.vue-flow__controls-button', 'backgroundColor'),
			controlIcon: cs('.vue-flow__controls-button svg', 'fill'),
			handleBorder: cs('.vue-flow__handle', 'borderTopColor'),
		},
		expected: {
			canvasBg: resolve('backgroundColor', 'var(--el-bg-color-page)'),
			nodeBg: resolve('backgroundColor', 'var(--el-bg-color-overlay)'),
			nodeText: resolve('color', 'var(--el-text-color-regular)'),
			edge: resolve('color', 'var(--el-text-color-secondary)'),
			edgeYes: resolve('color', 'var(--el-color-success)'),
			arrow: resolve('color', 'var(--el-text-color-secondary)'),
			arrowYes: resolve('color', 'var(--el-color-success)'),
			dots: resolve('color', 'var(--el-border-color-darker)'),
			controlBg: resolve('backgroundColor', 'var(--el-bg-color-overlay)'),
			controlIcon: resolve('color', 'var(--el-text-color-regular)'),
			handleBorder: resolve('color', 'var(--el-bg-color-overlay)'),
		},
	};
});

(async () => {
	const browser = await L.chromium.launch();

	// ---- light vs dark
	const light = await L.open(browser, ROOT);
	const pl = await probe(light.page);
	await light.page.screenshot({ path: `${OUT}/01-desktop-light.png` });
	await light.page.locator(nodeSel('c1')).click();
	await light.page.waitForSelector('.el-drawer [data-test="node-form"]', { state: 'visible' });
	await light.page.waitForTimeout(500);
	await light.page.screenshot({ path: `${OUT}/01b-desktop-light-drawer.png` });
	check('L1 production build renders without console errors or failed requests', light.errors.length === 0 && light.failed.length === 0, JSON.stringify({ e: light.errors, f: light.failed }).slice(0, 300));
	await light.context.close();

	const dark = await L.open(browser, ROOT, {}, { dark: true });
	const pd = await probe(dark.page);
	const keys = Object.keys(pd.expected);
	const mismatches = keys.filter((k) => pd.actual[k] !== pd.expected[k]);
	check('K1 <html class="dark"> set by the admin useDarkMode composable', pd.htmlDark && !pl.htmlDark);
	check('K2 dark: canvas, node, edges, arrowheads, background dots, controls, handles resolve to the Element Plus dark variables', mismatches.length === 0, mismatches.length ? JSON.stringify(mismatches.map((k) => [k, pd.actual[k], pd.expected[k]])) : JSON.stringify(pd.actual));
	const lm = keys.filter((k) => pl.actual[k] !== pl.expected[k]);
	check('K3 light: same elements resolve to the light variables', lm.length === 0, lm.length ? JSON.stringify(lm.map((k) => [k, pl.actual[k], pl.expected[k]])) : '');
	const themed = keys.filter((k) => !['edgeYes', 'arrowYes'].includes(k)); // the admin's success colour is the same in both themes
	const changed = themed.filter((k) => pd.actual[k] !== pl.actual[k]);
	check('K4 every probed colour actually differs between light and dark', changed.length === themed.length, `unchanged: ${themed.filter((k) => !changed.includes(k)).join(',') || 'none'}`);
	console.log('INFO  marker reference on a yes-edge:', pd.actual.markerRef);
	console.log('INFO  background dot fill attribute written by the library:', pd.actual.dotsAttr, '(overridden by CSS)');
	await dark.page.screenshot({ path: `${OUT}/02-desktop-dark.png` });
	// runtime toggle without reload
	await dark.page.locator('[data-test="toggle-dark"]').click();
	await dark.page.waitForTimeout(500);
	const pt = await probe(dark.page);
	check('K5 runtime toggle dark -> light repaints the canvas without remount', !pt.htmlDark && pt.actual.canvasBg === pl.actual.canvasBg && pt.actual.edge === pl.actual.edge && pt.actual.dots === pl.actual.dots);
	await dark.page.locator('[data-test="toggle-dark"]').click();
	await dark.page.locator(nodeSel('c1')).click();
	await dark.page.waitForSelector('.el-drawer [data-test="node-form"]', { state: 'visible' });
	await dark.page.waitForTimeout(500);
	await dark.page.screenshot({ path: `${OUT}/02b-desktop-dark-drawer.png` });
	await dark.context.close();

	// ---- tablet screenshot
	const tab = await L.open(browser, ROOT, tablet);
	await tab.page.screenshot({ path: `${OUT}/03-tablet-landscape-light.png` });
	await tab.context.close();
	const tabDark = await L.open(browser, ROOT, tablet, { dark: true });
	await tabDark.page.screenshot({ path: `${OUT}/03b-tablet-landscape-dark.png` });
	await tabDark.context.close();

	// ---- phone read-only
	const ph = await L.open(browser, ROOT, phone);
	const page = ph.page;
	const g0 = await graph(page);
	check('RO1 375 px: read-only tag shown, palette + edit buttons hidden', (await page.locator('[data-test="readonly-tag"]').count()) === 1 && (await page.locator('[data-test="automation-palette"]').count()) === 0 && (await page.locator('[data-test="undo"]').count()) === 0);
	const fit = await page.evaluate(() => { const p = document.querySelector('.vue-flow__pane').getBoundingClientRect(); return [...document.querySelectorAll('.vue-flow__node')].every((n) => { const r = n.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom; }); });
	check('RO2 whole graph fitted into the 375 px viewport (fit-view-on-init)', fit, `zoom=${(await viewport(page)).zoom.toFixed(2)}`);
	await page.screenshot({ path: `${OUT}/04-phone-375-light.png` });
	const v0 = await viewport(page);
	const a3 = await center(page, nodeSel('a3'));
	await touchDrag(page, a3, { x: a3.x + 60, y: a3.y + 60 });
	const v1 = await viewport(page);
	check('RO3 touch-dragging a node does not move it', JSON.stringify(await graph(page)) === JSON.stringify(g0), `viewport moved instead: ${v1.x !== v0.x || v1.y !== v0.y}`);
	await touchDrag(page, await center(page, handleSel('c1', 'no')), await center(page, handleSel('a3', 'in')), 14);
	const c1 = await center(page, handleSel('a3', 'done')); await page.touchscreen.tap(c1.x, c1.y); await page.waitForTimeout(250);
	const c2 = await center(page, handleSel('a2', 'in')); await page.touchscreen.tap(c2.x, c2.y); await page.waitForTimeout(300);
	check('RO4 handles are not connectable (touch-drag and tap-tap)', (await graph(page)).edges.length === 5 && (await page.locator('.vue-flow__handle.connectable').count()) === 0);
	await page.locator(nodeSel('c1')).tap(); await page.waitForTimeout(300);
	const selectable = await page.locator('.vue-flow__node.selected').count();
	await page.keyboard.press('Delete'); await page.waitForTimeout(300);
	check('RO5 Delete key does nothing; no drawer opens', (await graph(page)).nodes.length === 7 && !(await page.locator('.el-drawer').isVisible()), `node still selectable for viewing: ${selectable === 1}`);
	const pane = await page.locator('.vue-flow__pane').boundingBox();
	const empty = { x: pane.x + pane.width * 0.5, y: pane.y + pane.height * 0.9 };
	const v2 = await viewport(page);
	await touchDrag(page, empty, { x: empty.x - 50, y: empty.y - 70 });
	const v3 = await viewport(page);
	check('RO6 pan still works', Math.abs(v3.x - v2.x + 50) < 15 && Math.abs(v3.y - v2.y + 70) < 15, `dx=${(v3.x - v2.x).toFixed(0)} dy=${(v3.y - v2.y).toFixed(0)}`);
	await pinch(page, { x: pane.x + pane.width / 2, y: pane.y + pane.height / 2 }, 60, 200);
	const v4 = await viewport(page);
	check('RO7 pinch zoom still works', v4.zoom > v3.zoom * 1.1, `${v3.zoom.toFixed(2)} -> ${v4.zoom.toFixed(2)}`);
	await page.locator('.vue-flow__controls-fitview').tap(); await page.waitForTimeout(500);
	check('RO8 graph JSON unchanged after all read-only interactions', JSON.stringify(await graph(page)) === JSON.stringify(g0));
	await page.screenshot({ path: `${OUT}/04b-phone-375-light-zoomed.png` });
	await ph.context.close();
	const phDark = await L.open(browser, ROOT, phone, { dark: true });
	await phDark.page.screenshot({ path: `${OUT}/04c-phone-375-dark.png` });
	await phDark.context.close();

	// read-only with a mouse at desktop width (prop only, no breakpoint)
	const ro = await L.open(browser, `${ROOT}?readonly=1`);
	const r0 = await graph(ro.page);
	const n = await center(ro.page, nodeSel('a3'));
	await mouseDrag(ro.page, n, { x: n.x + 80, y: n.y + 40 });
	await mouseDrag(ro.page, await center(ro.page, handleSel('c1', 'no')), await center(ro.page, handleSel('a3', 'in')));
	const rv0 = await viewport(ro.page);
	await ro.page.mouse.wheel(0, -300); await ro.page.waitForTimeout(400);
	check('RO9 read-only prop with mouse: no drag, no connect, wheel zoom works', JSON.stringify(await graph(ro.page)) === JSON.stringify(r0) && (await viewport(ro.page)).zoom > rv0.zoom);
	await ro.context.close();

	// ---- sub-path hosting
	for (const [label, url] of [['absolute base /api/hassio_ingress/abc/', INGRESS], ['relative base ./ under /api/hassio_ingress/xyz/', RELATIVE]]) {
		const s = await L.open(browser, url);
		const requests = await s.page.evaluate(() => performance.getEntriesByType('resource').filter((r) => new URL(r.name).host === location.host).map((r) => new URL(r.name).pathname));
		const p = await probe(s.page);
		const vfCss = await s.page.evaluate(() => ({ pos: getComputedStyle(document.querySelector('.vue-flow__pane')).position, nodePos: getComputedStyle(document.querySelector('.vue-flow__node')).position, ctl: getComputedStyle(document.querySelector('.vue-flow__controls-button')).display }));
		check(`S1 sub-path (${label}): canvas renders, library CSS applied, all assets under the prefix`, (await s.page.locator('.vue-flow__node').count()) === 7 && (await s.page.locator('.vue-flow__edge').count()) === 5 && vfCss.pos === 'absolute' && vfCss.nodePos === 'absolute' && s.failed.length === 0 && s.errors.length === 0 && requests.every((r) => r.startsWith('/api/hassio_ingress/')) && p.actual.canvasBg === p.expected.canvasBg, `assets: ${requests.join(' ')}`);
		const a = await center(s.page, nodeSel('a3'));
		await mouseDrag(s.page, a, { x: a.x + 80, y: a.y + 40 });
		await mouseDrag(s.page, await center(s.page, handleSel('c1', 'no')), await center(s.page, handleSel('a3', 'in')));
		check(`S2 sub-path (${label}): drag + connect work`, (await graph(s.page)).edges.length === 6);
		if (url === INGRESS) await s.page.screenshot({ path: `${OUT}/05-ingress-subpath.png` });
		await s.context.close();
	}

	await browser.close();
	const failedChecks = L.results.filter((r) => !r.ok);
	console.log(`\n${L.results.length - failedChecks.length}/${L.results.length} passed`);
	process.exit(failedChecks.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
