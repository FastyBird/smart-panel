import { EventEmitter } from 'events';
import * as net from 'net';
import { AddressInfo } from 'net';
import * as tls from 'tls';

import {
	PROTECT_TEST_DIRECT_DOMAIN,
	PROTECT_TEST_TLS,
	protectTlsServerOptions,
} from '../../../../test/support/protect-tls';
import { PROTECT_TLS_INSPECT_TIMEOUT_MS } from '../devices-unifi-protect.constants';
import { ProtectApiError } from '../errors/protect-api.error';

import { connectVerifiedProtectTls } from './protect-tls-connect';
import { ProtectTlsSettings, planProtectTls } from './protect-tls-policy';

// `import * as tls` namespaces cannot be spied on; a pass-through mock lets a test see or replace `tls.connect`.
jest.mock('tls', () => {
	const actual = jest.requireActual<typeof tls>('tls');

	return { ...actual, connect: jest.fn((options: tls.ConnectionOptions) => actual.connect(options)) };
});

const realConnect = jest.requireActual<typeof tls>('tls').connect;
const connectMock = tls.connect as unknown as jest.Mock<tls.TLSSocket, [tls.ConnectionOptions]>;

interface TestServer {
	port: number;
	bytesReceived: number;
	close: () => Promise<void>;
}

