import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory, DevicesModuleDeviceConnectionStatus } from '../../../../openapi.constants';
import type { IDevice } from '../../store/devices.store.types';

import DevicesRowList from './devices-row-list.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('./devices-table-column-icon.vue', () => ({ default: defineComponent({ template: '<span />' }) }));

const device = (id: string, status: DevicesModuleDeviceConnectionStatus): IDevice =>
	({ id, name: `Device ${id}`, category: DevicesModuleDeviceCategory.lighting, status: { status } }) as unknown as IDevice;

const render = (props: Partial<InstanceType<typeof DevicesRowList>['$props']> = {}) =>
	mount(DevicesRowList, { props: { items: [], loading: false, filtersActive: false, ...props } });

describe('DevicesRowList', () => {
	it('lists every device with its category and a status tag, and opens it', async () => {
		const wrapper = render({
			items: [device('a', DevicesModuleDeviceConnectionStatus.connected), device('b', DevicesModuleDeviceConnectionStatus.lost)],
		});

		const rows = wrapper.findAll('[data-test-id="devices-row"]');

		expect(rows).toHaveLength(2);
		expect(rows[0].text()).toContain('Device a');
		expect(rows[0].text()).toContain('devicesModule.categories.devices.lighting');
		expect(rows[0].text()).toContain('devicesModule.states.connected');

		await rows[1].trigger('click');

		expect(wrapper.emitted('detail')).toEqual([['b']]);
	});

	it('says it is loading before the first devices arrive', () => {
		expect(render({ loading: true }).findComponent({ name: 'StateView' }).props('kind')).toBe('loading');
	});

	it('offers to reset the filters when they hide every device', async () => {
		const wrapper = render({ filtersActive: true });

		expect(wrapper.text()).toContain('devicesModule.texts.devices.noFilteredDevices');

		await wrapper.find('button').trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('says there are no devices yet', () => {
		expect(render().text()).toContain('devicesModule.texts.devices.noDevices');
	});
});
