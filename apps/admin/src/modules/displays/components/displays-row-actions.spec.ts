import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDisplay } from '../store/displays.store.types';

import DisplaysRowActions from './displays-row-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(',')}` : key) }),
}));

const display = (overrides: Partial<IDisplay> = {}) => ({ id: 'd1', name: 'Kitchen', macAddress: 'aa:bb', ...overrides }) as unknown as IDisplay;

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

describe('DisplaysRowActions', () => {
	it('offers Edit as an icon and Detail and Remove in the more menu', async () => {
		const wrapper = mount(DisplaysRowActions, { props: { display: display() }, global: { stubs } });

		expect(wrapper.find('[data-test-id="edit-display"]').attributes('aria-label')).toBe('displaysModule.aria.edit:Kitchen');
		expect(wrapper.find('[data-test-id="remove-display"]').classes()).toContain('text-danger!');

		await wrapper.find('[data-test-id="edit-display"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'detail');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('edit')).toEqual([['d1']]);
		expect(wrapper.emitted('detail')).toEqual([['d1']]);
		expect(wrapper.emitted('remove')).toEqual([['d1']]);
	});

	it('names an unnamed display by its MAC address', () => {
		const wrapper = mount(DisplaysRowActions, { props: { display: display({ name: null }) }, global: { stubs } });

		expect(wrapper.find('[data-test-id="more-display"]').attributes('aria-label')).toBe('displaysModule.aria.more:aa:bb');
	});
});
