/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1NotSupportedException } from '../devices-shelly-v1.exceptions';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { NormalizedDeviceChangeEvent, NormalizedDeviceEvent } from '../interfaces/shellies.interface';
import { ShellyV1ConfigModel } from '../models/config.model';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';
import { ShellyV1Service } from './shelly-v1.service';

describe('ShellyV1Service', () => {
	let module: TestingModule;
	let service: ShellyV1Service;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let deviceMapper: jest.Mocked<DeviceMapperService>;
	let shelliesAdapter: jest.Mocked<ShelliesAdapterService>;

	const mockDevice = {
		id: 'device-uuid',
		identifier: 'shelly1pm-ABC123',
		type: 'SHSW-PM', // Device model type
	} as unknown as ShellyV1DeviceEntity;

	const mockChannel = {
		id: 'channel-uuid',
		identifier: 'relay_0',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
	} as ShellyV1ChannelEntity;

	const mockDeviceInfoChannel = {
		id: 'device-info-channel-uuid',
		identifier: 'device_information',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
	} as ShellyV1ChannelEntity;

	const mockProperty = {
		id: 'property-uuid',
		identifier: 'state',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
		value: false,
	} as ShellyV1ChannelPropertyEntity;

	const mockModelProperty = {
		id: 'model-property-uuid',
		identifier: 'model',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
		value: 'SHSW-PM',
	} as ShellyV1ChannelPropertyEntity;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				ShellyV1Service,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn().mockReturnValue({
							enabled: true,
							discovery: { enabled: true, interface: null },
							timeouts: { requestTimeout: 10, staleTimeout: 30 },
						}),
					},
				},
				{
					provide: ShelliesAdapterService,
					useValue: {
						start: jest.fn(),
						stop: jest.fn(),
						getDevice: jest.fn(),
						getRegisteredDevice: jest
							.fn()
							.mockReturnValue({ id: 'shelly1pm-ABC123', type: 'SHSW-PM', host: '192.168.1.100', enabled: true }),
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						updateDeviceEnabledStatus: jest.fn(),
					},
				},
				{
					provide: DeviceMapperService,
					useValue: {
						mapDevice: jest.fn(),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOneBy: jest.fn(),
						findAll: jest.fn(),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOneBy: jest.fn(),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOneBy: jest.fn(),
						update: jest.fn(),
					},
				},
				{
					provide: DeviceConnectivityService,
					useValue: {
						setConnectionState: jest.fn(),
					},
				},
				{
					provide: ShellyV1HttpClientService,
					useValue: {
						getDeviceInfo: jest.fn(),
						getDeviceStatus: jest.fn(),
						getDeviceSettings: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<ShellyV1Service>(ShellyV1Service);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
		deviceMapper = module.get(DeviceMapperService);
		shelliesAdapter = module.get(ShelliesAdapterService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('handleDeviceChanged', () => {
		it('should update property value when device, channel, and property are found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay0',
				newValue: true,
				oldValue: false,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy
				.mockResolvedValueOnce(mockDeviceInfoChannel) // First call for device_information
				.mockResolvedValueOnce(mockChannel); // Second call for relay_0
			channelsPropertiesService.findOneBy
				.mockResolvedValueOnce(mockModelProperty) // First call for model property
				.mockResolvedValueOnce(mockProperty); // Second call for state property
			channelsPropertiesService.update.mockResolvedValue({
				...mockProperty,
				value: true,
				get type() {
					return DEVICES_SHELLY_V1_TYPE;
				},
			} as ShellyV1ChannelPropertyEntity);

			await service.handleDeviceChanged(changeEvent);

			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(channelsService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'device_information',
				'device-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'model',
				'device-info-channel-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'relay_0',
				'device-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'state',
				'channel-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				'property-uuid',
				expect.objectContaining({ value: true }),
			);
		});

		it('should skip update if device is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'unknown-device',
				property: 'relay0',
				newValue: true,
				oldValue: false,
			};

			devicesService.findOneBy.mockResolvedValue(null);

			await service.handleDeviceChanged(changeEvent);

			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'unknown-device', DEVICES_SHELLY_V1_TYPE);
			expect(channelsService.findOneBy).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if channel is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay0',
				newValue: true,
				oldValue: false,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy
				.mockResolvedValueOnce(mockDeviceInfoChannel) // First call for device_information
				.mockResolvedValueOnce(null); // Second call for relay_0 - not found
			channelsPropertiesService.findOneBy.mockResolvedValue(mockModelProperty); // For model property

			await service.handleDeviceChanged(changeEvent);

			expect(channelsService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'relay_0',
				'device-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if property is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'power0',
				newValue: 100,
				oldValue: 0,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy
				.mockResolvedValueOnce(mockDeviceInfoChannel) // First call for device_information
				.mockResolvedValueOnce(mockChannel); // Second call for a channel
			channelsPropertiesService.findOneBy
				.mockResolvedValueOnce(mockModelProperty) // First call for model property
				.mockResolvedValueOnce(null); // Second call for power property - not found

			await service.handleDeviceChanged(changeEvent);

			expect(channelsPropertiesService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'power',
				'channel-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if binding is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'unknownProperty',
				newValue: true,
				oldValue: false,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockDeviceInfoChannel); // For device_information
			channelsPropertiesService.findOneBy.mockResolvedValue(mockModelProperty); // For model property

			await service.handleDeviceChanged(changeEvent);

			// Should call to get device_information and model, but not the actual channel
			expect(channelsService.findOneBy).toHaveBeenCalledWith(
				'identifier',
				'device_information',
				'device-uuid',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay0',
				newValue: true,
				oldValue: false,
			};

			devicesService.findOneBy.mockRejectedValue(new Error('Database error'));

			await expect(service.handleDeviceChanged(changeEvent)).resolves.not.toThrow();
		});
	});

	describe('handleDeviceOffline', () => {
		it('should mark device as offline when device is found', async () => {
			const offlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: false,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await service.handleDeviceOffline(offlineEvent);

			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-uuid', {
				state: ConnectionState.DISCONNECTED,
			});
		});

		it('should skip if device is not found', async () => {
			const offlineEvent: NormalizedDeviceEvent = {
				id: 'unknown-device',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: false,
			};

			devicesService.findOneBy.mockResolvedValue(null);

			await service.handleDeviceOffline(offlineEvent);

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const offlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: false,
			};

			devicesService.findOneBy.mockRejectedValue(new Error('Database error'));

			await expect(service.handleDeviceOffline(offlineEvent)).resolves.not.toThrow();
		});
	});

	describe('handleDeviceOnline', () => {
		it('should mark device as online when device is found', async () => {
			const onlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await service.handleDeviceOnline(onlineEvent);

			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-uuid', {
				state: ConnectionState.CONNECTED,
			});
		});

		it('should skip if device is not found', async () => {
			const onlineEvent: NormalizedDeviceEvent = {
				id: 'unknown-device',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			devicesService.findOneBy.mockResolvedValue(null);

			await service.handleDeviceOnline(onlineEvent);

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const onlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			devicesService.findOneBy.mockRejectedValue(new Error('Database error'));

			await expect(service.handleDeviceOnline(onlineEvent)).resolves.not.toThrow();
		});
	});

	describe('initializeDeviceStates', () => {
		it('should set all devices to UNKNOWN state', async () => {
			const device2 = {
				id: 'device-uuid-2',
				identifier: 'shelly1-DEF456',
				get type() {
					return DEVICES_SHELLY_V1_TYPE;
				},
			} as ShellyV1DeviceEntity;

			const devices = [mockDevice, device2];

			devicesService.findAll.mockResolvedValue(devices);

			await (service as any).initializeDeviceStates();

			expect(devicesService.findAll).toHaveBeenCalledWith(DEVICES_SHELLY_V1_TYPE);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledTimes(2);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenNthCalledWith(1, 'device-uuid', {
				state: ConnectionState.UNKNOWN,
			});
			expect(deviceConnectivityService.setConnectionState).toHaveBeenNthCalledWith(2, 'device-uuid-2', {
				state: ConnectionState.UNKNOWN,
			});
		});

		it('should handle errors gracefully', async () => {
			devicesService.findAll.mockRejectedValue(new Error('Database error'));

			await expect((service as any).initializeDeviceStates()).resolves.not.toThrow();
		});

		it('should handle empty device list', async () => {
			devicesService.findAll.mockResolvedValue([]);

			await (service as any).initializeDeviceStates();

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});
	});

	describe('Discovery enabled/disabled', () => {
		it('should process new devices when discovery is enabled', async () => {
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-NEW123',
				type: 'SHSW-PM',
				host: '192.168.1.200',
				online: true,
			};

			// Mock that device does not exist in database
			devicesService.findOneBy.mockResolvedValue(null);
			deviceMapper.mapDevice.mockResolvedValue(mockDevice);

			await service.handleDeviceDiscovered(discoveryEvent);

			// Discovery is enabled by default, should call mapDevice for new devices
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(discoveryEvent);
		});

		it('should ignore new devices when discovery is disabled', async () => {
			// Update config to disable discovery
			const configService = module.get(ConfigService);
			const mockConfig: ShellyV1ConfigModel = {
				enabled: true,
				type: 'devices-shelly-v1',
				discovery: { enabled: false, interface: null },
				timeouts: { requestTimeout: 10, staleTimeout: 30 },
			} as ShellyV1ConfigModel;
			jest.spyOn(configService, 'getPluginConfig').mockReturnValue(mockConfig);

			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-NEW123',
				type: 'SHSW-PM',
				host: '192.168.1.200',
				online: true,
			};

			// Mock that device does not exist in database (new device)
			devicesService.findOneBy.mockResolvedValue(null);
			deviceMapper.mapDevice.mockResolvedValue(mockDevice);

			await service.handleDeviceDiscovered(discoveryEvent);

			// Discovery is disabled, should NOT call mapDevice for new devices
			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-NEW123', DEVICES_SHELLY_V1_TYPE);
			expect(deviceMapper.mapDevice).not.toHaveBeenCalled();
		});

		it('should still process existing devices when discovery is disabled', async () => {
			// Update config to disable discovery
			const configService = module.get(ConfigService);
			const mockConfig: ShellyV1ConfigModel = {
				enabled: true,
				type: 'devices-shelly-v1',
				discovery: { enabled: false, interface: null },
				timeouts: { requestTimeout: 10, staleTimeout: 30 },
			} as ShellyV1ConfigModel;
			jest.spyOn(configService, 'getPluginConfig').mockReturnValue(mockConfig);

			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			// Mock that device exists in database (existing device)
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			deviceMapper.mapDevice.mockResolvedValue(mockDevice);

			await service.handleDeviceDiscovered(discoveryEvent);

			// Discovery is disabled, but device exists, should still call mapDevice
			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(discoveryEvent);
		});
	});

	describe('Exception handling', () => {
		it('should handle DevicesShellyV1NotSupportedException when device type is not supported', async () => {
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'unsupported-device',
				type: 'UNSUPPORTED_TYPE',
				host: '192.168.1.100',
				online: true,
			};

			deviceMapper.mapDevice.mockRejectedValue(
				new DevicesShellyV1NotSupportedException('Unsupported device type: UNSUPPORTED_TYPE'),
			);

			await expect(service.handleDeviceDiscovered(discoveryEvent)).resolves.not.toThrow();
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(discoveryEvent);
		});
	});

	describe('Logging prefixes', () => {
		it('should use [SHELLY V1][SERVICE] prefix in log messages', async () => {
			const loggerSpy = jest.spyOn(Logger.prototype, 'log');
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			deviceMapper.mapDevice.mockResolvedValue(mockDevice);

			await service.handleDeviceDiscovered(discoveryEvent);

			expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('[SHELLY V1][SERVICE]'));
			loggerSpy.mockRestore();
		});

		it('should use [SHELLY V1][SERVICE] prefix in error messages with metadata', async () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			const testError = new Error('Test error');
			deviceMapper.mapDevice.mockRejectedValue(testError);

			await service.handleDeviceDiscovered(discoveryEvent);

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[SHELLY V1][SERVICE]'),
				expect.objectContaining({
					message: 'Test error',
					stack: expect.any(String),
				}),
			);
			loggerErrorSpy.mockRestore();
		});
	});
});
