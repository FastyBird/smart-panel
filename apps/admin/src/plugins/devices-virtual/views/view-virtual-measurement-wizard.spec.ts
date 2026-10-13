/* eslint-disable vue/one-component-per-file -- The two components are isolated UI stubs for navigation tests. */
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewVirtualMeasurementWizard from './view-virtual-measurement-wizard.vue';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device' } }));
vi.mock('element-plus', () => ({
	ElButton: defineComponent({ props: { disabled: Boolean }, template: '<button :disabled="disabled"><slot /></button>' }),
}));
vi.mock('../components/virtual-measurement-editor.vue', () => ({
	default: defineComponent({ name: 'VirtualMeasurementEditor', emits: ['busy', 'created'], template: '<div />' }),
}));

describe('measurement creation navigation', () => {
	it('disables Back while saving and retains navigation to the newly created device', async () => {
		push.mockClear();
		const wrapper = mount(ViewVirtualMeasurementWizard);
		const editor = wrapper.findComponent({ name: 'VirtualMeasurementEditor' });
		editor.vm.$emit('busy', true);
		await wrapper.vm.$nextTick();
		expect(wrapper.get('button').element.disabled).toBe(true);
		await wrapper.get('button').trigger('click');
		expect(push).not.toHaveBeenCalled();
		editor.vm.$emit('busy', false);
		await wrapper.vm.$nextTick();
		expect(wrapper.get('button').element.disabled).toBe(false);
		editor.vm.$emit('created', 'committed-device');
		expect(push).toHaveBeenCalledWith({ name: 'device', params: { id: 'committed-device' } });
	});
});
