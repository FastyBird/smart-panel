import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';

import ViewVirtualMeasurementWizard from './view-virtual-measurement-wizard.vue';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device' } }));
vi.mock('../components/virtual-measurement-editor.vue', () => ({
	default: defineComponent({
		name: 'VirtualMeasurementEditor',
		props: { mode: { type: String, default: '' } },
		emits: ['busy', 'created'],
		template: '<div />',
	}),
}));

describe('measurement creation navigation', () => {
	it('holds the wizard shell while saving and navigates to the newly created device', async () => {
		push.mockClear();
		const wrapper = mount(ViewVirtualMeasurementWizard);

		const editor = wrapper.findComponent({ name: 'VirtualMeasurementEditor' });
		expect(editor.props('mode')).toBe('sensor_aggregate');
		editor.vm.$emit('busy', true);
		await wrapper.vm.$nextTick();

		editor.vm.$emit('busy', false);
		await wrapper.vm.$nextTick();

		editor.vm.$emit('created', 'committed-device');
		expect(push).toHaveBeenCalledWith({ name: 'device', params: { id: 'committed-device' } });
	});

	it('opens the numeric conversion editor for the registered transform variant', () => {
		const wrapper = mount(ViewVirtualMeasurementWizard, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform } });
		expect(wrapper.findComponent({ name: 'VirtualMeasurementEditor' }).props('mode')).toBe('sensor_transform');
	});
});
