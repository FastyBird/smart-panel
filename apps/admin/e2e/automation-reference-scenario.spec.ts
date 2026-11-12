import { type Locator, type Page, expect, test } from '@playwright/test';

import { type IGraph, type IStoredAutomation, mockBackend } from './support/mock-backend';

/*
 * The reference scenario of the automations design (docs/superpowers/specs/2026-11-10-automations-design.md,
 * § Goal), drawn on the canvas the way a user draws it: cards dragged from the palette, configured in their
 * forms and wired handle to handle. It is saved, the page is loaded again, and the graph the backend
 * received has to be the scenario, and has to be what the canvas shows again.
 *
 *   occupancy becomes detected → illuminance < 50 lx → time is 22:00–06:00 → light on at 20 %
 *                                                                        └ no → light on at 100 %
 *   occupancy becomes clear → Delay 2 min → occupancy still clear → light off
 *
 * The re-check after the Delay is what the design asks of a Delay before a state-changing action (§ Runs).
 *
 * The backend is answered in the browser (`support/mock-backend.ts`), so nothing but the admin is started.
 */

const AUTOMATION_ID = '00000000-0000-4000-8000-0000000000a1';

// The simulator devices of `fixtures/devices.json`
const OCCUPANCY = {
	device_id: '00000000-0000-4000-8000-000000000001',
	channel_id: '00000000-0000-4000-8000-000000000004',
	property_id: '00000000-0000-4000-8000-000000000005',
};
const ILLUMINANCE = {
	device_id: '00000000-0000-4000-8000-000000000001',
	channel_id: '00000000-0000-4000-8000-000000000002',
	property_id: '00000000-0000-4000-8000-000000000003',
};
const LIGHT_ON = {
	device_id: '00000000-0000-4000-8000-000000000006',
	channel_id: '00000000-0000-4000-8000-000000000007',
	property_id: '00000000-0000-4000-8000-000000000009',
};
const LIGHT_BRIGHTNESS = {
	device_id: '00000000-0000-4000-8000-000000000006',
	channel_id: '00000000-0000-4000-8000-000000000007',
	property_id: '00000000-0000-4000-8000-000000000008',
};

type CardName = 'occupied' | 'dark' | 'night' | 'dimmed' | 'full' | 'clear' | 'wait' | 'vacant' | 'off';

/** The scenario, with the cards named as above instead of the ids the editor gives them */
const EXPECTED: { nodes: Record<CardName, { type: string; config: Record<string, unknown> }>; edges: string[] } = {
	nodes: {
		occupied: { type: 'device.property.changed', config: { ...OCCUPANCY, to: true } },
		dark: { type: 'device.property.compare', config: { ...ILLUMINANCE, operator: 'lt', value: 50 } },
		night: { type: 'time.window', config: { from: '22:00', to: '06:00' } },
		dimmed: {
			type: 'device.property.set',
			config: {
				writes: [
					{ ...LIGHT_ON, value: true },
					{ ...LIGHT_BRIGHTNESS, value: 20 },
				],
			},
		},
		full: {
			type: 'device.property.set',
			config: {
				writes: [
					{ ...LIGHT_ON, value: true },
					{ ...LIGHT_BRIGHTNESS, value: 100 },
				],
			},
		},
		clear: { type: 'device.property.changed', config: { ...OCCUPANCY, to: false } },
		wait: { type: 'flow.delay', config: { seconds: 120 } },
		vacant: { type: 'device.property.compare', config: { ...OCCUPANCY, operator: 'eq', value: false } },
		off: { type: 'device.property.set', config: { writes: [{ ...LIGHT_ON, value: false }] } },
	},
	edges: [
		'occupied:out -> dark:in',
		'dark:yes -> night:in',
		'night:yes -> dimmed:in',
		'night:no -> full:in',
		'clear:out -> wait:in',
		'wait:out -> vacant:in',
		'vacant:yes -> off:in',
	],
};

const emptyAutomation = (): IStoredAutomation => ({
	id: AUTOMATION_ID,
	name: 'Hallway light',
	description: null,
	icon: null,
	enabled: false,
	space_id: null,
	mode: 'restart',
	graph: { version: 1, nodes: [], edges: [] },
	revision: 1,
	status: 'ok',
	last_triggered_at: null,
	last_run_status: null,
	created_at: '2026-11-01T10:00:00.000Z',
	updated_at: null,
});

