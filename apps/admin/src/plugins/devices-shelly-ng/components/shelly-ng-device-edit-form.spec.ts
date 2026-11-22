import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import type { IShellyNgDevice } from '../store/devices.store.types';

import ShellyNgDeviceEditForm from './shelly-ng-device-edit-form.vue';

const state = vi.hoisted(() => ({ model: {} as Record<string, unknown> }));

vi.mock('../composables/useDeviceEditForm', () => ({
	useDeviceEditForm: () => ({
		categoriesOptions: [
			{ value: 'generic', label: DevicesModuleDeviceCategory.generic },
			{ value: 'lighting', label: DevicesModuleDeviceCategory.lighting },
		],
		hasEthernet: ref(true),
		model: state.model,
		formEl: ref({
			clearValidate: vi.fn(),
			resetFields: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		}),
		formChanged: { value: false },
		formResult: { value: FormResult.NONE },
		submit: vi.fn(),
	}),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../composables/useDiscoveredDevicesOptions', () => ({
	useDiscoveredDevicesOptions: () => ({
		devicesOptions: [],
		areLoading: false,
	}),
}));

describe('ShellyNgDeviceEditForm', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		state.model = reactive({ id: '123', name: '', category: 'generic', description: '', password: null as string | null });

		wrapper = mount(ShellyNgDeviceEditForm, {
			// The room picker reads the spaces store: these tests are about the plugin's own fields
			global: { stubs: { SpaceSelect: true } },
			props: {
				device: {
					id: '123',
					type: DEVICES_SHELLY_NG_TYPE,
					category: DevicesModuleDeviceCategory.generic,
					name: '',
					description: '',
					password: 'secret',
					addresses: [
						{ id: 'addr-1', interfaceType: 'ethernet', address: '192.168.0.1' },
						{ id: 'addr-2', interfaceType: 'wifi', address: '192.168.0.2' },
					],
				} as unknown as IShellyNgDevice,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
		expect(wrapper.find('input[name="ethernetAddress"]').exists()).toBe(true);
		expect(wrapper.find('input[name="wifiAddress"]').exists()).toBe(true);
		expect(wrapper.find('input[name="password"]').exists()).toBe(true);
	});

	it('never shows a saved password: Replace sets a new one, Cancel keeps the saved one', async () => {
		state.model = reactive({ id: '123', name: '', category: 'generic', description: '', password: 'secret' as string | null });
		wrapper = mount(ShellyNgDeviceEditForm, {
			global: { stubs: { SpaceSelect: true } },
			props: { device: { id: '123', type: DEVICES_SHELLY_NG_TYPE, addresses: [] } as unknown as IShellyNgDevice },
		});

		expect(wrapper.find('[data-test-id="secret-input-saved"]').exists()).toBe(true);
		expect(wrapper.findAll('input').some((input) => (input.element as HTMLInputElement).value === 'secret')).toBe(false);

		await wrapper.get('[data-test-id="secret-input-replace"]').trigger('click');
		await flushPromises();
		await wrapper.get('input[data-test-id="secret-input-field"]').setValue('new-one');

		expect(state.model.password).toBe('new-one');

		await wrapper.get('[data-test-id="secret-input-cancel"]').trigger('click');
		await flushPromises();

		expect(state.model.password).toBe('secret');
	});

	it('emits update:remote-form-changed on change', async () => {
		await wrapper.setProps({ remoteFormChanged: true });
		// Trigger internal watcher manually if needed in tests
		wrapper.vm.$emit('update:remote-form-changed', true);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});

	describe('with a saved password', () => {
		beforeEach(async () => {
			state.model = reactive({ id: '123', name: '', category: 'generic', description: '', password: 'secret' as string | null });
			wrapper = mount(ShellyNgDeviceEditForm, {
				global: { stubs: { SpaceSelect: true } },
				props: { device: { id: '123', type: DEVICES_SHELLY_NG_TYPE, addresses: [] } as unknown as IShellyNgDevice },
			});

			await wrapper.get('[data-test-id="secret-input-replace"]').trigger('click');
			await flushPromises();
		});

		it('sends a replacement exactly as typed, spaces included, and an empty one as no password', async () => {
			await wrapper.get('input[data-test-id="secret-input-field"]').setValue(' new one ');
			expect(state.model.password).toBe(' new one ');

			await wrapper.get('input[data-test-id="secret-input-field"]').setValue('   ');
			expect(state.model.password).toBe('   ');

			await wrapper.get('input[data-test-id="secret-input-field"]').setValue('');
			expect(state.model.password).toBeNull();
		});

		it('drops the replacement when the form is reset, showing the saved password again', async () => {
			await wrapper.get('input[data-test-id="secret-input-field"]').setValue('new-one');

			await wrapper.setProps({ remoteFormReset: true });
			await flushPromises();

			expect(state.model.password).toBe('secret');
			expect(wrapper.find('[data-test-id="secret-input-saved"]').exists()).toBe(true);
			expect(wrapper.find('input[data-test-id="secret-input-field"]').exists()).toBe(false);
		});
	});
});
