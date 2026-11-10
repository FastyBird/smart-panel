// AU-0 spike: desktop (mouse + keyboard) assertions. Usage: node desktop.cjs [baseUrl]
const L = require('./lib.cjs');
const { check, nodeSel, handleSel, center, graph, canvasGraph, viewport, mouseDrag } = L;
const BASE = process.argv[2] || 'http://localhost:3903/spike.html';
const sep = BASE.includes('?') ? '&' : '?';

(async () => {
	const browser = await L.chromium.launch();
	const { page, errors, failed, context } = await L.open(browser, BASE);

	// 1. rendering
	const g0 = await graph(page);
	check('R1 7 nodes / 5 edges rendered', (await page.locator('.vue-flow__node').count()) === 7 && (await page.locator('.vue-flow__edge').count()) === 5);
	check('R2 Element Plus el-tag + el-text + el-icon inside every node',
		(await page.locator('.vue-flow__node .el-tag').count()) === 7 && (await page.locator('.vue-flow__node .el-text').count()) === 7 && (await page.locator('.vue-flow__node .el-icon svg').count()) === 7,
		`icons=${await page.locator('.vue-flow__node .el-icon svg').count()}`);
	const summaries = await page.locator('[data-test="node-summary"]').allTextContents();
	check('R3 reference summaries', ['Occupancy becomes detected', 'Illuminance < 50 lx', 'Time is 22:00–06:00', 'Light on, brightness 20 %', 'Light on, brightness 100 %', 'Occupancy clear for 2 min', 'Light off'].every((s) => summaries.includes(s)));
	const handles = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.vue-flow__node')].map((n) => [n.dataset.id, [...n.querySelectorAll('.vue-flow__handle')].map((h) => `${h.classList.contains('source') ? 'S' : 'T'}:${h.dataset.handleid}`).join(',')])));
	check('R4 handles: trigger out only; condition in+yes/no; action in+done/error', handles.t1 === 'S:out' && handles.c1 === 'T:in,S:yes,S:no' && handles.a1 === 'T:in,S:done,S:error', JSON.stringify(handles));

	// 2. pan / zoom
	const pane = await page.locator('.vue-flow__pane').boundingBox();
	const empty = { x: pane.x + pane.width * 0.6, y: pane.y + pane.height * 0.85 };
	const v0 = await viewport(page);
	await mouseDrag(page, empty, { x: empty.x - 60, y: empty.y - 40 });
	const v1 = await viewport(page);
	check('P1 pan by dragging the pane', Math.abs(v1.x - v0.x + 60) < 12 && Math.abs(v1.y - v0.y + 40) < 12, `dx=${(v1.x - v0.x).toFixed(0)} dy=${(v1.y - v0.y).toFixed(0)}`);
	await page.mouse.move(empty.x, empty.y);
	await page.mouse.wheel(0, -300);
	await page.waitForTimeout(400);
	const v2 = await viewport(page);
	check('P2 zoom with the wheel', v2.zoom > v1.zoom, `${v1.zoom.toFixed(2)} -> ${v2.zoom.toFixed(2)}`);
	await page.locator('.vue-flow__controls-zoomout').click();
	await page.waitForTimeout(500);
	const v3 = await viewport(page);
	check('P3 zoom with the Controls button', v3.zoom < v2.zoom, `${v2.zoom.toFixed(2)} -> ${v3.zoom.toFixed(2)}`);
	await page.locator('.vue-flow__controls-fitview').click();
	await page.waitForTimeout(600);
	check('P4 graph JSON untouched by pan/zoom', JSON.stringify(await graph(page)) === JSON.stringify(g0));

	// 3. drag node
	const zoom = (await viewport(page)).zoom;
	const a3 = await center(page, nodeSel('a3'));
	await mouseDrag(page, a3, { x: a3.x + 100, y: a3.y + 60 });
	const g1 = await graph(page);
	const p0 = g0.nodes.find((n) => n.id === 'a3').position;
	const p1 = g1.nodes.find((n) => n.id === 'a3').position;
	check('D1 node drag changes position in the exported JSON', Math.abs(p1.x - p0.x - 100 / zoom) < 15 && Math.abs(p1.y - p0.y - 60 / zoom) < 15, `(${p0.x},${p0.y}) -> (${p1.x},${p1.y}) at zoom ${zoom.toFixed(2)}`);
	check('D2 only that node moved', g1.nodes.filter((n) => JSON.stringify(n.position) !== JSON.stringify(g0.nodes.find((m) => m.id === n.id).position)).length === 1);
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.85 } });
	await page.waitForTimeout(300);

	// 4. connect c1.no -> a3.in
	await mouseDrag(page, await center(page, handleSel('c1', 'no')), await center(page, handleSel('a3', 'in')));
	const g2 = await graph(page);
	const added = g2.edges.find((e) => e.source === 'c1' && e.source_port === 'no' && e.target === 'a3' && e.target_port === 'in');
	check('C1 edge created by dragging handle to handle', g2.edges.length === 6 && !!added && (await page.locator('.vue-flow__edge').count()) === 6, JSON.stringify(added));

	// 5. invalid connections
	const rej0 = await page.locator('[data-test="status"]').textContent();
	await mouseDrag(page, await center(page, handleSel('a1', 'done')), await center(page, handleSel('c1', 'in')));
	const status1 = await page.locator('[data-test="status"]').textContent();
	check('V1 cycle rejected (a1.done -> c1.in): no edge, reason reported', (await graph(page)).edges.length === 6 && /rejected: cycle/.test(status1), status1.trim().replace(/\s+/g, ' '));
	await mouseDrag(page, await center(page, handleSel('a1', 'done')), await center(page, handleSel('a1', 'in')));
	check('V2 self connection rejected', (await graph(page)).edges.length === 6, (await page.locator('[data-test="status"]').textContent()).trim().replace(/\s+/g, ' '));
	await mouseDrag(page, await center(page, handleSel('c1', 'no')), await center(page, handleSel('a3', 'in')));
	check('V3 duplicate edge rejected', (await graph(page)).edges.length === 6, (await page.locator('[data-test="status"]').textContent()).trim().replace(/\s+/g, ' '));
	await mouseDrag(page, await center(page, handleSel('c1', 'no')), await center(page, nodeSel('t2')));
	await mouseDrag(page, await center(page, handleSel('c1', 'no')), await center(page, handleSel('t2', 'out')));
	check('V4 edge into a trigger impossible in strict mode (dropped on trigger body and on its out handle)', (await graph(page)).edges.length === 6);
	const direct = await page.evaluate(() => ({
		trigger: window.__automationSpike.checkConnection({ source: 'c1', source_port: 'no', target: 't2', target_port: 'in' }),
		cycle: window.__automationSpike.checkConnection({ source: 'a1', source_port: 'done', target: 'c1', target_port: 'in' }),
		ok: window.__automationSpike.checkConnection({ source: 'a3', source_port: 'done', target: 'a2', target_port: 'in' }),
	}));
	check('V5 validator function: into_trigger / cycle / valid', direct.trigger === 'into_trigger' && direct.cycle === 'cycle' && direct.ok === null, JSON.stringify(direct));

	// 6. drawer form
	await page.locator(nodeSel('c1')).click();
	await page.waitForSelector('.el-drawer [data-test="node-form"]', { state: 'visible' });
	await page.waitForTimeout(400);
	check('F1 selecting a node opens the el-drawer with its form', await page.locator('.el-drawer').isVisible(), await page.locator('.el-drawer__title').textContent());
	const valueInput = page.locator('.el-drawer [data-test="field-value"] input');
	await valueInput.fill('120');
	await valueInput.press('Enter');
	await page.waitForTimeout(300);
	const sum1 = await page.locator(`${nodeSel('c1')} [data-test="node-summary"]`).textContent();
	check('F2 el-input-number edit updates node summary', sum1.trim() === 'Illuminance < 120 lx', sum1.trim());
	await page.locator('.el-drawer [data-test="field-operator"]').click();
	await page.locator('.el-select-dropdown__item:visible', { hasText: '≥' }).click();
	await page.waitForTimeout(300);
	const sum2 = await page.locator(`${nodeSel('c1')} [data-test="node-summary"]`).textContent();
	check('F3 el-select edit updates node summary', sum2.trim() === 'Illuminance ≥ 120 lx', sum2.trim());
	const g3 = await graph(page);
	check('F4 config lands in exported JSON, node stays selected', g3.nodes.find((n) => n.id === 'c1').config.value === 120 && g3.nodes.find((n) => n.id === 'c1').config.operator === 'gte' && (await page.locator(`${nodeSel('c1')}.selected`).count()) === 1, JSON.stringify(g3.nodes.find((n) => n.id === 'c1').config));
	check('F5 canvas still interactive while the non-modal drawer is open (drag t2)', await (async () => {
		const before = (await graph(page)).nodes.find((n) => n.id === 't2').position;
		const c = await center(page, nodeSel('t2'));
		await mouseDrag(page, c, { x: c.x, y: c.y + 50 });
		const after = (await graph(page)).nodes.find((n) => n.id === 't2').position;
		return after.y > before.y;
	})());

	// 7. undo / redo (snapshot history outside the library)
	const beforeUndo = await graph(page);
	await page.locator('[data-test="undo"]').click();
	await page.waitForTimeout(300);
	const undone = await graph(page);
	const cg = await canvasGraph(page);
	check('U1 undo restores previous snapshot and the canvas follows', JSON.stringify(undone) !== JSON.stringify(beforeUndo) && JSON.stringify(cg) === JSON.stringify(undone));
	await page.locator('[data-test="redo"]').click();
	await page.waitForTimeout(300);
	check('U2 redo', JSON.stringify(await graph(page)) === JSON.stringify(beforeUndo) && JSON.stringify(await canvasGraph(page)) === JSON.stringify(beforeUndo));

	// 8. palette drag & drop
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.9 } });
	await page.waitForTimeout(400);
	check('F6 clicking the pane deselects and closes the drawer', !(await page.locator('.el-drawer').isVisible()));
	const drop = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.9 };
	const item = await center(page, '[data-test-palette="flow.delay"]');
	await page.mouse.move(item.x, item.y);
	await page.mouse.down();
	await page.mouse.move(item.x + 20, item.y + 10, { steps: 3 });
	await page.mouse.move(drop.x, drop.y, { steps: 10 });
	await page.mouse.up();
	await page.waitForTimeout(400);
	const g4 = await graph(page);
	const newNode = g4.nodes.find((n) => n.type === 'flow.delay');
	const newBox = newNode ? await page.locator(nodeSel(newNode.id)).boundingBox() : null;
	check('N1 new node dragged in from the palette at the drop point', g4.nodes.length === 8 && !!newBox && Math.abs(newBox.x - drop.x) < 20 && Math.abs(newBox.y - drop.y) < 20, newNode ? `${newNode.id} at (${newNode.position.x},${newNode.position.y}) "${await page.locator(`${nodeSel(newNode.id)} [data-test="node-summary"]`).textContent()}"` : 'no node');
	if (newNode) {
		await mouseDrag(page, await center(page, handleSel('t2', 'out')), await center(page, handleSel(newNode.id, 'in')));
		check('N2 the new node is connectable', (await graph(page)).edges.some((e) => e.source === 't2' && e.target === newNode.id));
	}
	await page.locator('[data-test-palette="time.window"]').click();
	await page.waitForTimeout(300);
	check('N3 palette click adds a node at the viewport centre', (await graph(page)).nodes.length === 9);

	// 9. multi select
	await page.locator(nodeSel('t1')).click();
	await page.locator(nodeSel('c1')).click({ modifiers: ['Control'] });
	await page.waitForTimeout(300);
	const multi = await page.locator('.vue-flow__node.selected').count();
	check('M1 Ctrl/Cmd+click multi-select', multi === 2, `selected=${multi}`);
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.95 } });
	await page.keyboard.down('Shift');
	await mouseDrag(page, { x: pane.x + pane.width * 0.02, y: pane.y + 10 }, { x: pane.x + pane.width * 0.6, y: pane.y + pane.height * 0.55 });
	await page.keyboard.up('Shift');
	await page.waitForTimeout(300);
	const boxSel = await page.locator('.vue-flow__node.selected').count();
	check('M2 Shift+drag selection rectangle', boxSel >= 2, `selected=${boxSel}`);
	await page.keyboard.press('Escape');
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.95 } });
	await page.waitForTimeout(300);

	// 10. keyboard a11y
	await page.locator(nodeSel('a3')).focus();
	const kb0 = (await graph(page)).nodes.find((n) => n.id === 'a3').position;
	await page.keyboard.press('Enter');
	await page.waitForTimeout(500);
	const kbSelected = await page.locator(`${nodeSel('a3')}.selected`).count();
	const kbFocus = await page.evaluate(() => document.activeElement && (document.activeElement.className || document.activeElement.tagName));
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(300);
	const kbMid = (await canvasGraph(page)).nodes.find((n) => n.id === 'a3').position;
	console.log(`INFO  keyboard: after Enter selected=${kbSelected}, focus moved to "${kbFocus}", ArrowRight moved node: ${kbMid.x !== kb0.x}`);
	await page.locator(nodeSel('a3')).focus();
	await page.waitForTimeout(200);
	const kbRefocus = await page.evaluate(() => document.activeElement && (document.activeElement.className || document.activeElement.tagName));
	console.log(`INFO  keyboard: programmatic refocus of the node while the drawer is open lands on "${kbRefocus}" (el-drawer focus trap)`);
	await page.keyboard.press('Escape'); // closes the drawer, focus returns to the still-selected node
	await page.waitForTimeout(400);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(400);
	const kb1 = (await canvasGraph(page)).nodes.find((n) => n.id === 'a3').position;
	check('K1 keyboard: focus node, Enter selects, Escape closes the drawer, arrow keys move the node (10 px grid step)', kb1.x > kb0.x, `(${kb0.x}) -> (${kb1.x}); exported=${(await graph(page)).nodes.find((n) => n.id === 'a3').position.x}`);
	const aria = await page.evaluate(() => ({ node: document.querySelector('.vue-flow__node[data-id="a3"]').getAttribute('aria-label'), role: document.querySelector('.vue-flow__node[data-id="a3"]').getAttribute('role'), tab: document.querySelector('.vue-flow__node[data-id="a3"]').getAttribute('tabindex'), edge: document.querySelector('.vue-flow__edge').getAttribute('aria-label'), live: !!document.querySelector('[aria-live]') }));
	console.log('INFO  aria', JSON.stringify(aria));

	// 11. delete
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.95 } });
	await page.locator(nodeSel('a2')).click();
	await page.waitForTimeout(400);
	const active = await page.evaluate(() => document.activeElement && (document.activeElement.className || document.activeElement.tagName));
	await page.keyboard.press('Delete');
	await page.waitForTimeout(400);
	const g5 = await graph(page);
	check('X1 select node + Delete key removes node and its edges', !g5.nodes.some((n) => n.id === 'a2') && !g5.edges.some((e) => e.target === 'a2' || e.source === 'a2') && (await page.locator(nodeSel('a2')).count()) === 0, `focus after click: ${active}`);
	const edgeCountBefore = g5.edges.length;
	{
		const h1 = await center(page, handleSel('t1', 'out'));
		const h2 = await center(page, handleSel('c1', 'in'));
		await page.mouse.click((h1.x + h2.x) / 2, (h1.y + h2.y) / 2 + 3);
	}
	await page.waitForTimeout(300);
	const edgeSelected = await page.locator('.vue-flow__edge.selected').count();
	await page.keyboard.press('Backspace');
	await page.waitForTimeout(400);
	check('X2 select edge + Backspace removes the edge', edgeSelected === 1 && (await graph(page)).edges.length === edgeCountBefore - 1 && !(await graph(page)).edges.some((e) => e.id === 'e1'));
	await page.locator(nodeSel('a1')).click();
	await page.waitForTimeout(300);
	await page.locator('[data-test="delete-selected"]').click();
	await page.waitForTimeout(400);
	check('X3 toolbar Delete button (touch path) removes the selected node', !(await graph(page)).nodes.some((n) => n.id === 'a1'));
	await page.locator(nodeSel('c2')).click();
	await page.waitForSelector('.el-drawer [data-test="node-form"]', { state: 'visible' });
	await page.locator('.el-drawer .el-select').first().click();
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	check('X4 Backspace typed inside a drawer field does NOT delete the node', (await graph(page)).nodes.some((n) => n.id === 'c2'));

	// 12. export + round trip
	await page.locator('.vue-flow__pane').click({ position: { x: pane.width * 0.6, y: pane.height * 0.95 } });
	await page.locator('[data-test="toggle-json"]').click();
	const jsonText = await page.locator('[data-test="graph-json"]').textContent();
	const exported = JSON.parse(jsonText);
	const g6 = await graph(page);
	check('J1 exported JSON has the design shape', Array.isArray(exported.nodes) && exported.nodes.every((n) => typeof n.id === 'string' && typeof n.type === 'string' && typeof n.position.x === 'number' && typeof n.config === 'object' && Object.keys(n).sort().join() === 'config,id,position,type') && exported.edges.every((e) => Object.keys(e).sort().join() === 'id,source,source_port,target,target_port'), `${exported.nodes.length} nodes, ${exported.edges.length} edges`);
	check('J2 exported JSON == canvas state after all edits', (await page.evaluate(([a, b]) => window.__automationSpike.canonical(a) === window.__automationSpike.canonical(b), [exported, await canvasGraph(page)])));
	await page.locator('[data-test="round-trip"]').click();
	await page.waitForSelector('[data-test="round-trip-result"]');
	const rt = await page.locator('[data-test="round-trip-result"]').textContent();
	const g7 = await canvasGraph(page);
	check('J3 round-trip: export -> fresh canvas from JSON -> export is identical', rt.trim() === 'round-trip ok' && (await page.evaluate(([a, b]) => window.__automationSpike.canonical(a) === window.__automationSpike.canonical(b), [g6, g7])), rt.trim());
	check('J4 remounted canvas renders the same node/edge counts', (await page.locator('.vue-flow__node').count()) === g6.nodes.length && (await page.locator('.vue-flow__edge').count()) === g6.edges.length, `${g6.nodes.length} nodes / ${g6.edges.length} edges`);
	await page.screenshot({ path: __dirname + '/after-edits.png' });
	check('E1 no console errors/warnings, no failed requests', errors.length === 0 && failed.length === 0, JSON.stringify({ errors, failed }).slice(0, 600));
	await context.close();

	// 13. loose mode: validator must reject an edge into a trigger even when the library would allow source->source
	const loose = await L.open(browser, `${BASE}${sep}loose=1`);
	await mouseDrag(loose.page, await center(loose.page, handleSel('c1', 'no')), await center(loose.page, handleSel('t2', 'out')));
	const ls = (await loose.page.locator('[data-test="status"]').textContent()).trim().replace(/\s+/g, ' ');
	check('V6 loose connection mode: edge into trigger rejected by isValidConnection', (await graph(loose.page)).edges.length === 5 && /rejected: into_trigger/.test(ls), ls);
	await loose.context.close();

	await browser.close();
	const failedChecks = L.results.filter((r) => !r.ok);
	console.log(`\n${L.results.length - failedChecks.length}/${L.results.length} passed`);
	process.exit(failedChecks.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
