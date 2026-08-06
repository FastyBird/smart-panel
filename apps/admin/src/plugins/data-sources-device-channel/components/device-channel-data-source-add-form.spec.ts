import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices';

import DeviceChannelDataSourceAddForm from './device-channel-data-source-add-form.vue';

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
		useChannels: () => ({
			channels: ref([]),
			fetchChannels: vi.fn().mockResolvedValue(undefined),
			areLoading: ref(false),
		}),
		useChannelsProperties: () => ({
			properties: ref([]),
			fetchProperties: vi.fn().mockResolvedValue(undefined),
			areLoading: ref(false),
		}),
	};
});

vi.mock('../../../modules/dashboard', async () => {
	const actual = await vi.importActual('../../../modules/dashboard');

	return {
		...actual,
		useDataSourceAddForm: () => ({
			model: reactive({ id: 'data-source-1', device: '', channel: '', property: '', icon: null }),
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

describe('DeviceChannelDataSourceAddForm.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
	});

	it('does not offer a hidden device', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', hidden: true } as IDevice,
		];

		const wrapper = mount(DeviceChannelDataSourceAddForm, {
			props: {
				id: 'data-source-1',
				parent: 'tile',
				parentId: 'tile-1',
			},
		});

		const options = wrapper.findAllComponents({ name: 'ElOption' });
		const deviceOptionValues = options.map((option) => option.props('value')).filter((value) => value === 'visible' || value === 'concealed');

		expect(deviceOptionValues).toEqual(['visible']);
	});
});
