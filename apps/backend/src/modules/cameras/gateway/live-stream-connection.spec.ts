import { EventEmitter } from 'events';
import { IncomingMessage, Server, createServer } from 'http';
import { AddressInfo } from 'net';
import WebSocket, { WebSocketServer } from 'ws';

import { Logger } from '@nestjs/common';

import { FAKE_CAMERA_SECRET_URL } from '../../../../test/support/fake-camera-stream.provider';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CamerasNotFoundException,
	Go2rtcUnavailableException,
} from '../cameras.exceptions';
import { CameraStreamSession } from '../services/camera-session.service';
import { Go2rtcStreamLease } from '../services/go2rtc-streams.service';

import { LiveStreamConnection, LiveStreamConnectionOptions } from './live-stream-connection';
import {
	LIVE_CLIENT_MAX_PAYLOAD_BYTES,
	LIVE_HEARTBEAT_INTERVAL_MS,
	LIVE_HIGH_WATER_BYTES,
	LIVE_LOW_WATER_BYTES,
	LIVE_MAX_LIFETIME_MS,
	LIVE_STALL_TIMEOUT_MS,
} from './live-stream.constants';

const session: CameraStreamSession = {
	id: '0b1f7c3e-52a4-4d51-8a63-0c6f4f2f0a11',
	deviceId: '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b',
	profileId: 'medium',
	transport: 'mse',
	owner: { kind: 'user', id: 'u1' } as CameraStreamSession['owner'],
	expiresAt: Date.now() + 60_000,
};

const PASSWORD_SENTINEL = 'PW_SENTINEL';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor timed out');
		}

		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

function listen(server: Server): Promise<number> {
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
	});
}