async function listen(server: net.Server, sockets: Set<net.Socket>): Promise<number> {
	server.on('connection', (socket: net.Socket) => {
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		socket.on('error', () => undefined);
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	return (server.address() as AddressInfo).port;
}

function closer(server: net.Server, sockets: Set<net.Socket>): () => Promise<void> {
	return () =>
		new Promise<void>((resolve) => {
			sockets.forEach((socket) => socket.destroy());
			server.close(() => resolve());
		});
}

async function startTlsServer(): Promise<TestServer> {
	const state = { bytesReceived: 0 };
	const sockets = new Set<net.Socket>();
	const server = tls.createServer(protectTlsServerOptions(), (socket) => {
		socket.on('data', (chunk: Buffer) => {
			state.bytesReceived += chunk.length;
		});
		socket.on('error', () => undefined);
	});

	server.on('tlsClientError', () => undefined);

	const port = await listen(server, sockets);

	return {
		port,
		get bytesReceived() {
			return state.bytesReceived;
		},
		close: closer(server, sockets),
	};
}

async function startSilentServer(): Promise<TestServer> {
	const sockets = new Set<net.Socket>();
	const server = net.createServer((socket) => socket.resume());
	const port = await listen(server, sockets);

	return { port, bytesReceived: 0, close: closer(server, sockets) };
}

const pinned = (fingerprintSha256: string): ProtectTlsSettings => ({
	mode: 'pinned',
	serverName: null,
	fingerprintSha256,
});

describe('connectVerifiedProtectTls', () => {
	let server: TestServer;
	const opened: tls.TLSSocket[] = [];

	/** Wraps the real tls.connect so a test can inspect the socket the function opened. */
	function captureSockets(): typeof connectMock {
		return connectMock.mockImplementation((options) => {
			const socket = realConnect(options);

			opened.push(socket);

			return socket;
		});
	}

	beforeEach(async () => {
		connectMock.mockClear();
		server = await startTlsServer();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		connectMock.mockImplementation((options) => realConnect(options));
		jest.useRealTimers();
		opened.splice(0).forEach((socket) => socket.destroy());
		await server.close();
	});

	it('resolves a pinned connection whose leaf matches', async () => {
		const seen: (string | null)[] = [];
		const { socket, fingerprint } = await connectVerifiedProtectTls({
			host: '127.0.0.1',
			port: server.port,
			plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.selfSigned)),
			handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			onPeerFingerprint: (value) => seen.push(value),
		});

		opened.push(socket);

		expect(fingerprint).toBe(PROTECT_TEST_TLS.fingerprints.selfSigned);
		expect(seen).toEqual([PROTECT_TEST_TLS.fingerprints.selfSigned]);
		expect(socket.destroyed).toBe(false);
		expect(server.bytesReceived).toBe(0);
	});

	it('rejects a pinned connection with another leaf', async () => {
		captureSockets();

		const seen: (string | null)[] = [];
		const error = await connectVerifiedProtectTls({
			host: '127.0.0.1',
			port: server.port,
			plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.console)),
			handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			onPeerFingerprint: (value) => seen.push(value),
		}).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ProtectApiError);
		expect(error).toMatchObject({ category: 'tls_fingerprint_mismatch', operation: 'tls' });
		// The fingerprint is reported even on a mismatch, so the admin can see what the console presented.
		expect(seen).toEqual([PROTECT_TEST_TLS.fingerprints.selfSigned]);
		expect(opened).toHaveLength(1);
		expect(opened[0].destroyed).toBe(true);
		expect(server.bytesReceived).toBe(0);
	});

	it('resolves a verify connection with the server name and the test CA', async () => {
		const { socket, fingerprint } = await connectVerifiedProtectTls({
			host: '127.0.0.1',
			port: server.port,
			plan: planProtectTls('127.0.0.1', {
				mode: 'verify',
				serverName: PROTECT_TEST_DIRECT_DOMAIN,
				fingerprintSha256: null,
			}),
			ca: [PROTECT_TEST_TLS.ca],
			handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
		});

		opened.push(socket);

		expect(fingerprint).toBe(PROTECT_TEST_TLS.fingerprints.console);
		expect(socket.authorized).toBe(true);
	});

	it('rejects a verify connection to the self-signed leaf', async () => {
		captureSockets();

		await expect(
			connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: server.port,
				plan: planProtectTls('127.0.0.1', { mode: 'verify', serverName: null, fingerprintSha256: null }),
				ca: [PROTECT_TEST_TLS.ca],
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			}),
		).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(opened[0].destroyed).toBe(true);
		expect(server.bytesReceived).toBe(0);
	});

	it('times out a handshake that never completes', async () => {
		const silent = await startSilentServer();

		captureSockets();

		try {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

			const outcome = connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: silent.port,
				plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.selfSigned)),
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			}).catch((e: unknown) => e);

			await jest.advanceTimersByTimeAsync(PROTECT_TLS_INSPECT_TIMEOUT_MS - 1);
			expect(opened[0].destroyed).toBe(false);
			await jest.advanceTimersByTimeAsync(1);

			expect(await outcome).toMatchObject({ category: 'timeout' });
			expect(opened[0].destroyed).toBe(true);
		} finally {
			jest.useRealTimers();
			await silent.close();
		}
	});

	it('rejects when the signal aborts', async () => {
		const silent = await startSilentServer();

		captureSockets();

		try {
			const controller = new AbortController();
			const outcome = connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: silent.port,
				plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.selfSigned)),
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
				signal: controller.signal,
			});

			controller.abort();

			await expect(outcome).rejects.toMatchObject({ category: 'cancelled' });
			expect(opened[0].destroyed).toBe(true);
		} finally {
			await silent.close();
		}
	});

	it('rejects an already aborted signal without connecting', async () => {
		const spy = captureSockets();
		const controller = new AbortController();

		controller.abort();

		await expect(
			connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: server.port,
				plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.selfSigned)),
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ category: 'cancelled' });
		expect(spy).not.toHaveBeenCalled();
	});

	it('reports a closed port as unreachable', async () => {
		const closed = net.createServer();

		await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));

		const closedPort = (closed.address() as AddressInfo).port;

		await new Promise<void>((resolve) => closed.close(() => resolve()));
		await expect(
			connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: closedPort,
				plan: planProtectTls('127.0.0.1', pinned(PROTECT_TEST_TLS.fingerprints.selfSigned)),
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			}),
		).rejects.toMatchObject({ category: 'unreachable' });
	});

	it('never resolves with authorized false in verify mode', async () => {
		const fake = Object.assign(new EventEmitter(), {
			authorized: false,
			destroyed: false,
			getPeerCertificate: () => ({ fingerprint256: PROTECT_TEST_TLS.fingerprints.console }),
			setKeepAlive: jest.fn(),
			disableRenegotiation: jest.fn(),
			destroy: jest.fn(function (this: { destroyed: boolean }) {
				this.destroyed = true;
			}),
		});
		const spy = connectMock.mockImplementation(() => {
			setImmediate(() => fake.emit('secureConnect'));

			return fake as unknown as tls.TLSSocket;
		});

		await expect(
			connectVerifiedProtectTls({
				host: '127.0.0.1',
				port: server.port,
				plan: planProtectTls('127.0.0.1', { mode: 'verify', serverName: null, fingerprintSha256: null }),
				handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			}),
		).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({ rejectUnauthorized: true }));
		expect(fake.destroy).toHaveBeenCalled();
		expect(fake.disableRenegotiation).not.toHaveBeenCalled();
		expect(() => fake.emit('error', new Error('late'))).not.toThrow();
	});

	it('connects with the plan, keeps alive and disables renegotiation before resolving', async () => {
		const spy = captureSockets();
		const keepAlive = jest.spyOn(net.Socket.prototype, 'setKeepAlive');
		const renegotiation = jest.spyOn(tls.TLSSocket.prototype, 'disableRenegotiation');
		const plan = planProtectTls('127.0.0.1', {
			mode: 'pinned',
			serverName: PROTECT_TEST_DIRECT_DOMAIN,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console,
		});
		const { socket } = await connectVerifiedProtectTls({
			host: '127.0.0.1',
			port: server.port,
			plan,
			handshakeTimeoutMs: PROTECT_TLS_INSPECT_TIMEOUT_MS,
			keepAlive: { enabled: true, initialDelayMs: 4321 },
		});

		expect(spy).toHaveBeenCalledWith({
			host: '127.0.0.1',
			port: server.port,
			servername: PROTECT_TEST_DIRECT_DOMAIN,
			rejectUnauthorized: false,
			ca: undefined,
		});
		expect(keepAlive).toHaveBeenCalledWith(true, 4321);
		expect(renegotiation).toHaveBeenCalledTimes(1);
		expect(socket.listenerCount('error')).toBeGreaterThan(0);
	});
});
