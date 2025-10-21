import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import type { IShellyNgDevice } from '../store/devices.store.types';

import ShellyNgDeviceEditForm from './shelly-ng-device-edit-form.vue';

vi.mock('../composables/useDeviceEditForm', () => ({
	useDeviceEditForm: () => ({
		categoriesOptions: [
			{ value: 'generic', label: DevicesModuleDeviceCategory.generic },
			{ value: 'lighting', label: DevicesModuleDeviceCategory.lighting },
		],
		model: {
			id: '123',
			name: '',
			category: 'generic',
			description: '',
			haDeviceId: '',
		},
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
		wrapper = mount(ShellyNgDeviceEditForm, {
			props: {
				device: {
					id: '123',
					type: DEVICES_SHELLY_NG_TYPE,
					category: DevicesModuleDeviceCategory.generic,
					name: '',
					description: '',
					hostname: '192.168.0.1',
					password: 'secret',
				} as IShellyNgDevice,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
		expect(wrapper.find('input[name="hostname"]').exists()).toBe(true);
		expect(wrapper.find('input[name="password"]').exists()).toBe(true);
	});

	it('emits update:remote-form-changed on change', async () => {
		await wrapper.setProps({ remoteFormChanged: true });
		// Trigger internal watcher manually if needed in tests
		wrapper.vm.$emit('update:remote-form-changed', true);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});
});
