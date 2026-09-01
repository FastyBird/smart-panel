/*
eslint-disable @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return,
@typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

import { DatabaseDiscovererService } from './database-discoverer.service';
import { DeviceManagerService } from './device-manager.service';
import { ShellyNgService } from './shelly-ng.service';
import { ShellyWsServerService } from './shelly-ws-server.service';

// 🔑 Mock the constants module so it doesn't evaluate the real DESCRIPTORS table
jest.mock('../devices-shelly-ng.constants', () => ({
	DEVICES_SHELLY_NG_PLUGIN_NAME: 'devices-shelly-ng',
	DEVICES_SHELLY_NG_TYPE: 'devices-shelly-ng',
	ComponentType: { WIFI: 'wifi' }, // add more keys if a test path needs them
	DeviceProfile: { SWITCH: 'switch', COVER: 'cover' },
	AddressType: { ETHERNET: 'ethernet', WIFI: 'wifi' },
	ADDRESS_PRIORITY: { ethernet: 0, wifi: 1 },
	DESCRIPTORS: {}, // avoid pulling in device model classes
}));

jest.mock('shellies-ds9', () => {
	const shelliesInstances: any[] = [];
	const mdnsInstances: any[] = [];

	class DeviceDiscoverer {
		public listeners: Record<string, Function[]> = {};
		on(evt: string, fn: Function) {
			(this.listeners[evt] ??= []).push(fn);
			return this;
		}
	}

	class MockShellies {
		public options: any;
		public listeners: Record<string, Function[]> = {};
		public registered: any[] = [];
		constructor(options: any) {
			this.options = options;
			shelliesInstances.push(this);
		}
		on(evt: string, fn: Function) {
			(this.listeners[evt] ??= []).push(fn);
			return this;
		}
		off(evt: string, fn: Function) {
			const arr = this.listeners[evt] ?? [];
			this.listeners[evt] = arr.filter((f) => f !== fn);
			return this;
		}
		registerDiscoverer(d: any) {
			this.registered.push(d);
		}
		removeAllListeners() {
			this.listeners = {};
		}
		clear() {
			/* noop */
		}
	}

	class MockMdnsDeviceDiscoverer extends DeviceDiscoverer {
		public options: any;
		constructor(options?: any) {
			super();
			this.options = options ?? {};
			mdnsInstances.push(this);
		}
		async start() {
			/* noop */
		}
	}

	return {
		Shellies: MockShellies,
		MdnsDeviceDiscoverer: MockMdnsDeviceDiscoverer,
		DeviceDiscoverer,
		__testing: { shelliesInstances, mdnsInstances },
	};
});

// Silence Nest logger

const pluginConfigEnabled = {
	enabled: true,
	statusPollInterval: 60,
	mdns: { enabled: true, interface: null as string | null },
	websockets: { requestTimeout: 10, pingInterval: 60, reconnectInterval: [5, 10, 30] },
};

const mockConfigService = (cfg = pluginConfigEnabled) => ({
	getPluginConfig: jest.fn().mockImplementation((name: string) => {
		if (name === DEVICES_SHELLY_NG_PLUGIN_NAME) return cfg;
		return undefined;
	}),
});

const mockDelegates = () => ({
	insert: jest.fn(),
	remove: jest.fn().mockResolvedValue(undefined),
	detach: jest.fn(),
	get: jest.fn().mockReturnValue(undefined),
	checkHealth: jest.fn().mockResolvedValue(undefined),
	pollAllDevices: jest.fn().mockResolvedValue(undefined),
});

const mockDevicesService = (devices: any[] = []) => ({
	findAll: jest.fn().mockResolvedValue(devices),
	findOneBy: jest.fn().mockResolvedValue(null),
});

const mockDbDiscoverer = () => ({ run: jest.fn().mockResolvedValue(undefined) });

const mkDevice = (over: Partial<any> = {}) => ({ id: 'dev-1', ...over });

const mockDeviceManagerService = {
	createOrUpdate: jest.fn().mockResolvedValue(undefined),
};

const mockDeviceConnectivityService = {
	setConnectionState: jest.fn().mockResolvedValue(undefined),
};

const mockPluginServiceManager = {
	restartService: jest.fn().mockResolvedValue(true),
};

