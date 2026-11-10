// AU-0 spike: touch-emulating tablet context. Usage: node touch.cjs [baseUrl]
const L = require('./lib.cjs');
const { check, nodeSel, handleSel, center, graph, viewport, touchDrag, pinch } = L;
const BASE = process.argv[2] || 'http://localhost:3903/spike.html';
const sep = BASE.includes('?') ? '&' : '?';
const tablet = { ...L.devices['iPad Pro 11 landscape'], deviceScaleFactor: 2 };
delete tablet.defaultBrowserType;

(async () => {
	const browser = await L.chromium.launch();
	const { page, errors, context } = await L.open(browser, BASE, tablet);
	const env = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, touch: 'ontouchstart' in window, points: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches }));
	console.log('INFO  context', JSON.stringify(env));
	check('T0 tablet context has touch and is editable (>= md)', env.touch && (await page.locator('[data-test="readonly-tag"]').count()) === 0);
	const pane = await page.locator('.vue-flow__pane').boundingBox();
	const empty = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.9 };
	const g0 = await graph(page);

	// pan + pinch
	const v0 = await viewport(page);
	await touchDrag(page, empty, { x: empty.x - 80, y: empty.y - 50 });
	const v1 = await viewport(page);
	check('T1 one-finger pan on the pane', Math.abs(v1.x - v0.x + 80) < 15 && Math.abs(v1.y - v0.y + 50) < 15, `dx=${(v1.x - v0.x).toFixed(0)} dy=${(v1.y - v0.y).toFixed(0)}`);
	await pinch(page, empty, 80, 220);
	const v2 = await viewport(page);
	check('T2 two-finger pinch zoom', v2.zoom > v1.zoom * 1.1, `${v1.zoom.toFixed(2)} -> ${v2.zoom.toFixed(2)}`);
	await page.locator('.vue-flow__controls-fitview').tap();
	await page.waitForTimeout(600);
	check('T2b Controls buttons respond to tap', Math.abs((await viewport(page)).zoom - v0.zoom) < 0.02);

	// drag node
	const zoom = (await viewport(page)).zoom;
	const a3 = await center(page, nodeSel('a3'));
	await touchDrag(page, a3, { x: a3.x + 90, y: a3.y + 50 });
	const p0 = g0.nodes.find((n) => n.id === 'a3').position;
	const p1 = (await graph(page)).nodes.find((n) => n.id === 'a3').position;
	check('T3 touch-drag a node', Math.abs(p1.x - p0.x - 90 / zoom) < 20 && Math.abs(p1.y - p0.y - 50 / zoom) < 20, `(${p0.x},${p0.y}) -> (${p1.x},${p1.y}) at zoom ${zoom.toFixed(2)}`);
	const drawerAfterDrag = await page.locator('.el-drawer').isVisible();
	console.log(`INFO  drawer open after touch-drag (drag selects the node): ${drawerAfterDrag}`);
	await page.touchscreen.tap(empty.x, empty.y);
	await page.waitForTimeout(400);

	// connect by touch drag
	const hs = await page.locator(handleSel('c1', 'no')).boundingBox();
	console.log(`INFO  handle box on tablet: ${hs.width.toFixed(1)}x${hs.height.toFixed(1)} css px (hit area enlarged by ::after to ~${(hs.width + 24 * zoom).toFixed(0)} px)`);
	await touchDrag(page, await center(page, handleSel('c1', 'no')), await center(page, handleSel('a3', 'in')), 16);
	const g2 = await graph(page);
	const dragEdge = g2.edges.some((e) => e.source === 'c1' && e.source_port === 'no' && e.target === 'a3');
	check('T4 connect by touch-dragging handle -> handle', dragEdge, `edges=${g2.edges.length}`);

	// connect by tap-tap (connectOnClick = true, the library default)
	await page.touchscreen.tap(...Object.values(await center(page, handleSel('a3', 'done'))));
	await page.waitForTimeout(250);
	const pending = await page.locator('.vue-flow__handle.connecting').count();
	await page.touchscreen.tap(...Object.values(await center(page, handleSel('a2', 'in'))));
	await page.waitForTimeout(400);
	const g3 = await graph(page);
	check('T5 connect by tap source handle, then tap target handle (connect-on-click)', g3.edges.some((e) => e.source === 'a3' && e.source_port === 'done' && e.target === 'a2'), `edges=${g3.edges.length}, handle marked "connecting" after first tap=${pending}`);

	// invalid by touch
	const before = (await graph(page)).edges.length;
	await touchDrag(page, await center(page, handleSel('a1', 'done')), await center(page, handleSel('c1', 'in')), 16);
	const st = (await page.locator('[data-test="status"]').textContent()).trim().replace(/\s+/g, ' ');
	check('T6 cycle rejected on touch-drag', (await graph(page)).edges.length === before && /rejected: cycle/.test(st), st);
	await page.touchscreen.tap(...Object.values(await center(page, handleSel('a2', 'done'))));
	await page.waitForTimeout(250);
	await page.touchscreen.tap(...Object.values(await center(page, handleSel('c1', 'in'))));
	await page.waitForTimeout(400);
	const st2 = (await page.locator('[data-test="status"]').textContent()).trim().replace(/\s+/g, ' ');
	check('T7 cycle rejected on tap-tap connect', (await graph(page)).edges.length === before, st2);

	// select -> drawer -> edit
	await page.touchscreen.tap(empty.x, empty.y);
	await page.waitForTimeout(300);
	await page.locator(nodeSel('t2')).tap();
	await page.waitForSelector('.el-drawer [data-test="node-form"]', { state: 'visible' });
	await page.waitForTimeout(400);
	await page.locator('.el-drawer [data-test="field-for"] .el-input-number__increase').tap();
	await page.waitForTimeout(300);
	const sum = (await page.locator(`${nodeSel('t2')} [data-test="node-summary"]`).textContent()).trim();
	check('T8 tap node -> drawer -> el-input-number "+" updates summary', sum === 'Occupancy clear for 3 min', sum);
	await page.screenshot({ path: __dirname + '/tablet-drawer.png' });
	await page.locator('[data-test="delete-selected"]').tap();
	await page.waitForTimeout(400);
	check('T9 delete via toolbar button (no keyboard on a tablet)', !(await graph(page)).nodes.some((n) => n.id === 't2'));

	// palette
	const n0 = (await graph(page)).nodes.length;
	await touchDrag(page, await center(page, '[data-test-palette="flow.delay"]'), { x: pane.x + pane.width * 0.5, y: pane.y + pane.height * 0.8 }, 16);
	const n1 = (await graph(page)).nodes.length;
	console.log(`INFO  palette touch-drag (HTML5 drag & drop) added a node: ${n1 > n0}`);
	await page.locator('[data-test-palette="flow.delay"]').tap();
	await page.waitForTimeout(400);
	const n2 = (await graph(page)).nodes.length;
	check('T10 palette: tap adds a node (fallback for HTML5 drag & drop, which does not start from touch)', n2 === Math.max(n1, n0) + 1, `touch-drag added=${n1 - n0}, tap added=${n2 - n1}`);
	check('T11 no console errors', errors.length === 0, JSON.stringify(errors).slice(0, 400));
	await context.close();

	// connect-on-click disabled: tap-tap must not connect, drag still must
	const off = await L.open(browser, `${BASE}${sep}connectOnClick=0`, tablet);
	await off.page.touchscreen.tap(...Object.values(await center(off.page, handleSel('a3', 'done'))));
	await off.page.waitForTimeout(250);
	await off.page.touchscreen.tap(...Object.values(await center(off.page, handleSel('a2', 'in'))));
	await off.page.waitForTimeout(400);
	const tapOff = (await graph(off.page)).edges.length;
	await touchDrag(off.page, await center(off.page, handleSel('a3', 'done')), await center(off.page, handleSel('a2', 'in')), 16);
	const dragOff = (await graph(off.page)).edges.length;
	check('T12 with :connect-on-click="false": tap-tap does nothing, touch-drag still connects', tapOff === 5 && dragOff === 6, `after taps=${tapOff}, after drag=${dragOff}`);
	await off.context.close();

	await browser.close();
	const failedChecks = L.results.filter((r) => !r.ok);
	console.log(`\n${L.results.length - failedChecks.length}/${L.results.length} passed`);
	process.exit(failedChecks.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
