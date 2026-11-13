import { ElDropdown } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import { AutomationNodeKind, AutomationRunRecordStatus, AutomationRunStepState, AutomationStatus } from '../../automations.constants';
import { mapTraceToOverlay } from '../../automations.trace';
import type { IAutomationShownRun } from '../../composables/types';
import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';
import type { IAutomationRun, IAutomationRunStep } from '../../store/runs.store.types';

import AutomationRunHistory from './automation-run-history.vue';
import AutomationRunSummary from './automation-run-summary.vue';
import AutomationStatusExplanation from './automation-status-explanation.vue';
import AutomationTestButton from './automation-test-button.vue';

// Keys come back with their parameters, so what is put into a text can be checked
vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		te: (key: string) => key.startsWith('automations.runs.problems.missing_reference'),
		locale: { value: 'en-US' },
	}),
}));

const automationId = '5b4b8bf0-3d1f-4a3b-8e0a-6a1c2d3e4f50';

const nodeTypes: IAutomationNodeType[] = [
	{
		type: 'manual.start',
		kind: AutomationNodeKind.trigger,
		name: 'Manual start',
		description: '',
		ports: { inputs: [], outputs: ['out'] },
		configSchema: {},
	},
	{
		type: 'flow.delay',
		kind: AutomationNodeKind.flow,
		name: 'Delay',
		description: '',
		ports: { inputs: ['in'], outputs: ['done'] },
		configSchema: {},
	},
	{
		type: 'notification.send',
		kind: AutomationNodeKind.action,
		name: 'Send notification',
		description: '',
		ports: { inputs: ['in'], outputs: ['done', 'error'] },
		configSchema: {},
	},
];

const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
		{ id: 'd1', type: 'flow.delay', position: { x: 300, y: 0 }, config: {} },
		{ id: 'a1', type: 'notification.send', position: { x: 600, y: 0 }, config: {} },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'd1', target_port: 'in' },
		{ id: 'e2', source: 'd1', source_port: 'done', target: 'a1', target_port: 'in' },
	],
};

const run = (overrides: Partial<IAutomationRun> = {}): IAutomationRun => ({
	id: 'a1f0c1d2-0000-4000-8000-000000000001',
	automationId,
	revision: 2,
	status: AutomationRunRecordStatus.completed,
	triggerNodeId: 't1',
	manual: false,
	startedAt: new Date('2026-11-11T07:30:00.000Z'),
	finishedAt: new Date('2026-11-11T07:30:01.500Z'),
	durationMs: 1500,
	endReason: null,
	trace: null,
	...overrides,
});

const steps: IAutomationRunStep[] = [
	{
		seq: 1,
		at: '2026-11-11T07:30:00.000Z',
		elapsed_ms: 0,
		node_id: 't1',
		type: 'manual.start',
		kind: AutomationNodeKind.trigger,
		state: AutomationRunStepState.done,
		output: 'out',
	},
	{
		seq: 2,
		at: '2026-11-11T07:30:00.010Z',
		elapsed_ms: 10,
		node_id: 'd1',
		type: 'flow.delay',
		kind: AutomationNodeKind.flow,
		via: 'e1',
		state: AutomationRunStepState.parked,
		delay_ms: 60_000,
	},
];

const shownRun = (overrides: Partial<IAutomationShownRun> = {}): IAutomationShownRun => ({
	runId: 'a1f0c1d2-0000-4000-8000-000000000001',
	source: 'replay',
	run: run({ status: AutomationRunRecordStatus.interrupted, endReason: 'backend_restarted', finishedAt: null, durationMs: null }),
	steps,
	overlay: mapTraceToOverlay(graph, steps),
	ended: true,
	attention: { kind: 'interrupted', nodeId: 'd1', endReason: 'backend_restarted' },
	loading: false,
	failed: false,
	truncated: false,
	...overrides,
});

