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
import { Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ShelliesAdapterCallbacks, ShellyDevice } from '../interfaces/shellies.interface';

import { ShelliesAdapterService } from './shellies-adapter.service';

// Mock the shellies library
jest.mock('../lib/shellies', () => ({
	on: jest.fn(),
	removeAllListeners: jest.fn(),
	start: jest.fn(),
	stop: jest.fn(),
	getDevice: jest.fn(),
	request: {
		timeout: jest.fn(),
	},
	staleTimeout: 0,
}));

const mockShelliesLibrary = require('../lib/shellies');

describe('ShelliesAdapterService', () => {
	let service: ShelliesAdapterService;
	let configService: jest.Mocked<ConfigService>;
	let callbacks: {
		onDeviceDiscovered: jest.Mock;
		onDeviceChanged: jest.Mock;
		onDeviceOffline: jest.Mock;
		onDeviceOnline: jest.Mock;
		onError: jest.Mock;
	};

	// Quiet logger noise

	beforeAll(() => {
	});

	afterAll(() => {
	});

	beforeEach(() => {
		jest.clearAllMocks();

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
			onDeviceDiscovered: jest.fn(),
			onDeviceChanged: jest.fn(),
			onDeviceOffline: jest.fn(),
			onDeviceOnline: jest.fn(),
			onError: jest.fn(),
		};

		service = new ShelliesAdapterService(configService);
		service.setCallbacks(callbacks as ShelliesAdapterCallbacks);
	});

	const makeShellyDevice = (id = 'shelly1pm-ABC123', type = 'SHSW-PM', host = '192.168.1.100'): Partial<ShellyDevice> =>
		({
			id,
			type,
			host,
			online: true,
			on: jest.fn(),
			setAuthCredentials: jest.fn(),
			setRelay: jest.fn(),
			setLight: jest.fn(),
			setRoller: jest.fn(),
		}) as any;

	describe('start', () => {
		it('should initialize shellies library and start discovery', async () => {
			await service.start();

			expect(mockShelliesLibrary.request.timeout).toHaveBeenCalledWith(5000); // 5s * 1000
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
		it('should set auth credentials on device', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');
			mockShelliesLibrary.getDevice.mockReturnValue(device);

			service.setDeviceAuthCredentials('SHSW-PM', 'shelly1pm-ABC123', 'admin', 'password123');

			expect(device.setAuthCredentials).toHaveBeenCalledWith('admin', 'password123');
		});

		it('should log warning when device not found', async () => {
			await service.start();

			mockShelliesLibrary.getDevice.mockReturnValue(undefined);

			service.setDeviceAuthCredentials('SHSW-PM', 'unknown-device', 'admin', 'password123');

			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				'[ShelliesAdapterService] Cannot set auth credentials - device not found: unknown-device',
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
		});

		it('should handle device without setAuthCredentials method', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123', 'SHSW-PM');
			device.setAuthCredentials = undefined as any;
			mockShelliesLibrary.getDevice.mockReturnValue(device);

			service.setDeviceAuthCredentials('SHSW-PM', 'shelly1pm-ABC123', 'admin', 'password123');

			expect(Logger.prototype.debug).not.toHaveBeenCalledWith(expect.stringContaining('Set auth credentials'));
		});
	});

	describe('Device event handlers', () => {
		it('should invoke change callback when device property changes', async () => {
			await service.start();

			const device = makeShellyDevice('shelly1pm-ABC123');
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

			removeHandler?.();

			expect(service.getRegisteredDevice('shelly1pm-ABC123')).toBeUndefined();
		});
	});
});
