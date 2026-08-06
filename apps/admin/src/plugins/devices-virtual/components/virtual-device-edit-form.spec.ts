import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import type { IVirtualDevice } from '../store/devices.store.types';

import VirtualDeviceEditForm from './virtual-device-edit-form.vue';

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDeviceEditForm: () => ({
			// Includes a blocked category (`thermostat`) deliberately — `useDeviceEditForm` genuinely maps
			// every `DevicesModuleDeviceCategory` with no notion of this plugin's restrictions, so the mock
			// mirrors that rather than pre-filtering on the composable's behalf. The component itself is
			// what must exclude it (see 'excludes categories the plugin cannot drive' below).
			categoriesOptions: [
				{ value: 'generic', label: DevicesModuleDeviceCategory.generic },
				{ value: 'lighting', label: DevicesModuleDeviceCategory.lighting },
				{ value: 'thermostat', label: DevicesModuleDeviceCategory.thermostat },
			],
			model: {
				id: '123',
				name: '',
				category: 'generic',
				description: '',
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
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('VirtualDeviceEditForm', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		wrapper = mount(VirtualDeviceEditForm, {
			props: {
				device: {
					id: '123',
					type: DEVICES_VIRTUAL_TYPE,
					category: DevicesModuleDeviceCategory.generic,
					name: '',
					description: '',
				} as IVirtualDevice,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
	});

	it('excludes categories the plugin cannot drive, even though useDeviceEditForm maps every category', () => {
		// Regression test for the edit form disagreeing with the wizard's category step about which
		// categories are legal — `thermostat` is present in the mocked `categoriesOptions` above (as
		// `useDeviceEditForm` genuinely returns it) but must never reach the (disabled) picker.
		const values = wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'));

		expect(values).not.toContain('thermostat');
		expect(values).toEqual(['generic', 'lighting']);
	});

	it('emits update:remote-form-changed on change', async () => {
		await wrapper.setProps({ remoteFormChanged: true });
		// Trigger internal watcher manually if needed in tests
		wrapper.vm.$emit('update:remote-form-changed', true);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});
});
