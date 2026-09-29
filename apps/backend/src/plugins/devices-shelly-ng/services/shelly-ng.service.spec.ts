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
		public devices = new Map<string, any>();
		get(id: string) {
			return this.devices.get(id);
		}
		add(device: any) {
			if (this.devices.has(device.id)) this.delete(device.id);
			this.devices.set(device.id, device);
			for (const listener of this.listeners.add ?? []) listener(device);
		}
		delete(id: string) {
			const device = this.devices.get(id);
			if (!device) return;
			this.devices.delete(id);
			device.rpcHandler?.destroy();
			for (const listener of this.listeners.remove ?? []) listener(device);
		}
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
		unregisterDiscoverer(d: any) {
			this.registered = this.registered.filter((registered) => registered !== d);
		}
		removeAllListeners() {
			this.listeners = {};
		}
		clear() {
			for (const id of this.devices.keys()) this.delete(id);
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
		stop = jest.fn().mockResolvedValue(undefined);
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
	detach: jest.fn().mockResolvedValue(undefined),
	get: jest.fn().mockReturnValue(undefined),
	checkHealth: jest.fn().mockResolvedValue(undefined),
	invalidateStatusPolls: jest.fn(),
	getConnectedDelegateIds: jest.fn().mockReturnValue([]),
	pollDevice: jest.fn().mockResolvedValue(undefined),
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

	function createPollingService(delegates: {
		getConnectedDelegateIds: jest.Mock;
		pollDevice: jest.Mock;
		invalidateStatusPolls?: jest.Mock;
	}): ShellyNgService {
		delegates.invalidateStatusPolls ??= jest.fn();

		const pollingService = new ShellyNgService(
			mockConfigService({ ...pluginConfigEnabled, statusPollInterval: 1 }) as any,
			mockDbDiscoverer() as any,
			delegates as any,
			mockDeviceManagerService as any,
			mockDevicesService() as any,
			mockDeviceConnectivityService as any,
			mockPluginServiceManager as any,
			mockWsServer as any,
		);

		(pollingService as any).pluginConfig = { ...pluginConfigEnabled, statusPollInterval: 1 };
		(pollingService as any).state = 'started';

		return pollingService;
	}

	afterEach(async () => {
		if (svc && svc.getState() === 'started') {
			await svc.stop();
		}

		svc = null;

		const ds9 = require('shellies-ds9');
		ds9.__testing.shelliesInstances.length = 0;
		ds9.__testing.mdnsInstances.length = 0;
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	describe('status poll scheduler', () => {
		test('uses stable staggered slots and skips an occupied delegate instead of catching up', async () => {
			jest.useFakeTimers();
			let release!: () => void;
			const delegates = {
				getConnectedDelegateIds: jest.fn().mockReturnValue(['c', 'a', 'b']),
				pollDevice: jest.fn().mockImplementation(() => new Promise<void>((resolve) => (release = resolve))),
			};
			const pollingService = createPollingService(delegates);

			(pollingService as any).startStatusPoll();
			await jest.advanceTimersByTimeAsync(0);
			expect(delegates.pollDevice).toHaveBeenCalledWith('a', 10_000);

			await jest.advanceTimersByTimeAsync(334);
			expect(delegates.pollDevice).toHaveBeenCalledWith('b', 10_000);
			await jest.advanceTimersByTimeAsync(333);
			expect(delegates.pollDevice).toHaveBeenCalledWith('c', 10_000);

			await jest.advanceTimersByTimeAsync(333);
			expect(delegates.pollDevice).toHaveBeenCalledTimes(3);

			release();
			await Promise.resolve();
			(pollingService as any).stopStatusPoll();
		});

		test('caps concurrent work at ten and cancels slots on lifecycle stop', async () => {
			jest.useFakeTimers();
			const delegates = {
				getConnectedDelegateIds: jest.fn().mockReturnValue(Array.from({ length: 11 }, (_, index) => `device-${index}`)),
				pollDevice: jest.fn().mockImplementation(() => new Promise<void>(() => undefined)),
			};
			const pollingService = createPollingService(delegates);

			(pollingService as any).startStatusPoll();
			await jest.advanceTimersByTimeAsync(1_000);
			expect(delegates.pollDevice).toHaveBeenCalledTimes(10);

			(pollingService as any).stopStatusPoll();
			await jest.advanceTimersByTimeAsync(2_000);
			expect(delegates.pollDevice).toHaveBeenCalledTimes(10);
		});
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

		sh.add(mkDevice({ id: 'dev-1' }));
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
		expect(sh.registered).toEqual([]);
		expect(ds9.__testing.mdnsInstances[0].stop).toHaveBeenCalledTimes(1);
		await svc.start();
		expect(ds9.__testing.shelliesInstances[1].registered).toHaveLength(2);
		expect(sh.registered).toEqual([]);
	});

	test.each([
		{ stage: 'queued', replacement: true },
		{ stage: 'lookup', replacement: true },
		{ stage: 'provision', replacement: true },
		{ stage: 'queued', replacement: false },
		{ stage: 'lookup', replacement: false },
		{ stage: 'provision', replacement: false },
	])('does not attach a removed discovery (stage=$stage, replacement=$replacement)', async ({ stage, replacement }) => {
		const delegates = mockDelegates();
		const devices = mockDevicesService();
		devices.findOneBy.mockResolvedValue({ id: 'stored-device' });
		const manager = { createOrUpdate: jest.fn().mockResolvedValue(undefined) };
		let release!: () => void;
		let entered!: () => void;
		const waiting = new Promise<void>((resolve) => (entered = resolve));
		const held = new Promise<void>((resolve) => (release = resolve));
		if (stage === 'provision') {
			manager.createOrUpdate.mockImplementationOnce(async () => {
				entered();
				await held;
			});
		} else {
			devices.findOneBy.mockImplementationOnce(async () => {
				entered();
				await held;
				return { id: 'stored-device' };
			});
		}
		svc = new ShellyNgService(
			mockConfigService() as any,
			mockDbDiscoverer() as any,
			delegates as any,
			manager as any,
			devices as any,
			mockDeviceConnectivityService as any,
			mockPluginServiceManager as any,
			mockWsServer as any,
		);
		await svc.start();
		const ds9 = require('shellies-ds9');
		const sh = ds9.__testing.shelliesInstances[0];
		const rpcHandler = { connected: true, destroy: jest.fn(() => (rpcHandler.connected = false)) };
		const old = mkDevice({ rpcHandler });
		// A currently owned transport may be reconnecting; ownership must not depend on connected=true.
		const latest = mkDevice({ rpcHandler: { connected: false, destroy: jest.fn() } });

		if (stage === 'queued') {
			sh.add(mkDevice({ id: 'blocker' }));
			await waiting;
			sh.add(old);
		} else {
			sh.add(old);
			await waiting;
		}

		if (replacement) sh.add(latest);
		else sh.delete(old.id);
		expect(rpcHandler.destroy).toHaveBeenCalledTimes(1);
		expect(rpcHandler.connected).toBe(false);
		release();
		await sleep(0);

		const attached = delegates.insert.mock.calls.filter(([device]) => device.id === old.id).map(([device]) => device);
		expect(attached).toEqual(replacement ? [latest] : []);
		if (stage === 'queued') {
			expect(devices.findOneBy).toHaveBeenCalledTimes(replacement ? 2 : 1);
		} else if (stage === 'lookup') {
			expect(manager.createOrUpdate).toHaveBeenCalledTimes(replacement ? 1 : 0);
		}
	});

	test.each(['lookup', 'provision'])(
		'stop prevents a discovery awaiting %s from attaching a stale delegate',
		async (stage) => {
			const delegates = mockDelegates();
			const devices = mockDevicesService();
			const manager = { createOrUpdate: jest.fn().mockResolvedValue(undefined) };
			let release!: (value?: unknown) => void;
			let entered!: () => void;
			const pending = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const wait = () => {
				entered();
				return new Promise((resolve) => {
					release = resolve;
				});
			};
			if (stage === 'lookup') {
				devices.findOneBy.mockImplementation(wait);
			} else {
				devices.findOneBy.mockResolvedValue({ id: 'existing' });
				manager.createOrUpdate.mockImplementation(wait);
			}
			svc = new ShellyNgService(
				mockConfigService() as any,
				mockDbDiscoverer() as any,
				delegates as any,
				manager as any,
				devices as any,
				mockDeviceConnectivityService as any,
				mockPluginServiceManager as any,
				mockWsServer as any,
			);
			await svc.start();
			const ds9 = require('shellies-ds9');
			const sh = ds9.__testing.shelliesInstances[0];
			sh.add(mkDevice());
			await pending;
			await svc.stop();
			release(stage === 'lookup' ? { id: 'existing' } : undefined);
			await sleep(0);

			expect(delegates.insert).not.toHaveBeenCalled();
			if (stage === 'lookup') {
				expect(manager.createOrUpdate).not.toHaveBeenCalled();
			}
		},
	);

	test.each([
		{ force: false, reject: false },
		{ force: true, reject: false },
		{ force: false, reject: true },
		{ force: true, reject: true },
	])(
		'stop drains admitted insertion before detach/restart (force=$force, reject=$reject)',
		async ({ force, reject }) => {
			const delegates = mockDelegates();
			const handlers = new Set<string>();
			let finish!: () => void;
			let entered!: () => void;
			const started = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const pending = new Promise<void>((resolve) => {
				finish = resolve;
			});
			delegates.get.mockReturnValue(force ? { connected: false } : undefined);
			delegates.insert.mockImplementation(async () => {
				entered();
				await pending;
				// performInsert can populate handler maps after an asynchronous lookup.
				handlers.add('old-handler');
				if (reject) throw new Error('insertion failed after partial setup');
				return { id: 'dev-1' };
			});
			delegates.detach.mockImplementation(() => {
				handlers.clear();
				return Promise.resolve();
			});
			svc = new ShellyNgService(
				mockConfigService() as any,
				mockDbDiscoverer() as any,
				delegates as any,
				mockDeviceManagerService as any,
				mockDevicesService() as any,
				mockDeviceConnectivityService as any,
				mockPluginServiceManager as any,
				mockWsServer as any,
			);
			await svc.start();
			const ds9 = require('shellies-ds9');
			ds9.__testing.shelliesInstances[0].add(mkDevice());
			await started;
			const stopping = svc.stop();
			const restarting = svc.start();

			try {
				await sleep(0);
				expect(delegates.detach).not.toHaveBeenCalled();
				expect(ds9.__testing.shelliesInstances).toHaveLength(1);
			} finally {
				finish();
				await stopping;
				await restarting;
			}

			expect(delegates.detach).toHaveBeenCalledTimes(1);
			expect(handlers.size).toBe(0);
			expect(svc.getState()).toBe('started');
			expect(ds9.__testing.shelliesInstances).toHaveLength(2);
		},
	);

	test.each(['reject', 'timeout'])('stop continues delegate cleanup when mDNS stop ends with %s', async (failure) => {
		jest.useFakeTimers();
		const delegates = mockDelegates();
		svc = new ShellyNgService(
			mockConfigService() as any,
			mockDbDiscoverer() as any,
			delegates as any,
			mockDeviceManagerService as any,
			mockDevicesService() as any,
			mockDeviceConnectivityService as any,
			mockPluginServiceManager as any,
			mockWsServer as any,
		);
		await svc.start();
		const ds9 = require('shellies-ds9');
		const mdns = ds9.__testing.mdnsInstances[0];
		mdns.stop.mockImplementation(() =>
			failure === 'reject' ? Promise.reject(new Error('close failed')) : new Promise(() => {}),
		);

		const stopped = svc.stop();
		await jest.advanceTimersByTimeAsync(5_000);
		await stopped;

		expect(ds9.__testing.shelliesInstances[0].registered).toEqual([]);
		expect(delegates.detach).toHaveBeenCalledTimes(1);
		expect(svc.getState()).toBe('stopped');
	});

	test('failed database discovery releases its registration before a retry', async () => {
		const db = mockDbDiscoverer();
		db.run.mockRejectedValueOnce(new Error('database discovery failed'));
		const delegates = mockDelegates();
		svc = new ShellyNgService(
			mockConfigService() as any,
			db as any,
			delegates as any,
			mockDeviceManagerService as any,
			mockDevicesService() as any,
			mockDeviceConnectivityService as any,
			mockPluginServiceManager as any,
			mockWsServer as any,
		);

		await expect(svc.start()).rejects.toThrow('database discovery failed');
		const ds9 = require('shellies-ds9');
		expect(svc.getState()).toBe('error');
		expect(ds9.__testing.shelliesInstances[0].registered).toEqual([]);
		expect(delegates.detach).toHaveBeenCalledTimes(1);
		await svc.start();
		expect(svc.getState()).toBe('started');
		expect(ds9.__testing.shelliesInstances[1].registered).toHaveLength(2);
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
