/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_WLED_TYPE, WLED_CHANNEL_IDENTIFIERS } from '../devices-wled.constants';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from '../entities/devices-wled.entity';
import { WledDeviceContext, WledInfo, WledState } from '../interfaces/wled.interface';

import { WledDeviceMapperService } from './device-mapper.service';

describe('WledDeviceMapperService', () => {
	let service: WledDeviceMapperService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;

	// Quiet logger noise
	let logSpy: jest.SpyInstance;
	let debugSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errSpy: jest.SpyInstance;

	beforeAll(() => {
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		logSpy.mockRestore();
		debugSpy.mockRestore();
		warnSpy.mockRestore();
		errSpy.mockRestore();
	});

	const mockWledInfo: WledInfo = {
		version: '0.14.0',
		versionId: 2400000,
		ledInfo: {
			count: 30,
			fps: 30,
			power: 150,
			maxPower: 850,
			maxSegments: 32,
		},
		name: 'WLED Test Device',
		udpPort: 21324,
		isLive: false,
		liveModeSource: '',
		lm: '',
		sourceIp: '',
		wifi: { bssid: 'AA:BB:CC:DD:EE:FF', rssi: -55, channel: 6 },
		fileSystem: { used: 12000, total: 200000, presetsJson: 1000 },
		effectsCount: 185,
		palettesCount: 75,
		uptime: 12345,
		architecture: 'esp32',
		core: '2.0.14',
		freeHeap: 120000,
		brand: 'WLED',
		product: 'FOSS',
		mac: 'AA:BB:CC:DD:EE:FF',
		ip: '192.168.1.100',
	};

	const mockWledState: WledState = {
		on: true,
		brightness: 128,
		transition: 7,
		preset: -1,
		playlist: -1,
		nightlight: { on: false, duration: 60, mode: 1, targetBrightness: 0, remaining: -1 },
		udp: { send: false, receive: true },
		liveOverride: 0,
		mainSegment: 0,
		segments: [
			{
				id: 0,
				start: 0,
				stop: 30,
				length: 30,
				grouping: 1,
				spacing: 0,
				offset: 0,
				colors: [
					[255, 0, 0],
					[0, 0, 0],
					[0, 0, 0],
				],
				effect: 0,
				effectSpeed: 128,
				effectIntensity: 128,
				palette: 0,
				selected: true,
				reverse: false,
				on: true,
				brightness: 255,
				mirror: false,
			},
		],
	};

	const mockDeviceContext: WledDeviceContext = {
		state: mockWledState,
		info: mockWledInfo,
		effects: [
			{ id: 0, name: 'Solid' },
			{ id: 1, name: 'Blink' },
			{ id: 2, name: 'Rainbow' },
		],
		palettes: [
			{ id: 0, name: 'Default' },
			{ id: 1, name: 'Party' },
			{ id: 2, name: 'Cloud' },
		],
	};

	const createMockDevice = (id: string, identifier: string, hostname: string, enabled = true): WledDeviceEntity =>
		({
			id,
			type: DEVICES_WLED_TYPE,
			identifier,
			name: `WLED ${identifier}`,
			category: DeviceCategory.LIGHTING,
			enabled,
			hostname,
			description: null,
			icon: null,
			draft: false,
			created_at: new Date(),
			updated_at: new Date(),
		}) as unknown as WledDeviceEntity;

	const createMockChannel = (id: string, identifier: string, deviceId: string): WledChannelEntity =>
		({
			id,
			type: DEVICES_WLED_TYPE,
			identifier,
			name: identifier,
			category: ChannelCategory.DEVICE_INFORMATION,
			device: deviceId,
			description: null,
			draft: false,
			created_at: new Date(),
			updated_at: new Date(),
		}) as unknown as WledChannelEntity;

	const createMockProperty = (id: string, identifier: string, channelId: string): WledChannelPropertyEntity =>
		({
			id,
			type: DEVICES_WLED_TYPE,
			identifier,
			name: identifier,
			channel: channelId,
			value: null,
			draft: false,
			created_at: new Date(),
			updated_at: new Date(),
		}) as unknown as WledChannelPropertyEntity;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WledDeviceMapperService,
				{
					provide: DevicesService,
					useValue: {
						findOneBy: jest.fn(),
						findAll: jest.fn(),
						create: jest.fn(),
						update: jest.fn(),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOneBy: jest.fn(),
						create: jest.fn(),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOneBy: jest.fn(),
						create: jest.fn(),
						update: jest.fn(),
					},
				},
				{
					provide: DeviceConnectivityService,
					useValue: {
						setConnectionState: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<WledDeviceMapperService>(WledDeviceMapperService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
	});

	describe('mapDevice', () => {
		it('should create a new device when it does not exist', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100');

			devicesService.findOneBy.mockResolvedValue(null);
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockResolvedValue(createMockChannel('channel-1', 'device_information', 'device-1'));
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockResolvedValue(
				createMockProperty('prop-1', 'firmware_revision', 'channel-1'),
			);
			channelsPropertiesService.update.mockResolvedValue(
				createMockProperty('prop-1', 'firmware_revision', 'channel-1'),
			);
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			const result = await service.mapDevice('192.168.1.100', mockDeviceContext);

			expect(result).toBeDefined();
			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: DEVICES_WLED_TYPE,
					category: DeviceCategory.LIGHTING,
					hostname: '192.168.1.100',
				}),
			);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(mockDevice.id, {
				state: ConnectionState.CONNECTED,
			});
		});

		it('should update hostname when device exists and hostname changed', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.50');
			const updatedDevice = { ...mockDevice, hostname: '192.168.1.100' };

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			devicesService.update.mockResolvedValue(updatedDevice as WledDeviceEntity);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockResolvedValue(createMockChannel('channel-1', 'device_information', 'device-1'));
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockResolvedValue(
				createMockProperty('prop-1', 'firmware_revision', 'channel-1'),
			);
			channelsPropertiesService.update.mockResolvedValue(
				createMockProperty('prop-1', 'firmware_revision', 'channel-1'),
			);
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.mapDevice('192.168.1.100', mockDeviceContext);

			expect(devicesService.update).toHaveBeenCalledWith(
				mockDevice.id,
				expect.objectContaining({
					hostname: '192.168.1.100',
				}),
			);
		});

		it('should skip updates for disabled device and set connection to UNKNOWN', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100', false);

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			const result = await service.mapDevice('192.168.1.100', mockDeviceContext);

			expect(result).toBe(mockDevice);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(mockDevice.id, {
				state: ConnectionState.UNKNOWN,
			});
			expect(channelsService.findOneBy).not.toHaveBeenCalled();
		});

		it('should create device_information channel with correct property identifiers', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100');
			const mockChannel = createMockChannel('channel-1', WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION, 'device-1');

			devicesService.findOneBy.mockResolvedValue(null);
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockImplementation((channelId, dto) => {
				return Promise.resolve(createMockProperty(`prop-${dto.identifier}`, dto.identifier, channelId));
			});
			channelsPropertiesService.update.mockImplementation((propId, _dto) => {
				return Promise.resolve(createMockProperty(propId, 'test', 'channel-1'));
			});
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.mapDevice('192.168.1.100', mockDeviceContext);

			// Verify firmware_revision property is created with correct identifier
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				mockChannel.id,
				expect.objectContaining({
					identifier: 'firmware_revision',
				}),
			);

			// Verify hardware_revision property is created with correct identifier
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				mockChannel.id,
				expect.objectContaining({
					identifier: 'hardware_revision',
				}),
			);

			// Verify the value is updated with actual firmware version
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					value: '0.14.0', // mockWledInfo.version
				}),
			);

			// Verify the value is updated with actual hardware revision (architecture)
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					value: 'esp32', // mockWledInfo.architecture
				}),
			);
		});

		it('should use custom name and identifier when provided', async () => {
			const mockDevice = createMockDevice('device-1', 'custom-wled', '192.168.1.100');

			devicesService.findOneBy.mockResolvedValue(null);
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockResolvedValue(createMockChannel('channel-1', 'device_information', 'device-1'));
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			channelsPropertiesService.update.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.mapDevice('192.168.1.100', mockDeviceContext, 'Custom WLED Name', 'custom-wled');

			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'custom-wled',
					name: 'Custom WLED Name',
				}),
			);
		});
	});

	describe('updateDeviceState', () => {
		it('should update channel properties when device exists', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-test', '192.168.1.100');
			const mockChannel = createMockChannel('channel-1', WLED_CHANNEL_IDENTIFIERS.LIGHT, 'device-1');
			const mockProperty = createMockProperty('prop-1', 'on', 'channel-1');

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockProperty);
			channelsPropertiesService.update.mockResolvedValue(mockProperty);

			await service.updateDeviceState('wled-test', mockWledState);

			expect(channelsPropertiesService.update).toHaveBeenCalled();
		});

		it('should skip update when device is not found', async () => {
			devicesService.findOneBy.mockResolvedValue(null);

			await service.updateDeviceState('unknown-device', mockWledState);

			expect(channelsService.findOneBy).not.toHaveBeenCalled();
		});

		it('should skip update when device is disabled', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-test', '192.168.1.100', false);

			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await service.updateDeviceState('wled-test', mockWledState);

			expect(channelsService.findOneBy).not.toHaveBeenCalled();
		});
	});

	describe('setDeviceConnectionState', () => {
		it('should set connection state when device exists', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-test', '192.168.1.100');

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.setDeviceConnectionState('wled-test', ConnectionState.CONNECTED);

			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(mockDevice.id, {
				state: ConnectionState.CONNECTED,
			});
		});

		it('should do nothing when device does not exist', async () => {
			devicesService.findOneBy.mockResolvedValue(null);

			await service.setDeviceConnectionState('unknown-device', ConnectionState.CONNECTED);

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});
	});

	describe('identifier generation', () => {
		it('should generate identifier from MAC address when not provided', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100');

			devicesService.findOneBy.mockResolvedValue(null);
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockResolvedValue(createMockChannel('channel-1', 'device_information', 'device-1'));
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			channelsPropertiesService.update.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.mapDevice('192.168.1.100', mockDeviceContext);

			// MAC is 'AA:BB:CC:DD:EE:FF', so identifier should be 'wled-ddeeff' (last 6 chars of cleaned MAC)
			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'wled-ddeeff',
				}),
			);
		});
	});

	describe('channel creation', () => {
		it('should create all required channels for a device', async () => {
			const mockDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100');

			devicesService.findOneBy.mockResolvedValue(null);
			devicesService.create.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(null);
			channelsService.create.mockImplementation((dto) => {
				return Promise.resolve(createMockChannel(`channel-${dto.identifier}`, dto.identifier, 'device-1'));
			});
			channelsPropertiesService.findOneBy.mockResolvedValue(null);
			channelsPropertiesService.create.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			channelsPropertiesService.update.mockResolvedValue(createMockProperty('prop-1', 'test', 'channel-1'));
			deviceConnectivityService.setConnectionState.mockResolvedValue(undefined);

			await service.mapDevice('192.168.1.100', mockDeviceContext);

			// Verify device_information channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
				}),
			);

			// Verify light channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
				}),
			);

			// Verify electrical_power channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: WLED_CHANNEL_IDENTIFIERS.ELECTRICAL_POWER,
				}),
			);

			// Verify nightlight channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
				}),
			);

			// Verify sync channel was created
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: WLED_CHANNEL_IDENTIFIERS.SYNC,
				}),
			);

			// Verify segment channel was created (segment_0)
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: `${WLED_CHANNEL_IDENTIFIERS.SEGMENT}_0`,
				}),
			);
		});
	});
});
