/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mAdapterCallbacks, Z2mDevice } from '../interfaces/zigbee2mqtt.interface';
import { Zigbee2mqttConfigModel } from '../models/config.model';

import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

describe('Zigbee2mqttService', () => {
	let service: Zigbee2mqttService;
	let configService: jest.Mocked<ConfigService>;
	let mqttAdapter: jest.Mocked<Z2mMqttClientAdapterService>;
	let deviceMapper: jest.Mocked<Z2mDeviceMapperService>;
	let devicesService: jest.Mocked<DevicesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let pluginServiceManager: jest.Mocked<PluginServiceManagerService>;
	let capturedCallbacks: Z2mAdapterCallbacks;

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

	const mockConfig: Partial<Zigbee2mqttConfigModel> = {
		enabled: true,
		mqtt: {
			host: 'localhost',
			port: 1883,
			username: null,
			password: null,
			baseTopic: 'zigbee2mqtt',
			clientId: null,
			cleanSession: true,
			keepalive: 60,
			connectTimeout: 30000,
			reconnectInterval: 5000,
		},
		tls: {
			enabled: false,
			rejectUnauthorized: true,
			ca: null,
			cert: null,
			key: null,
		},
		discovery: {
			autoAdd: true,
			syncOnStartup: true,
		},
	} as unknown as Zigbee2mqttConfigModel;

	const createMockDevice = (
		id: string,
		identifier: string,
		friendlyName: string,
		enabled = true,
	): Zigbee2mqttDeviceEntity =>
		({
			id,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier,
			name: friendlyName,
			friendlyName,
			ieeeAddress: '0x00158d00018255df',
			modelId: 'TEST_MODEL',
			category: DeviceCategory.SENSOR,
			enabled,
			description: null,
			icon: null,
			draft: false,
			created_at: new Date(),
			updated_at: new Date(),
		}) as unknown as Zigbee2mqttDeviceEntity;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.useFakeTimers();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Zigbee2mqttService,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn().mockReturnValue(mockConfig),
					},
				},
				{
					provide: Z2mMqttClientAdapterService,
					useValue: {
						connect: jest.fn(),
						disconnect: jest.fn(),
						isConnected: jest.fn().mockReturnValue(false),
						isBridgeOnline: jest.fn().mockReturnValue(false),
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						setCallbacks: jest.fn().mockImplementation((callbacks: Z2mAdapterCallbacks) => {
							capturedCallbacks = callbacks;
						}),
					},
				},
				{
					provide: Z2mDeviceMapperService,
					useValue: {
						mapDevice: jest.fn(),
						updateDeviceState: jest.fn(),
						setDeviceAvailability: jest.fn(),
						setDeviceConnectionState: jest.fn(),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([]),
						findOneBy: jest.fn(),
					},
				},
				{
					provide: DeviceConnectivityService,
					useValue: {
						setConnectionState: jest.fn(),
					},
				},
				{
					provide: PluginServiceManagerService,
					useValue: {
						restartService: jest.fn().mockResolvedValue(true),
					},
				},
			],
		}).compile();

		service = module.get<Zigbee2mqttService>(Zigbee2mqttService);
		configService = module.get(ConfigService);
		mqttAdapter = module.get(Z2mMqttClientAdapterService);
		deviceMapper = module.get(Z2mDeviceMapperService);
		devicesService = module.get(DevicesService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
		pluginServiceManager = module.get(PluginServiceManagerService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('IManagedPluginService interface', () => {
		it('should have correct pluginName', () => {
			expect(service.pluginName).toBe(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME);
		});

		it('should have correct serviceId', () => {
			expect(service.serviceId).toBe('connector');
		});

		it('should return stopped state initially', () => {
			expect(service.getState()).toBe('stopped');
		});
	});

	describe('start', () => {
		it('should start the service successfully', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			expect(service.getState()).toBe('started');
			expect(mqttAdapter.connect).toHaveBeenCalledWith(
				expect.objectContaining({
					host: 'localhost',
					port: 1883,
					baseTopic: 'zigbee2mqtt',
				}),
			);
		});

		it('should initialize device states to UNKNOWN before starting', async () => {
			const mockDevices = [
				createMockDevice('device-1', 'z2m-12345678', 'living_room_light'),
				createMockDevice('device-2', 'z2m-87654321', 'kitchen_sensor'),
			];

			devicesService.findAll.mockResolvedValue(mockDevices);
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-1', {
				state: ConnectionState.UNKNOWN,
			});
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-2', {
				state: ConnectionState.UNKNOWN,
			});
		});

		it('should not start if already started', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();
			jest.clearAllMocks();

			await service.start();

			expect(mqttAdapter.connect).not.toHaveBeenCalled();
		});

		it('should set state to error if connection fails', async () => {
			mqttAdapter.connect.mockRejectedValue(new Error('Connection failed'));

			await expect(service.start()).rejects.toThrow('Connection failed');
			expect(service.getState()).toBe('error');
		});
	});

	describe('stop', () => {
		it('should stop the service successfully', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);
			mqttAdapter.disconnect.mockResolvedValue(undefined);

			await service.start();
			await service.stop();

			expect(service.getState()).toBe('stopped');
			expect(mqttAdapter.disconnect).toHaveBeenCalled();
		});

		it('should not stop if already stopped', async () => {
			await service.stop();

			expect(mqttAdapter.disconnect).not.toHaveBeenCalled();
		});

		it('should set all devices to unknown state when stopping', async () => {
			const mockDevices = [createMockDevice('device-1', 'z2m-12345678', 'living_room_light')];

			devicesService.findAll.mockResolvedValue(mockDevices);
			mqttAdapter.connect.mockResolvedValue(undefined);
			mqttAdapter.disconnect.mockResolvedValue(undefined);

			await service.start();
			jest.clearAllMocks();
			devicesService.findAll.mockResolvedValue(mockDevices);

			await service.stop();

			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-1', {
				state: ConnectionState.UNKNOWN,
			});
		});
	});

	describe('onConfigChanged', () => {
		it('should return restartRequired true when relevant config changes', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			// Simulate config change by returning different values
			const changedConfig = {
				...mockConfig,
				mqtt: { ...mockConfig.mqtt, host: 'new-host' }, // Changed from localhost
			};
			configService.getPluginConfig.mockReturnValue(changedConfig as Zigbee2mqttConfigModel);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should return restartRequired false when config does not change', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			// Config is the same, no change
			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});

		it('should return restartRequired false when service is stopped', async () => {
			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});

	describe('restart', () => {
		it('should call pluginServiceManager.restartService', async () => {
			await service.restart();

			expect(pluginServiceManager.restartService).toHaveBeenCalledWith(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, 'connector');
		});
	});

	describe('callback: onDevicesReceived', () => {
		it('should map devices when auto-add is enabled', async () => {
			// Bridge must be online first for devices to be processed immediately
			capturedCallbacks.onBridgeOnline?.();
			// Let the promise settle
			await Promise.resolve();

			const devices: Z2mDevice[] = [
				{
					ieee_address: '0x00158d00018255df',
					type: 'Router',
					friendly_name: 'living_room_light',
					network_address: 12345,
					supported: true,
					disabled: false,
					definition: {
						model: 'LED1545G12',
						vendor: 'IKEA',
						description: 'TRADFRI LED bulb E26',
						exposes: [{ type: 'light', features: [] }],
					},
				},
			];

			capturedCallbacks.onDevicesReceived?.(devices);
			// Let the promise settle
			await Promise.resolve();

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(devices[0], true);
		});

		it('should not map devices when auto-add is disabled and no sync pending', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				discovery: { autoAdd: false, syncOnStartup: false },
			} as unknown as Zigbee2mqttConfigModel);

			// Bridge must be online first
			capturedCallbacks.onBridgeOnline?.();
			// Let the promise settle
			await Promise.resolve();

			const devices: Z2mDevice[] = [
				{
					ieee_address: '0x00158d00018255df',
					type: 'Router',
					friendly_name: 'living_room_light',
					network_address: 12345,
					supported: true,
					disabled: false,
					definition: {
						model: 'LED1545G12',
						vendor: 'IKEA',
						description: 'TRADFRI LED bulb E26',
						exposes: [{ type: 'light', features: [] }],
					},
				},
			];

			capturedCallbacks.onDevicesReceived?.(devices);
			// Let the promise settle
			await Promise.resolve();

			expect(deviceMapper.mapDevice).not.toHaveBeenCalled();
		});
	});

	describe('callback: onDeviceStateChanged', () => {
		it('should update device state via mapper', async () => {
			const state = { state: 'ON', brightness: 200 };

			capturedCallbacks.onDeviceStateChanged?.('living_room_light', state);
			// Let the promise settle
			await Promise.resolve();

			expect(deviceMapper.updateDeviceState).toHaveBeenCalledWith('living_room_light', state);
		});
	});

	describe('callback: onDeviceAvailabilityChanged', () => {
		it('should set device availability when online', async () => {
			capturedCallbacks.onDeviceAvailabilityChanged?.('living_room_light', true);
			// Let the promise settle
			await Promise.resolve();

			expect(deviceMapper.setDeviceAvailability).toHaveBeenCalledWith('living_room_light', true);
		});

		it('should set device availability when offline', async () => {
			capturedCallbacks.onDeviceAvailabilityChanged?.('living_room_light', false);
			// Let the promise settle
			await Promise.resolve();

			expect(deviceMapper.setDeviceAvailability).toHaveBeenCalledWith('living_room_light', false);
		});
	});

	describe('isBridgeOnline', () => {
		it('should return bridge online status from adapter', () => {
			mqttAdapter.isBridgeOnline.mockReturnValue(true);

			expect(service.isBridgeOnline()).toBe(true);

			mqttAdapter.isBridgeOnline.mockReturnValue(false);

			expect(service.isBridgeOnline()).toBe(false);
		});
	});

	describe('getRegisteredDevices', () => {
		it('should return registered devices from adapter', () => {
			const mockDevices = [
				{
					ieeeAddress: '0x00158d00018255df',
					friendlyName: 'living_room_light',
					type: 'Router' as const,
					supported: true,
					disabled: false,
					available: true,
					currentState: {},
				},
			];

			mqttAdapter.getRegisteredDevices.mockReturnValue(mockDevices);

			expect(service.getRegisteredDevices()).toEqual(mockDevices);
		});
	});
});