/** A stored graph in the terms of `EXPECTED`: the ids the editor made up are replaced by the card names */
const describeGraph = (graph: IGraph, names: Map<string, CardName>): typeof EXPECTED => {
	const name = (id: string): string => names.get(id) ?? `unknown ${id}`;

	return {
		nodes: Object.fromEntries(graph.nodes.map((node) => [name(node.id), { type: node.type, config: node.config }])) as typeof EXPECTED.nodes,
		edges: graph.edges.map((edge) => `${name(edge.source)}:${edge.source_port} -> ${name(edge.target)}:${edge.target_port}`),
	};
};

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('automation editor: the reference scenario', () => {
	// The first visit of the dev server compiles the app
	test.setTimeout(180_000);

	let page: Page;
	let canvas: Locator;
	let panel: Locator;

	/** Picks an option of an Element Plus select, found by the name of its input */
	const choose = async (scope: Locator, name: string, option: string): Promise<void> => {
		await scope.locator(`.el-select:has(input[name="${name}"])`).click();
		await page.locator('.el-select-dropdown__item:visible', { hasText: option }).first().click();
		await expect(page.locator('.el-select-dropdown:visible')).toHaveCount(0);
	};

	const pickProperty = async (scope: Locator, prefix: string, device: string, channel: string, property: string): Promise<void> => {
		await choose(scope, `${prefix}device_id`, device);
		await choose(scope, `${prefix}channel_id`, channel);
		await choose(scope, `${prefix}property_id`, property);
	};

	const fillNumber = async (scope: Locator, value: number): Promise<void> => {
		const input = scope.locator('input').first();

		await input.fill(String(value));
		await input.press('Tab');
	};

	/** Drags a card from the palette to a place on the canvas and returns the id the editor gave it */
	const addCard = async (type: string, x: number, y: number): Promise<string> => {
		const before = await canvas.locator('.vue-flow__node').count();

		await page.locator(`[data-test-palette="${type}"]`).dragTo(canvas, { targetPosition: { x, y } });

		await expect(canvas.locator('.vue-flow__node')).toHaveCount(before + 1);

		// The card added is selected, and its form is opened
		const added = canvas.locator('.vue-flow__node.selected');

		await expect(added).toHaveCount(1);
		await expect(panel).toBeVisible();

		return (await added.getAttribute('data-id')) as string;
	};

	/** Where each card is on the canvas, by id, in the coordinates of the flow (not of the screen) */
	const cardPositions = async (): Promise<Record<string, { x: number; y: number }>> =>
		Object.fromEntries(
			await canvas.locator('.vue-flow__node').evaluateAll((elements) =>
				elements.map((element) => {
					const match = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(element.getAttribute('style') ?? '');

					return [element.getAttribute('data-id'), match ? { x: Number(match[1]), y: Number(match[2]) } : null];
				})
			)
		) as Record<string, { x: number; y: number }>;

	const handle = (nodeId: string, port: string, type: 'source' | 'target'): Locator =>
		canvas.locator(`.vue-flow__handle.${type}[data-nodeid="${nodeId}"][data-handleid="${port}"]`);

	/** Draws an edge from an output to an input with the mouse */
	const connect = async (source: string, sourcePort: string, target: string): Promise<void> => {
		const before = await canvas.locator('.vue-flow__edge').count();

		const from = await handle(source, sourcePort, 'source').boundingBox();
		const to = await handle(target, 'in', 'target').boundingBox();

		if (!from || !to) {
			throw new Error(`A handle of ${source}:${sourcePort} -> ${target}:in is not on the screen`);
		}

		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
		await page.mouse.up();

		await expect(canvas.locator('.vue-flow__edge')).toHaveCount(before + 1);
	};

	test('is drawn, saved and read back as it was drawn', async ({ page: opened, baseURL }) => {
		page = opened;

		const backend = await mockBackend(page, baseURL as string, [emptyAutomation()]);

		await page.goto(`/automations/${AUTOMATION_ID}/flow`);

		canvas = page.locator('[data-test-id="automation-canvas"]');
		panel = page.locator('[data-test-id="automation-node-panel"]');

		await expect(page.locator('[data-test-palette="device.property.changed"]')).toBeVisible({ timeout: 60_000 });
		await expect(canvas.locator('.vue-flow__node')).toHaveCount(0);

		const names = new Map<string, CardName>();
		const ids = {} as Record<CardName, string>;

		const add = async (name: CardName, type: string, x: number, y: number): Promise<void> => {
			ids[name] = await addCard(type, x, y);
			names.set(ids[name], name);
		};

		// ---- When: somebody is detected ---------------------------------------------------------------

		await add('occupied', 'device.property.changed', 40, 60);
		await pickProperty(panel, '', 'Hallway sensor', 'Occupancy', 'Detected');
		await choose(panel, 'mode', 'becomes a value');
		await choose(panel.locator('[data-test-field="to"]'), 'to', 'Yes');

		// ---- And: it is dark ----------------------------------------------------------------------------

		await add('dark', 'device.property.compare', 360, 60);
		await pickProperty(panel, '', 'Hallway sensor', 'Illuminance', 'Illuminance');
		await choose(panel, 'operator', 'is less than');
		await fillNumber(panel.locator('[data-test-field="value"]'), 50);

		// ---- And: it is night -----------------------------------------------------------------------------

		await add('night', 'time.window', 680, 60);

		for (const [key, time] of [
			['from', '22:00'],
			['to', '06:00'],
		] as const) {
			const input = panel.locator(`[data-test-field="${key}"] input`);

			// The picker puts the time it opens with into the field, so it is let open before the time is typed
			await input.click();
			await expect(page.locator('.el-time-panel:visible')).toHaveCount(1);
			await input.fill(time);
			await input.press('Enter');
			await expect(page.locator('.el-time-panel:visible')).toHaveCount(0);
			await expect(input).toHaveValue(time);
		}

		await expect(panel.locator('[data-test-id="window-hint"]')).toContainText('crosses midnight');

		// ---- Then: the light, dimmed at night and full by day --------------------------------------------

		for (const [name, x, y, brightness] of [
			['dimmed', 40, 240, 20],
			['full', 360, 240, 100],
		] as const) {
			await add(name, 'device.property.set', x, y);

			await panel.locator('[data-test-id="add-write"]').click();

			const first = panel.locator('[data-test-write="0"]');
			const second = panel.locator('[data-test-write="1"]');

			await pickProperty(first, 'writes.0.', 'Hallway light', 'Light', 'On');
			await choose(first, 'writes.0.value', 'Yes');

			await pickProperty(second, 'writes.1.', 'Hallway light', 'Light', 'Brightness');
			await fillNumber(second.locator('[data-test-field="writes.1.value"]'), brightness);
		}

		// ---- When the room is clear: wait, check it is still clear, then the light off -----------------------

		await add('clear', 'device.property.changed', 40, 420);
		await pickProperty(panel, '', 'Hallway sensor', 'Occupancy', 'Detected');
		await choose(panel, 'mode', 'becomes a value');
		await choose(panel.locator('[data-test-field="to"]'), 'to', 'No');

		await add('wait', 'flow.delay', 360, 420);
		await choose(panel, 'seconds-unit', 'minutes');
		await fillNumber(panel.locator('[data-test-field="seconds"]'), 2);

		await add('vacant', 'device.property.compare', 680, 420);
		await pickProperty(panel, '', 'Hallway sensor', 'Occupancy', 'Detected');
		await choose(panel, 'operator', 'is equal to');
		await choose(panel.locator('[data-test-field="value"]'), 'value', 'No');

		await add('off', 'device.property.set', 1000, 420);
		await pickProperty(panel, 'writes.0.', 'Hallway light', 'Light', 'On');
		await choose(panel, 'writes.0.value', 'No');

		// ---- The wires --------------------------------------------------------------------------------------

		await panel.locator('[data-test-id="close-node-panel"]').click();
		await expect(panel).toHaveCount(0);

		await canvas.locator('.vue-flow__controls-fitview').click();

		await connect(ids.occupied, 'out', ids.dark);
		await connect(ids.dark, 'yes', ids.night);
		await connect(ids.night, 'yes', ids.dimmed);
		await connect(ids.night, 'no', ids.full);
		await connect(ids.clear, 'out', ids.wait);
		await connect(ids.wait, 'out', ids.vacant);
		await connect(ids.vacant, 'yes', ids.off);

		// ---- Save -------------------------------------------------------------------------------------------

		const cardsAsDrawn = await canvas.locator('[data-test-id="node-summary"]').allInnerTexts();
		const positionsAsDrawn = await cardPositions();

		expect(Object.keys(positionsAsDrawn).sort()).toEqual(Object.values(ids).sort());
		expect(Object.values(positionsAsDrawn)).not.toContain(null);

		const save = page.locator('[data-test-id="save-flow"]');

		await expect(save).toBeEnabled();
		await save.click();

		await expect(page.locator('[data-test-id="unsaved-tag"]')).toHaveCount(0);
		await expect(save).toBeDisabled();

		expect(backend.updates).toHaveLength(1);

		const stored = backend.automations.get(AUTOMATION_ID) as IStoredAutomation;

		expect(stored.revision).toBe(2);
		expect(describeGraph(stored.graph, names)).toEqual(EXPECTED);
		// The cards are stored where they were put
		expect(Object.fromEntries(stored.graph.nodes.map((node) => [node.id, node.position]))).toEqual(positionsAsDrawn);

		// ---- Reload: the canvas shows what was stored ---------------------------------------------------------

		await page.reload();

		await expect(canvas.locator('.vue-flow__node')).toHaveCount(stored.graph.nodes.length, { timeout: 60_000 });
		await expect(canvas.locator('.vue-flow__edge')).toHaveCount(stored.graph.edges.length);

		for (const node of stored.graph.nodes) {
			await expect(canvas.locator(`.vue-flow__node[data-id="${node.id}"]`)).toHaveCount(1);
		}

		for (const edge of stored.graph.edges) {
			await expect(canvas.locator(`.vue-flow__edge[data-id="${edge.id}"]`)).toHaveCount(1);
		}

		expect(await canvas.locator('[data-test-id="node-summary"]').allInnerTexts()).toEqual(cardsAsDrawn);
		// ... and are shown where they were put
		expect(await cardPositions()).toEqual(positionsAsDrawn);

		// Nothing to save: what was read is what is stored
		await expect(save).toBeDisabled();
		await expect(page.locator('[data-test-id="unsaved-tag"]')).toHaveCount(0);

		expect(backend.updates).toHaveLength(1);
		expect(backend.unhandled).toEqual([]);
	});
});
