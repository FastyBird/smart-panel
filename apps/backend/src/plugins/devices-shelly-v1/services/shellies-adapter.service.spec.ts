/*
eslint-disable @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return,
@typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DataSource } from 'typeorm';

import { Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterCallbacks, ShellyDevice } from '../interfaces/shellies.interface';
import { DeviceEntitySubscriber } from '../subscribers/device-entity.subscriber';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

// Mock the shellies library
jest.mock('../lib/shellies', () => ({
	clearShellyCredentials: jest.requireActual('../lib/shellies').clearShellyCredentials,
	subscribeShellyTemperatures: jest.fn().mockReturnValue(() => {}),
	readShellyTemperature: jest.fn().mockResolvedValue(null),
	on: jest.fn(),
	removeAllListeners: jest.fn(),
	removeAllDevices: jest.fn(),
	start: jest.fn(),
	stop: jest.fn(),
	getDevice: jest.fn(),
	request: {
		timeout: jest.fn(),
		redirects: jest.fn(),
	},
	staleTimeout: 0,
}));

const mockShelliesLibrary = require('../lib/shellies');

describe('ShelliesAdapterService', () => {
	let service: ShelliesAdapterService;
	let configService: jest.Mocked<ConfigService>;
	let httpClient: jest.Mocked<ShellyV1HttpClientService>;
	let callbacks: {
		onTemperatureReport: jest.Mock;
		onDeviceDiscovered: jest.Mock;
		onDeviceChanged: jest.Mock;
		onDeviceOffline: jest.Mock;
		onDeviceOnline: jest.Mock;
		onError: jest.Mock;
	};

	// Quiet logger noise

	beforeAll(() => {});

	afterAll(() => {});

	beforeEach(() => {
		jest.clearAllMocks();
		mockShelliesLibrary.readShellyTemperature.mockReset().mockResolvedValue(null);

		// Mock ConfigService
		configService = {
			getPluginConfig: jest.fn().mockReturnValue({
				timeouts: {
					requestTimeout: 5,
					staleTimeout: 60,
				},
				discovery: {
					interface: null,
				},
			}),
		} as any;

		// Set up callbacks
		callbacks = {
			onTemperatureReport: jest.fn().mockResolvedValue(true),
			onDeviceDiscovered: jest.fn(),
			onDeviceChanged: jest.fn(),
			onDeviceOffline: jest.fn(),
			onDeviceOnline: jest.fn(),
			onError: jest.fn(),
		};

		httpClient = {
			getDeviceInfo: jest.fn().mockResolvedValue({}),
		} as any;

		service = new ShelliesAdapterService(configService, httpClient);
		service.setCallbacks(callbacks as ShelliesAdapterCallbacks);
	});

	const makeShellyDevice = (id = 'shelly1pm-ABC123', type = 'SHSW-PM', host = '192.168.1.100'): Partial<ShellyDevice> =>
		({
			id,
			type,
			host,
			online: true,
			on: jest.fn(),
			removeAllListeners: jest.fn(),
			setAuthCredentials: jest.fn(),
			setRelay: jest.fn(),
			setLight: jest.fn(),
			setRoller: jest.fn(),
		}) as any;

	describe('start', () => {
		it('should initialize shellies library and start discovery', async () => {
			await service.start();

			expect(mockShelliesLibrary.request.timeout).toHaveBeenCalledWith(5000); // 5s * 1000
			expect(mockShelliesLibrary.request.redirects).toHaveBeenCalledWith(0);
			expect(mockShelliesLibrary.staleTimeout).toBe(60000); // 60s * 1000
			expect(mockShelliesLibrary.on).toHaveBeenCalledWith('add', expect.any(Function));
			expect(mockShelliesLibrary.start).toHaveBeenCalledWith(null);
			expect(Logger.prototype.log).toHaveBeenCalledWith(
				'[ShelliesAdapterService] Shellies adapter started successfully',
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
		});

		it('should not start if already started', async () => {
			await service.start();

			jest.clearAllMocks();

			await service.start();

			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				'[ShelliesAdapterService] Shellies adapter already started',
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
			expect(mockShelliesLibrary.start).not.toHaveBeenCalled();
		});

		it('should invoke error callback if start fails', async () => {
			const error = new Error('Network error');
			mockShelliesLibrary.start.mockImplementationOnce(() => {
				throw error;
			});

			await expect(service.start()).rejects.toThrow('Network error');

			expect(callbacks.onError).toHaveBeenCalledWith(error);
		});
	});

	describe('stop', () => {
		it('should stop shellies library and clear registry', async () => {
			await service.start();

			// Register a device
			const device = makeShellyDevice();
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			expect(service.getRegisteredDevices()).toHaveLength(1);

			service.stop();

			expect(mockShelliesLibrary.removeAllListeners).toHaveBeenCalled();
			expect(mockShelliesLibrary.stop).toHaveBeenCalled();
			expect(service.getRegisteredDevices()).toHaveLength(0);
		});

		it('should do nothing if not started', () => {
			service.stop();

			expect(mockShelliesLibrary.stop).not.toHaveBeenCalled();
		});
	});

	describe('Device discovery & registration', () => {
		it('should register a new device on discovery', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM', '192.168.1.100');

			// Simulate discovery event
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			const registered = service.getRegisteredDevice('shelly1pm-ABC123');

			expect(registered).toEqual({
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				enabled: true,
			});

			expect(callbacks.onDeviceDiscovered).toHaveBeenCalledWith({
				id: 'shelly1pm-ABC123',
				type: 'SHSW-PM',
				host: '192.168.1.100',
				online: true,
			});

			expect(device.on).toHaveBeenCalledWith('change', expect.any(Function));
			expect(device.on).toHaveBeenCalledWith('offline', expect.any(Function));
			expect(device.on).toHaveBeenCalledWith('online', expect.any(Function));
			expect(device.on).toHaveBeenCalledWith('stale', expect.any(Function));
			expect(device.on).toHaveBeenCalledWith('remove', expect.any(Function));
		});

		it('should update existing device on re-discovery (same id, new host)', async () => {
			await service.start();

			const device1 = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM', '192.168.1.100');
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device1);

			expect(service.getRegisteredDevices()).toHaveLength(1);

			// Re-discover with new host
			const device2 = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM', '192.168.1.200');
			addHandler?.(device2);

			const registered = service.getRegisteredDevice('shelly1pm-ABC123');

			expect(service.getRegisteredDevices()).toHaveLength(1); // Still only 1 device
			expect(registered?.host).toBe('192.168.1.200'); // Host updated
		});

		it('should register multiple different devices', async () => {
			await service.start();

			const device1 = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM', '192.168.1.100');
			const device2 = makeShellyDevice('shellyrgbw2-DEF456', 'SHRGBW2', '192.168.1.101');

			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device1);
			addHandler?.(device2);

			expect(service.getRegisteredDevices()).toHaveLength(2);
			expect(service.getRegisteredDevice('shelly1pm-ABC123')).toBeDefined();
			expect(service.getRegisteredDevice('shellyrgbw2-DEF456')).toBeDefined();
		});
	});

	describe('verified catalog registrations', () => {
		const mac = 'AABBCCDDEEFF';
		const firstHost = '192.168.1.100';
		const rawId = 'DDEEFF';
		const fullId = 'shelly1-' + mac.toLowerCase();
		const row = (identifier = fullId, hostname = firstHost) =>
			Object.assign(new ShellyV1DeviceEntity(), { id: 'catalog', identifier, hostname, enabled: true });

		async function registry() {
			const sdk = new Map<string, ShellyDevice>();
			mockShelliesLibrary.getDevice.mockImplementation((_type: string, id: string) => sdk.get(id));
			await service.start();
			const { create } = jest.requireActual<{ create(type: string, id: string, host: string): ShellyDevice }>(
				'shellies/lib/devices',
			);
			const add = (id = rawId, host = firstHost) => {
				const peer = create('SHSW-1', id, host);
				peer.online = true;
				sdk.set(id, peer);
				mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'add')[1](peer);
				return peer;
			};
			const remove = (peer: ShellyDevice) => {
				sdk.delete(peer.id);
				mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'remove')[1](peer);
			};
			const bind = (peer: ShellyDevice, catalog = row()) =>
				service.bindCatalogDevice(service.getRegisteredDevice(peer.id), peer, catalog, mac);
			return { add, remove, bind };
		}

		it('keeps an exact verified peer through compatible renames, mode, connection and enablement changes', async () => {
			const { add, bind } = await registry();
			const peer = add();
			const raw = service.getRegisteredDevice(rawId);
			expect(bind(peer, row(rawId))).toBe(true);
			expect(service.getRegisteredDeviceForCatalog(row())).toBe(raw);
			expect(service.getRegisteredDeviceForCatalog({ id: 'other', identifier: rawId })).toBeUndefined();
			expect(service.getRegisteredDeviceForCatalog(row('unrelated-123456'))).toBeUndefined();
			expect(service.getRegisteredDeviceForCatalog(row(fullId, 'wrong-host'))).toBeUndefined();
			peer.emit('change', 'mode', 'relay', 'roller');
			expect(service.getRegisteredDeviceForCatalog(row())).not.toBe(raw);
			peer.online = false;
			peer.online = true;
			service.updateDeviceEnabledStatus(rawId, false);
			expect(service.getRegisteredDeviceForCatalog(row())).toMatchObject({
				enabled: false,
				catalog: { deviceId: 'catalog', mac },
			});
			service.updateDeviceEnabledStatus(rawId, true);
			expect(service.getRegisteredDeviceForCatalog(row())).toBe(service.getRegisteredDevice(rawId));
			service.releaseCatalogDevice('catalog');
			expect(service.getRegisteredDeviceForCatalog(row())).toBeUndefined();
			expect(service.getRegisteredDevice(rawId)).toMatchObject({ enabled: false });
		});

		it('rejects two SDK IDs at one host and re-verifies the remaining peer when the duplicate leaves', async () => {
			const { add, remove, bind } = await registry();
			const first = add();
			expect(bind(first)).toBe(true);
			service.setDeviceAuthCredentials(first, firstHost, 'operator', 'fixture');
			const duplicate = add(mac);
			expect(bind(duplicate)).toBe(false);
			expect(service.getRegisteredDeviceForCatalog(row())).toBeUndefined();
			expect(service.getRegisteredDeviceForCatalog({ id: 'other', identifier: duplicate.id })).toBeUndefined();
			expect(service.getRegisteredDevice(duplicate.id).catalog).toBeUndefined();
			expect(first._request).toBeNull();
			callbacks.onDeviceDiscovered.mockClear().mockImplementationOnce(() => {
				expect(bind(first)).toBe(true);
				service.updateDeviceEnabledStatus(first.id, true);
			});
			remove(duplicate);
			expect(callbacks.onDeviceDiscovered).toHaveBeenCalledWith({
				id: rawId,
				host: firstHost,
				type: first.type,
				online: true,
			});
			expect(service.getRegisteredDeviceForCatalog(row())).toBe(service.getRegisteredDevice(first.id));
			expect(service.getRegisteredDevice(first.id).enabled).toBe(true);
		});

		it('retires the previous raw ID and credentials on a verified move while the old SDK peer still exists', async () => {
			const { add, bind } = await registry();
			const old = add();
			expect(bind(old, row(rawId))).toBe(true);
			service.setDeviceAuthCredentials(old, old.host, 'operator', 'fixture');
			const current = add(mac, '192.168.1.200');
			const moved = row(rawId, current.host);
			callbacks.onDeviceDiscovered.mockClear();
			expect(bind(current, moved)).toBe(true);
			expect(callbacks.onDeviceDiscovered).not.toHaveBeenCalled();
			expect(service.getRegisteredDeviceForCatalog(moved)).toBe(service.getRegisteredDevice(current.id));
			expect(service.getRegisteredDevice(old.id)).toMatchObject({ enabled: false });
			expect(service.getRegisteredDevice(old.id).catalog).toBeUndefined();
			expect(old._request).toBeNull();
			expect(service.setDeviceAuthCredentials(old, old.host, 'operator', 'retired')).toBe(false);
		});

		it('revokes an alias when its SDK host changes and ignores callbacks from a replaced object', async () => {
			const { add, bind } = await registry();
			const old = add();
			expect(bind(old)).toBe(true);
			old.host = '192.168.1.101';
			expect(service.getRegisteredDeviceForCatalog(row())).toBeUndefined();
			const replacement = add(rawId, old.host);
			const moved = row(fullId, old.host);
			expect(bind(replacement, moved)).toBe(true);
			callbacks.onDeviceChanged.mockClear();
			old.emit('change', 'relay0', true, false);
			old.emit('offline');
			old.emit('online');
			old.emit('remove');
			expect(callbacks.onDeviceChanged).not.toHaveBeenCalled();
			expect(callbacks.onDeviceOffline).not.toHaveBeenCalled();
			expect(callbacks.onDeviceOnline).not.toHaveBeenCalled();
			expect(service.getRegisteredDeviceForCatalog(moved)).toBe(service.getRegisteredDevice(rawId));
		});

		it.each(['verified', 'other MAC with the same suffix', 'other host', 'lost pin'])(
			'installs a rotated password on the real SDK peer after a catalog rename only for a current pin (%s)',
			async (scenario) => {
				const { add, bind } = await registry();
				const peer = add();
				const initial = Object.assign(row(rawId), { password: 'old' });
				expect(bind(peer, initial)).toBe(true);
				const setter = jest.spyOn(peer, 'setAuthCredentials');
				const pin = { mac, verifiedHost: firstHost, revision: 1 };
				const findPin = jest.fn().mockResolvedValue(pin);
				const subscriber = new DeviceEntitySubscriber(
					{ subscribers: [] } as unknown as DataSource,
					service,
					{
						getLoginSettings: jest.fn().mockResolvedValue({ username: 'operator' }),
					} as unknown as ShellyV1HttpClientService,
					{ findPin } as unknown as ShellyV1AdoptedIdentityService,
				);
				await subscriber.deviceCreated(initial);
				expect(setter).toHaveBeenLastCalledWith('operator', 'old');
				setter.mockClear();
				if (scenario === 'other MAC with the same suffix') findPin.mockResolvedValue({ ...pin, mac: '112233DDEEFF' });
				if (scenario === 'other host') findPin.mockResolvedValue({ ...pin, verifiedHost: '192.168.1.99' });
				if (scenario === 'lost pin') findPin.mockResolvedValue(null);
				const renamed = Object.assign(row(), { password: 'rotated' });
				await subscriber.deviceUpdated(renamed);
				if (scenario === 'verified') expect(setter).toHaveBeenCalledWith('operator', 'rotated');
				else {
					expect(setter).not.toHaveBeenCalled();
					expect(peer._request).toBeNull();
				}
				subscriber.deviceDeleted(renamed);
				expect(service.getRegisteredDeviceForCatalog(renamed)).toBeUndefined();
				expect(peer._request).toBeNull();
			},
		);
	});

	describe('getDevice', () => {
		it('should return device from shellies library', async () => {
			await service.start();

			const mockDevice = makeShellyDevice();
			mockShelliesLibrary.getDevice.mockReturnValue(mockDevice);

			const result = service.getDevice('SHSW-PM', 'shelly1pm-ABC123');

			expect(result).toBe(mockDevice);
			expect(mockShelliesLibrary.getDevice).toHaveBeenCalledWith('SHSW-PM', 'shelly1pm-ABC123');
		});

		it('should return undefined when device not found', async () => {
			await service.start();

			mockShelliesLibrary.getDevice.mockReturnValue(undefined);

			const result = service.getDevice('SHSW-PM', 'unknown-device');

			expect(result).toBeUndefined();
		});

		it('should return undefined when not started', () => {
			const result = service.getDevice('SHSW-PM', 'shelly1pm-ABC123');

			expect(result).toBeUndefined();
		});
	});

	describe('updateDeviceEnabledStatus', () => {
		it('should update enabled status for registered device', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			service.updateDeviceEnabledStatus('shelly1pm-ABC123', false);

			const registered = service.getRegisteredDevice('shelly1pm-ABC123');

			expect(registered?.enabled).toBe(false);
		});

		it('should do nothing for non-existent device', () => {
			service.updateDeviceEnabledStatus('unknown-device', false);

			expect(Logger.prototype.debug).not.toHaveBeenCalledWith(expect.stringContaining('Updated enabled status'));
		});
	});

	describe('setDeviceAuthCredentials', () => {
		it('revokes the installed SDK credentials before the same peer sends a request to its next host', async () => {
			const received: (string | undefined)[][] = [[], []];
			const servers = received.map((requests) =>
				createServer((req, res) => {
					requests.push(req.headers.authorization);
					res.setHeader('Content-Type', 'application/json');
					res.end('{}');
				}),
			);
			const [a, b] = await Promise.all(
				servers.map(
					(server) =>
						new Promise<string>((resolve) =>
							server.listen(0, '127.0.0.1', () => resolve(`127.0.0.1:${(server.address() as AddressInfo).port}`)),
						),
				),
			);
			try {
				await service.start();
				const { create } = jest.requireActual<{ create(type: string, id: string, host: string): ShellyDevice }>(
					'shellies/lib/devices',
				);
				const device = create('SHSW-PM', 'DDEEFF', a);
				mockShelliesLibrary.getDevice.mockReturnValue(device);
				mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'add')[1](device);
				service.setDeviceAuthCredentials(device, a, 'admin', 'fixture');
				await device.getStatus();
				device.host = b;
				service.setDeviceAuthCredentials(device, a, 'admin', 'fixture');
				await device.getStatus();
				expect(received).toEqual([['Basic ' + Buffer.from('admin:fixture').toString('base64')], [undefined]]);
				expect(callbacks.onDeviceDiscovered).toHaveBeenLastCalledWith(expect.objectContaining({ host: b }));
			} finally {
				await Promise.all(
					servers.map(
						(server) =>
							new Promise<void>((resolve) => {
								server.closeAllConnections();
								server.close(() => resolve());
							}),
					),
				);
			}
		});

		it('should set auth credentials on device', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');
			mockShelliesLibrary.getDevice.mockReturnValue(device);
			mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'add')[1](device);

			service.setDeviceAuthCredentials(device as ShellyDevice, device.host, 'admin', 'password123');

			expect(device.setAuthCredentials).toHaveBeenCalledWith('admin', 'password123');
			expect(service.getRegisteredDevice(device.id).credentialRevision).toBe(1);
			service.setDeviceAuthCredentials(device as ShellyDevice, device.host, 'admin', null);
			expect(service.getRegisteredDevice(device.id).credentialRevision).toBe(2);
		});

		it('withholds credentials after the captured peer has been replaced', async () => {
			await service.start();
			const old = makeShellyDevice();
			const replacement = makeShellyDevice();
			mockShelliesLibrary.getDevice.mockReturnValue(replacement);
			service.setDeviceAuthCredentials(old as ShellyDevice, old.host, 'admin', 'password123');
			expect(old.setAuthCredentials).not.toHaveBeenCalled();
			expect(replacement.setAuthCredentials).not.toHaveBeenCalled();
		});

		it('should handle device without setAuthCredentials method', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');
			device.setAuthCredentials = undefined as any;
			mockShelliesLibrary.getDevice.mockReturnValue(device);

			expect(service.setDeviceAuthCredentials(device as ShellyDevice, device.host, 'admin', 'password123')).toBe(false);

			expect(Logger.prototype.debug).not.toHaveBeenCalledWith(expect.stringContaining('Set auth credentials'));
		});
	});

	describe('HTTP liveness checks', () => {
		const ping = (alive: boolean) => {
			let release: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			httpClient.getDeviceInfo.mockImplementationOnce(async () => {
				await gate;
				if (!alive) throw new Error('offline');
				return { mac: 'AABBCCDDEEFF', type: 'SHHT-1', auth: false, fw: '1', longid: 1 };
			});
			return () => release();
		};
		const discoverStale = () => {
			const device = Object.assign(makeShellyDevice(), { lastSeen: new Date(Date.now() - 70_000) });
			mockShelliesLibrary.getDevice.mockReturnValue(device);
			mockShelliesLibrary.on.mock.calls
				.filter(([event]) => event === 'add')
				.at(-1)[1](device);
			return device;
		};

		it.each([true, false])(
			'ignores a retired run’s ping result (%s) without releasing the successor’s running check',
			async (alive) => {
				await service.start();
				const old = discoverStale();
				const originalLastSeen = old.lastSeen;
				const resolveOld = ping(alive);
				const firstCheck = service.checkDevicesStatus();
				expect(httpClient.getDeviceInfo).toHaveBeenCalledTimes(1);
				service.stop();
				await service.start();
				const successor = discoverStale();
				const resolveNew = ping(true);
				const secondCheck = service.checkDevicesStatus();
				expect(httpClient.getDeviceInfo).toHaveBeenCalledTimes(2);
				resolveOld();
				await firstCheck;
				expect(old.online).toBe(true);
				expect(old.lastSeen).toBe(originalLastSeen);
				expect(callbacks.onDeviceOffline).not.toHaveBeenCalled();
				await service.checkDevicesStatus();
				expect(httpClient.getDeviceInfo).toHaveBeenCalledTimes(2);
				resolveNew();
				await secondCheck;
				expect(Number(successor.lastSeen)).toBeGreaterThan(Number(originalLastSeen));
			},
		);

		it('discards a ping against a replaced peer within the same adapter run', async () => {
			await service.start();
			const original = discoverStale();
			const finish = ping(false);
			const checking = service.checkDevicesStatus();
			const successor = discoverStale();
			finish();
			await checking;
			expect(original.online).toBe(true);
			expect(successor.online).toBe(true);
			expect(callbacks.onDeviceOffline).not.toHaveBeenCalled();
		});
	});

	describe('Device event handlers', () => {
		const temperatureProbe = async () => {
			await service.start();
			const peer = makeShellyDevice('AABBCCDDEEFF', 'SHHT-1');
			mockShelliesLibrary.getDevice.mockReturnValue(peer);
			mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'add')[1](peer);
			const status = mockShelliesLibrary.subscribeShellyTemperatures.mock.calls[0][0] as (
				device: Partial<ShellyDevice>,
				serial: number,
				value: unknown,
			) => void;
			return { peer, push: (serial: number, value: unknown) => status(peer, serial, value) };
		};

		it.each([
			{ reason: 'packet lifetime', elapsed: 145_000, host: '192.168.1.100', restart: false },
			{ reason: 'different peer host', elapsed: 100, host: '192.168.1.99', restart: false },
			{ reason: 'adapter shutdown', elapsed: 100, host: '192.168.1.100', restart: true },
		])('ends removed peer ordering state at $reason', async ({ elapsed, host, restart }) => {
			jest.useFakeTimers();
			try {
				const { peer, push } = await temperatureProbe();
				push(250, 20);
				await jest.advanceTimersByTimeAsync(0);
				mockShelliesLibrary.getDevice.mockReturnValue(undefined);
				mockShelliesLibrary.on.mock.calls.find(([name]) => name === 'remove')[1](peer);
				expect(jest.getTimerCount()).toBe(1);
				if (restart) {
					service.stop();
					expect(jest.getTimerCount()).toBe(0);
					await service.start();
				}
				await jest.advanceTimersByTimeAsync(elapsed);
				const replacement = makeShellyDevice(peer.id, peer.type, host);
				mockShelliesLibrary.getDevice.mockReturnValue(replacement);
				mockShelliesLibrary.on.mock.calls
					.filter(([name]) => name === 'add')
					.at(-1)[1](replacement);
				mockShelliesLibrary.subscribeShellyTemperatures.mock.calls.at(-1)[0](replacement, 250, 19);
				expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([20, 19]);
				service.stop();
				expect(jest.getTimerCount()).toBe(0);
			} finally {
				jest.useRealTimers();
			}
		});

		it('retries only the original pending observation after discovery, coalesces writes and stops after publication', async () => {
			const { push } = await temperatureProbe();
			let unmapped: (published: boolean) => void;
			callbacks.onTemperatureReport.mockImplementationOnce(
				() =>
					new Promise<boolean>((resolve) => {
						unmapped = resolve;
					}),
			);
			push(5, 21.5);
			const original = callbacks.onTemperatureReport.mock.lastCall[0];
			push(5, 99);
			push(5, 99);
			expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
			callbacks.onTemperatureReport.mockRejectedValueOnce(new Error('storage unavailable'));
			unmapped(false);
			await new Promise(setImmediate);
			expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(2);
			callbacks.onTemperatureReport.mockImplementationOnce(() => {
				throw new Error('mapper failed');
			});
			push(5, 99);
			await new Promise(setImmediate);
			push(5, 99);
			await new Promise(setImmediate);
			push(5, 99);
			expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(4);
			for (const [report] of callbacks.onTemperatureReport.mock.calls) expect(report).toBe(original);
			expect(original.value).toBe(21.5);
		});

		it('rejects a superseded pending observation and never retries it after a newer serial', async () => {
			const { push } = await temperatureProbe();
			let finish: (published: boolean) => void;
			callbacks.onTemperatureReport.mockImplementationOnce(
				() =>
					new Promise<boolean>((resolve) => {
						finish = resolve;
					}),
			);
			push(5, 25);
			const old = callbacks.onTemperatureReport.mock.lastCall[0];
			push(5, 95);
			push(6, 26);
			const latest = callbacks.onTemperatureReport.mock.lastCall[0];
			expect(old.isLatest()).toBe(false);
			expect(latest.isLatest()).toBe(true);
			finish(false);
			await new Promise(setImmediate);
			mockShelliesLibrary.readShellyTemperature.mockResolvedValue({ serial: 6, value: 26 });
			push(5, 95);
			await new Promise(setImmediate);
			push(6, 96);
			expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([25, 26]);
		});

		it.each([true, false])(
			'preserves the serial baseline across offline/online after an admission of %s',
			async (published) => {
				const { peer, push } = await temperatureProbe();
				let finish: (published: boolean) => void;
				callbacks.onTemperatureReport.mockImplementationOnce(
					() =>
						new Promise<boolean>((resolve) => {
							finish = resolve;
						}),
				);
				push(1000, 20);
				const original = callbacks.onTemperatureReport.mock.lastCall[0];
				const listener = (name: string) => (peer.on as jest.Mock).mock.calls.find(([event]) => event === name)[1]();
				peer.online = false;
				listener('offline');
				peer.online = true;
				listener('online');
				finish(published);
				await new Promise(setImmediate);
				expect(original.isCurrent()).toBe(false);
				push(1000, 70);
				mockShelliesLibrary.readShellyTemperature.mockResolvedValueOnce({ serial: 1000, value: 20 });
				push(999, 71);
				await new Promise(setImmediate);
				expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
				push(1001, 21);
				const next = callbacks.onTemperatureReport.mock.lastCall[0];
				expect(next.value).toBe(21);
				mockShelliesLibrary.readShellyTemperature.mockResolvedValueOnce({ serial: 1, value: 18 });
				push(1, 72);
				await new Promise(setImmediate);
				expect(next.isCurrent()).toBe(false);
				mockShelliesLibrary.readShellyTemperature.mockResolvedValueOnce({ serial: 1, value: 18 });
				push(1001, 73);
				await new Promise(setImmediate);
				expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([20, 21, 18]);
			},
		);

		it.each(['published', 'pending'])(
			'keeps the serial but revokes a %s observation across disable/re-enable',
			async (state) => {
				const { peer, push } = await temperatureProbe();
				let finish: (admitted: boolean) => void;
				if (state === 'pending') {
					callbacks.onTemperatureReport.mockImplementationOnce(
						() =>
							new Promise<boolean>((resolve) => {
								finish = resolve;
							}),
					);
				}
				push(250, 20);
				await new Promise(setImmediate);
				const original = callbacks.onTemperatureReport.mock.lastCall[0];
				push(250, 80);
				service.updateDeviceEnabledStatus(peer.id, false);
				expect(original.isCurrent()).toBe(false);
				push(250, 81);
				service.updateDeviceEnabledStatus(peer.id, true);
				if (finish) finish(false);
				await new Promise(setImmediate);
				push(250, 82);
				expect(original.isCurrent()).toBe(false);
				expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
				push(251, 21);
				const next = callbacks.onTemperatureReport.mock.lastCall[0];
				expect(next.value).toBe(21);
				expect(next.isCurrent()).toBe(true);
				const read = mockShelliesLibrary.readShellyTemperature;
				expect(read).not.toHaveBeenCalled();
				read.mockResolvedValueOnce({ serial: 1, value: 18 });
				push(1, 83);
				await new Promise(setImmediate);
				expect(next.isCurrent()).toBe(false);
				read.mockResolvedValueOnce({ serial: 1, value: 18 });
				push(250, 84);
				await new Promise(setImmediate);
				expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([20, 21, 18]);
			},
		);

		it.each([1000, 60000])(
			'resynchronizes a rebooted live peer at %s and discards delayed packets on either side of the restart',
			async (last) => {
				jest.useFakeTimers();
				try {
					const { push } = await temperatureProbe();
					const read = mockShelliesLibrary.readShellyTemperature;
					push(last, 20);
					const old = callbacks.onTemperatureReport.mock.lastCall[0];
					read.mockResolvedValueOnce({ serial: last, value: 20 });
					push(last - 2, 81);
					await jest.advanceTimersByTimeAsync(0);
					expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
					expect(old.isCurrent()).toBe(true);
					read.mockResolvedValueOnce({ serial: 1, value: 19 });
					push(1, 82);
					await jest.advanceTimersByTimeAsync(0);
					expect(old.isCurrent()).toBe(false);
					const fresh = callbacks.onTemperatureReport.mock.lastCall[0];
					expect(fresh.value).toBe(19);
					read.mockResolvedValue({ serial: 1, value: 19 });
					push(last - 1, 83);
					await jest.advanceTimersByTimeAsync(0);
					push(last + 1, 84);
					await jest.advanceTimersByTimeAsync(0);
					push(1, 85);
					expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(2);
					read.mockResolvedValueOnce({ serial: 2, value: 18.5 });
					push(2, 86);
					await jest.advanceTimersByTimeAsync(0);
					expect(callbacks.onTemperatureReport.mock.lastCall[0].value).toBe(18.5);
					expect(fresh.isCurrent()).toBe(true);
					read.mockClear();
					await jest.advanceTimersByTimeAsync(145_001);
					push(3, 18.25);
					expect(callbacks.onTemperatureReport.mock.lastCall[0].value).toBe(18.25);
					expect(read).not.toHaveBeenCalled();
				} finally {
					jest.useRealTimers();
				}
			},
		);

		it('recovers a sleeping peer passively after the CoAP packet lifetime and retries an unanswered ambiguous serial', async () => {
			jest.useFakeTimers();
			try {
				const { push } = await temperatureProbe();
				const read = mockShelliesLibrary.readShellyTemperature;
				read.mockRejectedValue(new Error('sleeping'));
				push(1000, 22);
				const old = callbacks.onTemperatureReport.mock.lastCall[0];
				push(1, 40);
				await jest.advanceTimersByTimeAsync(0);
				push(1, 40);
				await jest.advanceTimersByTimeAsync(0);
				expect(read).toHaveBeenCalledTimes(2);
				expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
				await jest.advanceTimersByTimeAsync(145_001);
				push(4, 19);
				expect(callbacks.onTemperatureReport.mock.lastCall[0].value).toBe(19);
				expect(old.isCurrent()).toBe(false);
				push(1001, 90);
				await jest.advanceTimersByTimeAsync(145_001);
				push(5, 18);
				expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([22, 19, 18]);
			} finally {
				jest.useRealTimers();
			}
		});

		it('wraps across the reserved zero, drops repeats and invalid serials, and withdraws a pending read when the mapping changes', async () => {
			const { push } = await temperatureProbe();
			push(65534, 23);
			const first = callbacks.onTemperatureReport.mock.lastCall[0];
			push(65535, 22);
			push(0, 80);
			push(1, 21);
			push(1, 81);
			push(65536, 82);
			expect(first.isCurrent()).toBe(true);
			expect(mockShelliesLibrary.readShellyTemperature).not.toHaveBeenCalled();
			let finish: (reply: { serial: number; value: number }) => void;
			mockShelliesLibrary.readShellyTemperature.mockReturnValueOnce(
				new Promise((resolve) => {
					finish = resolve;
				}),
			);
			push(65534, 83);
			push(65534, 84);
			expect(mockShelliesLibrary.readShellyTemperature).toHaveBeenCalledTimes(1);
			service.updateDeviceEnabledStatus('AABBCCDDEEFF', false);
			service.updateDeviceEnabledStatus('AABBCCDDEEFF', true);
			finish({ serial: 2, value: 20 });
			await new Promise(setImmediate);
			expect(first.isCurrent()).toBe(false);
			expect(callbacks.onTemperatureReport.mock.calls.map(([report]) => report.value)).toEqual([23, 22, 21]);
		});

		it('takes original temperature fields from new CoIoT sequences and expires their original session', async () => {
			await service.start();
			const peer = makeShellyDevice('AABBCCDDEEFF', 'SHHT-1');
			mockShelliesLibrary.getDevice.mockReturnValue(peer);
			const add = mockShelliesLibrary.on.mock.calls.find(([event]) => event === 'add')[1];
			const status = mockShelliesLibrary.subscribeShellyTemperatures.mock.calls[0][0];
			add(peer);
			status(peer, 101, 19.5);
			status(peer, 101, 19.5);
			mockShelliesLibrary.readShellyTemperature.mockResolvedValueOnce({ serial: 101, value: 19.5 });
			status(peer, 99, 24);
			await new Promise(setImmediate);
			expect(callbacks.onTemperatureReport).toHaveBeenCalledTimes(1);
			const report = callbacks.onTemperatureReport.mock.calls[0][0];
			expect(report.value).toBe(19.5);
			expect(report.isCurrent()).toBe(true);
			status(peer, 102, null);
			expect(callbacks.onTemperatureReport.mock.lastCall[0].value).toBeNull();
			service.updateDeviceEnabledStatus('AABBCCDDEEFF', false);
			service.updateDeviceEnabledStatus('AABBCCDDEEFF', true);
			expect(report.isCurrent()).toBe(false);
		});

		it('should invoke change callback when device property changes', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
			mockShelliesLibrary.getDevice.mockReturnValue(device);
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			// Get the change handler registered for this device
			const changeHandler = (device.on as jest.Mock).mock.calls.find((call) => call[0] === 'change')?.[1];

			changeHandler?.('relay0', true, false);

			expect(callbacks.onDeviceChanged).toHaveBeenCalledWith({
				id: 'shelly1pm-ABC123',
				property: 'relay0',
				newValue: true,
				oldValue: false,
			});
		});

		it('should invoke offline callback when device goes offline', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
			mockShelliesLibrary.getDevice.mockReturnValue(device);
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			const offlineHandler = (device.on as jest.Mock).mock.calls.find((call) => call[0] === 'offline')?.[1];

			offlineHandler?.();

			expect(callbacks.onDeviceOffline).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'shelly1pm-ABC123',
				}),
			);
		});

		it('should invoke online callback when device comes online', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
			mockShelliesLibrary.getDevice.mockReturnValue(device);
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			const onlineHandler = (device.on as jest.Mock).mock.calls.find((call) => call[0] === 'online')?.[1];

			onlineHandler?.();

			expect(callbacks.onDeviceOnline).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'shelly1pm-ABC123',
				}),
			);
		});

		it('should remove device from registry when remove event fires', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
			const addHandler = mockShelliesLibrary.on.mock.calls.find((call) => call[0] === 'add')?.[1];
			addHandler?.(device);

			expect(service.getRegisteredDevice('shelly1pm-ABC123')).toBeDefined();

			const removeHandler = (device.on as jest.Mock).mock.calls.find((call) => call[0] === 'remove')?.[1];

			mockShelliesLibrary.getDevice.mockReturnValue(undefined);
			removeHandler?.();

			expect(service.getRegisteredDevice('shelly1pm-ABC123')).toBeUndefined();
		});
	});
});
