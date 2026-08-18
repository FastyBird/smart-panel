/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
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
		if (context.componentType === 'devicepower') {
			return {
				channels: [
					{
						identifier: `devicePower:${context.componentKey}`,
						name: `Battery: ${context.componentKey}`,
						category: ChannelCategory.BATTERY,
						properties: [],
					},
				],
			};
		}
		if (context.componentType === 'switch') {
			return {
				channels: [
					{
						identifier: `switch:${context.componentKey}`,
						name: `Switch: ${context.componentKey}`,
						category: ChannelCategory.SWITCHER,
						properties: [],
					},
				],
			};
		}
		return null;
	}),
	interpolateTemplate: jest.fn((template: string, context: any) =>
		template.replace(/\{key\}/g, String(context.componentKey)),
	),
	getDerivation: jest.fn(),
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

	getEmConfig: jest.fn(),
	getEmStatus: jest.fn(),
	getEmDataStatus: jest.fn(),
	getEm1Config: jest.fn(),
	getEm1Status: jest.fn(),
	getEm1DataStatus: jest.fn(),
} as unknown as jest.Mocked<ShellyRpcClientService>;

jest.mock('../../../spec/channels', () => {
	const { ChannelCategory, PropertyCategory } = jest.requireActual('../../../modules/devices/devices.constants');

	const common = (format?: any) => ({
		permissions: ['r', 'w'] as any as PermissionType[],
		data_type: 'string' as any as DataTypeType,
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
				[PropertyCategory.GRID_EXPORT]: { ...common(), data_type: 'number' as any },
			},
		},
		[ChannelCategory.ELECTRICAL_POWER]: {
			properties: {
				[PropertyCategory.POWER]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.VOLTAGE]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.CURRENT]: { ...common(), data_type: 'number' as any },
				[PropertyCategory.FREQUENCY]: { ...common(), data_type: 'number' as any },
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
	DEVICES_SHELLY_NG_PLUGIN_NAME: 'devices-shelly-ng-plugin',
	ComponentType: {
		SWITCH: 'switch',
		COVER: 'cover',
		LIGHT: 'light',
		INPUT: 'input',
		DEVICE_POWER: 'devicepower',
		HUMIDITY: 'humidity',
		TEMPERATURE: 'temperature',
		PM: 'pm1',
		EM: 'em',
		EM_DATA: 'emdata',
		EM1: 'em1',
		EM1_DATA: 'em1data',
		WIFI: 'wifi',
		ETHERNET: 'ethernet',
	},
	DeviceProfile: {
		SWITCH: 'switch',
		COVER: 'cover',
	},
	AddressType: {
		ETHERNET: 'ethernet',
		WIFI: 'wifi',
	},
	ADDRESS_PRIORITY: {
		ethernet: 0,
		wifi: 1,
	},
	DESCRIPTORS: {},
}));

const mockTransformerRegistry = {
	get: jest.fn().mockReturnValue({
		read: jest.fn((v) => v),
		write: jest.fn((v) => v),
		canRead: jest.fn().mockReturnValue(true),
		canWrite: jest.fn().mockReturnValue(true),
	}),
	has: jest.fn().mockReturnValue(true),
} as any;

const mockPropertyMappingStorage = {
	store: jest.fn(),
	get: jest.fn(),
	remove: jest.fn(),
	clear: jest.fn(),
	getPropertyIdsForChannel: jest.fn(),
} as any;

const mockDeviceAddressService = {
	getPreferredAddress: jest.fn().mockResolvedValue('192.168.1.10'),
	getPreferredAddressOrMigrate: jest.fn().mockResolvedValue('192.168.1.10'),
	getPreferredAddresses: jest.fn().mockResolvedValue(new Map()),
	syncAddresses: jest.fn().mockResolvedValue(undefined),
	upsertAddress: jest.fn().mockResolvedValue(undefined),
	findDeviceByCanonicalMac: jest.fn().mockResolvedValue(null),
	setCanonicalMac: jest.fn().mockResolvedValue(undefined),
	setHasEthernet: jest.fn().mockResolvedValue(undefined),
	getAddresses: jest.fn().mockResolvedValue([]),
	getLegacyHostname: jest.fn().mockResolvedValue(null),
} as any;

