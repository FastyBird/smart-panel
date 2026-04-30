/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PluginServiceManagerService } from '../../../modules/extensions/services/plugin-service-manager.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mAdapterCallbacks, Z2mDevice, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import { Zigbee2mqttConfigModel } from '../models/config.model';

import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';
import { Z2mWsClientAdapterService } from './ws-client-adapter.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

describe('Zigbee2mqttService', () => {
	let service: Zigbee2mqttService;
	let configService: jest.Mocked<ConfigService>;
	let mqttAdapter: jest.Mocked<Z2mMqttClientAdapterService>;
	let wsAdapter: jest.Mocked<Z2mWsClientAdapterService>;
	let deviceMapper: jest.Mocked<Z2mDeviceMapperService>;
	let devicesService: jest.Mocked<DevicesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let pluginServiceManager: jest.Mocked<PluginServiceManagerService>;
	let capturedCallbacks: Z2mAdapterCallbacks;

	// Quiet logger noise

	beforeAll(() => {});

	afterAll(() => {});

	const mockConfig: Partial<Zigbee2mqttConfigModel> = {
		enabled: true,
		connectionType: 'mqtt',
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
		ws: {
			host: 'localhost',
			port: 8080,
			baseTopic: 'zigbee2mqtt',
			secure: false,
			connectTimeout: 10000,
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

	const createMockAdapterValue = () => ({
		connect: jest.fn(),
		disconnect: jest.fn(),
		isConnected: jest.fn().mockReturnValue(false),
		isBridgeOnline: jest.fn().mockReturnValue(false),
		getRegisteredDevices: jest.fn().mockReturnValue([]),
		getCachedState: jest.fn().mockReturnValue({}),
		publishCommand: jest.fn().mockResolvedValue(true),
		requestState: jest.fn().mockResolvedValue(true),
		setPermitJoin: jest.fn().mockResolvedValue(true),
		getDevice: jest.fn(),
		getDeviceByIeeeAddress: jest.fn(),
		setCallbacks: jest.fn().mockImplementation((callbacks: Z2mAdapterCallbacks) => {
			capturedCallbacks = callbacks;
		}),
	});

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
					useValue: createMockAdapterValue(),
				},
				{
					provide: Z2mWsClientAdapterService,
					useValue: createMockAdapterValue(),
				},
				{
					provide: Z2mDeviceMapperService,
					useValue: {
						mapDevice: jest.fn(),
						updateDeviceState: jest.fn(),
						setDeviceAvailability: jest.fn(),
						setDeviceConnectionState: jest.fn(),
						restoreTransformersForExistingDevices: jest.fn().mockResolvedValue(undefined),
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
		wsAdapter = module.get(Z2mWsClientAdapterService);
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
		it('should start the service successfully with MQTT adapter', async () => {
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

		it('should start with WebSocket adapter when connectionType is ws', async () => {
			const wsConfig = {
				...mockConfig,
				connectionType: 'ws',
			};
			configService.getPluginConfig.mockReturnValue(wsConfig as unknown as Zigbee2mqttConfigModel);
			wsAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			expect(service.getState()).toBe('started');
			expect(wsAdapter.connect).toHaveBeenCalledWith(
				expect.objectContaining({
					host: 'localhost',
					port: 8080,
					baseTopic: 'zigbee2mqtt',
					secure: false,
				}),
			);
			expect(mqttAdapter.connect).not.toHaveBeenCalled();
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
		it('should return restartRequired true when MQTT config changes', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			const changedConfig = {
				...mockConfig,
				mqtt: { ...mockConfig.mqtt, host: 'new-host' },
			};
			configService.getPluginConfig.mockReturnValue(changedConfig as Zigbee2mqttConfigModel);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should return restartRequired true when connection type changes', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

			const changedConfig = {
				...mockConfig,
				connectionType: 'ws',
			};
			configService.getPluginConfig.mockReturnValue(changedConfig as unknown as Zigbee2mqttConfigModel);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should return restartRequired false when config does not change', async () => {
			mqttAdapter.connect.mockResolvedValue(undefined);

			await service.start();

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
			await capturedCallbacks.onBridgeOnline?.();

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

			await capturedCallbacks.onDevicesReceived?.(devices);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(devices[0], true);
		});

		it('should not map devices when auto-add is disabled and no sync pending', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				discovery: { autoAdd: false, syncOnStartup: false },
			} as unknown as Zigbee2mqttConfigModel);

			// Bridge must be online first
			await capturedCallbacks.onBridgeOnline?.();

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

			await capturedCallbacks.onDevicesReceived?.(devices);

			expect(deviceMapper.mapDevice).not.toHaveBeenCalled();
		});
	});

	describe('callback: onDeviceStateChanged', () => {
		it('should skip update when transformers not restored', async () => {
			const state = { state: 'ON', brightness: 200 };

			await capturedCallbacks.onDeviceStateChanged?.('living_room_light', state);

			// Should not call updateDeviceState because transformersRestored is false
			expect(deviceMapper.updateDeviceState).not.toHaveBeenCalled();
		});

		it('should update device state via mapper when transformers restored', async () => {
			// First, trigger device reception to set transformersRestored = true
			await capturedCallbacks.onBridgeOnline?.();
			await capturedCallbacks.onDevicesReceived?.([]);

			const state = { state: 'ON', brightness: 200 };

			await capturedCallbacks.onDeviceStateChanged?.('living_room_light', state);

			expect(deviceMapper.updateDeviceState).toHaveBeenCalledWith('living_room_light', state);
		});
	});

	describe('callback: onDeviceAvailabilityChanged', () => {
		it('should set device availability when online', async () => {
			await capturedCallbacks.onDeviceAvailabilityChanged?.('living_room_light', true);

			expect(deviceMapper.setDeviceAvailability).toHaveBeenCalledWith('living_room_light', true);
		});

		it('should set device availability when offline', async () => {
			await capturedCallbacks.onDeviceAvailabilityChanged?.('living_room_light', false);

			expect(deviceMapper.setDeviceAvailability).toHaveBeenCalledWith('living_room_light', false);
		});
	});

	describe('isBridgeOnline', () => {
		it('should return bridge online status from active adapter', () => {
			mqttAdapter.isBridgeOnline.mockReturnValue(true);

			expect(service.isBridgeOnline()).toBe(true);

			mqttAdapter.isBridgeOnline.mockReturnValue(false);

			expect(service.isBridgeOnline()).toBe(false);
		});
	});

	describe('getRegisteredDevices', () => {
		it('should return registered devices from active adapter', () => {
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

	describe('getActiveAdapter', () => {
		it('should return MQTT adapter by default', () => {
			expect(service.getActiveAdapter()).toBe(mqttAdapter);
		});
	});

	describe('setPermitJoin', () => {
		it('should return false when bridge is offline', async () => {
			mqttAdapter.isBridgeOnline.mockReturnValue(false);

			const result = await service.setPermitJoin(120);

			expect(result).toBe(false);
			expect(mqttAdapter.setPermitJoin).not.toHaveBeenCalled();
		});

		it('should return false when no active adapter', async () => {
			// Bypass the bridge-online guard, then null out the adapter to hit
			// the defensive `!this.activeAdapter` branch.
			jest.spyOn(service, 'isBridgeOnline').mockReturnValue(true);
			(service as unknown as { activeAdapter: unknown }).activeAdapter = null;

			const result = await service.setPermitJoin(120);

			expect(result).toBe(false);
		});

		it('should proxy through to the active adapter when bridge is online', async () => {
			mqttAdapter.isBridgeOnline.mockReturnValue(true);
			mqttAdapter.setPermitJoin.mockResolvedValue(true);

			const result = await service.setPermitJoin(120);

			expect(result).toBe(true);
			expect(mqttAdapter.setPermitJoin).toHaveBeenCalledWith(120);
		});

		it('should return the value the adapter returns', async () => {
			mqttAdapter.isBridgeOnline.mockReturnValue(true);
			mqttAdapter.setPermitJoin.mockResolvedValue(false);

			const result = await service.setPermitJoin(0);

			expect(result).toBe(false);
			expect(mqttAdapter.setPermitJoin).toHaveBeenCalledWith(0);
		});
	});

	describe('subscribeToDeviceJoined', () => {
		const buildRegistered = (friendlyName: string): Z2mRegisteredDevice => ({
			ieeeAddress: `0x${friendlyName}`,
			friendlyName,
			type: 'Router',
			supported: true,
			disabled: false,
			available: true,
			currentState: {},
		});

		it('should fire when a device joins and is included in the next bridge/devices payload', async () => {
			const subscriber = jest.fn();
			service.subscribeToDeviceJoined(subscriber);

			// Bridge online and registry initially populated only with a pre-existing device
			const existing = buildRegistered('existing_device');
			const newDevice = buildRegistered('new_device');

			mqttAdapter.getRegisteredDevices.mockReturnValue([existing]);
			await capturedCallbacks.onBridgeOnline?.();
			await capturedCallbacks.onDevicesReceived?.([]);

			// Initial fetch must NOT fire any subscriber
			expect(subscriber).not.toHaveBeenCalled();

			// Now a real device_joined event arrives
			await capturedCallbacks.onDeviceJoined?.(newDevice.ieeeAddress, newDevice.friendlyName);

			// Bridge republishes devices including the newly-joined device
			mqttAdapter.getRegisteredDevices.mockReturnValue([existing, newDevice]);
			await capturedCallbacks.onDevicesReceived?.([]);

			expect(subscriber).toHaveBeenCalledTimes(1);
			expect(subscriber).toHaveBeenCalledWith(newDevice);
		});

		it('should NOT fire on a periodic bridge/devices republish containing only already-paired devices', async () => {
			const subscriber = jest.fn();
			service.subscribeToDeviceJoined(subscriber);

			const existingA = buildRegistered('existing_a');
			const existingB = buildRegistered('existing_b');

			mqttAdapter.getRegisteredDevices.mockReturnValue([existingA, existingB]);
			await capturedCallbacks.onBridgeOnline?.();

			// Initial fetch
			await capturedCallbacks.onDevicesReceived?.([]);
			expect(subscriber).not.toHaveBeenCalled();

			// Subsequent periodic republishes — same devices, no device_joined in between
			await capturedCallbacks.onDevicesReceived?.([]);
			await capturedCallbacks.onDevicesReceived?.([]);

			expect(subscriber).not.toHaveBeenCalled();
		});

		it('should stop firing after unsubscribe', async () => {
			const subscriber = jest.fn();
			const unsubscribe = service.subscribeToDeviceJoined(subscriber);

			const existing = buildRegistered('existing');
			const newDevice = buildRegistered('new');

			mqttAdapter.getRegisteredDevices.mockReturnValue([existing]);
			await capturedCallbacks.onBridgeOnline?.();
			await capturedCallbacks.onDevicesReceived?.([]);

			unsubscribe();

			// Real device_joined + republish; should not fire because we unsubscribed
			await capturedCallbacks.onDeviceJoined?.(newDevice.ieeeAddress, newDevice.friendlyName);
			mqttAdapter.getRegisteredDevices.mockReturnValue([existing, newDevice]);
			await capturedCallbacks.onDevicesReceived?.([]);

			expect(subscriber).not.toHaveBeenCalled();
		});

		it('should not let a throwing subscriber prevent other subscribers from firing', async () => {
			const throwing = jest.fn(() => {
				throw new Error('boom');
			});
			const good = jest.fn();
			service.subscribeToDeviceJoined(throwing);
			service.subscribeToDeviceJoined(good);

			const newDevice = buildRegistered('new');

			mqttAdapter.getRegisteredDevices.mockReturnValue([]);
			await capturedCallbacks.onBridgeOnline?.();
			await capturedCallbacks.onDevicesReceived?.([]);

			await capturedCallbacks.onDeviceJoined?.(newDevice.ieeeAddress, newDevice.friendlyName);
			mqttAdapter.getRegisteredDevices.mockReturnValue([newDevice]);
			await capturedCallbacks.onDevicesReceived?.([]);

			expect(throwing).toHaveBeenCalledTimes(1);
			expect(good).toHaveBeenCalledTimes(1);
			expect(good).toHaveBeenCalledWith(newDevice);
		});
	});
});
