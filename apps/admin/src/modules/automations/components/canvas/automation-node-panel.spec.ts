import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationNodeKind } from '../../automations.constants';
import type { IAutomationGraphIssue } from '../../store/automations.store.types';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import AutomationIssuesList from './automation-issues-list.vue';
import AutomationNodeGenericForm from './automation-node-generic-form.vue';
import type { IAutomationNodePanelProps } from './automation-node-panel.types';
import AutomationNodePanel from './automation-node-panel.vue';

const translated: Record<string, string> = {
	'automations.editor.issues.unreachable_node': 'No trigger leads to this block.',
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => translated[key] ?? (params ? `${key} ${JSON.stringify(params)}` : key),
		te: (key: string) => key in translated,
	}),
}));

const delay: IAutomationNodeType = {
	type: 'flow.delay',
	kind: AutomationNodeKind.flow,
	name: 'Delay',
	description: 'Waits before continuing.',
	ports: { inputs: ['in'], outputs: ['out'] },
	configSchema: { type: 'object', properties: { seconds: { type: 'integer', minimum: 1 } }, required: ['seconds'], additionalProperties: false },
};

const issue = (overrides: Partial<IAutomationGraphIssue>): IAutomationGraphIssue => ({
	severity: 'error',
	code: 'invalid_config',
	message: 'Not valid.',
	blocking: true,
	node_id: 'd1',
	...overrides,
});

describe('AutomationNodePanel', (): void => {
	let wrapper: VueWrapper;

	const createWrapper = async (props: Partial<IAutomationNodePanelProps> = {}): Promise<void> => {
		wrapper = mount(AutomationNodePanel, {
			props: {
				node: { id: 'd1', type: 'flow.delay', position: { x: 0, y: 0 }, config: { seconds: 30 } },
				nodeType: delay,
				...props,
			},
		});

		await flushPromises();
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('is a panel beside the canvas, not a drawer over it', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.element.tagName).toBe('ASIDE');
		expect(document.querySelector('.el-drawer, .el-overlay')).toBeNull();
	});

	it('names the card and shows the generic form of its configuration', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.text()).toContain('Delay');
		expect(wrapper.text()).toContain('Waits before continuing.');
		expect(wrapper.text()).toContain('automations.editor.kinds.flow.label');

		const form = wrapper.findComponent(AutomationNodeGenericForm);

		expect(form.props()).toMatchObject({ nodeType: delay, config: { seconds: 30 }, disabled: false });
	});

	it('passes on what the form changes, and the wish to remove or close', async (): Promise<void> => {
		await createWrapper();

		wrapper.findComponent(AutomationNodeGenericForm).vm.$emit('update:config', { seconds: 60 }, 'seconds');
		wrapper.findComponent(AutomationNodeGenericForm).vm.$emit('update:invalid', true);

		await wrapper.find('[data-test-id="remove-node"]').trigger('click');
		await wrapper.find('[data-test-id="close-node-panel"]').trigger('click');

		expect(wrapper.emitted('update:config')).toEqual([[{ seconds: 60 }, 'seconds']]);
		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([true]);
		expect(wrapper.emitted('remove')).toHaveLength(1);
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('puts an issue about a field under that field and every other issue above the form', async (): Promise<void> => {
		await createWrapper({
			issues: [
				issue({ field: 'seconds', message: 'Seconds are required.' }),
				issue({ severity: 'warning', code: 'unreachable_node', message: 'No trigger leads to this node, so it never runs.' }),
				issue({ field: 'unknown.path', message: 'Something about a field the form does not show.' }),
			],
		});

		expect(wrapper.findComponent(AutomationNodeGenericForm).props('fieldErrors')).toEqual({ seconds: ['Seconds are required.'] });

		const alerts = wrapper.findAll('.el-alert').map((alert) => alert.text());

		// A structural problem is worded by the admin, a problem of the configuration by the backend
		expect(alerts).toEqual(['No trigger leads to this block.', 'Something about a field the form does not show.']);
	});

	it('explains a card that is no longer offered instead of showing a form', async (): Promise<void> => {
		await createWrapper({ node: { id: 'x', type: 'plugin.gone', position: { x: 0, y: 0 }, config: { a: 1 } }, nodeType: null });

		expect(wrapper.findComponent(AutomationNodeGenericForm).exists()).toBe(false);
		expect(wrapper.text()).toContain('automations.editor.texts.unknownNodeTypeHint {"type":"plugin.gone"}');
		expect(wrapper.text()).toContain('plugin.gone');
		expect(wrapper.find('[data-test-id="remove-node"]').exists()).toBe(true);
	});

	it('offers no removal while it is disabled', async (): Promise<void> => {
		await createWrapper({ disabled: true });

		expect(wrapper.find('[data-test-id="remove-node"]').exists()).toBe(false);
		expect(wrapper.findComponent(AutomationNodeGenericForm).props('disabled')).toBe(true);
	});
});