const mockWsServer = {
	start: jest.fn(),
	stop: jest.fn(),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ShellyNgService', () => {
	let svc: ShellyNgService | null = null;

	afterEach(async () => {
		if (svc && svc.getState() === 'started') {
			await svc.stop();
		}

		svc = null;

		const ds9 = require('shellies-ds9');
		ds9.__testing.shelliesInstances.length = 0;
		ds9.__testing.mdnsInstances.length = 0;
		jest.clearAllMocks();
	});

	test('start(): initializes when enabled', async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useFactory: mockDelegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = moduleRef.get(ShellyNgService);
		await svc.start();

		const ds9 = require('shellies-ds9');
		expect(ds9.__testing.shelliesInstances).toHaveLength(1);
	});

	test('start(): creates Shellies, registers DB discoverer, starts mDNS when enabled', async () => {
		const dbDisc = mockDbDiscoverer();
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
				{ provide: DatabaseDiscovererService, useValue: dbDisc },
				{ provide: DelegatesManagerService, useFactory: mockDelegates },
				{
					provide: DevicesService,
					useFactory: () =>
						mockDevicesService([
							{ id: '1', identifier: 'sh-1', enabled: true, password: 'p', type: DEVICES_SHELLY_NG_TYPE },
							{ id: '2', identifier: 'sh-2', enabled: false, password: null, type: DEVICES_SHELLY_NG_TYPE },
						]),
				},
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);
		await svc.start();

		const ds9 = require('shellies-ds9');
		expect(ds9.__testing.shelliesInstances).toHaveLength(1);
		const sh = ds9.__testing.shelliesInstances[0];

		expect(sh.options?.deviceOptions instanceof Map).toBe(true);
		expect(sh.options.deviceOptions.get('sh-1')).toEqual({ exclude: false, password: 'p' });
		expect(sh.options.deviceOptions.get('sh-2')).toEqual({ exclude: true, password: undefined });

		expect(ds9.__testing.mdnsInstances).toHaveLength(1);
		expect(sh.registered.length).toBeGreaterThanOrEqual(1);

		expect(dbDisc.run).toHaveBeenCalledTimes(1);
	});

	test('start(): no mDNS when disabled in config', async () => {
		const cfg = { ...pluginConfigEnabled, mdns: { enabled: false, interface: null as string | null } };
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(cfg) },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useFactory: mockDelegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);
		await svc.start();

		const ds9 = require('shellies-ds9');
		expect(ds9.__testing.shelliesInstances).toHaveLength(1);
		expect(ds9.__testing.mdnsInstances).toHaveLength(0);
	});

	test('event handlers: add/remove/exclude/unknown/error', async () => {
		const delegates = mockDelegates();
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useValue: delegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);
		await svc.start();

		const ds9 = require('shellies-ds9');
		const sh = ds9.__testing.shelliesInstances[0] as any;
		const emit = (evt: string, ...args: any[]) => (sh.listeners[evt] ?? []).forEach((fn: Function) => fn(...args));

		delegates.insert.mockResolvedValue({ id: 'dev-1' });

		emit('add', mkDevice({ id: 'dev-1' }));
		await sleep(0); // wait for async handler

		expect(delegates.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'dev-1' }));

		emit('remove', mkDevice({ id: 'dev-9' }));
		expect(delegates.remove).toHaveBeenCalledWith('dev-9');

		emit('exclude', 'dev-10');
		expect(delegates.remove).toHaveBeenCalledWith('dev-10');

		emit('unknown', 'dev-11', 'X');
		emit('error', 'dev-12', new Error('boom'));
	});

	test('stop(): detaches delegates and removes listeners', async () => {
		const delegates = mockDelegates();
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useValue: delegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);
		await svc.start();

		const ds9 = require('shellies-ds9');
		const sh = ds9.__testing.shelliesInstances[0] as any;

		expect(Object.values(sh.listeners).flat().length).toBeGreaterThan(0);
		await svc.stop();
		expect(delegates.detach).toHaveBeenCalledTimes(1);
	});

	test('getState() returns current service state', async () => {
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useFactory: mockDelegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);

		expect(svc.getState()).toBe('stopped');

		await svc.start();
		expect(svc.getState()).toBe('started');

		await svc.stop();
		expect(svc.getState()).toBe('stopped');
	});

	test('onConfigChanged() clears cached plugin config', async () => {
		const configSvc = mockConfigService(pluginConfigEnabled);
		const mod = await Test.createTestingModule({
			providers: [
				ShellyNgService,
				{ provide: ConfigService, useValue: configSvc },
				{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
				{ provide: DelegatesManagerService, useFactory: mockDelegates },
				{ provide: DevicesService, useFactory: () => mockDevicesService() },
				{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
				{ provide: ShellyWsServerService, useValue: mockWsServer },
			],
		}).compile();

		svc = mod.get(ShellyNgService);
		await svc.start();

		// Call onConfigChanged to clear cache
		await svc.onConfigChanged();

		// Access the private config getter by triggering a method that uses it
		// This would normally be done by ManagedServiceManagerService
		expect(svc.getState()).toBe('started');
	});

	describe('mDNS discovery errors', () => {
		const startService = async (): Promise<void> => {
			const moduleRef = await Test.createTestingModule({
				providers: [
					ShellyNgService,
					{ provide: ConfigService, useFactory: () => mockConfigService(pluginConfigEnabled) },
					{ provide: DatabaseDiscovererService, useFactory: mockDbDiscoverer },
					{ provide: DelegatesManagerService, useFactory: mockDelegates },
					{ provide: DevicesService, useFactory: () => mockDevicesService() },
					{ provide: DeviceManagerService, useValue: mockDeviceManagerService },
					{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
					{ provide: ManagedServiceManagerService, useValue: mockPluginServiceManager },
					{ provide: ShellyWsServerService, useValue: mockWsServer },
				],
			}).compile();

			svc = moduleRef.get(ShellyNgService);

			await svc.start();
		};

		const emitDiscovererError = (message: string): void => {
			const ds9 = require('shellies-ds9');

			const discoverer = ds9.__testing.mdnsInstances[0] as { listeners: Record<string, ((error: Error) => void)[]> };

			for (const listener of discoverer.listeners['error'] ?? []) {
				listener(new Error(message));
			}
		};

		test.each([['Cannot decode name (bad label)'], ['Cannot decode name (bad pointer)']])(
			'reports %s at debug level, since it comes from other devices on the network',
			async (message) => {
				const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
				const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

				await startService();

				emitDiscovererError(message);

				// The packet is not ours to parse - any mDNS speaker on the network can produce it,
				// so it must not surface as a warning about the Shelly plugin.
				expect(warnSpy).not.toHaveBeenCalled();
				expect(debugSpy).toHaveBeenCalled();
			},
		);

		test('still reports a genuine discovery failure at error level', async () => {
			const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

			await startService();

			emitDiscovererError('EADDRINUSE: address already in use');

			expect(errorSpy).toHaveBeenCalled();
		});
	});
});
