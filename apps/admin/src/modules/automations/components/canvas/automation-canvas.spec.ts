import { nextTick } from 'vue';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { VueFlow, useVueFlow } from '@vue-flow/core';
import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AUTOMATION_GRAPH_MAX_NODES, AUTOMATION_GRAPH_POSITION_LIMIT, AutomationNodeKind } from '../../automations.constants';
import type { IAutomationGraph } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { IAutomationCanvasProps } from './automation-canvas.types';
import AutomationCanvas from './automation-canvas.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

const nodeType = (type: string, kind: AutomationNodeKind, inputs: string[], outputs: string[]): IAutomationNodeType => ({
	type,
	kind,
	name: `Name of ${type}`,
	description: '',
	ports: { inputs, outputs },
	configSchema: { type: 'object', properties: { title: { type: 'string' } } },
});

const nodeTypes: IAutomationNodeType[] = [
	nodeType('manual.start', AutomationNodeKind.trigger, [], ['out']),
	nodeType('time.window', AutomationNodeKind.condition, ['in'], ['yes', 'no']),
	nodeType('notification.send', AutomationNodeKind.action, ['in'], ['done', 'error']),
];

const graph: IAutomationGraph = {
	version: 1,
	nodes: [
		{ id: 't1', type: 'manual.start', position: { x: 40, y: 60 }, config: {} },
		{ id: 'c1', type: 'time.window', position: { x: 400, y: 60 }, config: { from: '22:00', to: '06:00' } },
		{ id: 'a1', type: 'notification.send', position: { x: 760, y: 0 }, config: { title: 'Night' } },
		{ id: 'a2', type: 'notification.send', position: { x: 760, y: 120 }, config: { title: 'Day', nested_key: { camelKey: [1, 2] } } },
	],
	edges: [
		{ id: 'e1', source: 't1', source_port: 'out', target: 'c1', target_port: 'in' },
		{ id: 'e2', source: 'c1', source_port: 'yes', target: 'a1', target_port: 'in' },
		{ id: 'e3', source: 'c1', source_port: 'no', target: 'a2', target_port: 'in' },
	],
};

interface ICanvasExposed {
	getGraph: () => IAutomationGraph;
	addNode: (type: string, position?: { x: number; y: number }) => string | null;
	removeNode: (id: string) => void;
	checkConnection: (candidate: { source: string; source_port: string; target: string; target_port: string }) => string | null;
}

