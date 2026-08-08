import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices';

import DevicePreviewTileAddForm from './device-preview-tile-add-form.vue';

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
		useTileAddForm: () => ({
			model: reactive({ id: 'tile-1', device: '' }),
			formEl: ref(null),
			formChanged: ref(false),
			submit: vi.fn(),
			formResult: ref('none'),
		}),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('DevicePreviewTileAddForm.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
	});

	it('does not offer a hidden device', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', hidden: true } as IDevice,
		];

		const wrapper = mount(DevicePreviewTileAddForm, {
			props: {
				id: 'tile-1',
				parent: 'page',
				parentId: 'page-1',
				withPosition: false,
				withSize: false,
			},
		});

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
	});
});
