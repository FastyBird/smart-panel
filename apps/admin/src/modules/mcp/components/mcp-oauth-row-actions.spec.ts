import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import McpOAuthRowActions from './mcp-oauth-row-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElButton: { name: 'ElButton', props: ['disabled'], template: '<button :disabled="disabled"><slot name="icon" /><slot /></button>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { name: 'ElDropdownMenu', template: '<ul><slot /></ul>' },
	ElDropdownItem: { name: 'ElDropdownItem', props: ['command', 'disabled'], template: '<li><slot /></li>' },
};

const mountActions = (props: Record<string, unknown> = {}) => mount(McpOAuthRowActions, { props: { name: 'Codex', ...props }, global: { stubs } });

describe('McpOAuthRowActions', () => {
	it('shows Edit only on rows that can be edited', () => {
		expect(mountActions().find('[data-test-id="mcp-oauth-row-edit"]').exists()).toBe(false);
		expect(mountActions({ editable: true }).find('[data-test-id="mcp-oauth-row-edit"]').exists()).toBe(true);
	});

	it('labels the icon buttons and gives them tooltips', () => {
		const wrapper = mountActions({ editable: true });

		expect(wrapper.findAllComponents({ name: 'ElTooltip' }).map((tooltip) => tooltip.props('content'))).toEqual([
			'mcpModule.actions.edit',
			'mcpModule.actions.more',
		]);

		for (const button of wrapper.findAll('button')) {
			expect(button.attributes('aria-label')).toBeTruthy();
		}
	});

	it('keeps Revoke in the menu as a destructive item, disabled when the row cannot be revoked', () => {
		const wrapper = mountActions({ revokeDisabled: true });
		const revoke = wrapper.findComponent({ name: 'ElDropdownItem' });

		expect(revoke.classes()).toContain('text-danger!');
		expect(revoke.props('disabled')).toBe(true);
	});

	it('emits edit and revoke', async () => {
		const wrapper = mountActions({ editable: true });

		await wrapper.find('[data-test-id="mcp-oauth-row-edit"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'revoke');

		expect(wrapper.emitted('edit')).toHaveLength(1);
		expect(wrapper.emitted('revoke')).toHaveLength(1);
	});
});