describe('LiveStreamConnection (real sockets)', () => {
	let httpServer: Server;
	let gateway: WebSocketServer;
	let upstreamServer: WebSocketServer;
	let gatewayPort: number;
	let upstreamPort: number;

	let upstreamSockets: WebSocket[];
	let upstreamRequests: IncomingMessage[];
	let upstreamMessages: string[];
	let upstreamCloseCodes: number[];
	let connections: LiveStreamConnection[];
	let closedCalls: LiveStreamConnection[];
	let release: jest.Mock;
	let connectUpstream: jest.Mock<Promise<Go2rtcStreamLease>, [AbortSignal]>;
	let clients: WebSocket[];
	let logged: string[];
	let loggerSpies: jest.SpyInstance[];

	const makeLease = (port = upstreamPort): Go2rtcStreamLease => ({
		streamName: 'cam_medium',
		wsUrl: `ws://127.0.0.1:${port}/api/ws?src=cam_medium`,
		authorization: `Basic ${PASSWORD_SENTINEL}`,
		release,
	});

	beforeEach(async () => {
		logged = [];
		loggerSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
				logged.push(JSON.stringify(args));
			}),
		);

		upstreamSockets = [];
		upstreamRequests = [];
		upstreamMessages = [];
		upstreamCloseCodes = [];
		connections = [];
		closedCalls = [];
		clients = [];
		release = jest.fn();
		connectUpstream = jest.fn<Promise<Go2rtcStreamLease>, [AbortSignal]>(() => Promise.resolve(makeLease()));

		upstreamServer = new WebSocketServer({ port: 0, host: '127.0.0.1' });
		await new Promise<void>((resolve) => upstreamServer.on('listening', () => resolve()));
		upstreamPort = (upstreamServer.address() as AddressInfo).port;
		upstreamServer.on('connection', (socket, request) => {
			upstreamSockets.push(socket);
			upstreamRequests.push(request);
			socket.on('message', (data) => upstreamMessages.push((data as Buffer).toString()));
			socket.on('close', (code) => upstreamCloseCodes.push(code));
		});

		gateway = new WebSocketServer({ noServer: true, maxPayload: LIVE_CLIENT_MAX_PAYLOAD_BYTES });
		httpServer = createServer();
		httpServer.on('upgrade', (request, socket, head) => {
			gateway.handleUpgrade(request, socket, head, (client) => {
				const connection = new LiveStreamConnection({
					client,
					session,
					connectUpstream: (signal) => connectUpstream(signal),
					onClosed: (closed) => closedCalls.push(closed),
				});

				connections.push(connection);
				connection.start();
			});
		});
		gatewayPort = await listen(httpServer);
	});

	afterEach(async () => {
		for (const client of clients) {
			client.terminate();
		}

		for (const socket of upstreamSockets) {
			socket.terminate();
		}

		await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
		await new Promise<void>((resolve) => {
			gateway.close();
			httpServer.close(() => resolve());
		});

		loggerSpies.forEach((spy) => spy.mockRestore());
	});

	function connectClient(): {
		socket: WebSocket;
		closed: Promise<[number, string]>;
		received: Array<[Buffer, boolean]>;
	} {
		const socket = new WebSocket(`ws://127.0.0.1:${gatewayPort}/live`);
		const received: Array<[Buffer, boolean]> = [];

		clients.push(socket);
		socket.on('message', (data, isBinary) => received.push([data as Buffer, isBinary]));

		const closed = new Promise<[number, string]>((resolve) => {
			socket.on('close', (code, reason) => resolve([code, reason.toString()]));
		});

		return { socket, closed, received };
	}

	const opened = (socket: WebSocket) =>
		new Promise<void>((resolve) => {
			socket.on('open', () => resolve());
		});

	it('relays the mse request upstream and media back', async () => {
		const { socket, received } = connectClient();

		await opened(socket);
		socket.send(JSON.stringify({ type: 'mse', value: 'avc1.640029' }));
		await waitFor(() => upstreamMessages.length === 1);

		expect(JSON.parse(upstreamMessages[0])).toEqual({ type: 'mse', value: 'avc1.640029' });
		expect(upstreamRequests[0].headers.authorization).toBe(`Basic ${PASSWORD_SENTINEL}`);

		const ftyp = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

		upstreamSockets[0].send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' }));
		upstreamSockets[0].send(ftyp);
		await waitFor(() => received.length === 2);

		expect(received[0][1]).toBe(false);
		expect(JSON.parse(received[0][0].toString())).toEqual({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' });
		expect(received[1][1]).toBe(true);
		expect(received[1][0]).toEqual(ftyp);
	});

	it('queues client requests until the upstream opens', async () => {
		connectUpstream.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(makeLease()), 300)));

		const { socket } = connectClient();

		await opened(socket);
		socket.send(JSON.stringify({ type: 'mse', value: 'avc1.640029' }));

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(upstreamMessages).toEqual([]);

		await waitFor(() => upstreamMessages.length === 1);

		expect(JSON.parse(upstreamMessages[0])).toEqual({ type: 'mse', value: 'avc1.640029' });
	});

	it.each([
		JSON.stringify({ type: 'webrtc/offer', value: 'v=0' }),
		'not json',
		JSON.stringify({ type: 'mse', value: 'x'.repeat(2000) }),
		JSON.stringify({ type: 'mse', value: 5 }),
		JSON.stringify(['mse']),
		'null',
	])('closes 1008 for the request %#', async (frame) => {
		const { socket, closed } = connectClient();

		await opened(socket);
		socket.send(frame);

		expect(await closed).toEqual([1008, 'protocol_violation']);
		expect(upstreamMessages).toEqual([]);
	});

	it('accepts an mse request without a value', async () => {
		const { socket } = connectClient();

		await opened(socket);
		socket.send(JSON.stringify({ type: 'mse' }));
		await waitFor(() => upstreamMessages.length === 1);

		expect(JSON.parse(upstreamMessages[0])).toEqual({ type: 'mse' });
	});

	it('closes 1003 for a binary client frame', async () => {
		const { socket, closed } = connectClient();

		await opened(socket);
		socket.send(Buffer.from([1, 2, 3]));

		expect(await closed).toEqual([1003, 'unsupported_data']);
	});

	it('closes 1011 upstream_closed and releases the lease once when go2rtc closes', async () => {
		const { socket, closed } = connectClient();

		await opened(socket);
		await waitFor(() => upstreamSockets.length === 1);
		upstreamSockets[0].close(1000);

		expect(await closed).toEqual([1011, 'upstream_closed']);
		await waitFor(() => closedCalls.length === 1);

		expect(release).toHaveBeenCalledTimes(1);
		expect(closedCalls[0]).toBe(connections[0]);
		expect(connections[0].closed).toBe(true);
	});

	it('closes upstream with 1000 and releases the lease when the client leaves', async () => {
		const { socket } = connectClient();

		await opened(socket);
		await waitFor(() => upstreamSockets.length === 1);
		socket.close(1000);

		await waitFor(() => upstreamCloseCodes.length === 1);
		await waitFor(() => closedCalls.length === 1);

		expect(upstreamCloseCodes).toEqual([1000]);
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('releases a lease that arrives after the client left, and creates no upstream', async () => {
		let signal: AbortSignal | undefined;
		let resolveLease!: (lease: Go2rtcStreamLease) => void;

		connectUpstream.mockImplementation((abortSignal) => {
			signal = abortSignal;

			return new Promise((resolve) => {
				resolveLease = resolve;
			});
		});

		const { socket } = connectClient();

		await opened(socket);
		await waitFor(() => connectUpstream.mock.calls.length === 1);
		socket.close(1000);
		await waitFor(() => closedCalls.length === 1);

		expect(signal?.aborted).toBe(true);
		expect(release).not.toHaveBeenCalled();

		resolveLease(makeLease());
		await waitFor(() => release.mock.calls.length === 1);
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(upstreamSockets).toHaveLength(0);
		expect(release).toHaveBeenCalledTimes(1);
		expect(closedCalls).toHaveLength(1);
	});

	it.each([
		[new Go2rtcUnavailableException('x'), [1013, 'relay_unavailable']],
		[new CamerasNotFoundException('x'), [4000, 'revoked']],
		[new CameraProfileUnavailableException('x'), [4000, 'revoked']],
		[new CameraOfflineException('x'), [4000, 'revoked']],
		[new Error(FAKE_CAMERA_SECRET_URL), [1011, 'upstream_failed']],
	])('maps a failed connect %#', async (error, expected) => {
		connectUpstream.mockRejectedValue(error);

		const { socket, closed } = connectClient();

		await opened(socket);

		expect(await closed).toEqual(expected);
		await waitFor(() => closedCalls.length === 1);

		expect(release).not.toHaveBeenCalled();
	});

	it('closes 1011 upstream_failed and releases the lease when the upstream handshake fails', async () => {
		const unused = createServer();
		const deadPort = await listen(unused);

		await new Promise<void>((resolve) => unused.close(() => resolve()));
		connectUpstream.mockImplementation(() => Promise.resolve(makeLease(deadPort)));

		const { socket, closed } = connectClient();

		await opened(socket);

		expect(await closed).toEqual([1011, 'upstream_failed']);
		await waitFor(() => closedCalls.length === 1);

		expect(release).toHaveBeenCalledTimes(1);
	});

	it('uses only fixed close reasons and never logs the authorization header, the source url or the alias', async () => {
		// 1. connect fails with a secret-bearing message
		connectUpstream.mockRejectedValueOnce(new Error(FAKE_CAMERA_SECRET_URL));

		const failed = connectClient();

		await opened(failed.socket);

		const failedClose = await failed.closed;

		// 2. a normal run that ends with the upstream closing
		const normal = connectClient();

		await opened(normal.socket);
		await waitFor(() => upstreamSockets.length === 1);
		upstreamSockets[0].close(1000, FAKE_CAMERA_SECRET_URL);

		const normalClose = await normal.closed;

		// 3. a client that sends a rejected frame carrying the secrets
		const violating = connectClient();

		await opened(violating.socket);
		violating.socket.send(`${PASSWORD_SENTINEL} ${FAKE_CAMERA_SECRET_URL}`);

		const violatingClose = await violating.closed;

		await waitFor(() => closedCalls.length === 3);

		const reasons = [failedClose, normalClose, violatingClose];

		expect(reasons).toEqual([
			[1011, 'upstream_failed'],
			[1011, 'upstream_closed'],
			[1008, 'protocol_violation'],
		]);
		expect(logged.some((line) => line.includes(`Live stream closed session=${session.id}`))).toBe(true);

		const everything = JSON.stringify([reasons, logged]);

		expect(everything).not.toContain(PASSWORD_SENTINEL);
		expect(everything).not.toContain('SENTINELALIAS');
		expect(everything).not.toContain('fake-console');
		expect(everything).not.toContain('api/ws');
	});
});

