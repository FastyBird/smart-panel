import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices';
import { SceneCategory } from '../../../modules/scenes/scenes.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

import LocalSceneActionAddForm from './local-scene-action-add-form.vue';

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

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('LocalSceneActionAddForm.vue', () => {
	beforeEach(() => {
		mockDevices.value = [];
	});

	it('does not offer a hidden device', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', category: DevicesModuleDeviceCategory.generic, hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', category: DevicesModuleDeviceCategory.generic, hidden: true } as IDevice,
		];

		const wrapper = mount(LocalSceneActionAddForm, {
			props: {
				id: 'action-1',
				sceneId: 'scene-1',
			},
		});

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
	});

	it('does not offer a hidden device among recommended options either', () => {
		mockDevices.value = [
			{ id: 'visible', name: 'Visible device', category: DevicesModuleDeviceCategory.lighting, hidden: false } as IDevice,
			{ id: 'concealed', name: 'Concealed device', category: DevicesModuleDeviceCategory.lighting, hidden: true } as IDevice,
		];

		const wrapper = mount(LocalSceneActionAddForm, {
			props: {
				id: 'action-1',
				sceneId: 'scene-1',
				sceneCategory: SceneCategory.lighting,
			},
		});

		const options = wrapper.findAllComponents({ name: 'ElOption' });

		expect(options.map((option) => option.props('value'))).toEqual(['visible']);
	});
});