const mockProvisionQueue = new DeviceProvisionQueueService();

const makeService = () =>
	new DeviceManagerService(
		mockRpc as any,
		mockDevicesService,
		mockChannelsService,
		mockChannelsPropertiesService,
		mockMappingLoaderService,
		mockTransformerRegistry,
		mockPropertyMappingStorage,
		mockProvisionQueue,
		mockDeviceAddressService,
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
			password: 'pass',
			category: DeviceCategory.SWITCHER,
		} as any;

		mockDevicesService.findOne.mockResolvedValue(device);

		// Spy private getSpecification to bypass DESCRIPTORS
		jest.spyOn<any, any>(svc as any, 'getSpecification').mockReturnValue({
			models: ['SOME-MODEL'],
			system: [{ type: 'wifi' }],
		});

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

describe('DeviceManagerService energy meters', () => {
	const baseDeviceInfo = {
		id: 'shelly-dev-id',
		mac: 'mac',
		model: 'SPEM-003CEBEU',
		fw_id: 'fw',
		ver: '1.2.3',
		app: 'app',
		auth_en: false,
		auth_domain: null,
		discoverable: true,
		key: 'key',
		batch: 'batch',
		fw_sbits: 'sbits',
	};

	const arrange = (svc: any, components: { key: string }[]) => {
		jest.spyOn<any, any>(svc, 'getSpecification').mockReturnValue({
			models: ['SPEM-003CEBEU'],
			system: [{ type: 'wifi' }],
		});

		mockRpc.getDeviceInfo.mockResolvedValue(baseDeviceInfo as any);
		mockRpc.getComponents.mockResolvedValue(components.map((c) => ({ ...c, config: {}, status: {} })) as any);
		mockRpc.getSystemConfig.mockResolvedValue({
			device: { name: 'Main meter', eco_mode: false, mac: 'mac', fw_id: 'fw', discoverable: true },
			location: { tz: null, lat: null, lon: null },
			debug: { mqtt: { enabled: false }, websocket: { enabled: false }, udp: { addr: null } },
			rpc_udp: { dst_addr: '', listen_port: null },
			sntp: { server: '' },
			cfg_rev: 1,
		} as any);
		mockRpc.getWifiStatus.mockResolvedValue({ rssi: -55 } as any);

		mockChannelsService.findOneBy.mockResolvedValue(null);
		mockChannelsService.findAll.mockResolvedValue([]);

		let channelCounter = 0;
		mockChannelsService.create.mockImplementation(async (dto: any) => ({ id: `ch_${++channelCounter}`, ...dto }));
		mockChannelsService.update.mockImplementation(async (id: string, dto: any) => ({ id, ...dto }));

		let propCounter = 0;
		mockChannelsPropertiesService.findOneBy.mockResolvedValue(null);
		mockChannelsPropertiesService.create.mockImplementation(async (channelId: string, dto: any) => ({
			id: `p_${++propCounter}`,
			channel: channelId,
			...dto,
		}));
		mockChannelsPropertiesService.update.mockImplementation(async (id: string, dto: any) => ({ id, ...dto }));
	};

	const createdChannels = () =>
		mockChannelsService.create.mock.calls.map((call: any[]) => call[0]).filter((dto: any) => dto?.identifier);

	const propertiesOf = (identifier: string) => {
		const index = mockChannelsService.create.mock.calls.findIndex((call: any[]) => call[0]?.identifier === identifier);

		if (index === -1) {
			return [];
		}

		const channelId = `ch_${index + 1}`;

		return mockChannelsPropertiesService.create.mock.calls
			.filter((call: any[]) => call[0] === channelId)
			.map((call: any[]) => call[1]);
	};

	test('three-phase meter creates a channel per phase plus the device-reported total', async () => {
		const svc = makeService();
		const device = { id: 'db-em-1', password: null, category: DeviceCategory.SENSOR } as any;

		mockDevicesService.findOne.mockResolvedValue(device);
		arrange(svc, [{ key: 'em:0' }, { key: 'emdata:0' }]);

		mockRpc.getEmConfig.mockResolvedValue({ id: 0, name: null } as any);
		mockRpc.getEmStatus.mockResolvedValue({
			id: 0,
			a_current: 1.1,
			a_voltage: 231,
			a_act_power: 250,
			a_freq: 50,
			b_current: 2.2,
			b_voltage: 232,
			b_act_power: 500,
			b_freq: 50,
			c_current: 3.3,
			c_voltage: 233,
			c_act_power: 750,
			c_freq: 50,
			n_current: null,
			total_current: 6.6,
			total_act_power: 1500,
		} as any);
		mockRpc.getEmDataStatus.mockResolvedValue({
			id: 0,
			a_total_act_energy: 10,
			a_total_act_ret_energy: 1,
			b_total_act_energy: 20,
			b_total_act_ret_energy: 2,
			c_total_act_energy: 30,
			c_total_act_ret_energy: 3,
			total_act: 60,
			total_act_ret: 6,
		} as any);

		await svc.createOrUpdate(device.id);

		const identifiers = createdChannels().map((dto: any) => dto.identifier);

		expect(identifiers).toEqual(
			expect.arrayContaining([
				'power:0:a',
				'power:0:b',
				'power:0:c',
				'power:0:total',
				'energy:0:a',
				'energy:0:b',
				'energy:0:c',
				'energy:0:total',
			]),
		);

		// The total comes straight from the meter, never summed by us.
		const total = propertiesOf('power:0:total');

		expect(total.find((prop: any) => prop.category === PropertyCategory.POWER)?.value).toBe(1500);

		// Phase B carries the full instantaneous set the spec allows.
		expect(
			propertiesOf('power:0:b')
				.map((prop: any) => prop.category)
				.sort(),
		).toEqual(
			[PropertyCategory.CURRENT, PropertyCategory.FREQUENCY, PropertyCategory.POWER, PropertyCategory.VOLTAGE].sort(),
		);

		// Returned energy is the only spec property that can carry it.
		expect(propertiesOf('energy:0:c').find((prop: any) => prop.category === PropertyCategory.GRID_EXPORT)?.value).toBe(
			3,
		);
	});

	test('a phase with no CT attached is skipped rather than written without its required power', async () => {
		const svc = makeService();
		const device = { id: 'db-em-2', password: null, category: DeviceCategory.SENSOR } as any;

		mockDevicesService.findOne.mockResolvedValue(device);
		arrange(svc, [{ key: 'em:0' }]);

		mockRpc.getEmConfig.mockResolvedValue({ id: 0, name: null } as any);
		mockRpc.getEmStatus.mockResolvedValue({
			id: 0,
			a_current: 1.1,
			a_voltage: 231,
			a_act_power: 250,
			a_freq: 50,
			b_current: null,
			b_voltage: null,
			b_act_power: null,
			b_freq: null,
			c_current: null,
			c_voltage: null,
			c_act_power: null,
			c_freq: null,
			n_current: null,
			total_current: 1.1,
			total_act_power: 250,
		} as any);

		await svc.createOrUpdate(device.id);

		const identifiers = createdChannels().map((dto: any) => dto.identifier);

		expect(identifiers).toContain('power:0:a');
		expect(identifiers).not.toContain('power:0:b');
		expect(identifiers).not.toContain('power:0:c');
	});

	test('single-phase meters create one channel per em1 component', async () => {
		const svc = makeService();
		const device = { id: 'db-em-3', password: null, category: DeviceCategory.SWITCHER } as any;

		mockDevicesService.findOne.mockResolvedValue(device);
		arrange(svc, [{ key: 'em1:0' }, { key: 'em1:1' }, { key: 'em1data:0' }, { key: 'em1data:1' }]);

		mockRpc.getEm1Config.mockImplementation(async (_host: string, id: number) => ({ id, name: null }) as any);
		mockRpc.getEm1Status.mockImplementation(
			async (_host: string, id: number) =>
				({ id, current: 1 + id, voltage: 230, act_power: 100 * (id + 1), freq: 50 }) as any,
		);
		mockRpc.getEm1DataStatus.mockImplementation(
			async (_host: string, id: number) => ({ id, total_act_energy: 10 * (id + 1), total_act_ret_energy: id }) as any,
		);

		await svc.createOrUpdate(device.id);

		const identifiers = createdChannels().map((dto: any) => dto.identifier);

		expect(identifiers).toEqual(expect.arrayContaining(['power:0', 'power:1', 'energy:0', 'energy:1']));

		// No three-phase channels: this profile has no `em` component at all.
		expect(identifiers.some((identifier: string) => identifier.endsWith(':total'))).toBe(false);

		expect(propertiesOf('power:1').find((prop: any) => prop.category === PropertyCategory.POWER)?.value).toBe(200);
	});
});

