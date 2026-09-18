/*
eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState, DataTypeType } from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
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
import {
	NormalizedDeviceChangeEvent,
	NormalizedDeviceEvent,
	ShelliesAdapterCallbacks,
} from '../interfaces/shellies.interface';
import { ShellyDevice } from '../interfaces/shellies.interface';
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
	let channelInputOccurrencesService: jest.Mocked<ChannelInputOccurrencesService>;
	let shelliesAdapter: jest.Mocked<ShelliesAdapterService>;
	let adapterCallbacks: ShelliesAdapterCallbacks;

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
		value: new PropertyValueState(false),
	} as ShellyV1ChannelPropertyEntity;

	const mockInputChannel = {
		id: 'channel-input_0-uuid',
		identifier: 'input_0',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
	} as ShellyV1ChannelEntity;

	const mockDetectedProperty = {
		id: 'prop-detected-uuid',
		identifier: 'detected',
		dataType: DataTypeType.BOOL,
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
		value: new PropertyValueState(false),
	} as ShellyV1ChannelPropertyEntity;

	const mockEventProperty = {
		id: 'prop-event-uuid',
		identifier: 'event',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
		value: new PropertyValueState(null),
	} as ShellyV1ChannelPropertyEntity;

	const mockModelProperty = {
		id: 'model-property-uuid',
		identifier: 'model',
		get type() {
			return DEVICES_SHELLY_V1_TYPE;
		},
		value: new PropertyValueState('SHSW-PM'),
	} as ShellyV1ChannelPropertyEntity;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				ShellyV1Service,
				{
					provide: ChannelInputOccurrencesService,
					useValue: {
						publishOccurrence: jest.fn(),
					},
				},
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
						setCallbacks: jest.fn().mockImplementation((callbacks: ShelliesAdapterCallbacks) => {
							adapterCallbacks = callbacks;
						}),
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
			],
		}).compile();

		service = module.get<ShellyV1Service>(ShellyV1Service);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
		deviceMapper = module.get(DeviceMapperService);
		shelliesAdapter = module.get(ShelliesAdapterService);
		channelInputOccurrencesService = module.get(ChannelInputOccurrencesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('handleDeviceChanged (via callbacks)', () => {
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
				value: new PropertyValueState(true),
				get type() {
					return DEVICES_SHELLY_V1_TYPE;
				},
			} as ShellyV1ChannelPropertyEntity);

			await adapterCallbacks.onDeviceChanged?.(changeEvent);

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

			await adapterCallbacks.onDeviceChanged?.(changeEvent);

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

			await adapterCallbacks.onDeviceChanged?.(changeEvent);

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

			await adapterCallbacks.onDeviceChanged?.(changeEvent);

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

			await adapterCallbacks.onDeviceChanged?.(changeEvent);

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

			await expect(adapterCallbacks.onDeviceChanged?.(changeEvent)).resolves.not.toThrow();
		});
	});

	describe('handleDeviceOffline (via callbacks)', () => {
		it('should mark device as offline when device is found', async () => {
			const offlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: false,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await adapterCallbacks.onDeviceOffline?.(offlineEvent);

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

			await adapterCallbacks.onDeviceOffline?.(offlineEvent);

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

			await expect(adapterCallbacks.onDeviceOffline?.(offlineEvent)).resolves.not.toThrow();
		});
	});

	describe('handleDeviceOnline (via callbacks)', () => {
		it('should mark device as online when device is found', async () => {
			const onlineEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await adapterCallbacks.onDeviceOnline?.(onlineEvent);

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

			await adapterCallbacks.onDeviceOnline?.(onlineEvent);

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

			await expect(adapterCallbacks.onDeviceOnline?.(onlineEvent)).resolves.not.toThrow();
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

	describe('Discovery enabled/disabled (via callbacks)', () => {
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

			await adapterCallbacks.onDeviceDiscovered?.(discoveryEvent);

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

			await adapterCallbacks.onDeviceDiscovered?.(discoveryEvent);

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

			await adapterCallbacks.onDeviceDiscovered?.(discoveryEvent);

			// Discovery is disabled, but device exists, should still call mapDevice
			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'shelly1pm-ABC123', DEVICES_SHELLY_V1_TYPE);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(discoveryEvent);
		});
	});

	describe('Exception handling (via callbacks)', () => {
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

			await expect(adapterCallbacks.onDeviceDiscovered?.(discoveryEvent)).resolves.not.toThrow();
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(discoveryEvent);
		});
	});

	describe('Logging prefixes (via callbacks)', () => {
		it('should not use hardcoded prefixes in log messages', async () => {
			const loggerSpy = jest.spyOn(Logger.prototype, 'log');
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			deviceMapper.mapDevice.mockResolvedValue(mockDevice);

			await adapterCallbacks.onDeviceDiscovered?.(discoveryEvent);

			expect(loggerSpy).toHaveBeenCalledWith(
				expect.not.stringContaining('[SHELLY V1]'),
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
			loggerSpy.mockRestore();
		});

		it('should not use hardcoded prefixes in error messages', async () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
			const discoveryEvent: NormalizedDeviceEvent = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			};

			const testError = new Error('Test error');
			deviceMapper.mapDevice.mockRejectedValue(testError);

			await adapterCallbacks.onDeviceDiscovered?.(discoveryEvent);

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.not.stringContaining('[SHELLY V1]'),
				undefined,
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
			loggerErrorSpy.mockRestore();
		});
	});

	describe('Hardware inputs and button gestures', () => {
		it('should publish occurrence when inputEventCounter changes and baseline exists', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 1,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockInputChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockEventProperty);

			// First counter event baselines the tracker (counter=1)
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 1,
				oldValue: 0,
			});

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();

			// Second counter event increments counter (counter=2, rawEvent='S') -> fires press occurrence!
			shellyDevice.inputEventCounter0 = 2;
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 2,
				oldValue: 1,
			});

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith({
				deviceId: 'device-uuid',
				channelId: 'channel-input_0-uuid',
				propertyId: 'prop-event-uuid',
				event: 'press',
				nativeEventType: 'S',
				sourceTimestamp: expect.any(String) as unknown as string,
				sourceOccurrenceId: 'channel-input_0-uuid:S:2',
			});

			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				'prop-event-uuid',
				expect.objectContaining({ value: 'press' }),
			);
		});

		it('should suppress duplicate occurrence when counter is unchanged', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 5,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			devicesService.findOneBy.mockResolvedValue(mockDevice);

			// Baseline at 5
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 5,
				oldValue: 5,
			});

			// Repeated multicast with counter still 5
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 5,
				oldValue: 5,
			});

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('should dispatch consecutive identical presses when counter increments', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 10,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockInputChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockEventProperty);

			// Baseline at 10
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 10,
				oldValue: 10,
			});

			// Press 1 (counter 11, S)
			shellyDevice.inputEventCounter0 = 11;
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 11,
				oldValue: 10,
			});

			// Press 2 (counter 12, S)
			shellyDevice.inputEventCounter0 = 12;
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 12,
				oldValue: 11,
			});

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({ event: 'press', sourceOccurrenceId: 'channel-input_0-uuid:S:11' }),
			);
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ event: 'press', sourceOccurrenceId: 'channel-input_0-uuid:S:12' }),
			);
		});

		it('should update detected property as boolean when input0 changes', async () => {
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy
				.mockResolvedValueOnce(mockDeviceInfoChannel) // descriptor lookup
				.mockResolvedValueOnce(mockInputChannel); // input_0 channel lookup
			channelsPropertiesService.findOneBy
				.mockResolvedValueOnce(mockModelProperty) // model lookup
				.mockResolvedValueOnce(mockDetectedProperty); // detected property lookup

			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'input0',
				newValue: 1,
				oldValue: 0,
			});

			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				'prop-detected-uuid',
				expect.objectContaining({ value: true }),
			);
		});

		it('should snapshot inputEvent before asynchronous device lookup to prevent race conditions', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 1,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			channelsService.findOneBy.mockResolvedValue(mockInputChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockEventProperty);

			// Baseline counter 1
			devicesService.findOneBy.mockResolvedValueOnce(mockDevice);
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 1,
				oldValue: 0,
			});

			// Setup findOneBy to simulate asynchronous delay during which shellyDevice.inputEvent0 mutates to 'L'
			devicesService.findOneBy.mockImplementationOnce(() => {
				shellyDevice.inputEvent0 = 'L'; // Later adapter update during async lookup
				return Promise.resolve(mockDevice);
			});

			// Event arrives with counter 2 when inputEvent0 was 'S'
			shellyDevice.inputEvent0 = 'S';
			shellyDevice.inputEventCounter0 = 2;
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 2,
				oldValue: 1,
			});

			// Must publish 'press' ('S'), not 'long_press' ('L')
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'press',
					nativeEventType: 'S',
					sourceOccurrenceId: 'channel-input_0-uuid:S:2',
				}),
			);
		});

		it('should allow retrying event when occurrence publication fails and commit is withheld', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 1,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockInputChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockEventProperty);

			// Baseline at 1
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 1,
				oldValue: 0,
			});

			// Next event: counter 2 fails during occurrence publication
			shellyDevice.inputEventCounter0 = 2;
			channelInputOccurrencesService.publishOccurrence.mockRejectedValueOnce(new Error('Network failure'));

			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 2,
				oldValue: 1,
			});

			// Retry with same counter 2 succeeds
			channelInputOccurrencesService.publishOccurrence.mockResolvedValueOnce(undefined);
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 2,
				oldValue: 1,
			});

			// Occurrence publication was called again for the retry
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);

			// Once succeeded, subsequent repeated call with counter 2 is suppressed
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 2,
				oldValue: 2,
			});

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
		});

		it('should include reset generation in sourceOccurrenceId on counter reset events', async () => {
			const shellyDevice = {
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				inputEvent0: 'S',
				inputEventCounter0: 50,
			};

			shelliesAdapter.getDevice.mockReturnValue(shellyDevice as unknown as ShellyDevice);
			devicesService.findOneBy.mockResolvedValue(mockDevice);
			channelsService.findOneBy.mockResolvedValue(mockInputChannel);
			channelsPropertiesService.findOneBy.mockResolvedValue(mockEventProperty);

			// Baseline at counter 50
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 50,
				oldValue: 0,
			});

			// Device reboots, counter resets to 1 with event 'S'
			shellyDevice.inputEventCounter0 = 1;
			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEventCounter0',
				newValue: 1,
				oldValue: 50,
			});

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'press',
					nativeEventType: 'S',
					sourceOccurrenceId: 'channel-input_0-uuid:S:1:reset:1',
				}),
			);
		});

		it('should ignore direct inputEvent0 change events', async () => {
			devicesService.findOneBy.mockResolvedValue(mockDevice);

			await adapterCallbacks.onDeviceChanged?.({
				id: 'shelly1pm-ABC123',
				property: 'inputEvent0',
				newValue: 'S',
				oldValue: '',
			});

			expect(channelsService.findOneBy).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});
	});
});
