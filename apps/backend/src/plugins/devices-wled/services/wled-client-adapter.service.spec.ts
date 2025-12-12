/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/require-await
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

import { WledAdapterEventType } from '../interfaces/wled.interface';

import { WledClientAdapterService } from './wled-client-adapter.service';

// Mock global fetch
global.fetch = jest.fn();

describe('WledClientAdapterService', () => {
	let service: WledClientAdapterService;
	let eventEmitter: EventEmitter2;

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

	beforeEach(() => {
		jest.clearAllMocks();
		eventEmitter = new EventEmitter2();
		jest.spyOn(eventEmitter, 'emit');
		service = new WledClientAdapterService(eventEmitter);
	});

	const mockWledState = {
		on: true,
		bri: 128,
		transition: 7,
		ps: -1,
		pl: -1,
		nl: { on: false, dur: 60, mode: 1, tbri: 0, rem: -1 },
		udpn: { send: false, recv: true },
		lor: 0,
		mainseg: 0,
		seg: [
			{
				id: 0,
				start: 0,
				stop: 30,
				len: 30,
				grp: 1,
				spc: 0,
				of: 0,
				col: [[255, 0, 0], [0, 0, 0], [0, 0, 0]],
				fx: 0,
				sx: 128,
				ix: 128,
				pal: 0,
				sel: true,
				rev: false,
				on: true,
				bri: 255,
				mi: false,
			},
		],
	};

	const mockWledInfo = {
		ver: '0.14.0',
		vid: 2400000,
		leds: { count: 30, fps: 30, pwr: 150, maxpwr: 850, maxseg: 32 },
		name: 'WLED Test',
		udpport: 21324,
		live: false,
		lm: '',
		lip: '',
		ws: -1,
		wifi: { bssid: 'AA:BB:CC:DD:EE:FF', rssi: -55, channel: 6 },
		fs: { u: 12000, t: 200000, pmt: 1000 },
		fxcount: 185,
		palcount: 75,
		uptime: 12345,
		arch: 'esp32',
		core: '2.0.14',
		freeheap: 120000,
		brand: 'WLED',
		product: 'FOSS',
		mac: 'AA:BB:CC:DD:EE:FF',
		ip: '192.168.1.100',
	};

	const mockFetchSuccess = <T>(data: T): void => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => data,
		});
	};

	const mockFetchError = (status = 500, statusText = 'Internal Server Error'): void => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status,
			statusText,
		});
	};

	const mockFetchMultiple = (responses: Array<{ data?: unknown; error?: boolean; status?: number }>): void => {
		const implementations = responses.map(({ data, error, status }) => {
			if (error) {
				return Promise.resolve({
					ok: false,
					status: status || 500,
					statusText: 'Error',
				});
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				json: async () => data,
			});
		});

		let callIndex = 0;
		(global.fetch as jest.Mock).mockImplementation(() => {
			const response = implementations[callIndex];
			callIndex++;
			return response;
		});
	};

	describe('connect', () => {
		it('should connect to a WLED device and emit connected event', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid', 'Blink', 'Rainbow'] },
				{ data: ['Default', 'Party', 'Cloud'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				WledAdapterEventType.DEVICE_CONNECTED,
				expect.objectContaining({
					host: '192.168.1.100',
				}),
			);

			const device = service.getDevice('192.168.1.100');
			expect(device).toBeDefined();
			expect(device?.connected).toBe(true);
			expect(device?.identifier).toBe('wled-test');
		});

		it('should throw exception on connection failure', async () => {
			mockFetchError(500, 'Internal Server Error');

			await expect(service.connect('192.168.1.100', 'wled-test')).rejects.toThrow();
		});
	});

	describe('disconnect', () => {
		it('should disconnect a device and emit disconnected event', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();

			service.disconnect('192.168.1.100');

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				WledAdapterEventType.DEVICE_DISCONNECTED,
				expect.objectContaining({
					host: '192.168.1.100',
					reason: 'manual disconnect',
				}),
			);

			expect(service.getDevice('192.168.1.100')).toBeUndefined();
		});

		it('should do nothing if device is not registered', () => {
			service.disconnect('192.168.1.100');

			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('getDevice', () => {
		it('should return registered device by host', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');

			const device = service.getDevice('192.168.1.100');

			expect(device).toBeDefined();
			expect(device?.host).toBe('192.168.1.100');
		});

		it('should return undefined for unknown device', () => {
			const device = service.getDevice('192.168.1.100');

			expect(device).toBeUndefined();
		});
	});

	describe('getDeviceByIdentifier', () => {
		it('should return registered device by identifier', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');

			const device = service.getDeviceByIdentifier('wled-test');

			expect(device).toBeDefined();
			expect(device?.identifier).toBe('wled-test');
		});

		it('should return undefined for unknown identifier', () => {
			const device = service.getDeviceByIdentifier('unknown');

			expect(device).toBeUndefined();
		});
	});

	describe('updateState', () => {
		it('should send state update and emit state changed event', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();

			// Mock the POST response
			mockFetchSuccess(mockWledState);

			const result = await service.updateState('192.168.1.100', { on: false }, 0);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ on: false }),
				}),
			);
		});

		it('should return false for unregistered device', async () => {
			const result = await service.updateState('192.168.1.100', { on: true }, 0);

			expect(result).toBe(false);
		});
	});

	describe('turnOn/turnOff', () => {
		beforeEach(async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should turn on the device', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.turnOn('192.168.1.100');

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({ on: true }),
				}),
			);
		});

		it('should turn off the device', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.turnOff('192.168.1.100');

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({ on: false }),
				}),
			);
		});
	});

	describe('setBrightness', () => {
		beforeEach(async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should set brightness', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.setBrightness('192.168.1.100', 200);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({ bri: 200 }),
				}),
			);
		});

		it('should clamp brightness to valid range', async () => {
			mockFetchSuccess(mockWledState);

			await service.setBrightness('192.168.1.100', 300);

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({ bri: 255 }),
				}),
			);
		});
	});

	describe('setColor', () => {
		beforeEach(async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should set RGB color', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.setColor('192.168.1.100', 255, 128, 64);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({
						seg: [{ id: 0, col: [[255, 128, 64]] }],
					}),
				}),
			);
		});

		it('should set RGBW color', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.setColor('192.168.1.100', 255, 128, 64, 32);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({
						seg: [{ id: 0, col: [[255, 128, 64, 32]] }],
					}),
				}),
			);
		});
	});

	describe('setEffect', () => {
		beforeEach(async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should set effect', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.setEffect('192.168.1.100', 5);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({
						seg: [{ id: 0, fx: 5 }],
					}),
				}),
			);
		});

		it('should set effect with speed and intensity', async () => {
			mockFetchSuccess(mockWledState);

			const result = await service.setEffect('192.168.1.100', 5, 200, 150);

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({
						seg: [{ id: 0, fx: 5, sx: 200, ix: 150 }],
					}),
				}),
			);
		});
	});

	describe('refreshState', () => {
		beforeEach(async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should refresh state and emit state changed event', async () => {
			mockFetchSuccess(mockWledState);

			const state = await service.refreshState('192.168.1.100');

			expect(state).toBeDefined();
			expect(state?.on).toBe(true);
			expect(state?.brightness).toBe(128);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				WledAdapterEventType.DEVICE_STATE_CHANGED,
				expect.objectContaining({
					host: '192.168.1.100',
				}),
			);
		});

		it('should return null for unregistered device', async () => {
			const state = await service.refreshState('192.168.1.200');

			expect(state).toBeNull();
		});
	});

	describe('isConnected', () => {
		it('should return true for connected device', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');

			expect(service.isConnected('192.168.1.100')).toBe(true);
		});

		it('should return false for unknown device', () => {
			expect(service.isConnected('192.168.1.100')).toBe(false);
		});
	});

	describe('getRegisteredDevices', () => {
		it('should return all registered devices', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-1');
			jest.clearAllMocks();

			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.101', 'wled-2');

			const devices = service.getRegisteredDevices();

			expect(devices).toHaveLength(2);
		});
	});

	describe('disconnectAll', () => {
		it('should disconnect all devices', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.100', 'wled-1');
			jest.clearAllMocks();

			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid'] },
				{ data: ['Default'] },
			]);

			await service.connect('192.168.1.101', 'wled-2');
			jest.clearAllMocks();

			service.disconnectAll();

			expect(service.getRegisteredDevices()).toHaveLength(0);
		});
	});
});