describe('DeviceManagerService battery devices', () => {
	// The component type is matched against the key prefix the device reports,
	// which is lower-case. While the constant read `devicePower` this branch never
	// ran, so battery devices such as the Plus H&T got no battery channel at all.
	test('a devicepower component produces a battery channel', async () => {
		const svc = makeService();
		const device = { id: 'db-ht-1', password: null, category: DeviceCategory.SENSOR } as any;

		mockDevicesService.findOne.mockResolvedValue(device);

		jest.spyOn<any, any>(svc as any, 'getSpecification').mockReturnValue({
			models: ['SNSN-0013A'],
			system: [{ type: 'wifi' }],
		});

		mockRpc.getDeviceInfo.mockResolvedValue({
			id: 'shelly-ht',
			mac: 'mac',
			model: 'SNSN-0013A',
			fw_id: 'fw',
			ver: '1.2.3',
			app: 'app',
			auth_en: false,
			auth_domain: null,
			discoverable: true,
			key: 'key',
			batch: 'batch',
			fw_sbits: 'sbits',
		} as any);

		mockRpc.getComponents.mockResolvedValue([{ key: 'devicepower:0', config: {}, status: {} }] as any);
		mockRpc.getSystemConfig.mockResolvedValue({
			device: { name: 'Hall sensor', eco_mode: false, mac: 'mac', fw_id: 'fw', discoverable: true },
			location: { tz: null, lat: null, lon: null },
			debug: { mqtt: { enabled: false }, websocket: { enabled: false }, udp: { addr: null } },
			rpc_udp: { dst_addr: '', listen_port: null },
			sntp: { server: '' },
			cfg_rev: 1,
		} as any);
		mockRpc.getWifiStatus.mockResolvedValue({ rssi: -70 } as any);
		mockRpc.getDevicePowerStatus.mockResolvedValue({
			id: 0,
			battery: { V: 5.9, percent: 88 },
			external: { present: false },
		} as any);

		mockChannelsService.findOneBy.mockResolvedValue(null);
		mockChannelsService.findAll.mockResolvedValue([]);

		let channelCounter = 0;
		mockChannelsService.create.mockImplementation(async (dto: any) => ({ id: `ch_${++channelCounter}`, ...dto }));
		mockChannelsService.update.mockImplementation(async (id: string, dto: any) => ({ id, ...dto }));

		mockChannelsPropertiesService.findOneBy.mockResolvedValue(null);
		let propCounter = 0;
		mockChannelsPropertiesService.create.mockImplementation(async (channelId: string, dto: any) => ({
			id: `p_${++propCounter}`,
			channel: channelId,
			...dto,
		}));
		mockChannelsPropertiesService.update.mockImplementation(async (id: string, dto: any) => ({ id, ...dto }));

		await svc.createOrUpdate(device.id);

		const battery = mockChannelsService.create.mock.calls
			.map((call: any[]) => call[0])
			.find((dto: any) => dto?.category === ChannelCategory.BATTERY);

		expect(battery).toBeTruthy();

		const percentage = mockChannelsPropertiesService.create.mock.calls
			.map((call: any[]) => call[1])
			.find((dto: any) => dto?.category === PropertyCategory.PERCENTAGE);

		expect(percentage?.value).toBe(88);
	});
});

