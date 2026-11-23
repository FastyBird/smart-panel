import { describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { mount } from '@vue/test-utils';

import type { IMcpClient } from '../schemas/client.types';

import McpClientActions from './mcp-client-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const client = {
	id: 'c1',
	name: 'Test agent',
	credentialRevoked: false,
} as unknown as IMcpClient;

const mountActions = () =>
	mount(McpClientActions, {
		props: { client },
		global: {
			stubs: {
				ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
				ElButton: { name: 'ElButton', template: '<button><slot name="icon" /><slot /></button>' },
				ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
				ElDropdownMenu: { name: 'ElDropdownMenu', template: '<ul><slot /></ul>' },
				ElDropdownItem: { name: 'ElDropdownItem', props: ['command', 'disabled', 'divided'], template: '<li><slot /></li>' },
			},
		},
	});

describe('McpClientActions', () => {
	// Spec section 4: icon-only buttons only for edit and more, each with an aria-label
	it('renders edit and more as labelled icon buttons', () => {
		const wrapper = mountActions();
		const buttons = wrapper.findAll('button');

		expect(buttons.map((button) => button.attributes('data-test-id'))).toEqual(['edit-mcp-client', 'more-mcp-client']);
		expect(wrapper.findAllComponents(Icon)).toHaveLength(2);

		for (const button of buttons) {
			expect(button.attributes('aria-label')).toBeTruthy();
		}
	});

	it('gives both icon buttons a tooltip', () => {
		const wrapper = mountActions();

		expect(wrapper.findAllComponents({ name: 'ElTooltip' }).map((tooltip) => tooltip.props('content'))).toEqual([
			'mcpModule.actions.edit',
			'mcpModule.actions.more',
		]);
	});

	it('lists rotate first and the destructive actions last, after one divider', () => {
		const wrapper = mountActions();
		const items = wrapper.findAllComponents({ name: 'ElDropdownItem' });

		expect(items.map((item) => item.props('command'))).toEqual(['rotate', 'revoke', 'delete']);
		expect(items.map((item) => item.props('divided') === true || item.props('divided') === '')).toEqual([false, true, false]);
		expect(items[1].classes()).toContain('text-danger!');
		expect(items[2].classes()).toContain('text-danger!');
	});

	it('disables revoke once the credential is revoked', () => {
		const wrapper = mount(McpClientActions, {
			props: { client: { ...client, credentialRevoked: true } },
			global: { stubs: { ElDropdownItem: { name: 'ElDropdownItem', props: ['command', 'disabled'], template: '<li><slot /></li>' } } },
		});

		const revoke = wrapper.findAllComponents({ name: 'ElDropdownItem' }).find((item) => item.props('command') === 'revoke');

		expect(revoke?.props('disabled')).toBe(true);
	});

	it('emits the chosen menu command with the client', () => {
		const wrapper = mountActions();

		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'rotate');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'delete');

		expect(wrapper.emitted('rotate')).toEqual([[client]]);
		expect(wrapper.emitted('delete')).toEqual([[client]]);
	});
});
