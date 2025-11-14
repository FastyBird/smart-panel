import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { NormalizedDeviceChangeEvent, NormalizedDeviceEvent } from '../interfaces/shellies.interface';

import { DeviceMapperService } from './device-mapper.service';
import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1Service } from './shelly-v1.service';

describe('ShellyV1Service', () => {
	let service: ShellyV1Service;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;

	const mockDevice = {
		id: 'device-uuid',
		identifier: 'shelly1pm-ABC123',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
	} as ShellyV1DeviceEntity;

	const mockChannel = {
		id: 'channel-uuid',
		identifier: 'relay_0',
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

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ShellyV1Service,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
					},
				},
				{
					provide: ShelliesAdapterService,
					useValue: {
						start: jest.fn(),
						stop: jest.fn(),
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
						findOne: jest.fn(),
						findAll: jest.fn(),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOne: jest.fn(),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn(),
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
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<ShellyV1Service>(ShellyV1Service);
		devicesService = module.get(DevicesService) as jest.Mocked<DevicesService>;
		channelsService = module.get(ChannelsService) as jest.Mocked<ChannelsService>;
		channelsPropertiesService = module.get(ChannelsPropertiesService) as jest.Mocked<ChannelsPropertiesService>;
		deviceConnectivityService = module.get(DeviceConnectivityService) as jest.Mocked<DeviceConnectivityService>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('handleDeviceChanged', () => {
		it('should update property value when device, channel, and property are found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay_0.state',
				newValue: true,
				oldValue: false,
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			channelsPropertiesService.update.mockResolvedValue({
				...mockProperty,
				value: true,
				get type() {
					return DEVICES_SHELLY_V1_TYPE;
				},
			} as ShellyV1ChannelPropertyEntity);

			await service.handleDeviceChanged(changeEvent);

			expect(devicesService.findOne).toHaveBeenCalledWith('shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(channelsService.findOne).toHaveBeenCalledWith('device-uuid', 'relay_0', DEVICES_SHELLY_V1_TYPE);
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith('channel-uuid', 'state', DEVICES_SHELLY_V1_TYPE);
			expect(channelsPropertiesService.update).toHaveBeenCalledWith('property-uuid', expect.objectContaining({ value: true }));
		});

		it('should skip update if device is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'unknown-device',
				property: 'relay_0.state',
				newValue: true,
				oldValue: false,
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(null);

			await service.handleDeviceChanged(changeEvent);

			expect(devicesService.findOne).toHaveBeenCalledWith('unknown-device', DEVICES_SHELLY_V1_TYPE);
			expect(channelsService.findOne).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if channel is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'unknown_channel.state',
				newValue: true,
				oldValue: false,
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(null);

			await service.handleDeviceChanged(changeEvent);

			expect(channelsService.findOne).toHaveBeenCalledWith('device-uuid', 'unknown_channel', DEVICES_SHELLY_V1_TYPE);
			expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if property is not found', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay_0.unknown_property',
				newValue: 100,
				oldValue: 0,
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await service.handleDeviceChanged(changeEvent);

			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(
				'channel-uuid',
				'unknown_property',
				DEVICES_SHELLY_V1_TYPE,
			);
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should skip update if property path cannot be parsed', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'invalid-path',
				newValue: true,
				oldValue: false,
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);

			await service.handleDeviceChanged(changeEvent);

			expect(channelsService.findOne).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const changeEvent: NormalizedDeviceChangeEvent = {
				id: 'shelly1pm-ABC123',
				property: 'relay_0.state',
				newValue: true,
				oldValue: false,
				device: {} as any,
			};

			devicesService.findOne.mockRejectedValue(new Error('Database error'));

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
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);

			await service.handleDeviceOffline(offlineEvent);

			expect(devicesService.findOne).toHaveBeenCalledWith('shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
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
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(null);

			await service.handleDeviceOffline(offlineEvent);

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const offlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: false,
				device: {} as any,
			};

			devicesService.findOne.mockRejectedValue(new Error('Database error'));

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
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(mockDevice);

			await service.handleDeviceOnline(onlineEvent);

			expect(devicesService.findOne).toHaveBeenCalledWith('shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
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
				device: {} as any,
			};

			devicesService.findOne.mockResolvedValue(null);

			await service.handleDeviceOnline(onlineEvent);

			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const onlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
				device: {} as any,
			};

			devicesService.findOne.mockRejectedValue(new Error('Database error'));

			await expect(service.handleDeviceOnline(onlineEvent)).resolves.not.toThrow();
		});
	});

	describe('parsePropertyPath', () => {
		it('should parse valid property paths correctly', () => {
			const testCases = [
				{ input: 'relay_0.state', expected: { channelIdentifier: 'relay_0', propertyIdentifier: 'state' } },
				{
					input: 'light_0.brightness',
					expected: { channelIdentifier: 'light_0', propertyIdentifier: 'brightness' },
				},
				{ input: 'roller_0.position', expected: { channelIdentifier: 'roller_0', propertyIdentifier: 'position' } },
			];

			for (const testCase of testCases) {
				const result = (service as any).parsePropertyPath(testCase.input);

				expect(result).toEqual(testCase.expected);
			}
		});

		it('should return null for invalid property paths', () => {
			const invalidPaths = ['invalid', 'relay_0', 'relay_0.state.extra', ''];

			for (const path of invalidPaths) {
				const result = (service as any).parsePropertyPath(path);

				expect(result).toEqual({ channelIdentifier: null, propertyIdentifier: null });
			}
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
});
