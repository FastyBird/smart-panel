import { expect, test } from '@playwright/test';

import { type IStoredAutomation, type IStoredRun, mockBackend } from './support/mock-backend';

/*
 * Testing an automation and reading what its runs did (design § Editor, "Test and trace"): a run is picked
 * from the history and laid over the canvas, the card it stopped at is explained and can be gone to, and
 * Test starts a run by hand. The backend is answered in the browser (`support/mock-backend.ts`); the socket
 * is not opened, so a run started here is followed without steps.
 */

const AUTOMATION_ID = '00000000-0000-4000-8000-0000000000b1';
const RUN_ID = '00000000-0000-4000-8000-0000000000c1';

// Manual start → Delay → notification
const automation = (): IStoredAutomation => ({
	id: AUTOMATION_ID,
	name: 'Reminder',
	description: null,
	icon: null,
	enabled: true,
	space_id: null,
	mode: 'restart',
	graph: {
		version: 1,
		nodes: [
			{ id: 'n1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
			{ id: 'n2', type: 'flow.delay', position: { x: 360, y: 0 }, config: { seconds: 60 } },
			{ id: 'n3', type: 'notification.send', position: { x: 720, y: 0 }, config: { severity: 'info', title: 'Reminder' } },
		],
		edges: [
			{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' },
			{ id: 'e2', source: 'n2', source_port: 'out', target: 'n3', target_port: 'in' },
		],
	},
	revision: 2,
	status: 'ok',
	last_triggered_at: '2026-11-11T07:30:00.000Z',
	last_run_status: 'interrupted',
	created_at: '2026-11-01T10:00:00.000Z',
	updated_at: null,
});

// The backend restarted while the run waited on the Delay
const interruptedRun = (): IStoredRun => ({
	id: RUN_ID,
	automation_id: AUTOMATION_ID,
	revision: 2,
	status: 'interrupted',
	trigger_node_id: 'n1',
	manual: true,
	started_at: '2026-11-11T07:30:00.000Z',
	finished_at: null,
	duration_ms: null,
	end_reason: 'backend_restarted',
	trace: {
		trigger: { node_id: 'n1', manual: true, data: {} },
		steps: [
			{ seq: 1, at: '2026-11-11T07:30:00.000Z', elapsed_ms: 0, node_id: 'n1', type: 'manual.start', kind: 'trigger', state: 'done', output: 'out' },
			{
				seq: 2,
				at: '2026-11-11T07:30:00.005Z',
				elapsed_ms: 5,
				node_id: 'n2',
				type: 'flow.delay',
				kind: 'flow',
				via: 'e1',
				state: 'parked',
				delay_ms: 60_000,
			},
		],
		truncated: false,
	},
});

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe('automation editor: test and trace', () => {
	// The first visit of the dev server compiles the app
	test.setTimeout(180_000);

	test('replays a past run, explains where it stopped, and starts a test run', async ({ page, baseURL }) => {
		const backend = await mockBackend(page, baseURL as string, [automation()], [interruptedRun()]);

		await page.goto(`/automations/${AUTOMATION_ID}/flow`);

		const canvas = page.locator('[data-test-id="automation-canvas"]');
		const card = (id: string) => canvas.locator(`.vue-flow__node[data-id="${id}"] .automation-node-card`);

		await expect(canvas.locator('.vue-flow__node')).toHaveCount(3, { timeout: 60_000 });

		// ---- The history ---------------------------------------------------------------------------------------

		await page.locator('[data-test-id="toggle-run-history"]').click();

		const item = page.locator(`[data-test-id="run-item"][data-test-run="${RUN_ID}"]`);

		await expect(item.locator('[data-test-id="run-status"]')).toHaveText('Interrupted');
		await expect(item.locator('[data-test-id="run-trigger"]')).toHaveText('By hand from Manual start');

		// ---- Replayed on the canvas ----------------------------------------------------------------------------

		await item.click();

		const summary = page.locator('[data-test-id="run-summary"]');

		await expect(summary).toHaveAttribute('data-test-source', 'replay');
		await expect(card('n1')).toHaveAttribute('data-test-run-state', 'passed');
		await expect(card('n2')).toHaveAttribute('data-test-run-state', 'reached');
		await expect(card('n2').locator('[data-test-id="node-run"]')).toHaveText('Was waiting here when the run stopped');
		await expect(card('n3')).toHaveAttribute('data-test-run-state', 'none');
		await expect(canvas.locator('.vue-flow__edge[data-id="e1"]')).toHaveClass(/automation-canvas__edge--taken/);
		await expect(canvas.locator('.vue-flow__edge[data-id="e2"]')).toHaveClass(/automation-canvas__edge--not-taken/);

		// ---- Explained in plain words, with the way to the card ------------------------------------------------

		const attention = summary.locator('[data-test-id="run-attention"]');

		await expect(attention).toContainText('This run stopped before it ended. The server restarted while the run was waiting.');

		await attention.locator('[data-test-id="run-attention-node"]').click();

		await expect(canvas.locator('.vue-flow__node.selected')).toHaveAttribute('data-id', 'n2');

		// Looking at a run changes nothing that could be saved
		await expect(page.locator('[data-test-id="unsaved-tag"]')).toHaveCount(0);
		await expect(page.locator('[data-test-id="save-flow"]')).toBeDisabled();

		// ---- A test run ----------------------------------------------------------------------------------------

		await page.locator('[data-test-id="test-automation"]').click();

		await expect(summary).toHaveAttribute('data-test-source', 'live');
		await expect(summary.locator('[data-test-id="run-summary-status"]')).toHaveText('Running');
		await expect(card('n1')).toHaveAttribute('data-test-run-state', 'none');

		expect(backend.triggers).toEqual([{ id: AUTOMATION_ID, body: {} }]);

		await summary.locator('[data-test-id="close-run"]').click();

		await expect(summary).toHaveCount(0);
		await expect(card('n1')).not.toHaveAttribute('data-test-run-state', /.+/);

		expect(backend.updates).toEqual([]);
		expect(backend.unhandled).toEqual([]);
	});
});
