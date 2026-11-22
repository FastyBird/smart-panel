import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { AutomationNodeKind } from '../../automations.constants';
import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import AutomationStepList from './automation-step-list.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, te: () => false }),
}));

const nodeType = (type: string, kind: AutomationNodeKind): IAutomationNodeType =>
	({
		type,
		kind,
		name: type,
		description: '',
		ports: { inputs: [], outputs: [] },
		configSchema: { type: 'object', properties: {} },
	}) as unknown as IAutomationNodeType;

const NODE_TYPES = [
	nodeType('manual.start', AutomationNodeKind.trigger),
	nodeType('flow.delay', AutomationNodeKind.action),
	nodeType('notification.send', AutomationNodeKind.action),
];

const node = (id: string, type: string, x: number, y = 0) => ({ id, type, position: { x, y }, config: {} });

const graph = (overrides: Partial<IAutomationGraph> = {}): IAutomationGraph =>
	({
		version: 1,
		nodes: [node('n3', 'notification.send', 720), node('n1', 'manual.start', 0), node('n2', 'flow.delay', 360), node('loose', 'flow.delay', 0, 400)],
		edges: [
			{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' },
			{ id: 'e2', source: 'n2', source_port: 'out', target: 'n3', target_port: 'in' },
		],
		...overrides,
	}) as IAutomationGraph;

const render = (props: Record<string, unknown> = {}) =>
	mount(AutomationStepList, {
		props: { graph: graph(), nodeTypes: NODE_TYPES, ...props },
		global: {
			stubs: {
				AutomationNodeCard: defineComponent({
					name: 'AutomationNodeCard',
					props: {
						title: { type: String, default: '' },
						issue: { type: String, default: undefined },
						domain: { type: String, default: undefined },
						kind: { type: String, default: null },
						run: { type: Object, default: undefined },
						selected: { type: Boolean, default: false },
					},
					template: '<div />',
				}),
			},
		},
	});

describe('AutomationStepList', () => {
	it('lists the steps in the order the flow runs, from the triggers, and the steps nothing leads to last', () => {
		const wrapper = render();
		const steps = wrapper.findAll('[data-test-id="automation-step"]');

		expect(steps.map((step) => step.attributes('data-step-id'))).toEqual(['n1', 'n2', 'n3', 'loose']);
		expect(steps.map((step) => step.text())).toEqual(['1', '2', '3', '4']);
		expect(wrapper.findAllComponents({ name: 'AutomationNodeCard' }).map((card) => card.props('kind'))).toEqual([
			AutomationNodeKind.trigger,
			AutomationNodeKind.action,
			AutomationNodeKind.action,
			AutomationNodeKind.action,
		]);
	});

	it('marks a step with its issue and its domain', () => {
		const wrapper = render({
			issues: [{ code: 'x', severity: 'error', message: 'Broken', node_id: 'n2' }],
			nodeDomain: (current: { config: Record<string, unknown> }) => ('lamp' in current.config ? 'lights' : undefined),
			graph: graph({
				nodes: [node('n1', 'manual.start', 0), { ...node('n2', 'flow.delay', 360), config: { lamp: true } }],
				edges: [{ id: 'e1', source: 'n1', source_port: 'out', target: 'n2', target_port: 'in' }],
			}),
		});

		const cards = wrapper.findAllComponents({ name: 'AutomationNodeCard' });

		expect(cards[1].props('issue')).toBe('error');
		expect(cards[1].props('domain')).toBe('lights');
		expect(cards[0].props('issue')).toBeUndefined();
		expect(cards[0].props('domain')).toBeUndefined();
	});

	it('lists a step once when two ports of one step lead to it', () => {
		const wrapper = render({
			graph: graph({
				nodes: [node('n1', 'manual.start', 0), node('n2', 'flow.delay', 360)],
				edges: [
					{ id: 'e1', source: 'n1', source_port: 'true', target: 'n2', target_port: 'in' },
					{ id: 'e2', source: 'n1', source_port: 'false', target: 'n2', target_port: 'in' },
				],
			}),
		});

		expect(wrapper.findAll('[data-test-id="automation-step"]').map((step) => step.attributes('data-step-id'))).toEqual(['n1', 'n2']);
	});

	it('shows what each step did in the run laid over the flow, and none for a step it did not reach', () => {
		const wrapper = render({
			run: {
				overlay: { nodes: { n1: { state: 'passed', visits: 1 }, n2: { state: 'failed', visits: 2, error: 'Broken' } }, edges: {} },
				ended: true,
			},
		});

		const cards = wrapper.findAllComponents({ name: 'AutomationNodeCard' });

		expect(cards[0].props('run')).toEqual(expect.objectContaining({ state: 'passed', visits: 1 }));
		expect(cards[1].props('run')).toEqual(expect.objectContaining({ state: 'failed', visits: 2 }));
		expect(cards[2].props('run')).toBeNull();
	});

	it('scrolls to a step it is pointed at, and marks it', async () => {
		const wrapper = render();
		const scroll = vi.fn();

		(wrapper.get('[data-step-id="n3"]').element as HTMLElement).scrollIntoView = scroll;

		(wrapper.vm as unknown as { focusStep: (id: string) => void }).focusStep('n3');
		await wrapper.vm.$nextTick();

		expect(scroll).toHaveBeenCalledTimes(1);
		expect(wrapper.findAllComponents({ name: 'AutomationNodeCard' })[2].props('selected')).toBe(true);
	});

	it('says when the flow has no steps', () => {
		const wrapper = render({ graph: graph({ nodes: [], edges: [] }) });

		expect(wrapper.find('[data-test-id="automation-step-list"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('automations.editor.texts.noSteps');
	});
});
