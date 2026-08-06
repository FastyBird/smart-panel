import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices';

import DeviceDetailPageAddForm from './device-detail-page-add-form.vue';

const mockDevices = ref<IDevice[]>([]);
const mockFetchDevices = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../modules/devices', async () => {
	const actual = await vi.importActual('../../../modules/devices');

	return {
		...actual,
		useDevices: () => ({
			devices: mockDevices,
			fetchDevices: mockFetchDevices,
			areLoading: ref(false),
			loaded: ref(true),
		}),
	};
});

vi.mock('../../../modules/dashboard', async () => {
	const actual = await vi.importActual('../../../modules/dashboard');

	return {
		...actual,
		usePageAddForm: () => ({
			model: reactive({ id: 'page-1', title: '', device: '', icon: null, order: 0, showTopBar: true, displays: [] }),
			formEl: ref(null),
			formChanged: ref(false),
			submit: vi.fn(),
			formResult: ref('none'),
		}),
	};
});

vi.mock('../../../modules/displays', async () => {
	const { defineComponent } = await import('vue');

	return {
		DisplaysMultiSelect: defineComponent({
			name: 'DisplaysMultiSelect',
			template: '<div />',
		}),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('DeviceDetailPageAddForm.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
	});

	it('does not offer a hidden device', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', hidden: true } as IDevice,
		];

		const wrapper = mount(DeviceDetailPageAddForm, {
			props: {
				id: 'page-1',
			},
		});

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
	});
});
