import { ref } from 'vue';

import { createPinia, defineStore, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyPermissions } from '../../../openapi.constants';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../store/keys';
import { useDeviceControl } from './useDeviceControl';

const mockChannels: Record<string, IChannel> = {
	'ch-light': {
		id: 'ch-light',
		device: 'dev-1',
		type: 'device-channel',
		category: DevicesModuleChannelCategory.light,
		name: 'Light',
		identifier: 'light',
		description: null,
		parent: null,
		draft: false,
		createdAt: new Date(),
		updatedAt: null,
	},
	'ch-btn': {
		id: 'ch-btn',
		device: 'dev-1',
		type: 'device-channel',
		category: DevicesModuleChannelCategory.button,
		name: 'Button',
		identifier: 'btn',
		description: null,
		parent: null,
		draft: false,
		createdAt: new Date(),
		updatedAt: null,
	},
	'ch-bin': {
		id: 'ch-bin',
		device: 'dev-1',
		type: 'device-channel',
		category: DevicesModuleChannelCategory.binary_input,
		name: 'Binary Input',
		identifier: 'bin',
		description: null,
		parent: null,
		draft: false,
		createdAt: new Date(),
		updatedAt: null,
	},
	'ch-analog': {
		id: 'ch-analog',
		device: 'dev-1',
		type: 'device-channel',
		category: DevicesModuleChannelCategory.analog_input,
		name: 'Analog Input',
		identifier: 'analog',
		description: null,
		parent: null,
		draft: false,
		createdAt: new Date(),
		updatedAt: null,
	},
};

const mockProperties: Record<string, IChannelProperty[]> = {
	'ch-light': [
		{
			id: 'prop-light-brightness',
			channel: 'ch-light',
			permissions: [DevicesModuleChannelPropertyPermissions.rw],
		} as unknown as IChannelProperty,
	],
	'ch-btn': [
		{
			id: 'prop-btn-event',
			channel: 'ch-btn',
			permissions: [DevicesModuleChannelPropertyPermissions.rw], // Even if theoretically writable
		} as unknown as IChannelProperty,
	],
	'ch-bin': [
		{
			id: 'prop-bin-detected',
			channel: 'ch-bin',
			permissions: [DevicesModuleChannelPropertyPermissions.rw],
		} as unknown as IChannelProperty,
	],
	'ch-analog': [
		{
			id: 'prop-analog-value',
			channel: 'ch-analog',
			permissions: [DevicesModuleChannelPropertyPermissions.rw],
		} as unknown as IChannelProperty,
	],
};

const useMockDevicesStore = defineStore('devices-mock-store', () => ({
	data: ref<Record<string, IDevice>>({
		'dev-1': { id: 'dev-1', name: 'Test Device' } as IDevice,
	}),
	semaphore: ref({
		fetching: {
			item: [],
		},
	}),
}));

const useMockChannelsStore = defineStore('channels-mock-store', () => ({
	data: ref(mockChannels),
	semaphore: ref({
		fetching: {
			items: false,
		},
	}),
	firstLoad: ref(true),
}));

const useMockChannelsPropertiesStore = defineStore('channels-properties-mock-store', () => ({
	semaphore: ref({
		fetching: {
			items: false,
		},
	}),
	firstLoad: ref(true),
	findForChannel: (channelId: string) => mockProperties[channelId] ?? [],
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: (key: unknown) => {
				if (key === devicesStoreKey) {
					return useMockDevicesStore();
				}
				if (key === channelsStoreKey) {
					return useMockChannelsStore();
				}
				if (key === channelsPropertiesStoreKey) {
					return useMockChannelsPropertiesStore();
				}
				return {};
			},
		}),
		useSockets: () => ({
			sendCommand: vi.fn(),
		}),
	};
});

describe('useDeviceControl', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('excludes hardware input channels (button, binary_input, analog_input) from controllable channels', () => {
		const { controllableChannels, hasControllableProperties } = useDeviceControl({ id: 'dev-1' });

		expect(hasControllableProperties.value).toBe(true);
		expect(controllableChannels.value).toHaveLength(1);
		expect(controllableChannels.value[0].id).toBe('ch-light');
	});
});