class FakeSocket extends EventEmitter {
	readyState: number = WebSocket.OPEN;
	bufferedAmount = 0;
	autoPong = false;
	private callbacks: Array<(error?: Error) => void> = [];

	send = jest.fn((_data: unknown, _options: unknown, callback?: (error?: Error) => void) => {
		if (callback) this.callbacks.push(callback);
	});
	pause = jest.fn();
	resume = jest.fn();
	close = jest.fn();
	terminate = jest.fn();
	ping = jest.fn(() => {
		if (this.autoPong) this.emit('pong');
	});

	flushSendCallbacks(): void {
		const pending = this.callbacks;

		this.callbacks = [];
		pending.forEach((callback) => callback());
	}
}

describe('LiveStreamConnection (fake sockets)', () => {
	let client: FakeSocket;
	let upstream: FakeSocket;
	let release: jest.Mock;
	let onClosed: jest.Mock;
	let connection: LiveStreamConnection;
	let resolveLease: (lease: Go2rtcStreamLease) => void;
	let loggerSpies: jest.SpyInstance[];

	const lease = (): Go2rtcStreamLease => ({
		streamName: 'cam_medium',
		wsUrl: 'ws://127.0.0.1:1/api/ws?src=cam_medium',
		authorization: null,
		release,
	});

	const flush = async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	};

	const create = (overrides: Partial<LiveStreamConnectionOptions> = {}) => {
		connection = new LiveStreamConnection({
			client: client as unknown as WebSocket,
			session,
			connectUpstream: () => Promise.resolve(lease()),
			onClosed,
			createUpstream: () => upstream as unknown as WebSocket,
			...overrides,
		});
	};

	const openUpstream = async () => {
		connection.start();
		await flush();
		upstream.emit('open');
	};

	beforeEach(() => {
		jest.useFakeTimers();
		loggerSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined),
		);
		client = new FakeSocket();
		client.autoPong = true;
		upstream = new FakeSocket();
		release = jest.fn();
		onClosed = jest.fn();
	});

	afterEach(() => {
		jest.useRealTimers();
		loggerSpies.forEach((spy) => spy.mockRestore());
	});

	it('forwards upstream frames with the same binary flag', async () => {
		create();
		await openUpstream();

		const media = Buffer.alloc(10);

		upstream.emit('message', media, true);
		upstream.emit('message', Buffer.from('{"type":"mse"}'), false);

		expect(client.send).toHaveBeenNthCalledWith(1, media, { binary: true }, expect.any(Function));
		expect(client.send).toHaveBeenNthCalledWith(
			2,
			Buffer.from('{"type":"mse"}'),
			{ binary: false },
			expect.any(Function),
		);
	});

	it('pauses upstream above 4 MiB buffered and resumes below 1 MiB', async () => {
		create();
		await openUpstream();

		client.bufferedAmount = LIVE_HIGH_WATER_BYTES + 1;
		upstream.emit('message', Buffer.alloc(10), true);

		expect(upstream.pause).toHaveBeenCalledTimes(1);

		client.bufferedAmount = LIVE_LOW_WATER_BYTES + 1;
		client.flushSendCallbacks();

		expect(upstream.resume).not.toHaveBeenCalled();

		upstream.emit('message', Buffer.alloc(10), true);
		client.bufferedAmount = LIVE_LOW_WATER_BYTES - 1;
		client.flushSendCallbacks();

		expect(upstream.resume).toHaveBeenCalledTimes(1);
		expect(upstream.pause).toHaveBeenCalledTimes(1);
	});

	it('closes 1013 slow_consumer after 10 s paused', async () => {
		create();
		await openUpstream();

		client.bufferedAmount = LIVE_HIGH_WATER_BYTES + 1;
		upstream.emit('message', Buffer.alloc(10), true);

		jest.advanceTimersByTime(LIVE_STALL_TIMEOUT_MS - 1);
		expect(client.close).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);

		expect(client.close).toHaveBeenCalledWith(1013, 'slow_consumer');
		expect(upstream.terminate).toHaveBeenCalledTimes(1);
		expect(release).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('does not close a consumer that resumed in time', async () => {
		create();
		await openUpstream();

		client.bufferedAmount = LIVE_HIGH_WATER_BYTES + 1;
		upstream.emit('message', Buffer.alloc(10), true);
		jest.advanceTimersByTime(LIVE_STALL_TIMEOUT_MS - 1);

		client.bufferedAmount = 0;
		client.flushSendCallbacks();
		jest.advanceTimersByTime(LIVE_STALL_TIMEOUT_MS * 2);

		expect(upstream.resume).toHaveBeenCalledTimes(1);
		expect(client.close).not.toHaveBeenCalled();
		expect(connection.closed).toBe(false);
	});

	it('closes 4002 after 4 h', async () => {
		create();
		await openUpstream();

		jest.advanceTimersByTime(LIVE_MAX_LIFETIME_MS - 1);
		expect(client.close).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);

		expect(client.close).toHaveBeenCalledWith(4002, 'max_lifetime');
		expect(upstream.close).toHaveBeenCalledWith(1000);
		expect(release).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('keeps a client that answers pings', async () => {
		create();
		await openUpstream();

		jest.advanceTimersByTime(LIVE_HEARTBEAT_INTERVAL_MS * 5);

		expect(client.ping).toHaveBeenCalledTimes(5);
		expect(client.terminate).not.toHaveBeenCalled();
		expect(connection.closed).toBe(false);
	});

	it('terminates a client that stops answering pings and releases its lease', async () => {
		client.autoPong = false;
		create();
		await openUpstream();

		jest.advanceTimersByTime(LIVE_HEARTBEAT_INTERVAL_MS);

		expect(client.ping).toHaveBeenCalledTimes(1);
		expect(client.terminate).not.toHaveBeenCalled();

		jest.advanceTimersByTime(LIVE_HEARTBEAT_INTERVAL_MS);

		expect(client.terminate).toHaveBeenCalledTimes(1);
		expect(client.close).not.toHaveBeenCalled();
		expect(upstream.close).toHaveBeenCalledWith(1000);
		expect(release).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
		expect(connection.closed).toBe(true);
	});

	it('closes 1008 when a ninth frame is queued and never connects upstream', async () => {
		const lateLease = new Promise<Go2rtcStreamLease>((resolve) => {
			resolveLease = resolve;
		});

		create({ connectUpstream: () => lateLease });
		connection.start();

		const frame = Buffer.from(JSON.stringify({ type: 'mse', value: 'avc1' }));

		for (let i = 0; i < 8; i++) client.emit('message', frame, false);

		expect(client.close).not.toHaveBeenCalled();

		client.emit('message', frame, false);

		expect(client.close).toHaveBeenCalledWith(1008, 'protocol_violation');
		expect(onClosed).toHaveBeenCalledTimes(1);

		resolveLease(lease());
		await flush();

		expect(release).toHaveBeenCalledTimes(1);
		expect(upstream.send).not.toHaveBeenCalled();
	});

	it('flushes queued frames in order once the upstream opens', async () => {
		create();
		connection.start();

		const first = JSON.stringify({ type: 'mse', value: 'a' });
		const second = JSON.stringify({ type: 'mse', value: 'b' });

		client.emit('message', Buffer.from(first), false);
		client.emit('message', Buffer.from(second), false);
		await flush();

		expect(upstream.send).not.toHaveBeenCalled();

		upstream.emit('open');

		expect(upstream.send.mock.calls.map(([data]) => data)).toEqual([first, second]);
	});

	it('terminates an upstream that is still connecting when the client leaves', async () => {
		create();
		connection.start();
		await flush();
		upstream.readyState = WebSocket.CONNECTING;

		client.emit('close', 1001, Buffer.from('anything the client said'));

		expect(upstream.terminate).toHaveBeenCalledTimes(1);
		expect(upstream.close).not.toHaveBeenCalled();
		expect(release).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('closes both directions exactly once and clears every timer', async () => {
		create();
		await openUpstream();

		connection.close('REVOKED');
		connection.close('MAX_LIFETIME');
		upstream.emit('close', 1000, Buffer.alloc(0));
		client.emit('close', 1000, Buffer.alloc(0));
		upstream.emit('error', new Error('late'));

		expect(client.close).toHaveBeenCalledTimes(1);
		expect(client.close).toHaveBeenCalledWith(4000, 'revoked');
		expect(upstream.close).toHaveBeenCalledTimes(1);
		expect(release).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledTimes(1);
		expect(onClosed).toHaveBeenCalledWith(connection);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('closes 1011 upstream_failed when the upstream cannot be created', async () => {
		create({
			createUpstream: () => {
				throw new Error(FAKE_CAMERA_SECRET_URL);
			},
		});
		connection.start();
		await flush();

		expect(client.close).toHaveBeenCalledWith(1011, 'upstream_failed');
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('closes 1011 upstream_closed when the upstream errors after opening', async () => {
		create();
		await openUpstream();

		upstream.emit('error', new Error(FAKE_CAMERA_SECRET_URL));

		expect(client.close).toHaveBeenCalledWith(1011, 'upstream_closed');
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('exposes the session and starts open', () => {
		create();

		expect(connection.session).toBe(session);
		expect(connection.closed).toBe(false);
	});
});
