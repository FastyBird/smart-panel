import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

import ShellyNgDeviceAddForm from './shelly-ng-device-add-form.vue';

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDevices: () => ({
			devices: ref([]),
			loaded: ref(true),
			fetchDevices: vi.fn(),
		}),
	};
});

const state = vi.hoisted(() => ({
	deviceInfo: undefined as unknown as { value: Record<string, unknown> | null },
	model: {} as Record<string, unknown>,
}));

const mockSubmit = vi.fn().mockResolvedValue(undefined);
const mockCheck = vi.fn();

vi.mock('../composables/useDeviceAddForm', async () => {
	const { reactive, ref } = await import('vue');

	return {
		useDeviceAddForm: () => {
			state.model = reactive({ id: 'abc123', name: '', category: '', description: '', identifier: 'shelly-device' });
			state.deviceInfo = ref(null);

			return {
				categoriesOptions: [
					{ value: 'generic', label: 'Generic' },
					{ value: 'lighting', label: 'Lighting' },
				],
				model: state.model,
				formEl: ref({
					clearValidate: vi.fn(),
					resetFields: vi.fn(),
					validate: vi.fn().mockResolvedValue(true),
				}),
				deviceInfo: state.deviceInfo,
				supportedDevices: ref([{ name: 'Shelly Plus 1', models: ['SHELLY-MODEL'], categories: [] }]),
				formChanged: { value: false },
				formResult: { value: 'none' },
				submit: mockSubmit,
				checkDevice: mockCheck,
			};
		},
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('ShellyNgDeviceAddForm.vue', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		vi.clearAllMocks();

		wrapper = mount(ShellyNgDeviceAddForm, {
			props: {
				id: 'abc123',
				type: DEVICES_SHELLY_NG_TYPE,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="hostname"]').exists()).toBe(true);
		expect(wrapper.find('input[name="password"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
	});

	it('renders category select with options', () => {
		const options = wrapper.findAllComponents({ name: 'ElOption' });
		expect(options.length).toBe(2);
		expect(options[0]?.props('label')).toBe('Generic');
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

	it('has no steps: Save submits the one form, which tests the device first when needed', async () => {
		await wrapper.setProps({ remoteFormSubmit: true });

		expect(mockSubmit).toHaveBeenCalledTimes(1);
		expect(wrapper.text()).not.toContain('devicesShellyNgPlugin.buttons.next.title');
	});

	it('shows the model and firmware as the connection test result', async () => {
		mockCheck.mockImplementationOnce(async () => {
			state.deviceInfo.value = { id: 'shelly-id', model: 'shelly-model', firmware: '1.0.0', name: null };

			return state.deviceInfo.value;
		});

		await wrapper.get('[data-test-id="test-connection-button"]').trigger('click');
		await flushPromises();

		expect(mockCheck).toHaveBeenCalledTimes(1);
		expect(wrapper.get('[data-test-id="test-connection-result"]').text()).toContain('Shelly Plus 1');
		expect(wrapper.get('[data-test-id="test-connection-result"]').text()).toContain('1.0.0');
	});

	it('shows why the device could not be read', async () => {
		mockCheck.mockRejectedValueOnce(new Error('Invalid password'));

		await wrapper.get('[data-test-id="test-connection-button"]').trigger('click');
		await flushPromises();

		expect(wrapper.get('[data-test-id="test-connection-result"]').text()).toContain('Invalid password');
	});

	it('fills the name from the device only while the field is empty', async () => {
		state.model.name = 'Desk lamp';
		state.deviceInfo.value = { id: 'shelly-id', model: 'shelly-model', firmware: '1.0.0', name: 'shellyplus1-a1b2' };
		await flushPromises();

		expect(state.model.name).toBe('Desk lamp');

		state.model.name = '';
		state.deviceInfo.value = { id: 'shelly-id-2', model: 'shelly-model', firmware: '1.0.0', name: 'Living room' };
		await flushPromises();

		expect(state.model.name).toBe('Living room');
	});
});
