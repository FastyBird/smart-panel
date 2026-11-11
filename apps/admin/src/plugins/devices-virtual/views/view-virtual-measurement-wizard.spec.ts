/* eslint-disable vue/one-component-per-file -- The two components are isolated UI stubs for navigation tests. */
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewVirtualMeasurementWizard from './view-virtual-measurement-wizard.vue';

const { push, route } = vi.hoisted(() => ({ push: vi.fn(), route: { query: {} as Record<string, string> } }));
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device' } }));
vi.mock('../components/wizard/virtual-wizard-shell.vue', () => ({
	default: defineComponent({
		name: 'VirtualWizardShell',
		props: { busy: Boolean },
		template: '<div><slot /></div>',
	}),
}));
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
		route.query = {};
		const wrapper = mount(ViewVirtualMeasurementWizard);
		const shell = wrapper.findComponent({ name: 'VirtualWizardShell' });
		const editor = wrapper.findComponent({ name: 'VirtualMeasurementEditor' });
		expect(editor.props('mode')).toBe('sensor_aggregate');
		editor.vm.$emit('busy', true);
		await wrapper.vm.$nextTick();
		expect(shell.props('busy')).toBe(true);
		editor.vm.$emit('busy', false);
		await wrapper.vm.$nextTick();
		expect(shell.props('busy')).toBe(false);
		editor.vm.$emit('created', 'committed-device');
		expect(push).toHaveBeenCalledWith({ name: 'device', params: { id: 'committed-device' } });
	});

	it('opens the numeric conversion editor when the route asks for a transform', () => {
		route.query = { mode: 'sensor_transform' };
		const wrapper = mount(ViewVirtualMeasurementWizard);
		expect(wrapper.findComponent({ name: 'VirtualMeasurementEditor' }).props('mode')).toBe('sensor_transform');
	});
});