describe('automation run components', (): void => {
	let wrapper: VueWrapper;

	afterEach((): void => {
		wrapper?.unmount();
	});

	describe('AutomationTestButton', (): void => {
		it('starts a test at the first trigger with one button when there is one trigger', async (): Promise<void> => {
			wrapper = mount(AutomationTestButton, { props: { triggers: [{ id: 't1', label: 'Manual start' }] } });

			await wrapper.find('[data-test-id="test-automation"]').trigger('click');

			expect(wrapper.emitted('test')).toEqual([[]]);
			expect(wrapper.findComponent(ElDropdown).exists()).toBe(false);
		});

		it('lets the trigger be chosen when there are several', async (): Promise<void> => {
			wrapper = mount(AutomationTestButton, {
				props: {
					triggers: [
						{ id: 't1', label: 'Manual start' },
						{ id: 't2', label: 'At 7:00' },
					],
				},
			});

			const dropdown = wrapper.findComponent(ElDropdown);

			expect(dropdown.exists()).toBe(true);

			dropdown.vm.$emit('command', 't2');
			dropdown.vm.$emit('click');

			expect(wrapper.emitted('test')).toEqual([['t2'], []]);
		});

		it('is disabled with the reason, and while a test is starting', async (): Promise<void> => {
			wrapper = mount(AutomationTestButton, { props: { triggers: [{ id: 't1', label: 'Manual start' }], disabledReason: 'Save first.' } });

			expect(wrapper.find('[data-test-id="test-automation-wrapper"]').attributes('data-test-reason')).toBe('Save first.');
			expect(wrapper.find('[data-test-id="test-automation"]').attributes('disabled')).toBeDefined();

			await wrapper.setProps({ disabledReason: null, loading: true });

			await wrapper.find('[data-test-id="test-automation"]').trigger('click');

			expect(wrapper.emitted('test')).toBeUndefined();
		});
	});

	describe('AutomationRunHistory', (): void => {
		it('lists the runs with status, trigger and time, and picks one', async (): Promise<void> => {
			const first = run({ id: 'a1f0c1d2-0000-4000-8000-000000000002', manual: true, status: AutomationRunRecordStatus.failed });
			const second = run({ triggerNodeId: 'gone', durationMs: null });

			wrapper = mount(AutomationRunHistory, { props: { runs: [first, second], graph, nodeTypes, selectedRunId: second.id } });

			const items = wrapper.findAll('[data-test-id="run-item"]');

			expect(items).toHaveLength(2);
			expect(items[0]?.find('[data-test-id="run-status"]').text()).toBe('automations.runs.statuses.failed');
			expect(items[0]?.find('[data-test-id="run-trigger"]').text()).toBe('automations.runs.texts.manual {"trigger":"Manual start"}');
			expect(items[0]?.find('[data-test-id="run-time"]').text()).toContain('automations.runs.texts.startedFor');
			expect(items[1]?.find('[data-test-id="run-trigger"]').text()).toBe('automations.runs.texts.unknownTrigger');
			expect(items[1]?.attributes('aria-pressed')).toBe('true');

			await items[0]?.trigger('click');
			await wrapper.find('[data-test-id="reload-runs"]').trigger('click');

			expect(wrapper.emitted('select')).toEqual([[first.id]]);
			expect(wrapper.emitted('reload')).toHaveLength(1);
		});

		it('says when there are no runs, they are loading or could not be loaded', async (): Promise<void> => {
			wrapper = mount(AutomationRunHistory, { props: { runs: [], graph, nodeTypes } });

			expect(wrapper.find('[data-test-id="runs-empty"]').text()).toBe('automations.runs.texts.empty');

			await wrapper.setProps({ loading: true });

			expect(wrapper.find('[data-test-id="runs-empty"]').text()).toBe('automations.runs.texts.loading');

			await wrapper.setProps({ loading: false, failed: true });

			expect(wrapper.find('[data-test-id="runs-load-failed"]').text()).toBe('automations.runs.texts.loadFailed');
			expect(wrapper.find('[data-test-id="runs-empty"]').exists()).toBe(false);
		});

		it('says the runs listed may be out of date when reading them again failed', (): void => {
			wrapper = mount(AutomationRunHistory, { props: { runs: [run()], graph, nodeTypes, failed: true } });

			expect(wrapper.find('[data-test-id="runs-load-failed"]').text()).toBe('automations.runs.texts.reloadFailed');
			expect(wrapper.findAll('[data-test-id="run-item"]')).toHaveLength(1);
		});
	});

	describe('AutomationRunSummary', (): void => {
		it('explains an interrupted run in plain words and leads to the card it waited on', async (): Promise<void> => {
			wrapper = mount(AutomationRunSummary, { props: { shown: shownRun(), graph, nodeTypes, revision: 2 } });

			expect(wrapper.find('[data-test-id="run-summary"]').attributes('data-test-source')).toBe('replay');
			expect(wrapper.find('[data-test-id="run-summary-status"]').text()).toBe('automations.runs.statuses.interrupted');

			const attention = wrapper.find('[data-test-id="run-attention"]');

			expect(attention.attributes('data-test-kind')).toBe('interrupted');
			expect(attention.text()).toContain('automations.runs.explanations.interrupted.text');
			expect(attention.text()).toContain('automations.runs.explanations.interruptedCauses.backend_restarted');

			const link = wrapper.find('[data-test-id="run-attention-node"]');

			expect(link.text()).toBe('automations.runs.buttons.showNode.title {"node":"Delay"}');
			// Reached and used from the keyboard
			expect(link.element.tagName).toBe('BUTTON');

			await link.trigger('click');
			await wrapper.find('[data-test-id="close-run"]').trigger('click');

			expect(wrapper.emitted('focus')).toEqual([['d1']]);
			expect(wrapper.emitted('close')).toHaveLength(1);
		});

		it('says what to keep in mind when reading the canvas', (): void => {
			wrapper = mount(AutomationRunSummary, {
				props: {
					shown: shownRun({
						truncated: true,
						failed: true,
						overlay: { ...mapTraceToOverlay(graph, steps), missingNodeIds: ['gone'] },
					}),
					graph,
					nodeTypes,
					revision: 3,
				},
			});

			const notes = wrapper.findAll('[data-test-note]').map((note) => note.attributes('data-test-note'));

			expect(notes).toEqual(['traceFailed', 'truncated', 'otherRevision', 'missingNodes']);
		});

		it('shows a live run that has not reached a card yet as running, with nothing to explain', (): void => {
			wrapper = mount(AutomationRunSummary, {
				props: {
					shown: shownRun({ source: 'live', run: null, steps: [], overlay: mapTraceToOverlay(graph, []), ended: false, attention: null }),
					graph,
					nodeTypes,
					revision: 2,
					unsaved: true,
				},
			});

			expect(wrapper.find('[data-test-id="run-summary-status"]').text()).toBe('automations.runs.statuses.running');
			expect(wrapper.find('[data-test-id="run-attention"]').exists()).toBe(false);
			expect(wrapper.findAll('[data-test-note]').map((note) => note.attributes('data-test-note'))).toEqual(['waitingForSteps', 'unsaved']);
		});
	});

	describe('AutomationStatusExplanation', (): void => {
		it('explains a suspended automation without naming a trigger the engine did not name', (): void => {
			wrapper = mount(AutomationStatusExplanation, {
				props: {
					status: AutomationStatus.suspended,
					runtime: { automationId, loaded: true, status: AutomationStatus.suspended, problems: [], suspendedReason: 'Too often.' },
					graph,
					nodeTypes,
				},
			});

			expect(wrapper.text()).toContain('automations.runs.explanations.suspended.text');
			expect(wrapper.find('[data-test-id="status-node"]').exists()).toBe(false);
		});

		it('lists why an invalid automation cannot run, each with the card concerned', async (): Promise<void> => {
			wrapper = mount(AutomationStatusExplanation, {
				props: {
					status: AutomationStatus.invalid,
					runtime: {
						automationId,
						loaded: true,
						status: AutomationStatus.invalid,
						problems: [
							{ code: 'missing_reference', message: 'The device is gone.', node_id: 'a1' },
							{ code: 'no_trigger', message: 'No trigger.' },
						],
						suspendedReason: null,
					},
					graph,
					nodeTypes,
				},
			});

			const problems = wrapper.findAll('[data-test-id="status-problem"]');

			expect(problems).toHaveLength(2);
			expect(problems[0]?.text()).toContain('automations.runs.problems.missing_reference');
			// No word of its own: the editor's, or the backend's
			expect(problems[1]?.text()).toContain('No trigger.');
			expect(problems[1]?.find('[data-test-id="status-node"]').exists()).toBe(false);

			expect(problems[0]?.find('[data-test-id="status-node"]').element.tagName).toBe('BUTTON');

			await problems[0]?.find('[data-test-id="status-node"]').trigger('click');

			expect(wrapper.emitted('focus')).toEqual([['a1']]);
		});
	});
});
