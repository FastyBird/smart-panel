import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlugin } from '../../../common';
import { DEVICES_MODULE_NAME } from '../../../modules/devices';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException } from '../devices-home-assistant.exceptions';

import { useHomeAssistantDiscoveredDevices } from './home-assistant-discovered-devices.store';
import type {
	IHomeAssistantDiscoveredDevice,
	IHomeAssistantDiscoveredDevicesSetActionPayload,
} from './home-assistant-discovered-devices.store.types';

const deviceId = '2fcdc656a7ae51e33482c8314b1d32b9';

const mockGetStore = vi.fn((key: symbol) => {
	switch (key.description) {
		case 'FB-Plugin-Devices-Home-Assistant-States':
			return {
				firstLoad: [],
				set: vi.fn(),
				unset: vi.fn(),
			};
		default:
			throw new Error(`Unknown store key requested: ${key.description}`);
	}
});

const mockBackendClient = {
	GET: vi.fn(),
};

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: DEVICES_HOME_ASSISTANT_TYPE,
		modules: [DEVICES_MODULE_NAME],
	} as IPlugin,
]);

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectStoresManager: vi.fn(() => ({
			getStore: mockGetStore,
		})),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
	};
});

describe('Home Assistant Discovered Devices Store', () => {
	let store: ReturnType<typeof useHomeAssistantDiscoveredDevices>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useHomeAssistantDiscoveredDevices();

		vi.clearAllMocks();
	});

	it('should fetch discovered devices', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: deviceId,
						name: 'Home Assistant device',
						entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
						adopted_device_id: null,
						states: [
							{
								entity_id: 'sensor.hall_heater_floot_temperature',
								state: '21.85',
								attributes: {
									state_class: 'measurement',
									unit_of_measurement: '°C',
									device_class: 'temperature',
									friendly_name: 'Chodba Topení Teplota Podlaha',
								},
								last_changed: '2025-05-02T20:15:02.441749+00:00',
								last_reported: '2025-05-02T20:15:02.441749+00:00',
								last_updated: '2025-05-02T20:15:02.441749+00:00',
							},
						],
					},
				],
			},
		});

		const result = await store.fetch();

		expect(result[0]?.id).toBe(deviceId);
		expect(store.firstLoadFinished()).toBe(true);
		expect(store.findAll()).toHaveLength(1);
		expect(store.findById(deviceId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch()).rejects.toThrow(DevicesHomeAssistantApiException);
	});

	it('should get discovered device by id', async () => {
		const testItem = {
			id: deviceId,
			name: 'Home Assistant device',
			entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
			adoptedDeviceId: null,
		};

		store.data[deviceId] = testItem as unknown as IHomeAssistantDiscoveredDevice;

		const found = store.findById(deviceId);
		expect(found).toEqual(testItem);
	});

	it('should set a discovered device manually', () => {
		const testItem: IHomeAssistantDiscoveredDevicesSetActionPayload = {
			id: deviceId,
			data: {
				name: 'Home Assistant device',
				entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
				adoptedDeviceId: null,
			},
		};

		const device = store.set(testItem);

		expect(device.id).toBe(deviceId);
		expect(store.findById(deviceId)).toEqual(device);
	});

	it('should unset discovered device', () => {
		const testItem: IHomeAssistantDiscoveredDevicesSetActionPayload = {
			id: deviceId,
			data: {
				name: 'Home Assistant device',
				entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
				adoptedDeviceId: null,
			},
		};

		const added = store.set(testItem);
		expect(store.data[deviceId]).toEqual(added);

		store.unset({ id: deviceId });

		expect(store.findAll()).toHaveLength(0);
	});
});
