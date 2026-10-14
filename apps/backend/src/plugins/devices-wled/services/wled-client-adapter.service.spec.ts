/*
eslint-disable @typescript-eslint/require-await
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import WebSocket from 'ws';

import { WledAdapterCallbacks, WledDeviceContext, WledDeviceStateChangedEvent } from '../interfaces/wled.interface';

import { WledClientAdapterService } from './wled-client-adapter.service';

// Mock global fetch
global.fetch = jest.fn();
jest.mock('ws');

describe('WledClientAdapterService', () => {
	let service: WledClientAdapterService;
	let callbacks: {
		onDeviceConnected: jest.Mock;
		onDeviceDisconnected: jest.Mock;
		onDeviceStateChanged: jest.Mock;
		onDeviceError: jest.Mock;
	};

	// Quiet logger noise

	beforeAll(() => {});

	afterAll(() => {});

	beforeEach(() => {
		jest.clearAllMocks();
		callbacks = {
			onDeviceConnected: jest.fn(),
			onDeviceDisconnected: jest.fn(),
			onDeviceStateChanged: jest.fn(),
			onDeviceError: jest.fn(),
		};
		service = new WledClientAdapterService();
		service.setCallbacks(callbacks as WledAdapterCallbacks);
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
				col: [
					[255, 0, 0],
					[0, 0, 0],
					[0, 0, 0],
				],
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
		it('probes without registering the device or emitting connection events', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			const context = await service.probe('192.168.1.100');

			expect(context.info.mac).toBe(mockWledInfo.mac);
			expect(service.getDevice('192.168.1.100')).toBeUndefined();
			expect(callbacks.onDeviceConnected).not.toHaveBeenCalled();
		});

		it('should connect to a WLED device and invoke connected callback', async () => {
			mockFetchMultiple([
				{ data: mockWledState },
				{ data: mockWledInfo },
				{ data: ['Solid', 'Blink', 'Rainbow'] },
				{ data: ['Default', 'Party', 'Cloud'] },
			]);

			await service.connect('192.168.1.100', 'wled-test');

			expect(callbacks.onDeviceConnected).toHaveBeenCalledWith(
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
		it('should disconnect a device and invoke disconnected callback', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();

			service.disconnect('192.168.1.100');

			expect(callbacks.onDeviceDisconnected).toHaveBeenCalledWith(
				expect.objectContaining({
					host: '192.168.1.100',
					identifier: 'wled-test',
					reason: 'manual disconnect',
				}),
			);

			expect(service.getDevice('192.168.1.100')).toBeUndefined();
		});

		it('should do nothing if device is not registered', () => {
			service.disconnect('192.168.1.100');

			expect(callbacks.onDeviceDisconnected).not.toHaveBeenCalled();
		});

		it('can suppress the disconnected callback during controlled replacement', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);
			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();

			service.disconnect('192.168.1.100', false);

			expect(service.getDevice('192.168.1.100')).toBeUndefined();
			expect(callbacks.onDeviceDisconnected).not.toHaveBeenCalled();
		});

		it('ignores a stale socket close after a replacement is registered at the same host', () => {
			jest.useFakeTimers();
			const sockets: Array<{
				on: jest.Mock;
				close: jest.Mock;
				handlers: Map<string, (...args: unknown[]) => void>;
			}> = [];
			(WebSocket as unknown as jest.Mock).mockImplementation(() => {
				const handlers = new Map<string, (...args: unknown[]) => void>();
				const socket = {
					on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
						handlers.set(event, handler);
					}),
					close: jest.fn(),
					handlers,
				};
				sockets.push(socket);

				return socket;
			});
			const context = {
				state: { on: true, brightness: 128, segments: [] },
				info: { name: 'WLED', mac: 'AA:BB:CC:DD:EE:FF' },
				effects: [],
				palettes: [],
			} as WledDeviceContext;
			service.configureWebSocket(true, 5000);

			service.connectWithContext('192.168.1.100', 'wled-old', context);
			sockets[0].handlers.get('open')?.();
			service.disconnect('192.168.1.100');
			service.connectWithContext('192.168.1.100', 'wled-new', context);
			sockets[1].handlers.get('open')?.();
			sockets[0].handlers.get('close')?.();
			jest.advanceTimersByTime(5000);

			expect(service.getDevice('192.168.1.100')).toEqual(
				expect.objectContaining({ identifier: 'wled-new', websocket: sockets[1] }),
			);
			expect(WebSocket).toHaveBeenCalledTimes(2);
			jest.useRealTimers();
		});
	});

	describe('getDevice', () => {
		it('should return registered device by host', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
					body: JSON.stringify({ on: false, v: true }),
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
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
					body: JSON.stringify({ on: true, v: true }),
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
					body: JSON.stringify({ on: false, v: true }),
				}),
			);
		});
	});

	describe('setBrightness', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
					body: JSON.stringify({ bri: 200, v: true }),
				}),
			);
		});

		it('should clamp brightness to valid range', async () => {
			mockFetchSuccess(mockWledState);

			await service.setBrightness('192.168.1.100', 300);

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/json/state',
				expect.objectContaining({
					body: JSON.stringify({ bri: 255, v: true }),
				}),
			);
		});
	});

	describe('setColor', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
						v: true,
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
						v: true,
					}),
				}),
			);
		});
	});

	describe('setEffect', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

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
						v: true,
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
						v: true,
					}),
				}),
			);
		});
	});

	describe('refreshState', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it('should refresh state and invoke state changed callback', async () => {
			mockFetchSuccess(mockWledState);

			const state = await service.refreshState('192.168.1.100');

			expect(state).toBeDefined();
			expect(state?.on).toBe(true);
			expect(state?.brightness).toBe(128);
			expect(callbacks.onDeviceStateChanged).toHaveBeenCalledWith(
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

	describe('verbose command feedback', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);
			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});

		it.each(['ordinary', 'extended'] as const)(
			'requests full state for %s POST and never treats a bare acceptance as feedback',
			async (kind) => {
				mockFetchSuccess({ success: true });
				const result =
					kind === 'ordinary'
						? await service.updateState('192.168.1.100', { on: true }, 0)
						: await service.updateStateExtended('192.168.1.100', { on: true });
				expect(result).toBe(true);
				const call = (global.fetch as jest.Mock).mock.calls[0] as [string, { body: string }];
				const options = call[1];
				expect(JSON.parse(options.body)).toMatchObject({ on: true, v: true });
				expect(callbacks.onDeviceStateChanged).not.toHaveBeenCalled();
			},
		);

		it('publishes actual reported state from a verbose response', async () => {
			mockFetchSuccess({ ...mockWledState, on: false });
			expect(await service.updateState('192.168.1.100', { on: true }, 0)).toBe(true);
			const callback = callbacks.onDeviceStateChanged;
			const event = callback.mock.calls[0] as [{ state: { on: boolean } }];
			expect(event[0].state.on).toBe(false);
		});
	});

	describe('qualified observation ordering', () => {
		beforeEach(async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);
			await service.connect('192.168.1.100', 'wled-test');
			jest.clearAllMocks();
		});
		it('keeps stable source authority through unchanged heartbeats and revokes it on disconnect', async () => {
			mockFetchSuccess(mockWledState);
			await service.refreshState('192.168.1.100');
			const [first] = callbacks.onDeviceStateChanged.mock.calls[0] as [WledDeviceStateChangedEvent];
			await service.refreshState('192.168.1.100');
			expect(first.observation?.evidence.isCurrent?.()).toBe(false);
			expect(first.observation?.evidence.sourceIsCurrent?.()).toBe(true);
			service.disconnect('192.168.1.100');
			expect(first.observation?.evidence.sourceIsCurrent?.()).toBe(false);
		});
		it('drops a delayed old poll after a newer report and after host replacement', async () => {
			let release!: (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
			const pending = new Promise((resolve) => {
				release = resolve;
			});
			(global.fetch as jest.Mock).mockImplementationOnce(() => pending);
			const oldPoll = service.refreshState('192.168.1.100');
			mockFetchSuccess({ ...mockWledState, on: false });
			await service.refreshState('192.168.1.100');
			release({ ok: true, status: 200, json: async () => mockWledState });
			expect(await oldPoll).toBeNull();
			expect(service.getDevice('192.168.1.100')?.context?.state.on).toBe(false);
			expect(callbacks.onDeviceStateChanged).toHaveBeenCalledTimes(1);
			const [event] = callbacks.onDeviceStateChanged.mock.calls[0] as [WledDeviceStateChangedEvent];
			const context = service.getDevice('192.168.1.100')?.context;
			service.connectWithContext('192.168.1.100', 'replacement', context);
			expect(event.observation?.evidence.sourceIsCurrent?.()).toBe(false);
		});
		it('rechecks composite admission at actual POST and refuses mismatched captured MAC', async () => {
			expect(service.captureDeviceIdentity('wled-test', '000000000000')).toBeNull();
			const identity = service.captureDeviceIdentity('wled-test', 'aabbccddeeff');
			expect(identity?.()).toBe(true);
			expect(await service.updateStateExtended('192.168.1.100', { on: true }, () => false)).toBe(false);
			expect(global.fetch).not.toHaveBeenCalled();
			service.disconnect('192.168.1.100');
			expect(identity?.()).toBe(false);
		});

		it.each(['ordinary', 'extended'] as const)(
			'accepts a successful %s POST superseded by a newer poll without publishing its response',
			async (kind) => {
				let resolvePost!: (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
				const pendingPost = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => {
					resolvePost = resolve;
				});
				(global.fetch as jest.Mock).mockImplementationOnce(() => pendingPost);

				const command =
					kind === 'ordinary'
						? service.updateState('192.168.1.100', { on: true }, 0)
						: service.updateStateExtended('192.168.1.100', { on: true });
				mockFetchSuccess({ ...mockWledState, on: false });
				await service.refreshState('192.168.1.100');
				const publishedEvents = callbacks.onDeviceStateChanged.mock.calls.length;

				resolvePost({ ok: true, status: 200, json: async () => ({ ...mockWledState, on: true }) });
				expect(await command).toBe(true);
				expect(callbacks.onDeviceStateChanged).toHaveBeenCalledTimes(publishedEvents);
				expect(service.getDevice('192.168.1.100')?.context?.state.on).toBe(false);
			},
		);

		it.each(['ordinary', 'extended'] as const)('%s POST failure remains a failure', async (kind) => {
			mockFetchError();
			const result =
				kind === 'ordinary'
					? await service.updateState('192.168.1.100', { on: true }, 0)
					: await service.updateStateExtended('192.168.1.100', { on: true });
			expect(result).toBe(false);
			expect(callbacks.onDeviceStateChanged).not.toHaveBeenCalled();
		});

		it.each(['ordinary', 'extended'] as const)(
			'rejects a verbose %s response after device replacement',
			async (kind) => {
				let resolvePost!: (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
				const pendingPost = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => {
					resolvePost = resolve;
				});
				(global.fetch as jest.Mock).mockImplementationOnce(() => pendingPost);

				const command =
					kind === 'ordinary'
						? service.updateState('192.168.1.100', { on: true }, 0)
						: service.updateStateExtended('192.168.1.100', { on: true });
				const context = service.getDevice('192.168.1.100')?.context;
				expect(context).toBeDefined();
				service.connectWithContext('192.168.1.100', 'replacement', context);
				resolvePost({ ok: true, status: 200, json: async () => mockWledState });

				expect(await command).toBe(false);
				expect(callbacks.onDeviceStateChanged).not.toHaveBeenCalled();
			},
		);
	});

	describe('isConnected', () => {
		it('should return true for connected device', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.100', 'wled-test');

			expect(service.isConnected('192.168.1.100')).toBe(true);
		});

		it('should return false for unknown device', () => {
			expect(service.isConnected('192.168.1.100')).toBe(false);
		});
	});

	describe('getRegisteredDevices', () => {
		it('should return all registered devices', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.100', 'wled-1');
			jest.clearAllMocks();

			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.101', 'wled-2');

			const devices = service.getRegisteredDevices();

			expect(devices).toHaveLength(2);
		});
	});

	describe('disconnectAll', () => {
		it('should disconnect all devices', async () => {
			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.100', 'wled-1');
			jest.clearAllMocks();

			mockFetchMultiple([{ data: mockWledState }, { data: mockWledInfo }, { data: ['Solid'] }, { data: ['Default'] }]);

			await service.connect('192.168.1.101', 'wled-2');
			jest.clearAllMocks();

			service.disconnectAll();

			expect(service.getRegisteredDevices()).toHaveLength(0);
		});
	});
});
