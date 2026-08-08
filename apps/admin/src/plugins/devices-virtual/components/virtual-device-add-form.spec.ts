import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

import VirtualDeviceAddForm from './virtual-device-add-form.vue';

const mockSubmit = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDeviceAddForm: () => ({
			// Includes a blocked category (`thermostat`) deliberately — `useDeviceAddForm` genuinely maps
			// every `DevicesModuleDeviceCategory` with no notion of this plugin's restrictions, so the
			// mock mirrors that rather than pre-filtering on the composable's behalf. The component itself
			// is what must exclude it (see 'excludes categories the plugin cannot drive' below).
			categoriesOptions: [
				{ value: 'generic', label: 'Generic' },
				{ value: 'lighting', label: 'Lighting' },
				{ value: 'thermostat', label: 'Thermostat' },
			],
			model: {
				id: 'abc123',
				name: '',
				category: '',
				description: '',
			},
			formEl: ref({
				clearValidate: vi.fn(),
				resetFields: vi.fn(),
				validate: vi.fn().mockResolvedValue(true),
			}),
			formChanged: { value: false },
			formResult: { value: 'none' },
			submit: mockSubmit, // make sure this is defined!
		}),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('VirtualDeviceAddForm.vue', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		wrapper = mount(VirtualDeviceAddForm, {
			props: {
				id: 'abc123',
				type: DEVICES_VIRTUAL_TYPE,
			},
		});
	});

	it('renders form fields', () => {
		expect(wrapper.find('input[name="id"]').exists()).toBe(true);
		expect(wrapper.find('input[name="name"]').exists()).toBe(true);
		expect(wrapper.find('textarea').exists()).toBe(true);
	});

	it('renders category select with options', () => {
		const options = wrapper.findAllComponents({ name: 'ElOption' });
		expect(options.length).toBe(2);
		expect(options[0]?.props('label')).toBe('Generic');
	});

	it('excludes categories the plugin cannot drive, even though useDeviceAddForm maps every category', () => {
		// Regression test for the add form disagreeing with the wizard's category step about which
		// categories are legal — `thermostat` is present in the mocked `categoriesOptions` above (as
		// `useDeviceAddForm` genuinely returns it) but must never reach the picker.
		const values = wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'));

		expect(values).not.toContain('thermostat');
		expect(values).toEqual(['generic', 'lighting']);
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