describe('AutomationIssuesList', (): void => {
	let wrapper: VueWrapper;

	const graph = {
		version: 1,
		nodes: [
			{ id: 't1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} },
			{ id: 'd1', type: 'flow.delay', position: { x: 0, y: 0 }, config: {} },
		],
		edges: [],
	};

	const issues: IAutomationGraphIssue[] = [
		issue({ severity: 'warning', code: 'unreachable_node', message: 'Unreachable.' }),
		issue({ field: 'seconds', message: 'Seconds are required.' }),
		issue({ code: 'no_trigger', message: 'An automation needs at least one trigger to start it.', node_id: undefined }),
		issue({ code: 'cycle', message: 'Loop.', node_id: undefined, node_ids: ['gone', 't1'] }),
	];

	afterEach((): void => {
		wrapper.unmount();
	});

	it('lists every issue, what stops the save first, and counts them', (): void => {
		wrapper = mount(AutomationIssuesList, { props: { issues, graph, nodeTypes: [delay] } });

		expect(wrapper.findAll('[data-test-issue]').map((item) => item.attributes('data-test-issue'))).toEqual([
			'invalid_config',
			'no_trigger',
			'cycle',
			'unreachable_node',
		]);
		expect(wrapper.find('[data-test-id="issues-errors"]').text()).toBe('automations.editor.texts.errorCount {"count":3}');
		expect(wrapper.find('[data-test-id="issues-warnings"]').text()).toBe('automations.editor.texts.warningCount {"count":1}');
	});

	it('names the node of an issue and leads to it', async (): Promise<void> => {
		wrapper = mount(AutomationIssuesList, { props: { issues, graph, nodeTypes: [delay] } });

		const items = wrapper.findAll('[data-test-issue]');

		expect(items[0]?.text()).toContain('Delay:');
		expect(items[0]?.text()).toContain('Seconds are required.');
		// An issue about the graph as a whole leads nowhere
		expect(items[1]?.find('[data-test-id="issue-node"]').exists()).toBe(false);
		// A type the catalogue does not hold is named by its identifier
		expect(items[2]?.text()).toContain('manual.start:');
		expect(items[3]?.text()).toContain('No trigger leads to this block.');

		await items[0]?.find('[data-test-id="issue-node"]').trigger('click');
		await items[2]?.find('[data-test-id="issue-node"]').trigger('click');

		// Of the nodes of a cycle the first one that is still on the canvas
		expect(wrapper.emitted('focus')).toEqual([['d1'], ['t1']]);
	});

	it('can be folded away', async (): Promise<void> => {
		wrapper = mount(AutomationIssuesList, { props: { issues, graph, nodeTypes: [delay] } });

		await wrapper.find('.automation-issues-list__header').trigger('click');

		expect(wrapper.findAll('[data-test-issue]')).toHaveLength(0);
		expect(wrapper.find('[data-test-id="issues-errors"]').exists()).toBe(true);
	});
});