describe('DeviceProvisionQueueService', () => {
	test('enqueue serializes work per device', async () => {
		const queue = new DeviceProvisionQueueService();

		const order: string[] = [];

		const slow = queue.enqueue('dev-1', async () => {
			order.push('first');
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		const fast = queue.enqueue('dev-1', async () => {
			order.push('second');
		});

		await Promise.all([slow, fast]);

		expect(order).toEqual(['first', 'second']);
	});

	test('normalizeValue clamps oversized numbers', () => {
		const svc: any = makeService();

		// With format range
		expect(
			svc.normalizeValue(200000, {
				format: [0, 10000],
			}),
		).toBe(10000);

		// Without format, keep value (mapping should define limits)
		expect(svc.normalizeValue(500000, null, null)).toBe(500000);
	});

	describe('applyDerivation', () => {
		test('threshold derivation: maps numeric ranges to enum values', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'threshold',
				thresholds: [{ max: 20, value: 'low' }, { max: 80, value: 'medium' }, { value: 'high' }],
			};

			expect(svc.applyDerivation(derivation, 15)).toBe('low');
			expect(svc.applyDerivation(derivation, 50)).toBe('medium');
			expect(svc.applyDerivation(derivation, 90)).toBe('high');
			expect(svc.applyDerivation(derivation, 100)).toBe('high');
		});

		test('threshold derivation: handles min boundaries', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'threshold',
				thresholds: [{ min: 0, max: 10, value: 'low' }, { min: 11, max: 20, value: 'medium' }, { value: 'high' }],
			};

			expect(svc.applyDerivation(derivation, 5)).toBe('low');
			expect(svc.applyDerivation(derivation, 15)).toBe('medium');
			expect(svc.applyDerivation(derivation, 25)).toBe('high');
		});

		test('threshold derivation: returns undefined for non-numeric values', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'threshold',
				thresholds: [{ value: 'test' }],
			};

			expect(svc.applyDerivation(derivation, 'not-a-number')).toBeUndefined();
			expect(svc.applyDerivation(derivation, true)).toBeUndefined();
		});

		test('boolean_map derivation: maps boolean values to enum values', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'boolean_map',
				true_value: 'locked',
				false_value: 'unlocked',
			};

			expect(svc.applyDerivation(derivation, true)).toBe('locked');
			expect(svc.applyDerivation(derivation, false)).toBe('unlocked');
			expect(svc.applyDerivation(derivation, 1)).toBe('locked'); // truthy
			expect(svc.applyDerivation(derivation, 0)).toBe('unlocked'); // falsy
		});

		test('position_status derivation: maps position to status', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'position_status',
				closed_value: 'closed',
				opened_value: 'opened',
				partial_value: 'stopped',
			};

			expect(svc.applyDerivation(derivation, 0)).toBe('closed');
			expect(svc.applyDerivation(derivation, 100)).toBe('opened');
			expect(svc.applyDerivation(derivation, 50)).toBe('stopped');
		});

		test('position_status derivation: uses closed_value as default for partial', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'position_status',
				closed_value: 'closed',
				opened_value: 'opened',
			};

			expect(svc.applyDerivation(derivation, 0)).toBe('closed');
			expect(svc.applyDerivation(derivation, 100)).toBe('opened');
			expect(svc.applyDerivation(derivation, 50)).toBe('closed'); // default to closed
		});

		test('position_status derivation: returns undefined for non-numeric values', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'position_status',
				closed_value: 'closed',
				opened_value: 'opened',
			};

			expect(svc.applyDerivation(derivation, 'not-a-number')).toBeUndefined();
		});

		test('returns undefined when derivation is undefined', () => {
			const svc: any = makeService();
			expect(svc.applyDerivation(undefined, 50)).toBeUndefined();
		});

		test('returns undefined for unknown derivation type', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'unknown_type',
			} as any;

			expect(svc.applyDerivation(derivation, 50)).toBeUndefined();
		});

		test('handles errors gracefully', () => {
			const svc: any = makeService();

			const derivation = {
				type: 'threshold',
				thresholds: null, // This will cause an error
			} as any;

			// Should not throw, but return undefined
			expect(() => svc.applyDerivation(derivation, 50)).not.toThrow();
			expect(svc.applyDerivation(derivation, 50)).toBeUndefined();
		});
	});
});
