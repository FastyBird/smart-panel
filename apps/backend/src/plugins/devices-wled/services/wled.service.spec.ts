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
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_TYPE } from '../devices-wled.constants';
import { WledDeviceEntity } from '../entities/devices-wled.entity';
import {
	RegisteredWledDevice,
	WledAdapterCallbacks,
	WledDeviceConnectedEvent,
	WledDeviceContext,
	WledDeviceDisconnectedEvent,
	WledDeviceStateChangedEvent,
	WledInfo,
	WledMdnsCallbacks,
	WledMdnsDiscoveredDevice,
	WledState,
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

	// Captured callbacks
	let adapterCallbacks: WledAdapterCallbacks;
	let mdnsCallbacks: WledMdnsCallbacks;

	// Quiet logger noise

	beforeAll(() => {});

	afterAll(() => {});

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

	const createMockDevice = (
		id: string,
		identifier: string | null,
		hostname: string,
		enabled = true,
	): WledDeviceEntity =>
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

	const mockContext = {
		state: { on: true, brightness: 128, segments: [] },
		info: { name: 'Probed WLED', mac: 'AA:BB:CC:DD:EE:FF' },
		effects: [],
		palettes: [],
	} as WledDeviceContext;

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
						probe: jest.fn(),
						connectWithContext: jest.fn(),
						disconnect: jest.fn(),
						disconnectAll: jest.fn(),
						getDevice: jest.fn(),
						getDeviceByIdentifier: jest.fn(),
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						isConnected: jest.fn(),
						refreshState: jest.fn(),
						configureWebSocket: jest.fn(),
						setCallbacks: jest.fn().mockImplementation((callbacks: WledAdapterCallbacks) => {
							adapterCallbacks = callbacks;
						}),
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
						update: jest.fn(),
						remove: jest.fn(),
					},
				},
				{
					provide: WledMdnsDiscovererService,
					useValue: {
						start: jest.fn(),
						stop: jest.fn(),
						getDiscoveredDevices: jest.fn().mockReturnValue([]),
						isDiscoveryRunning: jest.fn().mockReturnValue(true),
						clearDiscoveredDevices: jest.fn(),
						forgetDiscoveredDevice: jest.fn(),
						setCallbacks: jest.fn().mockImplementation((callbacks: WledMdnsCallbacks) => {
							mdnsCallbacks = callbacks;
						}),
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
			} as RegisteredWledDevice);
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
		it('should return restartRequired true when relevant config changes', async () => {
			// Start the service first
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

			await service.start();

			// Simulate config change by returning different values
			const changedConfig = {
				...mockConfig,
				polling: { interval: 20000 }, // Changed from 10000
			};
			configService.getPluginConfig.mockReturnValue(changedConfig as WledConfigModel);

			const result = await service.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('should return restartRequired false when config does not change', async () => {
			// Start the service first
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.getDevice.mockReturnValue(null);
			mdnsDiscoverer.start.mockImplementation(() => undefined);

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

			expect(pluginServiceManager.restartService).toHaveBeenCalledWith(DEVICES_WLED_PLUGIN_NAME, 'connector');
		});
	});

	describe('adapter callbacks', () => {
		it('should set connection state to CONNECTED on device connected', async () => {
			const event: WledDeviceConnectedEvent = {
				host: '192.168.1.100',
				info: { name: 'Test WLED', mac: 'AA:BB:CC:DD:EE:FF' } as WledInfo,
			};

			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			} as RegisteredWledDevice);

			await adapterCallbacks.onDeviceConnected?.(event);

			expect(deviceMapper.setDeviceConnectionState).toHaveBeenCalledWith('wled-test', ConnectionState.CONNECTED);
		});

		it('should set connection state to DISCONNECTED on device disconnected', async () => {
			const event: WledDeviceDisconnectedEvent = {
				host: '192.168.1.100',
				identifier: 'wled-test',
				reason: 'manual disconnect',
			};

			await adapterCallbacks.onDeviceDisconnected?.(event);

			expect(deviceMapper.setDeviceConnectionState).toHaveBeenCalledWith('wled-test', ConnectionState.DISCONNECTED);
		});

		it('should update device state via mapper on state changed', async () => {
			const event: WledDeviceStateChangedEvent = {
				host: '192.168.1.100',
				state: { on: true, brightness: 200, segments: [] } as WledState,
			};

			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			} as RegisteredWledDevice);

			await adapterCallbacks.onDeviceStateChanged?.(event);

			expect(deviceMapper.updateDeviceState).toHaveBeenCalledWith('wled-test', event.state);
		});
	});

	describe('mdns callbacks', () => {
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
			const discoveredContext = {
				...mockContext,
				info: { ...mockContext.info, mac: 'FF:EE:DD:CC:BB:AA' },
			};

			devicesService.findAll.mockResolvedValue([]);
			wledAdapter.probe.mockResolvedValue(discoveredContext);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-1', 'wled-ffeeddccbbaa', '192.168.1.200'));

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(wledAdapter.probe).toHaveBeenCalledWith('192.168.1.200', 5000);
			expect(wledAdapter.connectWithContext).toHaveBeenCalledWith(
				'192.168.1.200',
				'wled-ffeeddccbbaa',
				discoveredContext,
			);
		});

		it('should auto-add a device through its advertised non-default port', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Port-qualified WLED',
				host: 'wled.local',
				port: 8080,
				mac: 'FF:EE:DD:CC:BB:AA',
			};
			const discoveredContext = {
				...mockContext,
				info: { ...mockContext.info, mac: 'FF:EE:DD:CC:BB:AA' },
			};
			devicesService.findAll.mockResolvedValue([]);
			wledAdapter.probe.mockResolvedValue(discoveredContext);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-1', 'wled-ffeeddccbbaa', 'wled.local:8080'));

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(wledAdapter.probe).toHaveBeenCalledWith('wled.local:8080', 5000);
			expect(wledAdapter.connectWithContext).toHaveBeenCalledWith(
				'wled.local:8080',
				'wled-ffeeddccbbaa',
				discoveredContext,
			);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'wled.local:8080',
				discoveredContext,
				'Port-qualified WLED',
				'wled-ffeeddccbbaa',
				undefined,
				undefined,
			);
		});

		it('should make a failed auto-add discovery retryable', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Offline WLED',
				host: '192.168.1.200',
				port: 80,
			};
			devicesService.findAll.mockResolvedValue([]);
			wledAdapter.probe.mockRejectedValue(new Error('Device offline'));

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(mdnsDiscoverer.forgetDiscoveredDevice).toHaveBeenCalledWith('192.168.1.200');
		});

		it('should make a thrown auto-add setup failure retryable', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Unknown WLED',
				host: '192.168.1.200',
				port: 80,
			};
			devicesService.findAll.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Database unavailable'));

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(mdnsDiscoverer.forgetDiscoveredDevice).toHaveBeenCalledWith('192.168.1.200');
		});

		it('should make the initial mDNS database lookup failure retryable', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Unknown WLED',
				host: '192.168.1.200',
				port: 80,
			};
			devicesService.findAll.mockRejectedValueOnce(new Error('Database unavailable'));

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(mdnsDiscoverer.forgetDiscoveredDevice).toHaveBeenCalledWith('192.168.1.200');
			expect(wledAdapter.probe).not.toHaveBeenCalled();
		});

		it('should reconcile a known MAC at its newly advertised endpoint', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Advertised name',
				host: '192.168.1.200',
				port: 80,
				mac: 'AA:BB:CC:DD:EE:FF',
			};
			devicesService.findAll.mockResolvedValue([existingDevice]);
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValueOnce({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			deviceMapper.mapDevice.mockResolvedValue({
				...existingDevice,
				hostname: '192.168.1.200',
			} as WledDeviceEntity);

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.200',
				mockContext,
				'Administrator name',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(wledAdapter.connectWithContext).toHaveBeenCalledWith('192.168.1.200', 'wled-aabbccddeeff', mockContext);
		});

		it('should not auto-add device when autoAdd is disabled', async () => {
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.200',
				port: 80,
			};

			devicesService.findAll.mockResolvedValue([]);

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

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

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

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

			await mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);

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

	describe('adoption flow', () => {
		it('restarts and clears mDNS discovery during a rescan', async () => {
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([]);

			await service.rescanDiscovery();

			expect(mdnsDiscoverer.stop).toHaveBeenCalled();
			expect(mdnsDiscoverer.clearDiscoveredDevices).toHaveBeenCalled();
			expect(mdnsDiscoverer.start).toHaveBeenCalled();
		});

		it('clears stale discovery candidates during a rescan when mDNS is disabled', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, enabled: false },
			} as WledConfigModel);
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([]);

			await service.rescanDiscovery();

			expect(mdnsDiscoverer.clearDiscoveredDevices).toHaveBeenCalled();
			expect(mdnsDiscoverer.stop).not.toHaveBeenCalled();
			expect(mdnsDiscoverer.start).not.toHaveBeenCalled();
		});

		it('probes without registering a connection', async () => {
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([]);

			const result = await service.probeDevice('http://192.168.1.100');

			expect(result).toEqual(
				expect.objectContaining({
					host: '192.168.1.100',
					name: 'Probed WLED',
					mac: 'AA:BB:CC:DD:EE:FF',
					adoptedDeviceId: null,
				}),
			);
			expect(wledAdapter.connectWithContext).not.toHaveBeenCalled();
		});

		it('preserves an adopted device name when probing its current MAC', async () => {
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.50'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const result = await service.probeDevice('192.168.1.100');

			expect(result).toEqual(
				expect.objectContaining({
					name: 'Administrator name',
					adoptedDeviceId: 'device-1',
				}),
			);
		});

		it('brackets a bare IPv6 host before probing', async () => {
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([]);

			const result = await service.probeDevice('fe80::1234');

			expect(wledAdapter.probe).toHaveBeenCalledWith('[fe80::1234]', 5000);
			expect(result.host).toBe('[fe80::1234]');
		});

		it('adopts a legacy bare IPv6 row without creating a duplicate', async () => {
			const legacyDevice = createMockDevice('device-1', 'wled-2001:db8::1', '2001:db8::1');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([legacyDevice]);
			devicesService.update.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
				hostname: '[2001:db8::1]',
			} as WledDeviceEntity);
			deviceMapper.mapDevice.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
				hostname: '[2001:db8::1]',
			} as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: '2001:db8::1', name: 'Legacy IPv6 strip', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'[2001:db8::1]',
				mockContext,
				'Legacy IPv6 strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(devicesService.remove).not.toHaveBeenCalled();
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('provisions each device through the mapper and retains partial failures', async () => {
			wledAdapter.probe.mockResolvedValueOnce(mockContext).mockRejectedValueOnce(new Error('Device offline'));
			devicesService.findAll.mockResolvedValue([]);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Living room', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.101', name: 'Kitchen', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				mockContext,
				'Living room',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(wledAdapter.connectWithContext).toHaveBeenCalledWith('192.168.1.100', 'wled-aabbccddeeff', mockContext);
			expect(results).toEqual([
				expect.objectContaining({ status: 'created', deviceId: 'device-1' }),
				expect.objectContaining({ status: 'failed', error: 'Device offline' }),
			]);
		});

		it('disconnects a newly registered host when final adoption persistence fails', async () => {
			const createdDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValueOnce(null).mockReturnValueOnce({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([]);
			deviceMapper.mapDevice.mockResolvedValue(createdDevice);
			deviceConnectivityService.setConnectionState.mockRejectedValueOnce(new Error('Connectivity write failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Living room', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(devicesService.remove).toHaveBeenCalledWith('device-1');
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Connectivity write failed' })]);
		});

		it('keeps an invalid host scoped to its batch item', async () => {
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([]);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'));

			const results = await service.adoptDevices([
				{ host: 'not/a/host', name: 'Invalid', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Valid', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'created']);
		});

		it('resumes mapper provisioning for an existing device after a partial failure', async () => {
			const partialDevice = createMockDevice('device-1', 'wled-ddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([partialDevice]);
			deviceMapper.mapDevice.mockResolvedValue(partialDevice);

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Living room', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				mockContext,
				'Living room',
				'wled-ddeeff',
				undefined,
				undefined,
			);
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('updates an adopted MAC when it is discovered at a new host', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockResolvedValue({ ...existingDevice, hostname: '192.168.1.200' } as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'Moved strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.200',
				mockContext,
				'Moved strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenLastCalledWith('device-1', {
				state: ConnectionState.CONNECTED,
			});
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('keeps the source connection when moved-device provisioning fails', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockRejectedValue(new Error('Provisioning failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'Moved strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).not.toHaveBeenCalled();
			expect(deviceConnectivityService.setConnectionState).not.toHaveBeenCalled();
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Provisioning failed' })]);
		});

		it('disconnects a failed move target before restoring the source connection', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice
				.mockReturnValueOnce({
					host: '192.168.1.100',
					identifier: 'wled-aabbccddeeff',
					connected: true,
				} as RegisteredWledDevice)
				.mockReturnValueOnce(null)
				.mockReturnValueOnce({
					host: '192.168.1.200',
					identifier: 'wled-aabbccddeeff',
					connected: true,
				} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockResolvedValue({ ...existingDevice, hostname: '192.168.1.200' } as WledDeviceEntity);
			deviceConnectivityService.setConnectionState.mockRejectedValueOnce(new Error('Connectivity write failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'Moved strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.200', false);
			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.100', 'wled-aabbccddeeff', 5000);
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Connectivity write failed' })]);
		});

		it('disconnects an existing same-host device when adoption disables it', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockResolvedValue({ ...existingDevice, enabled: false } as WledDeviceEntity);

			const results = await service.adoptDevices([
				{
					host: '192.168.1.100',
					name: 'Disabled strip',
					category: DeviceCategory.LIGHTING,
					enabled: false,
				},
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(wledAdapter.connectWithContext).not.toHaveBeenCalled();
			expect(deviceConnectivityService.setConnectionState).toHaveBeenLastCalledWith('device-1', {
				state: ConnectionState.DISCONNECTED,
			});
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('reuses an existing connection when an enabled device keeps its host', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const registeredDevice = {
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
				context: { ...mockContext, state: { ...mockContext.state, brightness: 1 } },
				lastSeen: new Date(0),
			} as RegisteredWledDevice;
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValue(registeredDevice);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockResolvedValue(existingDevice);

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Living room', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).not.toHaveBeenCalled();
			expect(wledAdapter.connectWithContext).not.toHaveBeenCalled();
			expect(registeredDevice.context).toBe(mockContext);
			expect(registeredDevice.lastSeen?.getTime()).toBeGreaterThan(0);
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('preserves both selected devices when adopted controllers exchange hosts', async () => {
			const firstDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const secondDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.200');
			const secondContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValueOnce(mockContext).mockResolvedValueOnce(secondContext);
			wledAdapter.getDevice.mockImplementation((host) => {
				const device = [firstDevice, secondDevice].find(({ hostname }) => hostname === host);
				return device ? ({ host, identifier: device.identifier, connected: true } as RegisteredWledDevice) : null;
			});
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice]);
			deviceMapper.mapDevice
				.mockResolvedValueOnce({ ...firstDevice, hostname: '192.168.1.200' } as WledDeviceEntity)
				.mockResolvedValueOnce({ ...secondDevice, hostname: '192.168.1.100' } as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First strip', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Second strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.200', false);
			expect(devicesService.update).not.toHaveBeenCalled();
			expect(deviceMapper.mapDevice).toHaveBeenNthCalledWith(
				1,
				'192.168.1.200',
				mockContext,
				'First strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(deviceMapper.mapDevice).toHaveBeenNthCalledWith(
				2,
				'192.168.1.100',
				secondContext,
				'Second strip',
				'wled-112233445566',
				undefined,
				undefined,
			);
			expect(results).toEqual([
				expect.objectContaining({ status: 'updated', deviceId: 'device-1' }),
				expect.objectContaining({ status: 'updated', deviceId: 'device-2' }),
			]);
		});

		it('rolls back every selected device when one address-swap mapping fails', async () => {
			const firstDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'First original',
			} as WledDeviceEntity;
			const secondDevice = {
				...createMockDevice('device-2', 'wled-112233445566', '192.168.1.200'),
				name: 'Second original',
			} as WledDeviceEntity;
			const secondContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValueOnce(mockContext).mockResolvedValueOnce(secondContext);
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice]);
			deviceMapper.mapDevice
				.mockResolvedValueOnce({ ...firstDevice, hostname: '192.168.1.200', name: 'First moved' } as WledDeviceEntity)
				.mockRejectedValueOnce(new Error('Second mapping failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Second moved', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'failed']);
			expect(results[0].error).toContain('Second mapping failed');
			expect(results[1].error).toContain('Second mapping failed');
			expect(devicesService.update).toHaveBeenCalledWith(
				'device-1',
				expect.objectContaining({
					identifier: 'wled-aabbccddeeff',
					name: 'First original',
					hostname: '192.168.1.100',
					enabled: true,
				}),
			);
			expect(devicesService.update).toHaveBeenCalledWith(
				'device-2',
				expect.objectContaining({
					identifier: 'wled-112233445566',
					name: 'Second original',
					hostname: '192.168.1.200',
					enabled: true,
				}),
			);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-1', {
				state: ConnectionState.CONNECTED,
			});
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith('device-2', {
				state: ConnectionState.CONNECTED,
			});
		});

		it('does not retire a selected address owner when its swap probe fails', async () => {
			const firstDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const secondDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.200');
			wledAdapter.probe
				.mockResolvedValueOnce(mockContext)
				.mockRejectedValueOnce(new Error('Second controller offline'));
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice]);

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Second moved', category: DeviceCategory.LIGHTING },
			]);

			expect(results).toEqual([
				expect.objectContaining({
					status: 'failed',
					error: 'A related selected WLED controller could not be probed',
				}),
				expect.objectContaining({ status: 'failed', error: 'Second controller offline' }),
			]);
			expect(deviceMapper.mapDevice).not.toHaveBeenCalled();
			expect(devicesService.update).not.toHaveBeenCalled();
			expect(wledAdapter.disconnect).not.toHaveBeenCalled();
		});

		it('blocks an entire move chain when its closing selection probe fails', async () => {
			const firstDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const secondDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.200');
			const thirdDevice = createMockDevice('device-3', 'wled-778899aabbcc', '192.168.1.30');
			const secondContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe
				.mockResolvedValueOnce(mockContext)
				.mockResolvedValueOnce(secondContext)
				.mockRejectedValueOnce(new Error('Third controller offline'));
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice, thirdDevice]);

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.30', name: 'Second moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Third moved', category: DeviceCategory.LIGHTING },
			]);

			expect(results).toEqual([
				expect.objectContaining({
					status: 'failed',
					error: 'A related selected WLED controller could not be probed',
				}),
				expect.objectContaining({
					status: 'failed',
					error: 'A related selected WLED controller could not be probed',
				}),
				expect.objectContaining({ status: 'failed', error: 'Third controller offline' }),
			]);
			expect(deviceMapper.mapDevice).not.toHaveBeenCalled();
			expect(devicesService.update).not.toHaveBeenCalled();
			expect(wledAdapter.disconnect).not.toHaveBeenCalled();
		});

		it('continues independent adoption after a dependent rollback write fails', async () => {
			const firstDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const secondDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.200');
			const secondContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			const independentContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '77:88:99:AA:BB:CC' },
			};
			const independentDevice = createMockDevice('device-3', 'wled-778899aabbcc', '192.168.1.30');
			wledAdapter.probe
				.mockResolvedValueOnce(mockContext)
				.mockResolvedValueOnce(secondContext)
				.mockResolvedValueOnce(independentContext);
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice]);
			devicesService.update.mockRejectedValue(new Error('Rollback write failed'));
			deviceMapper.mapDevice
				.mockResolvedValueOnce({ ...firstDevice, hostname: '192.168.1.200' } as WledDeviceEntity)
				.mockRejectedValueOnce(new Error('Second mapping failed'))
				.mockResolvedValueOnce(independentDevice);

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Second moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.30', name: 'Independent', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'failed', 'created']);
			expect(deviceMapper.mapDevice).toHaveBeenCalledTimes(3);
			expect(results[2]).toEqual(expect.objectContaining({ deviceId: 'device-3' }));
		});

		it('removes a newly created device when its dependent move group fails', async () => {
			const existingDevice = createMockDevice('device-existing', 'wled-aabbccddeeff', '192.168.1.100');
			const newContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '77:88:99:AA:BB:CC' },
			};
			wledAdapter.probe.mockResolvedValueOnce(newContext).mockResolvedValueOnce(mockContext);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice
				.mockResolvedValueOnce(createMockDevice('device-new', 'wled-778899aabbcc', '192.168.1.100'))
				.mockRejectedValueOnce(new Error('Existing move failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'New controller', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.200', name: 'Existing controller', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'failed']);
			expect(devicesService.remove).toHaveBeenCalledWith('device-new');
			expect(devicesService.update).toHaveBeenCalledWith(
				'device-existing',
				expect.objectContaining({ hostname: '192.168.1.100', enabled: true }),
			);
		});

		it('removes a partial new device when its mapper rejects inside a dependent group', async () => {
			const existingDevice = createMockDevice('device-existing', 'wled-aabbccddeeff', '192.168.1.100');
			const partialDevice = createMockDevice('device-partial', 'wled-778899aabbcc', '192.168.1.100');
			const newContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '77:88:99:AA:BB:CC' },
			};
			wledAdapter.probe.mockResolvedValueOnce(newContext).mockResolvedValueOnce(mockContext);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			devicesService.findOneBy.mockResolvedValue(partialDevice);
			deviceMapper.mapDevice.mockRejectedValueOnce(new Error('Channel provisioning failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Partial controller', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.200', name: 'Existing controller', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'failed']);
			expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'wled-778899aabbcc', DEVICES_WLED_TYPE);
			expect(devicesService.remove).toHaveBeenCalledWith('device-partial');
			expect(deviceMapper.mapDevice).toHaveBeenCalledTimes(1);
		});

		it('rolls back only the failed connected address-move group', async () => {
			const devices = [
				createMockDevice('device-1', 'wled-000000000001', '192.168.1.1'),
				createMockDevice('device-2', 'wled-000000000002', '192.168.1.2'),
				createMockDevice('device-3', 'wled-000000000003', '192.168.1.3'),
				createMockDevice('device-4', 'wled-000000000004', '192.168.1.4'),
			];
			const contexts = devices.map((device, index) => ({
				...mockContext,
				info: { ...mockContext.info, mac: `00:00:00:00:00:0${index + 1}` },
			}));
			wledAdapter.probe
				.mockResolvedValueOnce(contexts[0])
				.mockResolvedValueOnce(contexts[1])
				.mockResolvedValueOnce(contexts[2])
				.mockResolvedValueOnce(contexts[3]);
			devicesService.findAll.mockResolvedValue(devices);
			deviceMapper.mapDevice
				.mockResolvedValueOnce({ ...devices[0], hostname: '192.168.1.2' } as WledDeviceEntity)
				.mockResolvedValueOnce({ ...devices[1], hostname: '192.168.1.1' } as WledDeviceEntity)
				.mockResolvedValueOnce({ ...devices[2], hostname: '192.168.1.4' } as WledDeviceEntity)
				.mockRejectedValueOnce(new Error('Second group failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.2', name: 'First A', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.1', name: 'First B', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.4', name: 'Second A', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.3', name: 'Second B', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['updated', 'updated', 'failed', 'failed']);
			expect(devicesService.update.mock.calls.map(([id]) => id)).toEqual(['device-3', 'device-4']);
		});

		it('rejects a duplicate controller identity within one adoption batch', async () => {
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([]);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'mDNS alias', category: DeviceCategory.LIGHTING },
				{ host: 'wled.local', name: 'Manual alias', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledTimes(1);
			expect(results).toEqual([
				expect.objectContaining({ status: 'created', deviceId: 'device-1' }),
				expect.objectContaining({
					status: 'failed',
					error: 'The same WLED controller was selected more than once',
				}),
			]);
		});

		it('does not propagate a duplicate alias as a failed move probe', async () => {
			const existingDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([existingDevice]);
			deviceMapper.mapDevice.mockResolvedValue({
				...existingDevice,
				hostname: 'wled.local',
			} as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: 'wled.local', name: 'Moved strip', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Duplicate alias', category: DeviceCategory.LIGHTING },
			]);

			expect(results).toEqual([
				expect.objectContaining({ status: 'updated', deviceId: 'device-1' }),
				expect.objectContaining({
					status: 'failed',
					error: 'The same WLED controller was selected more than once',
				}),
			]);
			expect(deviceMapper.mapDevice).toHaveBeenCalledTimes(1);
		});

		it('serializes overlapping adoption batches before taking their database snapshots', async () => {
			const createdDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			let finishFirstMapping: ((device: WledDeviceEntity) => void) | undefined;
			const firstMapping = new Promise<WledDeviceEntity>((resolve) => {
				finishFirstMapping = resolve;
			});
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([createdDevice]);
			deviceMapper.mapDevice.mockReturnValueOnce(firstMapping).mockResolvedValueOnce(createdDevice);

			const firstAdoption = service.adoptDevices([
				{ host: '192.168.1.100', name: 'First request', category: DeviceCategory.LIGHTING },
			]);
			const secondAdoption = service.adoptDevices([
				{ host: 'wled.local', name: 'Second request', category: DeviceCategory.LIGHTING },
			]);
			await Promise.resolve();
			await Promise.resolve();

			expect(devicesService.findAll).toHaveBeenCalledTimes(1);
			finishFirstMapping?.(createdDevice);

			const [firstResults, secondResults] = await Promise.all([firstAdoption, secondAdoption]);

			expect(firstResults[0].status).toBe('created');
			expect(secondResults[0].status).toBe('updated');
			expect(devicesService.findAll).toHaveBeenCalledTimes(2);
		});

		it('serializes mDNS auto-add before an overlapping adoption snapshot', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const autoAddedDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Discovered WLED',
				host: '192.168.1.100',
				port: 80,
				mac: 'AA:BB:CC:DD:EE:FF',
			};
			let finishAutoAdd: ((device: WledDeviceEntity) => void) | undefined;
			const autoAddMapping = new Promise<WledDeviceEntity>((resolve) => {
				finishAutoAdd = resolve;
			});
			devicesService.findAll
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([autoAddedDevice]);
			wledAdapter.connect.mockResolvedValue(undefined);
			wledAdapter.probe.mockResolvedValue(mockContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
				context: mockContext,
			} as RegisteredWledDevice);
			deviceMapper.mapDevice.mockReturnValueOnce(autoAddMapping).mockResolvedValueOnce(autoAddedDevice);

			const autoAdd = mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);
			await Promise.resolve();
			await Promise.resolve();
			const adoption = service.adoptDevices([
				{ host: '192.168.1.100', name: 'Adopted WLED', category: DeviceCategory.LIGHTING },
			]);
			await Promise.resolve();
			await Promise.resolve();

			expect(devicesService.findAll).toHaveBeenCalledTimes(3);
			finishAutoAdd?.(autoAddedDevice);

			await autoAdd;
			const results = await adoption;

			expect(devicesService.findAll).toHaveBeenCalledTimes(4);
			expect(devicesService.remove).not.toHaveBeenCalled();
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('rechecks mDNS auto-add eligibility after a queued adoption finishes', async () => {
			configService.getPluginConfig.mockReturnValue({
				...mockConfig,
				mdns: { ...(mockConfig as WledConfigModel).mdns, autoAdd: true },
			} as WledConfigModel);
			const adoptedDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			const discoveredDevice: WledMdnsDiscoveredDevice = {
				name: 'Advertised name',
				host: '192.168.1.100',
				port: 80,
				mac: 'AA:BB:CC:DD:EE:FF',
			};
			let finishProbe: ((context: WledDeviceContext) => void) | undefined;
			const pendingProbe = new Promise<WledDeviceContext>((resolve) => {
				finishProbe = resolve;
			});
			wledAdapter.probe.mockReturnValue(pendingProbe);
			wledAdapter.isConnected.mockReturnValue(true);
			devicesService.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([adoptedDevice]);
			deviceMapper.mapDevice.mockResolvedValue(adoptedDevice);

			const adoption = service.adoptDevices([
				{ host: '192.168.1.100', name: 'Administrator name', category: DeviceCategory.LIGHTING },
			]);
			await Promise.resolve();
			await Promise.resolve();
			const autoAdd = mdnsCallbacks.onDeviceDiscovered?.(discoveredDevice);
			await Promise.resolve();
			await Promise.resolve();

			finishProbe?.(mockContext);
			const [results] = await Promise.all([adoption, autoAdd]);

			expect(results).toEqual([expect.objectContaining({ status: 'created', deviceId: 'device-1' })]);
			expect(deviceMapper.mapDevice).toHaveBeenCalledTimes(1);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				mockContext,
				'Administrator name',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
		});

		it('retires a stale hostname owner after provisioning a different MAC', async () => {
			const staleDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-2', 'wled-112233445566', '192.168.1.100'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('192.168.1.100', false);
			expect(deviceMapper.mapDevice.mock.invocationCallOrder[0]).toBeLessThan(
				wledAdapter.disconnect.mock.invocationCallOrder[0],
			);
			expect(devicesService.update).toHaveBeenCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				enabled: false,
				hostname: null,
			});
			expect(deviceMapper.mapDevice.mock.invocationCallOrder[0]).toBeLessThan(
				devicesService.update.mock.invocationCallOrder[0],
			);
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				replacementContext,
				'Replacement strip',
				'wled-112233445566',
				undefined,
				undefined,
			);
			expect(results).toEqual([expect.objectContaining({ status: 'created', deviceId: 'device-2' })]);
		});

		it('disconnects a stale owner using its explicit default-port registration', async () => {
			const staleDevice = createMockDevice('device-1', 'wled-aabbccddeeff', 'wled.local:80');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockImplementation((host) =>
				host === 'wled.local:80'
					? ({
							host,
							identifier: 'wled-aabbccddeeff',
							connected: true,
						} as RegisteredWledDevice)
					: null,
			);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			deviceMapper.mapDevice.mockResolvedValue(createMockDevice('device-2', 'wled-112233445566', 'wled.local'));

			const results = await service.adoptDevices([
				{ host: 'wled.local', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(wledAdapter.disconnect).toHaveBeenCalledWith('wled.local:80', false);
			expect(devicesService.update).toHaveBeenCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				enabled: false,
				hostname: null,
			});
			expect(results).toEqual([expect.objectContaining({ status: 'created', deviceId: 'device-2' })]);
		});

		it('does not retire a stale hostname owner when replacement provisioning fails', async () => {
			const staleDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			deviceMapper.mapDevice.mockRejectedValue(new Error('Provisioning failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(devicesService.update).not.toHaveBeenCalled();
			expect(wledAdapter.disconnect).not.toHaveBeenCalled();
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Provisioning failed' })]);
		});

		it('removes a replacement when stale-owner retirement fails', async () => {
			const staleDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const replacementDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.100');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			deviceMapper.mapDevice.mockResolvedValue(replacementDevice);
			devicesService.update.mockRejectedValueOnce(new Error('Retirement failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(devicesService.remove).toHaveBeenCalledWith('device-2');
			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.100', 'wled-aabbccddeeff', 5000);
			expect(deviceConnectivityService.setConnectionState).toHaveBeenLastCalledWith('device-1', {
				state: ConnectionState.CONNECTED,
			});
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Retirement failed' })]);
		});

		it('restores a retired owner snapshot when a later connectivity write fails', async () => {
			const staleDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Original strip',
				description: 'Original description',
			} as WledDeviceEntity;
			const replacementDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.100');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-aabbccddeeff',
				connected: true,
			} as RegisteredWledDevice);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			deviceMapper.mapDevice.mockResolvedValue(replacementDevice);
			devicesService.update.mockResolvedValue(staleDevice);
			deviceConnectivityService.setConnectionState.mockRejectedValueOnce(new Error('Connectivity write failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(devicesService.remove).toHaveBeenCalledWith('device-2');
			expect(devicesService.update).toHaveBeenLastCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				identifier: 'wled-aabbccddeeff',
				name: 'Original strip',
				description: 'Original description',
				enabled: true,
				hostname: '192.168.1.100',
			});
			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.100', 'wled-aabbccddeeff', 5000);
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Connectivity write failed' })]);
		});

		it('restores an offline stale owner snapshot after replacement failure', async () => {
			const staleDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Offline original',
			} as WledDeviceEntity;
			const replacementDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.100');
			const replacementContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValue(replacementContext);
			wledAdapter.getDevice.mockReturnValue(null);
			devicesService.findAll.mockResolvedValue([staleDevice]);
			devicesService.update.mockResolvedValue(staleDevice);
			deviceMapper.mapDevice.mockResolvedValue(replacementDevice);
			deviceConnectivityService.setConnectionState.mockRejectedValueOnce(new Error('Connectivity write failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Replacement strip', category: DeviceCategory.LIGHTING },
			]);

			expect(devicesService.update).toHaveBeenLastCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				identifier: 'wled-aabbccddeeff',
				name: 'Offline original',
				description: null,
				enabled: true,
				hostname: '192.168.1.100',
			});
			expect(wledAdapter.connect).not.toHaveBeenCalled();
			expect(results).toEqual([expect.objectContaining({ status: 'failed', error: 'Connectivity write failed' })]);
		});

		it('restores an unselected stale owner when a dependent move group fails', async () => {
			const firstDevice = createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100');
			const secondDevice = createMockDevice('device-2', 'wled-112233445566', '192.168.1.200');
			const staleDevice = {
				...createMockDevice('device-stale', 'wled-778899aabbcc', '192.168.1.200'),
				name: 'Stale original',
				description: 'Restore me',
			} as WledDeviceEntity;
			const secondContext = {
				...mockContext,
				info: { ...mockContext.info, mac: '11:22:33:44:55:66' },
			};
			wledAdapter.probe.mockResolvedValueOnce(mockContext).mockResolvedValueOnce(secondContext);
			devicesService.findAll.mockResolvedValue([firstDevice, secondDevice, staleDevice]);
			deviceMapper.mapDevice
				.mockResolvedValueOnce({ ...firstDevice, hostname: '192.168.1.200' } as WledDeviceEntity)
				.mockRejectedValueOnce(new Error('Second mapping failed'));

			const results = await service.adoptDevices([
				{ host: '192.168.1.200', name: 'First moved', category: DeviceCategory.LIGHTING },
				{ host: '192.168.1.100', name: 'Second moved', category: DeviceCategory.LIGHTING },
			]);

			expect(results.map((result) => result.status)).toEqual(['failed', 'failed']);
			expect(devicesService.update).toHaveBeenCalledWith('device-stale', {
				type: DEVICES_WLED_TYPE,
				identifier: 'wled-778899aabbcc',
				name: 'Stale original',
				description: 'Restore me',
				enabled: true,
				hostname: '192.168.1.200',
			});
			expect(wledAdapter.connect).toHaveBeenCalledWith('192.168.1.200', 'wled-778899aabbcc', 5000);
		});

		it('upgrades a legacy same-host device without an identifier before provisioning', async () => {
			const legacyDevice = createMockDevice('device-1', null, '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([legacyDevice]);
			devicesService.update.mockResolvedValue({ ...legacyDevice, identifier: 'wled-aabbccddeeff' } as WledDeviceEntity);
			deviceMapper.mapDevice.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
			} as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Legacy strip', category: DeviceCategory.LIGHTING },
			]);

			expect(devicesService.update).toHaveBeenCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				identifier: 'wled-aabbccddeeff',
				hostname: '192.168.1.100',
			});
			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				mockContext,
				'Legacy strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('adopts a legacy host-derived identifier without creating a duplicate', async () => {
			const legacyDevice = createMockDevice('device-1', 'wled-192-168-1-100', '192.168.1.100');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([legacyDevice]);
			devicesService.update.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
			} as WledDeviceEntity);
			deviceMapper.mapDevice.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
			} as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: '192.168.1.100', name: 'Legacy strip', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'192.168.1.100',
				mockContext,
				'Legacy strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(devicesService.update).toHaveBeenCalledWith('device-1', {
				type: DEVICES_WLED_TYPE,
				identifier: 'wled-aabbccddeeff',
				hostname: '192.168.1.100',
			});
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('adopts a raw host-derived identifier stored with a non-default port', async () => {
			const legacyDevice = createMockDevice('device-1', 'wled-wled-local', 'wled.local:8080');
			wledAdapter.probe.mockResolvedValue(mockContext);
			devicesService.findAll.mockResolvedValue([legacyDevice]);
			devicesService.update.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
			} as WledDeviceEntity);
			deviceMapper.mapDevice.mockResolvedValue({
				...legacyDevice,
				identifier: 'wled-aabbccddeeff',
			} as WledDeviceEntity);

			const results = await service.adoptDevices([
				{ host: 'wled.local:8080', name: 'Legacy strip', category: DeviceCategory.LIGHTING },
			]);

			expect(deviceMapper.mapDevice).toHaveBeenCalledWith(
				'wled.local:8080',
				mockContext,
				'Legacy strip',
				'wled-aabbccddeeff',
				undefined,
				undefined,
			);
			expect(results).toEqual([expect.objectContaining({ status: 'updated', deviceId: 'device-1' })]);
		});

		it('marks discovered devices as already adopted by MAC identity', async () => {
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([
				{ host: '192.168.1.200', name: 'Moved WLED', mac: 'AA:BB:CC:DD:EE:FF', port: 80 },
			]);
			devicesService.findAll.mockResolvedValue([createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100')]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0].adoptedDeviceId).toBe('device-1');
		});

		it('preserves an adopted device name in discovery inventory', async () => {
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([
				{ host: '192.168.1.200', name: 'Advertised name', mac: 'AA:BB:CC:DD:EE:FF', port: 80 },
			]);
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0]).toEqual(
				expect.objectContaining({
					name: 'Administrator name',
					adoptedDeviceId: 'device-1',
				}),
			);
		});

		it('matches a MAC-less discovery record using its non-default port', async () => {
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', 'wled.local:8080'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([
				{ host: 'wled.local', name: 'Advertised name', port: 8080 },
			]);
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0]).toEqual(
				expect.objectContaining({
					name: 'Administrator name',
					adoptedDeviceId: 'device-1',
				}),
			);
		});

		it('matches a MAC-less discovery hostname case-insensitively', async () => {
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', 'wled.local'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([{ host: 'WLED.local', name: 'Advertised name', port: 80 }]);
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0]).toEqual(
				expect.objectContaining({
					name: 'Administrator name',
					adoptedDeviceId: 'device-1',
				}),
			);
		});

		it('matches a MAC-less default-port record to an explicit port 80 endpoint', async () => {
			const existingDevice = {
				...createMockDevice('device-1', 'wled-aabbccddeeff', 'wled.local:80'),
				name: 'Administrator name',
			} as WledDeviceEntity;
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([{ host: 'wled.local', name: 'Advertised name', port: 80 }]);
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0]).toEqual(
				expect.objectContaining({
					name: 'Administrator name',
					adoptedDeviceId: 'device-1',
				}),
			);
		});

		it('prefers the canonical MAC device over legacy rows at the same host', async () => {
			const nullIdentifierDevice = {
				...createMockDevice('device-null', null, '192.168.1.200'),
				name: 'Null identifier',
			} as WledDeviceEntity;
			const legacyDevice = {
				...createMockDevice('device-legacy', 'wled-ddeeff', '192.168.1.200'),
				name: 'Legacy identifier',
			} as WledDeviceEntity;
			const canonicalDevice = {
				...createMockDevice('device-canonical', 'wled-aabbccddeeff', '192.168.1.100'),
				name: 'Canonical identifier',
			} as WledDeviceEntity;
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([
				{ host: '192.168.1.200', name: 'Advertised name', mac: 'AA:BB:CC:DD:EE:FF', port: 80 },
			]);
			devicesService.findAll.mockResolvedValue([nullIdentifierDevice, legacyDevice, canonicalDevice]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0]).toEqual(
				expect.objectContaining({
					name: 'Canonical identifier',
					adoptedDeviceId: 'device-canonical',
				}),
			);
		});

		it('does not match a reused hostname when the probed MAC belongs to another device', async () => {
			mdnsDiscoverer.getDiscoveredDevices.mockReturnValue([
				{ host: '192.168.1.100', name: 'Replacement WLED', mac: '11:22:33:44:55:66', port: 80 },
			]);
			devicesService.findAll.mockResolvedValue([createMockDevice('device-1', 'wled-aabbccddeeff', '192.168.1.100')]);

			const inventory = await service.getDiscoveryInventory();

			expect(inventory.devices[0].adoptedDeviceId).toBeNull();
		});
	});

	describe('polling', () => {
		it('should poll device states when started', async () => {
			const mockRegisteredDevices = [
				{ host: '192.168.1.100', identifier: 'wled-1', connected: true, enabled: true },
				{ host: '192.168.1.101', identifier: 'wled-2', connected: true, enabled: true },
			];

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as RegisteredWledDevice[]);
			wledAdapter.refreshState.mockResolvedValue({ on: true, brightness: 128 } as WledState);
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

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as RegisteredWledDevice[]);
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

			wledAdapter.getRegisteredDevices.mockReturnValue(mockRegisteredDevices as RegisteredWledDevice[]);
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