describe('AutomationCanvas', (): void => {
	let wrapper: VueWrapper;

	beforeAll((): void => {
		// The canvas library measures its nodes; jsdom has nothing to measure with
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe(): void {}
				unobserve(): void {}
				disconnect(): void {}
			}
		);
	});

	const createWrapper = async (props: Partial<IAutomationCanvasProps> = {}): Promise<ICanvasExposed> => {
		wrapper = mount(AutomationCanvas, {
			props: { graph: JSON.parse(JSON.stringify(graph)) as IAutomationGraph, nodeTypes, ...props },
			attachTo: document.body,
		});

		await flushPromises();

		return wrapper.vm as unknown as ICanvasExposed;
	};

	const lastGraph = (): IAutomationGraph | undefined => {
		const emitted = wrapper.emitted('update:graph');

		return emitted?.[emitted.length - 1]?.[0] as IAutomationGraph | undefined;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('gives back the graph it was given, through the canvas library and unchanged', async (): Promise<void> => {
		const canvas = await createWrapper();

		expect(canvas.getGraph()).toEqual(graph);
		expect(wrapper.emitted('update:graph')).toBeUndefined();
	});

	it('draws a card for every node, with its kind and the name of its type', async (): Promise<void> => {
		await createWrapper();

		const cards = wrapper.findAll('.automation-node-card');

		expect(cards).toHaveLength(4);
		expect(cards.map((card) => card.attributes('data-test-kind'))).toEqual(['trigger', 'condition', 'action', 'action']);
		expect(cards[1]?.find('[data-test-id="node-title"]').text()).toBe('Name of time.window');
		expect(cards[1]?.find('[data-test-id="node-summary"]').text()).toBe('from: 22:00 · to: 06:00');
	});

	it('gives every card the handles of its type, and a trigger none to connect into', async (): Promise<void> => {
		await createWrapper();

		const handlesOf = (id: string): string[] =>
			wrapper
				.findAll(`.vue-flow__node[data-id="${id}"] .vue-flow__handle`)
				.map((handle) => `${handle.classes().includes('target') ? 'in' : 'out'}:${handle.attributes('data-test-port')}`);

		expect(handlesOf('t1')).toEqual(['out:out']);
		expect(handlesOf('c1')).toEqual(['in:in', 'out:yes', 'out:no']);
		expect(handlesOf('a1')).toEqual(['in:in', 'out:done', 'out:error']);
	});

	it('refuses the connections the backend would refuse', async (): Promise<void> => {
		const canvas = await createWrapper();

		expect(canvas.checkConnection({ source: 'c1', source_port: 'no', target: 't1', target_port: 'in' })).toBe('into_trigger');
		expect(canvas.checkConnection({ source: 'a1', source_port: 'done', target: 'c1', target_port: 'in' })).toBe('cycle');
		expect(canvas.checkConnection({ source: 'c1', source_port: 'yes', target: 'a1', target_port: 'in' })).toBe('duplicate');
		expect(canvas.checkConnection({ source: 'c1', source_port: 'done', target: 'a2', target_port: 'in' })).toBe('unknown_port');
		expect(canvas.checkConnection({ source: 'a1', source_port: 'done', target: 'a2', target_port: 'in' })).toBeNull();
	});

	it('adds a node of a known type and tells the graph', async (): Promise<void> => {
		const canvas = await createWrapper();

		const id = canvas.addNode('notification.send', { x: 100.4, y: 300 });

		await flushPromises();

		expect(id).toMatch(/^n_/);
		expect(lastGraph()).toEqual({
			...graph,
			nodes: [...graph.nodes, { id, type: 'notification.send', position: { x: 100, y: 300 }, config: {} }],
		});
	});

	it('does not add a node of an unknown type, in read-only mode, or beyond the limit', async (): Promise<void> => {
		const canvas = await createWrapper();

		expect(canvas.addNode('plugin.gone', { x: 0, y: 0 })).toBeNull();

		await wrapper.setProps({ readonly: true });

		expect(canvas.addNode('manual.start', { x: 0, y: 0 })).toBeNull();

		wrapper.unmount();

		const full: IAutomationGraph = {
			version: 1,
			nodes: Array.from({ length: AUTOMATION_GRAPH_MAX_NODES }, (_, index) => ({
				id: `n${index}`,
				type: 'manual.start',
				position: { x: 0, y: index * 100 },
				config: {},
			})),
			edges: [],
		};

		const fullCanvas = await createWrapper({ graph: full });

		expect(fullCanvas.addNode('manual.start', { x: 500, y: 0 })).toBeNull();
		expect(wrapper.emitted('reject')).toEqual([['limit']]);
		expect(wrapper.emitted('update:graph')).toBeUndefined();
	});

	it('removes a node together with the edges attached to it', async (): Promise<void> => {
		const canvas = await createWrapper();

		canvas.removeNode('a2');

		await flushPromises();

		expect(lastGraph()).toEqual({
			...graph,
			nodes: graph.nodes.filter((node) => node.id !== 'a2'),
			edges: graph.edges.filter((edge) => edge.id !== 'e3'),
		});
	});

	it('follows a configuration changed from outside without telling it back', async (): Promise<void> => {
		const canvas = await createWrapper();

		const edited: IAutomationGraph = {
			...graph,
			nodes: graph.nodes.map((node) => (node.id === 'a1' ? { ...node, config: { title: 'Changed' } } : node)),
		};

		await wrapper.setProps({ graph: edited });
		await flushPromises();

		expect(canvas.getGraph()).toEqual(edited);
		expect(wrapper.find('.vue-flow__node[data-id="a1"] [data-test-id="node-summary"]').text()).toBe('title: Changed');
		expect(wrapper.emitted('update:graph')).toBeUndefined();
	});

	it('puts a card dragged beyond the limit where it is stored, not where it was dropped', async (): Promise<void> => {
		await createWrapper();

		const flow = useVueFlow(wrapper.findComponent(VueFlow).props('id') as string);

		// The end of a drag, as the library reports it
		flow.updateNodePositions(
			[
				{
					id: 'a1',
					position: { x: AUTOMATION_GRAPH_POSITION_LIMIT + 5_000, y: -AUTOMATION_GRAPH_POSITION_LIMIT - 20 },
					from: { x: 760, y: 0 },
					distance: { x: 0, y: 0 },
					dimensions: { width: 280, height: 56 },
				},
			],
			true,
			false
		);
		await flushPromises();

		const limit = { x: AUTOMATION_GRAPH_POSITION_LIMIT, y: -AUTOMATION_GRAPH_POSITION_LIMIT };

		expect(lastGraph()?.nodes.find((node) => node.id === 'a1')?.position).toEqual(limit);
		expect(flow.findNode('a1')?.position).toEqual(limit);
		expect(wrapper.find('.vue-flow__node[data-id="a1"]').attributes('style')).toContain(`translate(${limit.x}px,${limit.y}px)`);

		// The echo of what was told is not news to the canvas
		await wrapper.setProps({ graph: lastGraph() });
		await flushPromises();

		expect(flow.findNode('a1')?.position).toEqual(limit);
		expect(wrapper.emitted('update:graph')).toHaveLength(1);
	});

	it('rebuilds itself from a graph with another structure, edges included', async (): Promise<void> => {
		const canvas = await createWrapper();

		const smaller: IAutomationGraph = { version: 1, nodes: graph.nodes.slice(0, 2), edges: graph.edges.slice(0, 1) };

		await wrapper.setProps({ graph: smaller });
		await flushPromises();

		expect(canvas.getGraph()).toEqual(smaller);

		// Back again, as an undo does: edges that were there before must not be refused as duplicates
		await wrapper.setProps({ graph: JSON.parse(JSON.stringify(graph)) as IAutomationGraph });
		await flushPromises();

		expect(canvas.getGraph()).toEqual(graph);
		expect(wrapper.emitted('update:graph')).toBeUndefined();
	});

	it('shows a graph the backend would refuse as it is', async (): Promise<void> => {
		// An edge into a trigger and a node of a type that is gone: what is stored has to be shown to be repaired
		const broken: IAutomationGraph = {
			version: 1,
			nodes: [...graph.nodes, { id: 'x', type: 'plugin.gone', position: { x: 0, y: 300 }, config: { some: 'thing' } }],
			edges: [
				...graph.edges,
				{ id: 'e4', source: 'a1', source_port: 'done', target: 't1', target_port: 'in' },
				{ id: 'e5', source: 'x', source_port: 'left', target: 'a2', target_port: 'in' },
			],
		};

		const canvas = await createWrapper({ graph: broken });

		expect(canvas.getGraph()).toEqual(broken);
		expect(wrapper.find('.vue-flow__node[data-id="x"] .automation-node-card').attributes('data-test-kind')).toBe('unknown');
		expect(wrapper.findAll('.vue-flow__node[data-id="x"] .vue-flow__handle').map((handle) => handle.attributes('data-test-port'))).toEqual(['left']);
	});

	it('outlines the nodes the issues name', async (): Promise<void> => {
		await createWrapper({
			issues: [
				{ severity: 'warning', code: 'unreachable_node', message: 'Unreachable.', node_id: 'a2', blocking: false },
				{ severity: 'error', code: 'invalid_config', message: 'Not valid.', node_id: 'a1', field: 'title', blocking: true },
				{ severity: 'error', code: 'cycle', message: 'Loop.', node_ids: ['c1'], blocking: true },
			],
		});

		await nextTick();

		const issueOf = (id: string): string | undefined =>
			wrapper.find(`.vue-flow__node[data-id="${id}"] .automation-node-card`).attributes('data-test-issue');

		expect(issueOf('t1')).toBeUndefined();
		expect(issueOf('c1')).toBe('error');
		expect(issueOf('a1')).toBe('error');
		expect(issueOf('a2')).toBe('warning');
	});
});
