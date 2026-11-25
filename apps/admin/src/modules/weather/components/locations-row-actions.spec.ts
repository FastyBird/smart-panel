import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IWeatherLocation } from '../store/locations.store.types';

import LocationsRowActions from './locations-row-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(',')}` : key) }),
}));

const location = { id: 'l1', name: 'Prague', type: 'weather-open-meteo' } as unknown as IWeatherLocation;

const stubs = {
	ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { name: 'ElDropdownItem', props: ['disabled', 'command'], template: '<li><slot /></li>' },
};

describe('LocationsRowActions', () => {
	it('offers Edit as an icon and Detail and Remove in the more menu', async () => {
		const wrapper = mount(LocationsRowActions, { props: { location, primary: false }, global: { stubs } });

		expect(wrapper.find('[data-test-id="edit-location"]').attributes('aria-label')).toBe('weatherModule.aria.edit:Prague');
		expect(wrapper.find('[data-test-id="more-location"]').attributes('aria-label')).toBe('weatherModule.aria.more:Prague');

		await wrapper.find('[data-test-id="edit-location"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'detail');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('edit')).toEqual([['l1']]);
		expect(wrapper.emitted('detail')).toEqual([['l1']]);
		expect(wrapper.emitted('remove')).toEqual([['l1']]);
	});

	it('keeps Remove off for the primary location, which the backend refuses to delete', () => {
		const wrapper = mount(LocationsRowActions, { props: { location, primary: true }, global: { stubs } });
		const removeItem = wrapper.findAllComponents({ name: 'ElDropdownItem' }).find((item) => item.props('command') === 'remove');

		expect(removeItem?.props('disabled')).toBe(true);
	});
});
