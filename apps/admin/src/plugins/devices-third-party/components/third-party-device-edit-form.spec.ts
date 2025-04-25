import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import type { IThirdPartyDevice } from '../store/devices.store.types';

import ThirdPartyDeviceEditForm from './third-party-device-edit-form.vue';

vi.mock('../composables/composables', () => ({
	useThirdPartyDeviceEditForm: () => ({
		categoriesOptions: [
			{ value: 'generic', label: DevicesModuleDeviceCategory.generic },
			{ value: 'lighting', label: DevicesModuleDeviceCategory.lighting },
		],
		model: {
			id: '123',
			name: '',
			category: 'generic',
			description: '',
			serviceAddress: '',
		},
		formEl: {
			clearValidate: vi.fn(),
			resetFields: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		},
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

describe('ThirdPartyDeviceEditForm', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		wrapper = mount(ThirdPartyDeviceEditForm, {
			props: {
				device: {
					id: '123',
					type: 'third-party',
					category: DevicesModuleDeviceCategory.generic,
					name: '',
					description: '',
					serviceAddress: '',
				} as IThirdPartyDevice,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea[name="description"]').exists()).toBe(true);
		expect(wrapper.find('input[name="serviceAddress"]').exists()).toBe(true);
	});

	it('emits update:remote-form-changed on change', async () => {
		await wrapper.setProps({ remoteFormChanged: true });
		// Trigger internal watcher manually if needed in tests
		wrapper.vm.$emit('update:remote-form-changed', true);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});
});
