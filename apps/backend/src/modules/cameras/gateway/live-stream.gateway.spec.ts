import { IncomingMessage, Server, createServer } from 'http';
import { AddressInfo, Socket } from 'net';
import { Duplex } from 'stream';
import WebSocket, { ClientOptions, WebSocketServer } from 'ws';

import { Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from '../../../../test/support/fake-camera-stream.provider';
import { DeviceCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_LIVE_PATH } from '../cameras.constants';
import { CameraOfflineException, CamerasNotFoundException } from '../cameras.exceptions';
import { CameraSessionOwner } from '../cameras.utils';
import { CameraSessionService } from '../services/camera-session.service';
import { CamerasService } from '../services/cameras.service';
import { Go2rtcStreamLease } from '../services/go2rtc-streams.service';
import { Go2rtcRelayStatus } from '../services/go2rtc.service';

import {
	LIVE_CLIENT_MAX_PAYLOAD_BYTES,
	LIVE_HEARTBEAT_INTERVAL_MS,
	LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS,
} from './live-stream.constants';
import { LiveStreamGateway } from './live-stream.gateway';

const PASSWORD_SENTINEL = 'PW_SENTINEL_9f3c';
const FAKE_TIMERS: Parameters<typeof jest.useFakeTimers>[0] = {
	doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'Date', 'hrtime', 'performance'],
};

type Close = [number, string];

function listen(server: Server): Promise<number> {
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
	});
}

/** Lets socket I/O and promise continuations run; works with fake timers (setImmediate is not faked). */
async function settle(rounds = 20): Promise<void> {
	for (let i = 0; i < rounds; i++) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor timed out');
		}

		await new Promise((resolve) => setImmediate(resolve));
	}
}

