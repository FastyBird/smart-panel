import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import { AUTOMATION_NODE_DRAG_MIME, AutomationNodeKind } from '../../automations.constants';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { IAutomationPaletteProps } from './automation-palette.types';
import AutomationPalette from './automation-palette.vue';

const translated: Record<string, string> = {
	'automations.editor.nodeTypes.flow.delay.name': 'Wait a while',
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => translated[key] ?? key,
		te: (key: string) => key in translated,
	}),
}));

const nodeType = (type: string, kind: AutomationNodeKind, name: string): IAutomationNodeType => ({
	type,
	kind,
	name,
	description: `About ${name}`,
	ports: { inputs: [], outputs: [] },
	configSchema: {},
});

// In the order the backend lists them: by type
const nodeTypes: IAutomationNodeType[] = [
	nodeType('device.property.changed', AutomationNodeKind.trigger, 'Device value changes'),
	nodeType('device.property.compare', AutomationNodeKind.condition, 'Device value is'),
	nodeType('device.property.set', AutomationNodeKind.action, 'Set device value'),
	nodeType('flow.delay', AutomationNodeKind.flow, 'Delay'),
	nodeType('manual.start', AutomationNodeKind.trigger, 'Manual start'),
	nodeType('notification.send', AutomationNodeKind.action, 'Send notification'),
	nodeType('plugin.card', AutomationNodeKind.action, 'A plugin card'),
];

describe('AutomationPalette', (): void => {
	let wrapper: VueWrapper;

	const createWrapper = (props: Partial<IAutomationPaletteProps> = {}): void => {
		wrapper = mount(AutomationPalette, { props: { nodeTypes, ...props } });
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('groups the catalogue as When / And / Then / Flow', (): void => {
		createWrapper();

		const groups = wrapper.findAll('[data-test-group]');

		expect(groups.map((group) => group.attributes('data-test-group'))).toEqual(['trigger', 'condition', 'action', 'flow']);
		expect(groups.map((group) => group.find('.automation-palette__label').text())).toEqual([
			'automations.editor.kinds.trigger.label',
			'automations.editor.kinds.condition.label',
			'automations.editor.kinds.action.label',
			'automations.editor.kinds.flow.label',
		]);
		expect(groups.map((group) => group.findAll('[data-test-palette]').map((item) => item.attributes('data-test-palette')))).toEqual([
			['device.property.changed', 'manual.start'],
			['device.property.compare'],
			['plugin.card', 'notification.send', 'device.property.set'],
			['flow.delay'],
		]);
	});

	it('names a card by its translation and falls back to the name the backend gives', (): void => {
		createWrapper();

		expect(wrapper.find('[data-test-palette="flow.delay"]').text()).toBe('Wait a while');
		expect(wrapper.find('[data-test-palette="plugin.card"]').text()).toBe('A plugin card');
		expect(wrapper.find('[data-test-palette="plugin.card"]').attributes('title')).toBe('About A plugin card');
	});

	it('leaves out a group nothing is offered for and says so when nothing is offered at all', async (): Promise<void> => {
		createWrapper({ nodeTypes: nodeTypes.filter((item) => item.kind !== AutomationNodeKind.flow) });

		expect(wrapper.findAll('[data-test-group]').map((group) => group.attributes('data-test-group'))).toEqual(['trigger', 'condition', 'action']);

		await wrapper.setProps({ nodeTypes: [] });

		expect(wrapper.findAll('[data-test-group]')).toHaveLength(0);
		expect(wrapper.text()).toContain('automations.editor.texts.noNodeTypes');
	});

	it('adds a card on a tap and from the keyboard, because a touch cannot drag', async (): Promise<void> => {
		createWrapper();

		await wrapper.find('[data-test-palette="manual.start"]').trigger('click');
		await wrapper.find('[data-test-palette="flow.delay"]').trigger('keydown', { key: 'Enter' });

		expect(wrapper.emitted('add')).toEqual([['manual.start'], ['flow.delay']]);
	});

	it('carries the type of the card when it is dragged', async (): Promise<void> => {
		createWrapper();

		const dataTransfer = { setData: vi.fn(), effectAllowed: '' };

		await wrapper.find('[data-test-palette="manual.start"]').trigger('dragstart', { dataTransfer });

		expect(wrapper.find('[data-test-palette="manual.start"]').attributes('draggable')).toBe('true');
		expect(dataTransfer.setData).toHaveBeenCalledWith(AUTOMATION_NODE_DRAG_MIME, 'manual.start');
		expect(dataTransfer.effectAllowed).toBe('copy');
		expect(wrapper.emitted('add')).toBeUndefined();
	});

	it('adds and drags nothing while it is disabled', async (): Promise<void> => {
		createWrapper({ disabled: true });

		const dataTransfer = { setData: vi.fn(), effectAllowed: '' };

		await wrapper.find('[data-test-palette="manual.start"]').trigger('click');
		await wrapper.find('[data-test-palette="manual.start"]').trigger('dragstart', { dataTransfer });

		expect(wrapper.emitted('add')).toBeUndefined();
		expect(dataTransfer.setData).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test-palette="manual.start"]').attributes('draggable')).toBe('false');
	});
});
