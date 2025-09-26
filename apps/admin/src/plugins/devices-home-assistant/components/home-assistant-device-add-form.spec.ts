import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

import HomeAssistantDeviceAddForm from './home-assistant-device-add-form.vue';

const mockSubmit = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDeviceAddForm: () => ({
			categoriesOptions: [
				{ value: 'generic', label: 'Generic' },
				{ value: 'lighting', label: 'Lighting' },
			],
			model: {
				id: 'abc123',
				name: '',
				category: '',
				description: '',
				haDeviceId: '',
			},
			formEl: {
				clearValidate: vi.fn(),
				resetFields: vi.fn(),
				validate: vi.fn().mockResolvedValue(true),
			},
			formChanged: { value: false },
			formResult: { value: 'none' },
			submit: mockSubmit, // make sure this is defined!
		}),
	};
});

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

describe('HomeAssistantDeviceAddForm.vue', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		wrapper = mount(HomeAssistantDeviceAddForm, {
			props: {
				id: 'abc123',
				type: DEVICES_HOME_ASSISTANT_TYPE,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
		expect(wrapper.find('input[name="haDeviceId"]').exists()).toBe(true);
	});

	it('renders category select with options', () => {
		const options = wrapper.findAllComponents({ name: 'ElOption' });
		expect(options.length).toBe(2);
		expect(options[0].props('label')).toBe('Generic');
	});

	it('emits update:remote-form-submit when remoteFormSubmit is true', async () => {
		await wrapper.setProps({ remoteFormSubmit: true });

		expect(wrapper.emitted('update:remote-form-submit')).toBeTruthy();
	});

	it('resets form when remoteFormReset is true', async () => {
		await wrapper.setProps({ remoteFormReset: true });

		expect(wrapper.emitted('update:remote-form-reset')).toBeTruthy();
	});

	it('emits update:remote-form-changed when formChanged changes', async () => {
		await wrapper.setProps({ remoteFormChanged: true });

		wrapper.vm.$emit('update:remote-form-changed', true);

		expect(wrapper.emitted('update:remote-form-changed')).toBeTruthy();
	});
});
