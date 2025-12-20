/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method
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
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_TYPE } from '../devices-wled.constants';
import { WledDeviceEntity } from '../entities/devices-wled.entity';
import {
	WledDeviceConnectedEvent,
	WledDeviceDisconnectedEvent,
	WledDeviceStateChangedEvent,
	WledInfo,
	WledMdnsDiscoveredDevice,
} from '../interfaces/wled.interface';
import { WledConfigModel } from '../models/config.model';

import { WledDeviceMapperService } from './device-mapper.service';
import { WledClientAdapterService } from './wled-client-adapter.service';
import { WledMdnsDiscovererService } from './wled-mdns-discoverer.service';
import { WledService } from './wled.service';

describe('WledService', () => {
	let service: WledService;
	let configService: jest.Mocked<ConfigService>;
	let wledAdapter: jest.Mocked<WledClientAdapterService>;
	let deviceMapper: jest.Mocked<WledDeviceMapperService>;
	let devicesService: jest.Mocked<DevicesService>;
	let mdnsDiscoverer: jest.Mocked<WledMdnsDiscovererService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let pluginServiceManager: jest.Mocked<PluginServiceManagerService>;

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

	const mockConfig: Partial<WledConfigModel> = {
		enabled: true,
		mdns: {
			enabled: true,
			interface: null,
			autoAdd: false,
		},
		websocket: {
			enabled: true,
			reconnectInterval: 5000,
		},
		polling: {
			interval: 10000,
		},
		timeouts: {
			connectionTimeout: 5000,
			commandDebounce: 100,
		},
	} as unknown as WledConfigModel;

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

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.useFakeTimers();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WledService,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn().mockReturnValue(mockConfig),
					},
				},
				{
					provide: WledClientAdapterService,
					useValue: {
						connect: jest.fn(),
						disconnect: jest.fn(),
						disconnectAll: jest.fn(),
						getDevice: jest.fn(),
						getDeviceByIdentifier: jest.fn(),
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						isConnected: jest.fn(),
						refreshState: jest.fn(),
						configureWebSocket: jest.fn(),
					},
				},
				{
					provide: WledDeviceMapperService,
					useValue: {
						mapDevice: jest.fn(),
						updateDeviceState: jest.fn(),
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
					provide: WledMdnsDiscovererService,
					useValue: {
						start: jest.fn(),
						stop: jest.fn(),
						getDiscoveredDevices: jest.fn().mockReturnValue([]),
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

		service = module.get<WledService>(WledService);
		configService = module.get(ConfigService);
		wledAdapter = module.get(WledClientAdapterService);
		deviceMapper = module.get(WledDeviceMapperService);
		devicesService = module.get(DevicesService);
		mdnsDiscoverer = module.get(WledMdnsDiscovererService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
		pluginServiceManager = module.get(PluginServiceManagerService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('IManagedPluginService interface', () => {
		it('should have correct pluginName', () => {
			expect(service.pluginName).toBe(DEVICES_WLED_PLUGIN_NAME);
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
			const mockDevice = createMockDevice('device-1', 'wled-test', '192.168.1.100');

			devicesService.findAll.mockResolvedValue([mockDevice]);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
				context: {
					state: { on: true, brightness: 128, segments: [] },
					info: { mac: 'AA:BB:CC:DD:EE:FF' },
					effects: [],
					palettes: [],
				},
			} as any);
			deviceMapper.updateDeviceState.mockResolvedValue(undefined);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			expect(service.getState()).toBe('started');
			expect(wledAdapter.configureWebSocket).toHaveBeenCalledWith(true, 5000);
			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.100', 'wled-test', 5000);
			expect(mdnsDiscoverer.start).toHaveBeenCalled();
		});

		it('should initialize device states to UNKNOWN before starting', async () => {
			const mockDevices = [
				createMockDevice('device-1', 'wled-1', '192.168.1.100'),
				createMockDevice('device-2', 'wled-2', '192.168.1.101'),
			];

			devicesService.findAll.mockResolvedValue(mockDevices);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-1', {
				state: ConnectionState.UNKNOWN,
			});
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-2', {
				state: ConnectionState.UNKNOWN,
			});
		});

		it('should not start if already started', async () => {
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();
			jest.clearAllMocks();

			await service.start();

			expect(wledAdapter.configureWebSocket).not.toHaveBeenCalled();
		});

		it('should continue starting even if device connection fails', async () => {
			// Individual device connection failures are caught and logged,
			// they don't crash the service
			wledAdapter.connect.mockRejectedValue(new Error('Connection failed'));
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			// Service should still start successfully
			expect(service.getState()).toBe('started');
		});
	});

	describe('stop', () => {
		it('should stop the service successfully', async () => {
			// First start the service
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			// Then stop it
			await service.stop();

			expect(service.getState()).toBe('stopped');
			expect(mdnsDiscoverer.stop).toHaveBeenCalled();
			expect(wledAdapter.disconnectAll).toHaveBeenCalled();
		});

		it('should not stop if already stopped', async () => {
			await service.stop();

			expect(mdnsDiscoverer.stop).not.toHaveBeenCalled();
		});
	});

	describe('onConfigChanged', () => {
		it('should return restartRequired true when service is started', async () => {
			// Start the service first
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should return restartRequired false when service is stopped', async () => {
			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});

	describe('restart', () => {
		it('should call pluginServiceManager.restartService', async () => {
			await service.restart();

			expect(pluginServiceManager.restartService).toHaveBeenCalledWith(DEVICES_WLED_PLUGIN_NAME, 'connector');
		});
	});

	describe('handleDeviceConnected', () => {
		it('should set connection state to CONNECTED', async () => {
			const event: WledDeviceConnectedEvent = {
				host: '192.168.1.100',
				info: { name: 'Test WLED', mac: 'AA:BB:CC:DD:EE:FF' } as WledInfo,
			};

			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			} as any);

			await service.handleDeviceConnected(event);

			expect(deviceMapper.setDeviceConnectionState).toHaveBeenCalledWith('wled-test', ConnectionState.CONNECTED);
		});
	});

	describe('handleDeviceDisconnected', () => {
		it('should set connection state to DISCONNECTED', async () => {
			const event: WledDeviceDisconnectedEvent = {
				host: '192.168.1.100',
				reason: 'manual disconnect',
			};

			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: false,
				enabled: true,
			} as any);

			await service.handleDeviceDisconnected(event);

			expect(deviceMapper.setDeviceConnectionState).toHaveBeenCalledWith('wled-test', ConnectionState.DISCONNECTED);
		});
	});

	describe('handleDeviceStateChanged', () => {
		it('should update device state via mapper', async () => {
			const event: WledDeviceStateChangedEvent = {
				host: '192.168.1.100',
				state: { on: true, brightness: 200, segments: [] } as any,
			};

			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			} as any);

			await service.handleDeviceStateChanged(event);

			expect(deviceMapper.updateDeviceState).toHaveBeenCalledWith('wled-test', event.state);
		});
	});

	describe('handleMdnsDeviceDiscovered', () => {
		it('should auto-add device when autoAdd is enabled', async () => {
			// Enable autoAdd in config
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as unknown as WledConfigModel);

			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.200',
				port: 80,
				mac: 'FF:EE:DD:CC:BB:AA',
			};

			devicesService.findAll.mockResolvedValue([]);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.200',
				identifier: 'wled-ffeeddccbbaa',
				connected: true,
				enabled: true,
				context: {
					state: { on: true, brightness: 128, segments: [] },
					info: { mac: 'FF:EE:DD:CC:BB:AA' },
					effects: [],
					palettes: [],
				},
			} as any);

			await service.handleMdnsDeviceDiscovered(discoveredDevice);

			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.200', 'wled-ffeeddccbbaa', 5000);
		});

		it('should not auto-add device when autoAdd is disabled', async () => {
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.200',
				port: 80,
			};

			devicesService.findAll.mockResolvedValue([]);

			await service.handleMdnsDeviceDiscovered(discoveredDevice);

			expect(wledAdapter.connect).not.toHaveBeenCalled();
		});

		it('should connect to existing device if found in database but not connected', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-existing', '192.168.1.200');

			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.200',
				port: 80,
			};

			devicesService.findAll.mockResolvedValue([existingDevice]);
			wledAdapter.isConnected.mockReturnValue(false);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);

			await service.handleMdnsDeviceDiscovered(discoveredDevice);

			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.200', 'wled-existing', 5000);
		});

		it('should not connect if device is already connected', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-existing', '192.168.1.200');

			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.200',
				port: 80,
			};

			devicesService.findAll.mockResolvedValue([existingDevice]);
			wledAdapter.isConnected.mockReturnValue(true);

			await service.handleMdnsDeviceDiscovered(discoveredDevice);

			expect(wledAdapter.connect).not.toHaveBeenCalled();
		});
	});

	describe('getDiscoveredDevices', () => {
		it('should return discovered devices from mDNS discoverer', () => {
			const mockDiscoveredDevices: WledMdnsDiscoveredDevice[] = [
				{ name: 'WLED 1', host: '192.168.1.100', port: 80 },
				{ name: 'WLED 2', host: '192.168.1.101', port: 80 },
			];

			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue(mockDiscoveredDevices);

			const result = service.getDiscoveredDevices();

			expect(result).toEqual(mockDiscoveredDevices);
		});
	});

	describe('polling', () => {
		it('should poll device states when started', async () => {
			const mockRegisteredDevices = [
				{ host: '192.168.1.100', identifier: 'wled-1', connected: true, enabled: true },
				{ host: '192.168.1.101', identifier: 'wled-2', connected: true, enabled: true },
			];

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as any[]);
			wledAdapter.refreshState.mockResolvedValue({ on: true, brightness: 128 } as any);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();
			jest.clearAllMocks();

			// Advance timers to trigger polling
			jest.advanceTimersByTime(10000);

			// Wait for async operations
			await Promise.resolve();

			expect(wledAdapter.refreshState).toHaveBeenCalledWith('192.168.1.100', 5000);
			expect(wledAdapter.refreshState).toHaveBeenCalledWith('192.168.1.101', 5000);
		});

		it('should not poll disabled devices', async () => {
			const mockRegisteredDevices = [{ host: '192.168.1.100', identifier: 'wled-1', connected: true, enabled: false }];

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as any[]);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();
			jest.clearAllMocks();

			// Advance timers to trigger polling
			jest.advanceTimersByTime(10000);

			await Promise.resolve();

			expect(wledAdapter.refreshState).not.toHaveBeenCalled();
		});

		it('should not poll disconnected devices', async () => {
			const mockRegisteredDevices = [{ host: '192.168.1.100', identifier: 'wled-1', connected: false, enabled: true }];

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as any[]);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();
			jest.clearAllMocks();

			// Advance timers to trigger polling
			jest.advanceTimersByTime(10000);

			await Promise.resolve();

			expect(wledAdapter.refreshState).not.toHaveBeenCalled();
		});
	});
});
