/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import {
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';

import { DeviceManagerService } from './device-manager.service';
import { ShellyRpcClientService } from './shelly-rpc-client.service';

const mockDevicesService = {
	findOne: jest.fn(),
} as any;

const mockChannelsService = {
	findOneBy: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	findAll: jest.fn(),
	remove: jest.fn(),
} as any;

const mockChannelsPropertiesService = {
	findOneBy: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
} as any;

const mockMappingLoaderService = {
	findMatchingMapping: jest.fn().mockImplementation((context: any) => {
		// Return a valid mapping for switch components
		if (context.componentType === 'switch') {
			return {
				channels: [
					{
						identifier: `switch:${context.componentKey}`,
						name: `Switch: ${context.componentKey}`,
						category: 'switcher', // Maps to ChannelCategory.SWITCHER
					},
				],
			};
		}
		return null;
	}),
	interpolateTemplate: jest.fn((template: string, context: any) =>
		template.replace(/\{key\}/g, String(context.componentKey)),
	),
} as any;

const mockRpc = {
	getDeviceInfo: jest.fn(),
	getComponents: jest.fn(),
	getSystemConfig: jest.fn(),
	getWifiStatus: jest.fn(),

	getSwitchConfig: jest.fn(),
	getSwitchStatus: jest.fn(),

	getCoverConfig: jest.fn(),
	getCoverStatus: jest.fn(),

	getLightConfig: jest.fn(),
	getLightStatus: jest.fn(),

	getInputConfig: jest.fn(),
	getInputStatus: jest.fn(),

	getDevicePowerStatus: jest.fn(),

	getHumidityConfig: jest.fn(),
	getHumidityStatus: jest.fn(),

	getTemperatureConfig: jest.fn(),
	getTemperatureStatus: jest.fn(),

	getPm1Config: jest.fn(),
	getPm1Status: jest.fn(),
} as unknown as jest.Mocked<ShellyRpcClientService>;

jest.mock('../../../spec/channels', () => {
	const { ChannelCategory, PropertyCategory } = jest.requireActual('../../../modules/devices/devices.constants');

	const common = (format?: any) => ({
		permissions: ['r', 'w'] as any as PermissionType[],
		data_type: 'string' as any as DataTypeType,
		unit: null,
		format: format ?? null,
	});

	const channelsSchema = {
		[ChannelCategory.DEVICE_INFORMATION]: {
			properties: {
				[PropertyCategory.MANUFACTURER]: common(),
				[PropertyCategory.MODEL]: common(),
				[PropertyCategory.SERIAL_NUMBER]: common(),
				[PropertyCategory.FIRMWARE_REVISION]: common(),
				[PropertyCategory.STATUS]: common([
					ConnectionState.CONNECTED,
					ConnectionState.DISCONNECTED,
					ConnectionState.UNKNOWN,
				]),
				[PropertyCategory.LINK_QUALITY]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.SWITCHER]: {
			properties: {
				[PropertyCategory.ON]: { ...common(), data_type: 'bool' as any },
			},
		},
		[ChannelCategory.ELECTRICAL_ENERGY]: {
			properties: {
				[PropertyCategory.CONSUMPTION]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.ELECTRICAL_POWER]: {
			properties: {
				[PropertyCategory.POWER]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.VOLTAGE]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.CURRENT]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.LIGHT]: {
			properties: {
				[PropertyCategory.ON]: { ...common(), data_type: 'bool' as any },
				[PropertyCategory.BRIGHTNESS]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.WINDOW_COVERING]: {
			properties: {
				[PropertyCategory.STATUS]: common(),
				[PropertyCategory.POSITION]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.COMMAND]: common(['open', 'close', 'stop']),
			},
		},
		[ChannelCategory.HUMIDITY]: {
			properties: {
				[PropertyCategory.HUMIDITY]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.TEMPERATURE]: {
			properties: {
				[PropertyCategory.TEMPERATURE]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.BATTERY]: {
			properties: {
				[PropertyCategory.PERCENTAGE]: { ...common(), data_type: 'number' as any },
			},
		},
	};

	return { channelsSchema };
});

jest.mock('../devices-shelly-ng.constants', () => ({
	DEVICES_SHELLY_NG_TYPE: 'devices-shelly-ng',
	ComponentType: {
		SWITCH: 'switch',
		COVER: 'cover',
		LIGHT: 'light',
		INPUT: 'input',
		DEVICE_POWER: 'devicepower',
		HUMIDITY: 'humidity',
		TEMPERATURE: 'temperature',
		PM: 'pm1',
		WIFI: 'wifi',
	},
	DeviceProfile: {
		SWITCH: 'switch',
		COVER: 'cover',
	},
	DESCRIPTORS: {},
}));

const makeService = () =>
	new DeviceManagerService(
		mockRpc as any,
		mockDevicesService,
		mockChannelsService,
		mockChannelsPropertiesService,
		mockMappingLoaderService,
	);

beforeEach(() => {
	jest.clearAllMocks();
});

describe('DeviceManagerService.getDeviceInfo', () => {
	test('groups components by type, collects numeric ids, returns name from system config', async () => {
		const svc = makeService();

		mockRpc.getDeviceInfo.mockResolvedValue({
			id: 'dev-id',
			mac: 'mac',
			model: 'SOME-MODEL',
			fw_id: 'fw',
			ver: '1.0',
			app: 'app',
			auth_en: false,
			auth_domain: null,
			discoverable: true,
			key: 'key',
			batch: 'batch',
			fw_sbits: 'sbits',
		} as any);

		mockRpc.getComponents.mockResolvedValue([
			{ key: 'switch:0', config: {}, status: {} },
			{ key: 'switch:1', config: {}, status: {} },
			{ key: 'wifi:0', config: {}, status: {} },
			{ key: 'other', config: {}, status: {} },
			{ key: 'switch:1', config: {}, status: {} }, // duplicate
		]);

		mockRpc.getSystemConfig.mockResolvedValue({
			device: { name: 'Pretty name', eco_mode: false, mac: 'mac', fw_id: 'fw', discoverable: true },
			location: { tz: null, lat: null, lon: null },
			debug: { mqtt: { enabled: false }, websocket: { enabled: false }, udp: { addr: null } },
			rpc_udp: { dst_addr: '', listen_port: null },
			sntp: { server: '' },
			cfg_rev: 1,
		} as any);

		const out = await svc.getDeviceInfo('host', undefined);

		expect(out.name).toBe('Pretty name');
		expect(out.components).toEqual([
			{ type: 'other', ids: [] },
			{ type: 'switch', ids: [0, 1] },
			{ type: 'wifi', ids: [0] },
		]);
	});
});

describe('DeviceManagerService.createOrUpdate', () => {
	test('throws if device not found', async () => {
		const svc = makeService();
		mockDevicesService.findOne.mockResolvedValue(null);

		await expect(svc.createOrUpdate('nope')).rejects.toThrow(DevicesShellyNgException);
	});

	test('happy path for a switch device: creates channels and props, returns device', async () => {
		const svc = makeService();

		const device = {
			id: 'db-dev-1',
			hostname: '192.168.1.10',
			password: 'pass',
			category: DeviceCategory.SWITCHER,
		} as any;

		mockDevicesService.findOne.mockResolvedValue(device);

		// Spy private getSpecification to bypass DESCRIPTORS
		jest.spyOn<any, any>(svc as any, 'getSpecification').mockReturnValue({ models: ['SOME-MODEL'] });

		// RPC device info & components
		mockRpc.getDeviceInfo.mockResolvedValue({
			id: 'shelly-dev-id',
			mac: 'mac',
			model: 'SOME-MODEL',
			fw_id: 'fw',
			ver: '1.2.3',
			app: 'app',
			profile: 'switch',
			auth_en: false,
			auth_domain: null,
			discoverable: true,
			key: 'key',
			batch: 'batch',
			fw_sbits: 'sbits',
		} as any);

		mockRpc.getComponents.mockResolvedValue([{ key: 'switch:0', config: {}, status: {} }]);

		mockRpc.getSystemConfig.mockResolvedValue({
			device: { name: 'Kitchen switch', eco_mode: false, mac: 'mac', fw_id: 'fw', discoverable: true },
			location: { tz: null, lat: null, lon: null },
			debug: { mqtt: { enabled: false }, websocket: { enabled: false }, udp: { addr: null } },
			rpc_udp: { dst_addr: '', listen_port: null },
			sntp: { server: '' },
			cfg_rev: 1,
		} as any);

		// WiFi RSSI available
		mockRpc.getWifiStatus.mockResolvedValue({ rssi: -60 } as any);

		// Switch config/status
		mockRpc.getSwitchConfig.mockResolvedValue({ id: 0, name: 'S0' } as any);
		mockRpc.getSwitchStatus.mockResolvedValue({ id: 0, output: true } as any);

		// Channels lookups:
		// Device Information channel already present? Simpler: pretend not present -> create
		mockChannelsService.findOneBy.mockImplementation(async () => {
			// Return null for all -> create new
			return null;
		});

		// Create channel returns an entity with an id
		let channelCounter = 0;
		mockChannelsService.create.mockImplementation(async (dto: any) => ({
			id: `ch_${++channelCounter}`,
			...dto,
		}));

		// Updates for props/channels
		mockChannelsService.update.mockImplementation(async (_id: string, dto: any) => ({
			id: _id,
			...dto,
		}));

		// Properties: no one exists -> create
		let propCounter = 0;
		mockChannelsPropertiesService.findOneBy.mockResolvedValue(null);
		mockChannelsPropertiesService.create.mockImplementation(async (_channelId: string, dto: any) => ({
			id: `p_${++propCounter}`,
			channel: _channelId,
			...dto,
		}));
		mockChannelsPropertiesService.update.mockImplementation(async (id: string, dto: any) => ({
			id,
			...dto,
		}));

		// No stale channels to remove
		mockChannelsService.findAll.mockResolvedValue([]);

		const out = await svc.createOrUpdate(device.id);

		expect(out).toBe(device);

		// Created Device Information + Switcher (+ maybe energy/power channels if present in status)
		expect(mockChannelsService.create).toHaveBeenCalled();
		// Manufacturer etc set
		expect(mockChannelsPropertiesService.create).toHaveBeenCalled();

		// Switch ON property was created with 'output' value
		const onCall = mockChannelsPropertiesService.create.mock.calls.find((c) => c[1]?.category === PropertyCategory.ON);
		expect(onCall).toBeTruthy();
	});
});