describe('LiveStreamGateway', () => {
	let server: Server;
	let port: number;
	let upstreamServer: WebSocketServer;
	let upstreamPort: number;
	let upstreamMessages: string[];
	let upstreamSockets: WebSocket[];

	let config: { enabled: boolean; maxSessions: number; maxSessionsPerCamera: number };
	let configUnreadable: boolean;
	let configService: { getModuleConfig: jest.Mock };
	let sessions: CameraSessionService;
	let provider: FakeCameraStreamProvider;
	let cameras: CamerasService;
	let status: Go2rtcRelayStatus;
	let relayListeners: Set<(status: Go2rtcRelayStatus) => void>;
	let go2rtc: { isRunning: jest.Mock; getStatus: jest.Mock; subscribe: jest.Mock };
	let release: jest.Mock;
	let acquire: jest.Mock<Promise<Go2rtcStreamLease>, [DeviceEntity, unknown, string]>;
	let gateway: LiveStreamGateway;
	let upgradeListenersBefore: number;

	let clients: WebSocket[];
	let tokens: string[];
	let logged: string[];
	let loggerSpies: jest.SpyInstance[];

	const lease = (): Go2rtcStreamLease => ({
		streamName: 'smart-panel_c1_medium',
		wsUrl: `ws://127.0.0.1:${upstreamPort}/api/ws?src=${encodeURIComponent(FAKE_CAMERA_SECRET_URL)}`,
		authorization: `Basic ${PASSWORD_SENTINEL}`,
		release,
	});

	const fireRelay = (next: Go2rtcRelayStatus) => {
		status = next;

		for (const listener of relayListeners) {
			listener(next);
		}
	};

	beforeEach(async () => {
		logged = [];
		loggerSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
				logged.push(JSON.stringify(args));
			}),
		);

		clients = [];
		tokens = [];
		upstreamMessages = [];
		upstreamSockets = [];

		upstreamServer = new WebSocketServer({ port: 0, host: '127.0.0.1' });
		await new Promise<void>((resolve) => upstreamServer.on('listening', () => resolve()));
		upstreamPort = (upstreamServer.address() as AddressInfo).port;
		upstreamServer.on('connection', (socket) => {
			upstreamSockets.push(socket);
			socket.on('message', (data) => {
				upstreamMessages.push((data as Buffer).toString());
				socket.send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' }));
				socket.send(Buffer.from([0, 0, 0, 24]), { binary: true });
			});
		});

		config = { enabled: true, maxSessions: 8, maxSessionsPerCamera: 4 };
		configUnreadable = false;
		configService = {
			getModuleConfig: jest.fn(() => {
				if (configUnreadable) {
					throw new Error('config unreadable');
				}

				return config;
			}),
		};

		sessions = new CameraSessionService(new EventEmitter2());

		provider = new FakeCameraStreamProvider('fake-cameras');

		const devicesService = {
			findOne: jest.fn((id: string) =>
				Promise.resolve({ id, category: DeviceCategory.CAMERA, type: 'fake-cameras', channels: [] }),
			),
		};

		cameras = new CamerasService(devicesService as never, { get: () => provider } as never);

		status = { mode: 'managed', state: 'running', reason: null, version: '1.9.9', generation: 1 };
		relayListeners = new Set();
		go2rtc = {
			isRunning: jest.fn(() => status.state === 'running'),
			getStatus: jest.fn(() => ({ ...status })),
			subscribe: jest.fn((listener: (status: Go2rtcRelayStatus) => void) => {
				relayListeners.add(listener);

				return () => relayListeners.delete(listener);
			}),
		};

		release = jest.fn();
		acquire = jest.fn<Promise<Go2rtcStreamLease>, [DeviceEntity, unknown, string]>(() => Promise.resolve(lease()));

		server = createServer();
		port = await listen(server);
		upgradeListenersBefore = server.listenerCount('upgrade');

		gateway = createGateway({ httpAdapter: { getHttpServer: () => server } });
		gateway.onApplicationBootstrap();
	});

	afterEach(async () => {
		jest.useRealTimers();

		for (const client of clients) {
			client.terminate();
		}

		for (const socket of upstreamSockets) {
			socket.terminate();
		}

		gateway.onModuleDestroy();

		await waitFor(() => [...clients, ...upstreamSockets].every((socket) => socket.readyState === WebSocket.CLOSED));

		await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
		await new Promise<void>((resolve) => {
			server.closeAllConnections();
			server.close(() => resolve());
		});

		loggerSpies.forEach((spy) => spy.mockRestore());

		// The secret rule holds for every case of the suite, not only for the dedicated test.
		const everything = logged.join('\n');

		for (const token of tokens) {
			expect(everything).not.toContain(token);
		}

		expect(everything).not.toContain('SENTINELALIAS');
		expect(everything).not.toContain(PASSWORD_SENTINEL);
	});

	function createGateway(adapterHost: unknown): LiveStreamGateway {
		return new LiveStreamGateway(
			adapterHost as HttpAdapterHost,
			configService as never,
			sessions,
			cameras,
			go2rtc as never,
			{ acquire } as never,
		);
	}

	function validToken(
		deviceId = 'c1',
		owner: CameraSessionOwner = { kind: 'user', id: 'u1' },
		profileId = 'medium',
	): string {
		const { token } = sessions.create({ deviceId, profileId, transport: 'mse', owner });

		tokens.push(token);

		return token;
	}

	function tokenFor(kind: 'unknown' | 'reused' | 'expired'): string {
		if (kind === 'unknown') {
			return 'tok-unknown-0000000000000000000000000000000';
		}

		const { session, token } = sessions.create({
			deviceId: 'c1',
			profileId: 'medium',
			transport: 'mse',
			owner: { kind: 'user', id: 'u1' },
		});

		tokens.push(token);

		if (kind === 'reused') {
			sessions.consume(token);
		} else {
			session.expiresAt = Date.now() - 1;
		}

		return token;
	}

	/** The request url carries the token and a secret-looking extra parameter: neither may reach a log line. */
	const liveUrl = (token: string, path = CAMERAS_LIVE_PATH) =>
		`ws://127.0.0.1:${port}${path}?session=${encodeURIComponent(token)}&src=${encodeURIComponent(FAKE_CAMERA_SECRET_URL)}`;

	function connect(token: string, options?: ClientOptions): { client: WebSocket; closed: Promise<Close> } {
		const client = new WebSocket(liveUrl(token), options);

		clients.push(client);
		client.on('error', () => undefined);

		const closed = new Promise<Close>((resolve) => {
			client.on('close', (code, reason) => resolve([code, reason.toString()]));
		});

		return { client, closed };
	}

	/** Opens a live socket and waits until media from the stub relay arrives through it. */
	async function openLive(
		token: string,
		options?: ClientOptions,
	): Promise<{ client: WebSocket; closed: Promise<Close> }> {
		const opened = connect(token, options);

		await new Promise<void>((resolve, reject) => {
			opened.client.once('open', () => resolve());
			opened.client.once('unexpected-response', () => reject(new Error('upgrade refused')));
		});

		opened.client.send(JSON.stringify({ type: 'mse', value: 'avc1.640029' }));

		await Promise.race([
			new Promise<void>((resolve) => opened.client.once('message', () => resolve())),
			opened.closed.then(([code, reason]) => Promise.reject(new Error(`closed ${code} ${reason}`))),
		]);

		return opened;
	}

	function closeOf(token: string): Promise<Close> {
		return connect(token).closed;
	}

	function handshakeStatus(token: string): Promise<number> {
		return new Promise((resolve) => {
			const client = new WebSocket(liveUrl(token));

			clients.push(client);
			client.on('error', () => undefined);
			client.once('upgrade', () => resolve(101));
			client.once('unexpected-response', (request, response) => {
				resolve(response.statusCode ?? 0);
				request.destroy();
			});
		});
	}

	it('leaves upgrades for other paths to other listeners', async () => {
		const other = new WebSocketServer({ noServer: true });
		const bytesWrittenBefore: number[] = [];

		server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
			if (!request.url?.startsWith('/socket.io/')) {
				return;
			}

			bytesWrittenBefore.push((socket as Socket).bytesWritten);
			other.handleUpgrade(request, socket, head, (client) => client.close(1000, 'other'));
		});

		const client = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);

		clients.push(client);

		const closed = await new Promise<Close>((resolve) => {
			client.on('close', (code, reason) => resolve([code, reason.toString()]));
		});

		expect(closed).toEqual([1000, 'other']);
		expect(bytesWrittenBefore).toEqual([0]);
		expect(gateway.getActiveCount()).toBe(0);

		other.close();
	});

	it('writes the 101 in the same tick as the upgrade event', async () => {
		let written = -1;

		server.on('upgrade', (_req, socket) => (written = (socket as Socket).bytesWritten)); // registered after the gateway

		await openLive(validToken());

		expect(written).toBeGreaterThan(0);
		expect(gateway.getActiveCount()).toBe(1);
		expect(acquire).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), provider, 'medium');
		expect(upstreamMessages).toEqual([JSON.stringify({ type: 'mse', value: 'avc1.640029' })]);
	});

	it.each(['unknown', 'reused', 'expired'] as const)('refuses a %s session with 401 before upgrading', async (kind) => {
		expect(await handshakeStatus(tokenFor(kind))).toBe(401);
		expect(acquire).not.toHaveBeenCalled();
		expect(gateway.getActiveCount()).toBe(0);
		expect(logged.some((line) => line.includes('Live stream refused reason=invalid_session'))).toBe(true);
	});

	it('refuses a request without a session parameter with 401', async () => {
		const status = await new Promise<number>((resolve) => {
			const client = new WebSocket(`ws://127.0.0.1:${port}${CAMERAS_LIVE_PATH}`);

			clients.push(client);
			client.on('error', () => undefined);
			client.once('unexpected-response', (request, response) => {
				resolve(response.statusCode ?? 0);
				request.destroy();
			});
		});

		expect(status).toBe(401);
	});

	it('answers 404 while the module is disabled and keeps the token usable', async () => {
		const token = validToken();

		config.enabled = false;

		expect(await handshakeStatus(token)).toBe(404);
		expect(logged.some((line) => line.includes('Live stream refused reason=module_disabled'))).toBe(true);

		config.enabled = true;

		expect(await handshakeStatus(token)).toBe(101);
	});

	it('answers 503 when the module config cannot be read', async () => {
		const token = validToken();

		configUnreadable = true;

		expect(await handshakeStatus(token)).toBe(503);
		expect(logged.some((line) => line.includes('Live stream refused reason=config_unavailable'))).toBe(true);

		configUnreadable = false;

		expect(await handshakeStatus(token)).toBe(101);
	});

	it('closes 1013 relay_unavailable when the relay is not running', async () => {
		status = { ...status, state: 'starting' };

		expect(await closeOf(validToken())).toEqual([1013, 'relay_unavailable']);
		expect(acquire).not.toHaveBeenCalled();
		expect(gateway.getActiveCount()).toBe(0);
	});

	it('enforces max_sessions and the per-camera limit', async () => {
		config.maxSessions = 2;
		config.maxSessionsPerCamera = 1;
		await openLive(validToken('c1'));
		expect(await closeOf(validToken('c1'))).toEqual([1013, 'camera_session_limit']);
		await openLive(validToken('c2'));
		expect(await closeOf(validToken('c3'))).toEqual([1013, 'session_limit']);
		expect(gateway.getActiveCount()).toBe(2);
		expect(acquire).toHaveBeenCalledTimes(2);
	});

	it('frees a slot when a silent client is terminated', async () => {
		jest.useFakeTimers(FAKE_TIMERS);

		config.maxSessionsPerCamera = 1;

		const silent = await openLive(validToken('c1'), { autoPong: false });

		expect(await closeOf(validToken('c1'))).toEqual([1013, 'camera_session_limit']);

		jest.advanceTimersByTime(LIVE_HEARTBEAT_INTERVAL_MS);
		await settle();

		expect(gateway.getActiveCount()).toBe(1);

		jest.advanceTimersByTime(LIVE_HEARTBEAT_INTERVAL_MS);

		expect(gateway.getActiveCount()).toBe(0);
		expect(release).toHaveBeenCalledTimes(1);

		const [code] = await silent.closed;

		expect(code).toBe(1006);

		await openLive(validToken('c1'));

		expect(gateway.getActiveCount()).toBe(1);
	});

	it.each([
		['handleDeviceDeleted', { id: 'c1' }, { deviceId: 'c1' }],
		['handleDisplayDeleted', { id: 'd1' }, { owner: { kind: 'display', id: 'd1' } }],
		['handleDisplayTokenRevoked', { id: 'd1' }, { owner: { kind: 'display', id: 'd1' } }],
		['handleUserDeleted', { id: 'u1' }, { owner: { kind: 'user', id: 'u1' } }],
	] as const)('%s closes the matching sockets with 4000 and leaves others open', async (handler, payload, match) => {
		const specs: Array<{ deviceId: string; owner: CameraSessionOwner }> = [
			{ deviceId: 'c1', owner: { kind: 'user', id: 'u1' } },
			{ deviceId: 'c2', owner: { kind: 'display', id: 'd1' } },
			{ deviceId: 'c3', owner: { kind: 'user', id: 'u2' } },
			{ deviceId: 'c3', owner: { kind: 'display', id: 'u1' } },
		];
		const matches = (spec: (typeof specs)[number]): boolean =>
			'deviceId' in match
				? spec.deviceId === match.deviceId
				: spec.owner.kind === match.owner.kind && spec.owner.id === match.owner.id;

		const opened: Array<{ spec: (typeof specs)[number]; client: WebSocket; closed: Promise<Close> }> = [];

		for (const spec of specs) {
			opened.push({ spec, ...(await openLive(validToken(spec.deviceId, spec.owner))) });
		}

		gateway[handler](payload);

		const closedOnes = opened.filter(({ spec }) => matches(spec));
		const openOnes = opened.filter(({ spec }) => !matches(spec));

		expect(closedOnes).toHaveLength(1);

		for (const { closed } of closedOnes) {
			expect(await closed).toEqual([4000, 'revoked']);
		}

		await settle();

		for (const { client } of openOnes) {
			expect(client.readyState).toBe(WebSocket.OPEN);
		}

		expect(gateway.getActiveCount()).toBe(openOnes.length);
	});

	it.each([
		['switched off', () => (config.enabled = false)],
		['unreadable', () => (configUnreadable = true)],
	])('closes every socket with 4001 when the module is %s', async (_label, change) => {
		const first = await openLive(validToken('c1'));
		const second = await openLive(validToken('c2', { kind: 'display', id: 'd1' }));
		const pending = validToken('c1');

		change();

		await gateway.handleConfigUpdated({ source: 'cameras-module', type: 'module' });

		expect(await first.closed).toEqual([4001, 'module_disabled']);
		expect(await second.closed).toEqual([4001, 'module_disabled']);
		expect(gateway.getActiveCount()).toBe(0);
		expect(await handshakeStatus(pending)).toBe(configUnreadable ? 503 : 404);
	});

	it('keeps sockets open when another module or an enabled cameras module changes', async () => {
		const live = await openLive(validToken('c1'));

		await gateway.handleConfigUpdated({ source: 'weather-module', type: 'module' });
		await gateway.handleConfigUpdated({ source: 'cameras-module', type: 'module' });
		await settle();

		expect(live.client.readyState).toBe(WebSocket.OPEN);
		expect(gateway.getActiveCount()).toBe(1);
	});

	it('closes sockets whose camera became unavailable after a plugin config change', async () => {
		const broken = await openLive(validToken('c1'));
		const brokenTwin = await openLive(validToken('c1', { kind: 'display', id: 'd1' }));
		const healthy = await openLive(validToken('c2'));
		const listProfiles = jest.spyOn(provider, 'listProfiles');

		listProfiles.mockImplementation((device) =>
			device.id === 'c1'
				? Promise.reject(new CameraOfflineException('Camera is offline'))
				: Promise.resolve([{ id: 'medium', channelId: 'ch', available: true }]),
		);

		await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		expect(await broken.closed).toEqual([4000, 'revoked']);
		expect(await brokenTwin.closed).toEqual([4000, 'revoked']);

		await settle();

		expect(healthy.client.readyState).toBe(WebSocket.OPEN);
		expect(gateway.getActiveCount()).toBe(1);
		// One check per (device, profile), not per socket.
		expect(listProfiles.mock.calls.map(([device]) => device.id).sort()).toEqual(['c1', 'c2']);
	});

	it('closes a socket whose profile is no longer available after a plugin config change', async () => {
		const live = await openLive(validToken('c1', { kind: 'user', id: 'u1' }, 'high'));

		await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		// The fake provider lists `high` as unavailable.
		expect(await live.closed).toEqual([4000, 'revoked']);
	});

	describe('provider instances during a re-validation', () => {
		const pass = { id: 'medium', channelId: 'ch', available: true } as never;

		async function openUnder(
			owner: CameraSessionOwner,
			under: FakeCameraStreamProvider,
		): Promise<Awaited<ReturnType<typeof openLive>>> {
			const resolved = await cameras.getProviderOrThrow('c1');

			jest.spyOn(cameras, 'getProviderOrThrow').mockResolvedValueOnce({ device: resolved.device, provider: under });

			return openLive(validToken('c1', owner));
		}

		it('keeps the sockets of the provider a newer passing check validated, and closes those of the older failing one', async () => {
			const providerA = new FakeCameraStreamProvider('fake-cameras');
			const providerB = new FakeCameraStreamProvider('fake-cameras');
			const underA = await openUnder({ kind: 'user', id: 'u1' }, providerA);
			const underB = await openUnder({ kind: 'user', id: 'u2' }, providerB);
			const resolved = await cameras.getProviderOrThrow('c1');

			let rejectOlder!: (error: Error) => void;

			jest
				.spyOn(cameras, 'getProviderOrThrow')
				.mockResolvedValueOnce({ device: resolved.device, provider: providerA })
				.mockResolvedValueOnce({ device: resolved.device, provider: providerB });

			const resolveProfile = jest.spyOn(cameras, 'resolveProfile');

			resolveProfile.mockImplementation((_device, checked) =>
				checked === providerA
					? new Promise((_resolve, reject) => {
							rejectOlder = reject;
						})
					: Promise.resolve(pass),
			);

			const older = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

			await waitFor(() => resolveProfile.mock.calls.length === 1);

			// The newer check (providerB) completes first and passes.
			await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

			rejectOlder(new CameraOfflineException('Camera is offline'));
			await older;

			expect(await underA.closed).toEqual([4000, 'revoked']);

			await settle();

			expect(underB.client.readyState).toBe(WebSocket.OPEN);
			expect(gateway.getActiveCount()).toBe(1);
		});

		describe('an older check that fails while a newer one is still pending', () => {
			async function scenario(): Promise<{
				underA: Awaited<ReturnType<typeof openLive>>;
				underB: Awaited<ReturnType<typeof openLive>>;
				rejectOlder: (error: Error) => void;
				settleNewer: (error?: Error) => void;
				older: Promise<void>;
				newer: Promise<void>;
			}> {
				const providerA = new FakeCameraStreamProvider('fake-cameras');
				const providerB = new FakeCameraStreamProvider('fake-cameras');
				const underA = await openUnder({ kind: 'user', id: 'u1' }, providerA);
				const underB = await openUnder({ kind: 'user', id: 'u2' }, providerB);
				const resolved = await cameras.getProviderOrThrow('c1');

				let rejectOlder!: (error: Error) => void;
				let settleNewer!: (error?: Error) => void;

				jest
					.spyOn(cameras, 'getProviderOrThrow')
					.mockResolvedValueOnce({ device: resolved.device, provider: providerA })
					.mockResolvedValueOnce({ device: resolved.device, provider: providerB });

				const resolveProfile = jest.spyOn(cameras, 'resolveProfile');

				resolveProfile.mockImplementation(
					(_device, checked) =>
						new Promise((resolve, reject) => {
							if (checked === providerA) {
								rejectOlder = reject;
							} else {
								settleNewer = (error) => (error ? reject(error) : resolve(pass));
							}
						}),
				);

				const older = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

				await waitFor(() => resolveProfile.mock.calls.length === 1);

				const newer = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

				await waitFor(() => resolveProfile.mock.calls.length === 2);

				return { underA, underB, rejectOlder, settleNewer, older, newer };
			}

			it('closes only its own provider, and keeps the replacement open once the newer check passes', async () => {
				const { underA, underB, rejectOlder, settleNewer, older, newer } = await scenario();

				rejectOlder(new CameraOfflineException('Camera is offline'));
				await older;

				expect(await underA.closed).toEqual([4000, 'revoked']);
				expect(underB.client.readyState).toBe(WebSocket.OPEN);

				settleNewer();
				await newer;
				await settle();

				expect(underB.client.readyState).toBe(WebSocket.OPEN);
				expect(gateway.getActiveCount()).toBe(1);
			});

			it('closes the replacement too when the newer check then fails', async () => {
				const { underA, underB, rejectOlder, settleNewer, older, newer } = await scenario();

				rejectOlder(new CameraOfflineException('Camera is offline'));
				await older;

				expect(await underA.closed).toEqual([4000, 'revoked']);
				expect(underB.client.readyState).toBe(WebSocket.OPEN);

				settleNewer(new CameraOfflineException('Camera is offline'));
				await newer;

				expect(await underB.closed).toEqual([4000, 'revoked']);
			});
		});

		it('closes a socket on a third provider that is neither the checked nor the validated one', async () => {
			const provider0 = new FakeCameraStreamProvider('fake-cameras');
			const providerA = new FakeCameraStreamProvider('fake-cameras');
			const providerB = new FakeCameraStreamProvider('fake-cameras');
			const underZero = await openUnder({ kind: 'user', id: 'u0' }, provider0);
			const underB = await openUnder({ kind: 'user', id: 'u2' }, providerB);
			const resolved = await cameras.getProviderOrThrow('c1');

			let rejectOlder!: (error: Error) => void;

			jest
				.spyOn(cameras, 'getProviderOrThrow')
				.mockResolvedValueOnce({ device: resolved.device, provider: providerA })
				.mockResolvedValueOnce({ device: resolved.device, provider: providerB });

			const resolveProfile = jest.spyOn(cameras, 'resolveProfile');

			resolveProfile.mockImplementation((_device, checked) =>
				checked === providerA
					? new Promise((_resolve, reject) => {
							rejectOlder = reject;
						})
					: Promise.resolve(pass),
			);

			const older = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

			await waitFor(() => resolveProfile.mock.calls.length === 1);
			await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

			rejectOlder(new CameraOfflineException('Camera is offline'));
			await older;

			expect(await underZero.closed).toEqual([4000, 'revoked']);

			await settle();

			expect(underB.client.readyState).toBe(WebSocket.OPEN);
		});

		it('closes every socket of the camera profile when the newest check fails', async () => {
			const providerA = new FakeCameraStreamProvider('fake-cameras');
			const providerB = new FakeCameraStreamProvider('fake-cameras');
			const underA = await openUnder({ kind: 'user', id: 'u1' }, providerA);
			const underB = await openUnder({ kind: 'user', id: 'u2' }, providerB);

			jest.spyOn(cameras, 'resolveProfile').mockRejectedValue(new CameraOfflineException('Camera is offline'));

			await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

			expect(await underA.closed).toEqual([4000, 'revoked']);
			expect(await underB.closed).toEqual([4000, 'revoked']);
		});
	});

	it('discards the result of an older check of the same provider that rejects after a newer one passed', async () => {
		const live = await openLive(validToken('c1'));
		const resolveProfile = jest.spyOn(cameras, 'resolveProfile');

		let rejectOlder!: (error: Error) => void;

		resolveProfile.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectOlder = reject;
				}),
		);

		const older = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		await waitFor(() => resolveProfile.mock.calls.length === 1);

		resolveProfile.mockResolvedValueOnce({ id: 'medium', channelId: 'ch', available: true } as never);

		await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		rejectOlder(new CameraOfflineException('Camera is offline'));
		await older;
		await settle();

		expect(live.client.readyState).toBe(WebSocket.OPEN);
		expect(gateway.getActiveCount()).toBe(1);
	});

	it('re-validates the cameras in parallel', async () => {
		await openLive(validToken('c1'));
		await openLive(validToken('c2'));

		const resolvers: Array<() => void> = [];

		jest.spyOn(provider, 'listProfiles').mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvers.push(() => resolve([{ id: 'medium', channelId: 'ch', available: true }]));
				}),
		);

		const done = gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		await waitFor(() => resolvers.length === 2);

		resolvers.forEach((resolve) => resolve());
		await done;

		expect(gateway.getActiveCount()).toBe(2);
	});

	it('closes every socket with 1013 when the relay stops or restarts', async () => {
		const first = await openLive(validToken('c1'));
		const second = await openLive(validToken('c2'));

		fireRelay({ ...status, state: 'starting' });

		expect(await first.closed).toEqual([1013, 'relay_unavailable']);
		expect(await second.closed).toEqual([1013, 'relay_unavailable']);

		// New sockets admitted under generation 1 close when the relay comes back as generation 2.
		status = { ...status, state: 'running', generation: 1 };

		const third = await openLive(validToken('c1'));

		fireRelay({ ...status, generation: 1 });
		await settle();

		expect(third.client.readyState).toBe(WebSocket.OPEN);

		fireRelay({ ...status, state: 'running', generation: 2 });

		expect(await third.closed).toEqual([1013, 'relay_unavailable']);
		expect(gateway.getActiveCount()).toBe(0);
	});

	it('closes 1011 upstream_failed when the lease cannot be acquired in time, and releases a late lease', async () => {
		jest.useFakeTimers(FAKE_TIMERS);

		let resolveLease!: (lease: Go2rtcStreamLease) => void;

		acquire.mockImplementationOnce(
			() =>
				new Promise<Go2rtcStreamLease>((resolve) => {
					resolveLease = resolve;
				}),
		);

		const live = connect(validToken('c1'));

		await new Promise<void>((resolve) => live.client.once('open', () => resolve()));
		await waitFor(() => acquire.mock.calls.length === 1);

		jest.advanceTimersByTime(LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS - 1);
		await settle();

		expect(gateway.getActiveCount()).toBe(1);

		jest.advanceTimersByTime(1);

		expect(await live.closed).toEqual([1011, 'upstream_failed']);
		expect(gateway.getActiveCount()).toBe(0);

		resolveLease(lease());
		await settle();

		expect(release).toHaveBeenCalledTimes(1);
	});

	it('never acquires a lease for a connection that closed while the camera lookup was pending', async () => {
		let resolveLookup!: (value: Awaited<ReturnType<CamerasService['getProviderOrThrow']>>) => void;

		const resolved = await cameras.getProviderOrThrow('c1');
		const lookup = jest.spyOn(cameras, 'getProviderOrThrow');

		lookup.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveLookup = resolve;
				}),
		);

		const live = connect(validToken('c1'));

		await new Promise<void>((resolve) => live.client.once('open', () => resolve()));
		await waitFor(() => lookup.mock.calls.length === 1);

		// The client goes away while the lookup is outstanding.
		live.client.terminate();
		await live.closed;
		await waitFor(() => gateway.getActiveCount() === 0);

		resolveLookup(resolved);
		await settle();

		expect(acquire).not.toHaveBeenCalled();
		expect(release).not.toHaveBeenCalled();
	});

	it('releases at once a lease whose acquisition completes after the connection closed', async () => {
		let resolveLease!: (lease: Go2rtcStreamLease) => void;

		acquire.mockImplementationOnce(
			() =>
				new Promise<Go2rtcStreamLease>((resolve) => {
					resolveLease = resolve;
				}),
		);

		const live = connect(validToken('c1'));

		await new Promise<void>((resolve) => live.client.once('open', () => resolve()));
		await waitFor(() => acquire.mock.calls.length === 1);

		live.client.terminate();
		await live.closed;
		await waitFor(() => gateway.getActiveCount() === 0);

		expect(release).not.toHaveBeenCalled();

		resolveLease(lease());
		await settle();

		expect(release).toHaveBeenCalledTimes(1);
	});

	it('closes 4000 when the camera is gone before the lease is acquired', async () => {
		jest.spyOn(cameras, 'getProviderOrThrow').mockRejectedValueOnce(new CamerasNotFoundException('Camera not found'));

		const live = connect(validToken('missing'));

		expect(await live.closed).toEqual([4000, 'revoked']);
		expect(acquire).not.toHaveBeenCalled();
	});

	it('refuses client frames above the payload limit', async () => {
		const live = await openLive(validToken('c1'));

		live.client.send('x'.repeat(LIVE_CLIENT_MAX_PAYLOAD_BYTES + 1));

		const [code] = await live.closed;

		// ws answers 1009; the connection may tear the socket down before the frame is flushed.
		expect([1006, 1009]).toContain(code);
		expect(gateway.getActiveCount()).toBe(0);
		expect(upstreamMessages).toHaveLength(1);
	});

	it('closes with 1001 and detaches on shutdown', async () => {
		const first = await openLive(validToken('c1'));
		const second = await openLive(validToken('c2'));

		expect(server.listenerCount('upgrade')).toBe(upgradeListenersBefore + 1);

		gateway.onModuleDestroy();

		expect(await first.closed).toEqual([1001, 'server_shutdown']);
		expect(await second.closed).toEqual([1001, 'server_shutdown']);
		expect(server.listenerCount('upgrade')).toBe(upgradeListenersBefore);
		expect(relayListeners.size).toBe(0);
		expect(gateway.getActiveCount()).toBe(0);
	});

	it('does nothing without an http adapter', () => {
		const detached = createGateway({ httpAdapter: undefined });

		expect(() => detached.onApplicationBootstrap()).not.toThrow();
		expect(go2rtc.subscribe).toHaveBeenCalledTimes(1);
		expect(() => detached.onModuleDestroy()).not.toThrow();
	});

	it('never logs the session token or the source url', async () => {
		// opened, then revoked by a failing provider whose error carries the source url
		const live = await openLive(validToken('c1'));

		jest.spyOn(provider, 'listProfiles').mockRejectedValue(new Error(FAKE_CAMERA_SECRET_URL));
		await gateway.handleConfigUpdated({ source: 'x', type: 'plugin' });

		const revoked = await live.closed;

		// refused at HTTP level
		const invalid = await handshakeStatus(tokenFor('unknown'));
		const reused = await handshakeStatus(tokenFor('reused'));

		config.enabled = false;

		const disabled = await handshakeStatus(validToken());

		config.enabled = true;
		configUnreadable = true;

		const unreadable = await handshakeStatus(validToken());

		configUnreadable = false;

		// refused after the upgrade
		config.maxSessions = 0;

		const limited = await closeOf(validToken());

		// failed lease with a secret-bearing error
		config.maxSessions = 8;
		acquire.mockRejectedValueOnce(new Error(FAKE_CAMERA_SECRET_URL));

		const failed = await closeOf(validToken());

		expect([revoked, invalid, reused, disabled, unreadable, limited, failed]).toEqual([
			[4000, 'revoked'],
			401,
			401,
			404,
			503,
			[1013, 'session_limit'],
			[1011, 'upstream_failed'],
		]);
		expect(logged.some((line) => line.includes('Live stream opened session='))).toBe(true);

		const everything = logged.join('\n');

		for (const token of tokens) {
			expect(everything).not.toContain(token);
			expect(everything).not.toContain(encodeURIComponent(token));
		}

		expect(everything).not.toContain('tok-unknown');
		expect(everything).not.toContain('SENTINELALIAS');
		expect(everything).not.toContain('fake-console');
		expect(everything).not.toContain(PASSWORD_SENTINEL);
		expect(everything).not.toContain(CAMERAS_LIVE_PATH);
		expect(everything).not.toContain('session=' + encodeURIComponent(tokens[0]));
	});
});
