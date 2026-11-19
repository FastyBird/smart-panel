import { lookup } from 'dns/promises';
import { EventEmitter, getEventListeners } from 'events';
import * as net from 'net';
import { AddressInfo } from 'net';
import { Duplex, duplexPair } from 'stream';
import * as tls from 'tls';

import { Logger } from '@nestjs/common';

import { GO2RTC_HTTP_TIMEOUT_MS } from '../../../modules/cameras/cameras.constants';
import { Go2rtcRelayStatus, Go2rtcService } from '../../../modules/cameras/services/go2rtc.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ProtectVerifiedTlsOptions, connectVerifiedProtectTls } from '../client/protect-tls-connect';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_STREAM_AVAILABILITY_TTL_MS,
	PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
	PROTECT_STREAM_BRIDGE_HANDSHAKE_WINDOW_MS,
	PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS,
	PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS,
	PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES,
	PROTECT_STREAM_BRIDGE_MAX_LISTENERS,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectConnectorService, ProtectSessionListener, ProtectStreamTlsTarget } from './protect-connector.service';
import { ProtectStreamBridgeService } from './protect-stream-bridge.service';

jest.mock('../client/protect-tls-connect', () => ({
	...jest.requireActual<object>('../client/protect-tls-connect'),
	connectVerifiedProtectTls: jest.fn(),
}));

jest.mock('dns/promises', () => ({ ...jest.requireActual<object>('dns/promises'), lookup: jest.fn() }));

// `import * as net` namespaces cannot be spied on; a pass-through mock lets a test see servers or fake a probe.
jest.mock('net', () => {
	const actual = jest.requireActual<typeof net>('net');

	return {
		...actual,
		connect: jest.fn((...args: Parameters<typeof net.connect>) => actual.connect(...args)),
		createServer: jest.fn((...args: Parameters<typeof net.createServer>) => actual.createServer(...args)),
	};
});

const connectMock = connectVerifiedProtectTls as jest.MockedFunction<typeof connectVerifiedProtectTls>;
const lookupMock = lookup as unknown as jest.Mock<Promise<{ address: string; family: number }[]>, [string, object]>;
const netConnectMock = net.connect as unknown as jest.Mock;
const createServerMock = net.createServer as unknown as jest.Mock<net.Server>;

const PIN = 'AB'.repeat(32);
const CONSOLE_HOST = '192.168.1.1';
const UPSTREAM = { host: CONSOLE_HOST, port: 7441 };
/** `prepare()` derives the host itself (M2): callers name only the console port. */
const PORT = { port: 7441 };
const ALIAS = 'SENTINELALIAShigh0123456789';
const OPTIONS_REQUEST = `OPTIONS rtsp://127.0.0.1:1/${ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n`;
const OK_ANSWER = 'RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n';

/** Log lines carrying `text` (the logger adds its context and tag around it). */
const linesWith = (lines: string[], text: string): string[] => lines.filter((line) => line.includes(text));

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function waitFor(predicate: () => boolean, rounds = 500): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		if (predicate()) {
			return;
		}

		await tick();
	}

	throw new Error('condition not reached');
}

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

class FakeConnector {
	target: ProtectStreamTlsTarget | null = {
		consoleHost: CONSOLE_HOST,
		tls: { mode: 'pinned', serverName: null, fingerprintSha256: PIN },
	};
	private readonly listeners = new Set<ProtectSessionListener>();

	getStreamTlsTarget(): ProtectStreamTlsTarget | null {
		return this.target;
	}

	onSessionChange(listener: ProtectSessionListener): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	endSession(reason: 'lost' | 'stopped' = 'lost'): void {
		this.target = null;
		this.listeners.forEach((listener) => listener(null, reason));
	}

	startSession(target: ProtectStreamTlsTarget): void {
		this.target = target;
		this.listeners.forEach((listener) => listener({ generation: 2 } as never, null));
	}
}

class FakeGo2rtc {
	status: Go2rtcRelayStatus = { mode: 'managed', state: 'running', reason: null, version: '1.9.15', generation: 1 };
	baseUrl = 'http://127.0.0.1:1984';
	private readonly listeners = new Set<(status: Go2rtcRelayStatus) => void>();

	getStatus(): Go2rtcRelayStatus {
		return { ...this.status };
	}

	getClient(): { baseUrl: string } | null {
		return this.status.state === 'running' ? { baseUrl: this.baseUrl } : null;
	}

	subscribe(listener: (status: Go2rtcRelayStatus) => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	update(patch: Partial<Go2rtcRelayStatus>): void {
		this.status = { ...this.status, ...patch };
		this.listeners.forEach((listener) => listener(this.getStatus()));
	}
}

/** One stubbed verified upstream: the bridge holds `bridgeEnd`, the test plays the console on `consoleEnd`. */
interface FakeUpstream {
	options: ProtectVerifiedTlsOptions;
	consoleEnd: Duplex;
	received: Buffer[];
}

/** A go2rtc stand-in that never touches the network: the test emits it as an accepted connection. */
const fakePeer = (remoteAddress: string): { bridgeEnd: Duplex; peerEnd: Duplex; received: Buffer[] } => {
	const [bridgeEnd, peerEnd] = duplexPair();
	const received: Buffer[] = [];

	Object.defineProperty(bridgeEnd, 'remoteAddress', { value: remoteAddress });
	peerEnd.on('data', (chunk: Buffer) => received.push(chunk));
	peerEnd.on('error', () => undefined);

	return { bridgeEnd, peerEnd, received };
};

describe('ProtectStreamBridgeService', () => {
	let connector: FakeConnector;
	let go2rtc: FakeGo2rtc;
	let pluginConfig: { enabled: boolean; streamHostOverride: string | null };
	let service: ProtectStreamBridgeService;
	let upstreams: FakeUpstream[];
	let logged: string[];
	let clients: net.Socket[];

	const build = (trustedCa?: string): ProtectStreamBridgeService => {
		const created = new ProtectStreamBridgeService(
			connector as unknown as ProtectConnectorService,
			go2rtc as unknown as Go2rtcService,
			{ getPluginConfig: jest.fn(() => pluginConfig) } as unknown as ConfigService,
			trustedCa,
		);

		created.onModuleInit();

		return created;
	};

	const servers = (): net.Server[] => createServerMock.mock.results.map((result) => result.value as net.Server);
	const openServers = (): net.Server[] => servers().filter((server) => server.listening);

	/** Upstream connections of accepted go2rtc connections (the pre-flight ones are destroyed by the bridge). */
	const verifiedUpstream = (): FakeUpstream => {
		const found = upstreams.at(-1);

		if (found === undefined) {
			throw new Error('no upstream');
		}

		return found;
	};

	const connectClient = async (port: number): Promise<{ socket: net.Socket; received: Buffer[]; closed: boolean }> => {
		const realConnect = jest.requireActual<typeof net>('net').connect;
		const socket = realConnect({ host: '127.0.0.1', port });
		const state = { socket, received: [] as Buffer[], closed: false };

		clients.push(socket);
		socket.on('data', (chunk: Buffer) => state.received.push(chunk));
		socket.on('error', () => undefined);
		socket.on('close', () => {
			state.closed = true;
		});

		await new Promise<void>((resolve) => socket.once('connect', () => resolve()));

		return state;
	};

	beforeEach(() => {
		connector = new FakeConnector();
		go2rtc = new FakeGo2rtc();
		pluginConfig = { enabled: true, streamHostOverride: null };
		upstreams = [];
		clients = [];
		logged = [];

		for (const level of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
			});
		}

		createServerMock.mockClear();
		netConnectMock.mockClear();
		lookupMock.mockReset();
		connectMock.mockReset();
		connectMock.mockImplementation((options) => {
			const [bridgeEnd, consoleEnd] = duplexPair();
			const upstream: FakeUpstream = { options, consoleEnd, received: [] };

			consoleEnd.on('data', (chunk: Buffer) => upstream.received.push(chunk));
			consoleEnd.on('error', () => undefined);
			upstreams.push(upstream);

			return Promise.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });
		});

		service = build();
	});

	afterEach(async () => {
		clients.forEach((socket) => socket.destroy());
		await service.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	describe('listener address', () => {
		it('binds loopback for a managed relay', async () => {
			const endpoint = await service.prepare(PORT);

			expect(endpoint.host).toBe('127.0.0.1');
			expect(openServers()).toHaveLength(1);
			expect((openServers()[0].address() as AddressInfo).address).toBe('127.0.0.1');
			expect((openServers()[0].address() as AddressInfo).port).toBe(endpoint.port);
			expect(netConnectMock).not.toHaveBeenCalled();
		});

		it('binds loopback for an external relay on localhost', async () => {
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://127.0.0.1:1984';

			const endpoint = await service.prepare(PORT);

			expect(endpoint.host).toBe('127.0.0.1');
			expect((openServers()[0].address() as AddressInfo).address).toBe('127.0.0.1');
			// A loopback relay needs no probe and no allow-list.
			expect(netConnectMock).not.toHaveBeenCalled();
			expect(lookupMock).not.toHaveBeenCalled();
		});

		it("admits only the external relay's addresses", async () => {
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://relay.lan:1984';
			// The probe learns the local address the backend uses to reach the relay; loopback stands in for it here.
			netConnectMock.mockImplementationOnce(() => {
				const probe = Object.assign(new EventEmitter(), {
					localAddress: '127.0.0.1',
					remoteAddress: '::ffff:192.0.2.50',
					destroy: jest.fn(),
					setTimeout: jest.fn(),
				});

				setImmediate(() => probe.emit('connect'));

				return probe;
			});
			lookupMock.mockResolvedValue([{ address: '192.0.2.50', family: 4 }]);

			const endpoint = await service.prepare(PORT);

			expect(netConnectMock).toHaveBeenCalledWith(expect.objectContaining({ host: 'relay.lan', port: 1984 }));
			expect(lookupMock).toHaveBeenCalledWith('relay.lan', { all: true });
			expect(endpoint.host).toBe('127.0.0.1');

			const preflights = upstreams.length;
			const [server] = openServers();
			const stranger = fakePeer('192.0.2.51');

			server.emit('connection', stranger.bridgeEnd);

			// Checked synchronously, in the same tick as `connection`: nothing else ran for this peer.
			expect(stranger.bridgeEnd.destroyed).toBe(true);

			await tick();

			expect(upstreams).toHaveLength(preflights);
			expect(linesWith(logged, 'UniFi Protect stream bridge refused a connection (peer)')).not.toHaveLength(0);

			// A real loopback client is no relay address either.
			const local = await connectClient(endpoint.port);

			await waitFor(() => local.closed);

			expect(upstreams).toHaveLength(preflights);

			const relay = fakePeer('::ffff:192.0.2.50');

			server.emit('connection', relay.bridgeEnd);
			await waitFor(() => upstreams.length === preflights + 1);

			relay.peerEnd.write(OPTIONS_REQUEST);
			await waitFor(() => verifiedUpstream().received.length > 0);
			verifiedUpstream().consoleEnd.write(OK_ANSWER);
			await waitFor(() => relay.received.length > 0);

			expect(Buffer.concat(verifiedUpstream().received).toString()).toBe(OPTIONS_REQUEST);
			expect(Buffer.concat(relay.received).toString()).toBe(OK_ANSWER);
		});

		it('infers the probe port from the relay URL scheme', async () => {
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'https://relay.lan';
			netConnectMock.mockImplementationOnce(() => {
				const probe = Object.assign(new EventEmitter(), { destroy: jest.fn(), setTimeout: jest.fn() });

				setImmediate(() => probe.emit('error', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })));

				return probe;
			});

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(netConnectMock).toHaveBeenCalledWith(expect.objectContaining({ host: 'relay.lan', port: 443 }));
		});

		it('fails closed when the external relay address cannot be learnt', async () => {
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://relay.lan:1984';
			netConnectMock.mockImplementationOnce(() => {
				const probe = Object.assign(new EventEmitter(), { destroy: jest.fn(), setTimeout: jest.fn() });

				setImmediate(() => probe.emit('error', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })));

				return probe;
			});

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(openServers()).toHaveLength(0);
			expect(connectMock).not.toHaveBeenCalled();
		});

		it('bounds the external probe by the go2rtc HTTP timeout', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://relay.lan:1984';

			const probe = Object.assign(new EventEmitter(), { destroy: jest.fn(), setTimeout: jest.fn() });

			netConnectMock.mockImplementationOnce(() => probe);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await tick();
			jest.advanceTimersByTime(GO2RTC_HTTP_TIMEOUT_MS);

			await expect(result).resolves.toMatchObject({ category: 'unavailable' });
			expect(probe.destroy).toHaveBeenCalled();
			expect(openServers()).toHaveLength(0);
		});

		it('races the relay lookup against the deadline', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://relay.lan:1984';
			netConnectMock.mockImplementationOnce(() => {
				const probe = Object.assign(new EventEmitter(), {
					localAddress: '127.0.0.1',
					remoteAddress: '192.0.2.50',
					destroy: jest.fn(),
					setTimeout: jest.fn(),
				});

				setImmediate(() => probe.emit('connect'));

				return probe;
			});
			lookupMock.mockReturnValue(new Promise(() => undefined));

			const result = service.prepare(PORT, { deadlineMs: 1500 }).catch((error: unknown) => error);

			await waitFor(() => lookupMock.mock.calls.length > 0);
			jest.advanceTimersByTime(1500);

			await expect(result).resolves.toMatchObject({ category: 'timeout' });
			expect(openServers()).toHaveLength(0);
		});

		it('refuses while the relay is not running', async () => {
			go2rtc.status = { ...go2rtc.status, state: 'starting' };

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(servers()).toHaveLength(0);

			go2rtc.status = { ...go2rtc.status, mode: 'disabled', state: 'running' };

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(servers()).toHaveLength(0);
		});

		it('refuses without a session', async () => {
			connector.target = null;

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(servers()).toHaveLength(0);
			expect(connectMock).not.toHaveBeenCalled();
		});
	});

	describe('listener lifetime', () => {
		it('reuses one listener per relay and upstream port', async () => {
			const first = await service.prepare(PORT);
			const second = await service.prepare(PORT);

			expect(second).toEqual(first);
			expect(servers()).toHaveLength(1);

			const other = await service.prepare({ port: 7442 });

			expect(other.port).not.toBe(first.port);
			expect(openServers()).toHaveLength(2);
		});

		it('opens one listener for concurrent prepares', async () => {
			const [first, second] = await Promise.all([service.prepare(PORT), service.prepare(PORT)]);

			expect(second).toEqual(first);
			expect(servers()).toHaveLength(1);
		});

		it('keeps the port across a session restart and reaches the new upstream', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			connector.endSession();
			await waitFor(() => client.closed);

			expect(openServers()).toHaveLength(1);

			connector.startSession({
				consoleHost: '192.168.1.2',
				tls: { mode: 'verify', serverName: 'console.id.ui.direct', fingerprintSha256: null },
			});

			const again = await service.prepare({ port: 7441 });

			expect(again).toEqual(endpoint);

			await connectClient(endpoint.port);
			await waitFor(() => upstreams.length === 4);

			expect(verifiedUpstream().options).toMatchObject({
				host: '192.168.1.2',
				port: 7441,
				plan: { servername: 'console.id.ui.direct', rejectUnauthorized: true, pinnedFingerprint: null },
			});
		});

		it('destroys connections while no session exists without an upstream connect', async () => {
			const endpoint = await service.prepare(PORT);

			connector.endSession();

			const client = await connectClient(endpoint.port);

			await waitFor(() => client.closed);

			expect(upstreams).toHaveLength(1);
			expect(connectMock).toHaveBeenCalledTimes(1);
			expect(openServers()).toHaveLength(1);
		});

		it('closes connections but keeps the listener when the upstream changes', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			pluginConfig.streamHostOverride = 'streams.example';

			const again = await service.prepare({ port: 7441 });

			expect(again).toEqual(endpoint);
			await waitFor(() => client.closed);
			expect(openServers()).toHaveLength(1);

			await connectClient(endpoint.port);
			await waitFor(() => upstreams.length === 4);

			// The stream goes to the override, but the TLS plan stays the session's (no SNI for an IP console, the pin).
			expect(verifiedUpstream().options).toMatchObject({
				host: 'streams.example',
				port: 7441,
				plan: { servername: undefined, pinnedFingerprint: PIN.toLowerCase() },
			});
		});

		it('refuses a connection while the stored override is invalid', async () => {
			const endpoint = await service.prepare(PORT);

			pluginConfig.streamHostOverride = 'rtsps://x';

			const client = await connectClient(endpoint.port);

			await waitFor(() => client.closed);

			expect(upstreams).toHaveLength(1);
		});

		it('warns once per interval that the stored override is invalid, without the value', () => {
			pluginConfig.streamHostOverride = 'rtsps://SENTINELHOST/x';

			expect(service.getUpstreamHost()).toBeNull();
			expect(service.getUpstreamHost()).toBeNull();

			const warning = 'UniFi Protect stream host override is invalid';

			expect(linesWith(logged, warning)).toHaveLength(1);
			expect(logged.join('\n')).not.toContain('SENTINELHOST');

			const now = Date.now();

			jest.spyOn(Date, 'now').mockReturnValue(now + 61_000);
			service.getUpstreamHost();

			expect(linesWith(logged, warning)).toHaveLength(2);
		});

		it('closes the listener when the relay generation changes', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			go2rtc.update({ generation: 2 });
			await waitFor(() => client.closed);

			expect(openServers()).toHaveLength(0);

			const next = await service.prepare(PORT);

			expect(openServers()).toHaveLength(1);
			expect(next.port).not.toBe(0);
		});

		it.each(['starting', 'unavailable', 'error', 'disabled'] as const)(
			'closes the listener when the relay turns %s',
			async (state) => {
				await service.prepare(PORT);

				go2rtc.update({ state });
				await waitFor(() => openServers().length === 0);
			},
		);

		it('closes the listener when the relay mode changes', async () => {
			await service.prepare(PORT);

			go2rtc.update({ mode: 'external' });
			await waitFor(() => openServers().length === 0);
		});

		it('closes a listener opened after the session ended', async () => {
			const listening = deferred<void>();
			const realCreate = jest.requireActual<typeof net>('net').createServer;

			createServerMock.mockImplementationOnce((...args: Parameters<typeof net.createServer>) => {
				const server = realCreate(...args);
				const listen = (port: number, host: string, callback: () => void): net.Server =>
					net.Server.prototype.listen.call(server, port, host, callback) as net.Server;

				// Holds the listen callback until the test releases it.
				(server as unknown as { listen: (port: number, host: string, callback: () => void) => net.Server }).listen = (
					port,
					host,
					callback,
				) => listen(port, host, () => void listening.promise.then(callback));

				return server;
			});

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => servers().length === 1);
			connector.endSession();
			listening.resolve();

			await expect(result).resolves.toMatchObject({ category: 'unavailable' });
			await waitFor(() => openServers().length === 0);
			expect(connectMock).not.toHaveBeenCalled();
		});

		it('keeps a listener another prepare handed out when a stale prepare ends', async () => {
			const preflightA = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEndA] = duplexPair();

			// A opens the listener in generation 1 and is still in its pre-flight.
			connectMock.mockImplementationOnce(() => preflightA.promise);

			const a = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);

			// The session is lost and comes back; the plugin stays enabled.
			const target = connector.target;

			connector.endSession();
			connector.startSession(target);

			// B, in the new session, reuses the listener and hands its port out.
			const b = await service.prepare(PORT);

			preflightA.resolve({ socket: bridgeEndA as unknown as tls.TLSSocket, fingerprint: PIN });

			await expect(a).resolves.toMatchObject({ category: 'unavailable' });
			expect(openServers()).toHaveLength(1);
			expect((openServers()[0].address() as AddressInfo).port).toBe(b.port);

			const client = await connectClient(b.port);

			await waitFor(() => upstreams.length === 2);
			client.socket.write(OPTIONS_REQUEST);
			await waitFor(() => verifiedUpstream().received.length > 0);

			expect(client.closed).toBe(false);
		});

		it('never returns a listener that closed during the pre-flight', async () => {
			const preflight = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => preflight.promise);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);
			openServers()[0].emit('error', Object.assign(new Error('boom'), { code: 'EMFILE' }));
			preflight.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			await expect(result).resolves.toMatchObject({ category: 'unavailable' });
			await waitFor(() => openServers().length === 0);
		});

		it('closes a listener nobody was handed when its pre-flight fails', async () => {
			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls')),
			);

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
			await waitFor(() => openServers().length === 0);
		});

		it('releases a listener a stray connection pinned once that connection closes', async () => {
			const preflight = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();

			connectMock.mockImplementationOnce(() => preflight.promise);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);

			const port = (openServers()[0].address() as AddressInfo).port;
			const stray = await connectClient(port);

			await waitFor(() => connectMock.mock.calls.length === 2);
			preflight.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls'));
			await expect(result).resolves.toMatchObject({ category: 'tls_fingerprint_mismatch' });
			expect(openServers()).toHaveLength(1);

			stray.socket.destroy();
			await waitFor(() => openServers().length === 0);
		});

		it('rejects a prepare whose upstream host changed meanwhile and keeps the new host connections', async () => {
			const endpoint = await service.prepare(PORT);
			const preflight = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => preflight.promise);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 2);

			pluginConfig.streamHostOverride = 'streams.example';
			service.handleConfigUpdated({ source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, type: 'plugin' });

			const client = await connectClient(endpoint.port);

			await waitFor(() => connectMock.mock.calls.length === 3);
			preflight.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			await expect(result).resolves.toMatchObject({ category: 'unavailable' });
			expect(client.closed).toBe(false);
		});

		it('keeps a handed-out listener when a later pre-flight fails', async () => {
			const endpoint = await service.prepare(PORT);

			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls')),
			);

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
			expect(openServers()).toHaveLength(1);
			expect((openServers()[0].address() as AddressInfo).port).toBe(endpoint.port);
		});

		it('caps the number of listeners', async () => {
			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_LISTENERS; index += 1) {
				await service.prepare({ port: 7441 + index });
			}

			const preflights = connectMock.mock.calls.length;

			await expect(service.prepare({ port: 7441 + PROTECT_STREAM_BRIDGE_MAX_LISTENERS })).rejects.toMatchObject({
				category: 'unavailable',
			});
			expect(openServers()).toHaveLength(PROTECT_STREAM_BRIDGE_MAX_LISTENERS);
			expect(connectMock.mock.calls.length).toBe(preflights);

			// An existing listener is still reused at the cap.
			await expect(service.prepare(PORT)).resolves.toMatchObject({ host: '127.0.0.1' });
		});

		it('closes connections when a config change moves the upstream host', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			// Another extension's change, or one that keeps the host, closes nothing.
			service.handleConfigUpdated({ source: 'devices-other-plugin', type: 'plugin' });
			service.handleConfigUpdated({ source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, type: 'plugin' });

			for (let round = 0; round < 10; round += 1) {
				await tick();
			}

			expect(client.closed).toBe(false);

			pluginConfig.streamHostOverride = 'streams.example';
			service.handleConfigUpdated({ source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, type: 'plugin' });

			await waitFor(() => client.closed);

			expect(openServers()).toHaveLength(1);
			expect(service.getUpstreamHost()).toBe('streams.example');
		});

		it('closes every connection when a config change makes the override invalid', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			pluginConfig.streamHostOverride = 'rtsps://x';
			service.handleConfigUpdated();

			await waitFor(() => client.closed);

			expect(service.getUpstreamHost()).toBeNull();
		});

		it('derives the upstream host itself and records verification under it', async () => {
			expect(service.getUpstreamHost()).toBe(CONSOLE_HOST);

			pluginConfig.streamHostOverride = 'streams.example';

			await service.prepare(PORT);

			expect(upstreams[0].options.host).toBe('streams.example');
			expect(service.getVerification({ host: 'streams.example', port: 7441 })).toBe('verified');
			expect(service.getVerification(UPSTREAM)).toBe('unknown');

			pluginConfig.streamHostOverride = 'rtsps://x';

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(connectMock).toHaveBeenCalledTimes(1);

			connector.target = null;

			expect(service.getUpstreamHost()).toBeNull();
		});

		it('cancels in-flight pre-flights on module destroy', async () => {
			connectMock.mockImplementationOnce(
				(options) =>
					new Promise((_resolve, reject) => {
						options.signal?.addEventListener('abort', () =>
							reject(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls')),
						);
					}),
			);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);
			await service.onModuleDestroy();

			expect(connectMock.mock.calls[0][0].signal?.aborted).toBe(true);
			await expect(result).resolves.toBeInstanceOf(ProtectApiError);
			expect(openServers()).toHaveLength(0);
		});

		it('cancels the external probe on module destroy', async () => {
			go2rtc.status = { ...go2rtc.status, mode: 'external' };
			go2rtc.baseUrl = 'http://relay.lan:1984';

			const probe = Object.assign(new EventEmitter(), { destroy: jest.fn(), setTimeout: jest.fn() });

			netConnectMock.mockImplementationOnce(() => probe);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => netConnectMock.mock.calls.length === 1);
			await service.onModuleDestroy();

			expect(probe.destroy).toHaveBeenCalled();
			await expect(result).resolves.toMatchObject({ category: 'cancelled' });
			expect(servers()).toHaveLength(0);
		});

		it('closes a listener whose bind completes after module destroy', async () => {
			const listening = deferred<void>();
			const realCreate = jest.requireActual<typeof net>('net').createServer;

			createServerMock.mockImplementationOnce((...args: Parameters<typeof net.createServer>) => {
				const server = realCreate(...args);
				const listen = (port: number, host: string, callback: () => void): net.Server =>
					net.Server.prototype.listen.call(server, port, host, callback) as net.Server;

				(server as unknown as { listen: (port: number, host: string, callback: () => void) => net.Server }).listen = (
					port,
					host,
					callback,
				) => listen(port, host, () => void listening.promise.then(callback));

				return server;
			});

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => servers().length === 1 && servers()[0].listening);

			const destroying = service.onModuleDestroy();

			listening.resolve();
			await destroying;

			expect(openServers()).toHaveLength(0);
			// Destroy aborts the bind wait like any other step of a prepare (the pre-flight case above is `cancelled` too).
			await expect(result).resolves.toMatchObject({ category: 'cancelled' });
			expect(connectMock).not.toHaveBeenCalled();
		});

		const holdNextBind = (): { release: () => void } => {
			const listening = deferred<void>();
			const realCreate = jest.requireActual<typeof net>('net').createServer;

			createServerMock.mockImplementationOnce((...args: Parameters<typeof net.createServer>) => {
				const server = realCreate(...args);
				const listen = (port: number, host: string, callback: () => void): net.Server =>
					net.Server.prototype.listen.call(server, port, host, callback) as net.Server;

				(server as unknown as { listen: (port: number, host: string, callback: () => void) => net.Server }).listen = (
					port,
					host,
					callback,
				) => listen(port, host, () => void listening.promise.then(callback));

				return server;
			});

			return { release: () => listening.resolve() };
		};

		it('settles a prepare cancelled while its listener is still binding', async () => {
			const bind = holdNextBind();
			const controller = new AbortController();
			const result = service.prepare(PORT, { signal: controller.signal }).catch((error: unknown) => error);

			await waitFor(() => servers().length === 1 && servers()[0].listening);

			controller.abort();

			await expect(result).resolves.toMatchObject({ category: 'cancelled' });
			expect(connectMock).not.toHaveBeenCalled();

			bind.release();

			// Nobody holds the late listener: it is closed rather than left open for a port squatter's benefit.
			await waitFor(() => openServers().length === 0);
		});

		it('settles a prepare whose deadline passes while its listener is still binding', async () => {
			const bind = holdNextBind();
			const result = service.prepare(PORT, { deadlineMs: 50 }).catch((error: unknown) => error);

			await expect(result).resolves.toMatchObject({ category: 'timeout' });
			expect(connectMock).not.toHaveBeenCalled();

			bind.release();

			await waitFor(() => openServers().length === 0);
		});

		it('keeps a late listener that another prepare is still waiting for', async () => {
			const bind = holdNextBind();
			const controller = new AbortController();
			const abandoned = service.prepare(PORT, { signal: controller.signal }).catch((error: unknown) => error);
			const waiting = service.prepare(PORT);

			await waitFor(() => servers().length === 1 && servers()[0].listening);

			controller.abort();
			await expect(abandoned).resolves.toMatchObject({ category: 'cancelled' });

			bind.release();

			const endpoint = await waiting;

			expect(openServers()).toHaveLength(1);
			expect(endpoint.port).toBe(
				servers()[0].address() === null ? -1 : (servers()[0].address() as net.AddressInfo).port,
			);
		});

		it('closes the listeners when the plugin is disabled', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			pluginConfig.enabled = false;
			connector.endSession('stopped');

			await waitFor(() => client.closed && openServers().length === 0);
		});

		it('releases every listener and connection on module destroy', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);
			await service.onModuleDestroy();

			expect(client.closed || (await waitFor(() => client.closed), true)).toBe(true);
			expect(openServers()).toHaveLength(0);
			expect(service.connectionCount).toBe(0);
			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
		});

		it('closes the listener when the server fails', async () => {
			await service.prepare(PORT);

			openServers()[0].emit('error', Object.assign(new Error('boom'), { code: 'EMFILE' }));

			await waitFor(() => openServers().length === 0);
		});
	});

	describe('connections', () => {
		it('verifies every connection with the session plan and the handshake timeout', async () => {
			service = build('TEST-CA-PEM');

			const endpoint = await service.prepare(PORT);

			await connectClient(endpoint.port);
			await waitFor(() => upstreams.length === 2);

			for (const upstream of upstreams) {
				expect(upstream.options).toMatchObject({
					host: CONSOLE_HOST,
					port: 7441,
					plan: { servername: undefined, rejectUnauthorized: false, pinnedFingerprint: PIN.toLowerCase() },
					handshakeTimeoutMs: PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
				});
				// System roots plus the extra CA, never a bare CA that would drop them.
				expect(upstream.options.ca).toEqual([...tls.rootCertificates, 'TEST-CA-PEM']);
			}
		});

		it('passes no CA without a trusted test CA', async () => {
			await service.prepare(PORT);

			expect(upstreams[0].options.ca).toBeUndefined();
		});

		it('refuses the seventeenth connection', async () => {
			const endpoint = await service.prepare(PORT);
			const open: { closed: boolean }[] = [];

			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS; index += 1) {
				open.push(await connectClient(endpoint.port));
			}

			await waitFor(() => service.connectionCount === PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS);

			const refused = await connectClient(endpoint.port);

			await waitFor(() => refused.closed);

			expect(open.every((client) => !client.closed)).toBe(true);
			expect(upstreams).toHaveLength(1 + PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS);
			expect(linesWith(logged, 'UniFi Protect stream bridge refused a connection (limit)')).toHaveLength(1);
		});

		it('limits the handshake rate', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

			const endpoint = await service.prepare(PORT);
			const [server] = openServers();

			connectMock.mockImplementation(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.UNREACHABLE, 'tls')),
			);

			// One at a time, each failing before the next, so the connection cap never applies.
			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES; index += 1) {
				server.emit('connection', fakePeer('127.0.0.1').bridgeEnd);
				await waitFor(() => service.connectionCount === 0);
			}

			const calls = connectMock.mock.calls.length;
			const extra = fakePeer('127.0.0.1');

			server.emit('connection', extra.bridgeEnd);
			await tick();

			expect(extra.bridgeEnd.destroyed).toBe(true);
			expect(connectMock.mock.calls.length).toBe(calls);
			expect(linesWith(logged, 'UniFi Protect stream bridge refused a connection (rate)')).not.toHaveLength(0);

			jest.advanceTimersByTime(PROTECT_STREAM_BRIDGE_HANDSHAKE_WINDOW_MS);

			server.emit('connection', fakePeer('127.0.0.1').bridgeEnd);
			await tick();

			expect(connectMock.mock.calls.length).toBe(calls + 1);
			expect(endpoint.port).toBeGreaterThan(0);
		});

		it('closes an idle connection after 60 s', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

			await service.prepare(PORT);

			const peer = fakePeer('127.0.0.1');

			openServers()[0].emit('connection', peer.bridgeEnd);
			await waitFor(() => upstreams.length === 2);
			await tick();

			jest.advanceTimersByTime(PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS - 1);
			peer.peerEnd.write(OPTIONS_REQUEST);
			await waitFor(() => verifiedUpstream().received.length > 0);

			jest.advanceTimersByTime(1);
			await tick();

			expect(peer.bridgeEnd.destroyed).toBe(false);

			jest.advanceTimersByTime(PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS - 2);
			verifiedUpstream().consoleEnd.write(OK_ANSWER);
			await waitFor(() => peer.received.length > 0);

			jest.advanceTimersByTime(PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS - 1);
			await tick();

			expect(peer.bridgeEnd.destroyed).toBe(false);

			jest.advanceTimersByTime(1);
			await waitFor(() => peer.bridgeEnd.destroyed);

			expect(service.connectionCount).toBe(0);
			expect(linesWith(logged, 'UniFi Protect stream bridge closed a connection (idle)')).not.toHaveLength(0);
		});

		it('reads nothing from go2rtc before the upstream is verified', async () => {
			const endpoint = await service.prepare(PORT);
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd, consoleEnd] = duplexPair();
			const received: Buffer[] = [];
			const accepted: net.Socket[] = [];

			consoleEnd.on('data', (chunk: Buffer) => received.push(chunk));
			connectMock.mockImplementationOnce(() => verification.promise);
			openServers()[0].on('connection', (socket: net.Socket) => accepted.push(socket));

			const client = await connectClient(endpoint.port);

			client.socket.write('OPTIONS first ');
			client.socket.write(`rtsp://x/${ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n`);
			await waitFor(() => accepted.length === 1 && connectMock.mock.calls.length === 2);

			for (let round = 0; round < 20; round += 1) {
				await tick();
			}

			expect(accepted[0].bytesRead).toBe(0);
			expect(received).toHaveLength(0);

			verification.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			await waitFor(() => Buffer.concat(received).toString().endsWith('\r\n\r\n'));

			expect(Buffer.concat(received).toString()).toBe(`OPTIONS first rtsp://x/${ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n`);
		});

		it('never forwards a byte when a connection fails verification', async () => {
			const endpoint = await service.prepare(PORT);

			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls')),
			);

			const client = await connectClient(endpoint.port);

			client.socket.write(OPTIONS_REQUEST);
			await waitFor(() => client.closed);

			expect(client.received).toHaveLength(0);
			expect(connectMock).toHaveBeenCalledTimes(2);
			expect(service.getVerification(UPSTREAM)).toBe('unverified');
			expect(linesWith(logged, 'UniFi Protect stream bridge refused a connection (tls)')).not.toHaveLength(0);
		});

		it('closes both sides on a redirect from the console', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			client.socket.write(OPTIONS_REQUEST);
			await waitFor(() => verifiedUpstream().received.length > 0);
			verifiedUpstream().consoleEnd.write(
				'RTSP/1.0 302 Found\r\nCSeq: 1\r\nLocation: rtsps://192.0.2.10:7441/x\r\n\r\n',
			);

			await waitFor(() => client.closed);

			expect(client.received).toHaveLength(0);
			expect(verifiedUpstream().consoleEnd.destroyed || verifiedUpstream().consoleEnd.writableEnded).toBe(true);
			expect(linesWith(logged, 'UniFi Protect stream bridge closed a connection (redirect)')).not.toHaveLength(0);
		});

		it('ends both sides when go2rtc closes its side', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			client.socket.end();

			await waitFor(() => service.connectionCount === 0);
		});

		it('ends both sides when the console closes its side', async () => {
			const endpoint = await service.prepare(PORT);
			const client = await connectClient(endpoint.port);

			await waitFor(() => upstreams.length === 2);

			verifiedUpstream().consoleEnd.end();

			await waitFor(() => client.closed && service.connectionCount === 0);
		});
	});

	describe('verification', () => {
		it('reports verification per upstream', async () => {
			expect(service.getVerification(UPSTREAM)).toBe('unknown');

			await service.prepare(PORT);

			expect(service.getVerification(UPSTREAM)).toBe('verified');
			expect(service.getVerification({ host: CONSOLE_HOST, port: 7442 })).toBe('unknown');

			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls')),
			);

			await expect(service.prepare({ port: 7442 })).rejects.toMatchObject({
				category: 'tls_fingerprint_mismatch',
			});

			expect(service.getVerification({ host: CONSOLE_HOST, port: 7442 })).toBe('unverified');
			expect(service.getVerification(UPSTREAM)).toBe('verified');
			expect(service.getVerification({ host: '192.168.1.9', port: 7442 })).toBe('unknown');
		});

		it('records nothing for a pre-flight that could not reach the console', async () => {
			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.UNREACHABLE, 'tls')),
			);

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unreachable' });
			expect(service.getVerification(UPSTREAM)).toBe('unknown');
		});

		it('forgets a failed verification after 60 s', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
			connectMock.mockImplementationOnce(() =>
				Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_UNTRUSTED, 'tls')),
			);

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'tls_untrusted' });

			jest.advanceTimersByTime(PROTECT_STREAM_AVAILABILITY_TTL_MS - 1);

			expect(service.getVerification(UPSTREAM)).toBe('unverified');

			jest.advanceTimersByTime(1);

			expect(service.getVerification(UPSTREAM)).toBe('unknown');
		});

		it('forgets every result when the session ends', async () => {
			await service.prepare(PORT);

			connector.endSession();

			expect(service.getVerification(UPSTREAM)).toBe('unknown');
		});

		it('bounds each caller by its own budget and signal, not the shared handshake', async () => {
			await service.prepare(PORT, { deadlineMs: 1200 });

			// The shared handshake runs with the full timeout; the caller's deadline is enforced on its own wait.
			expect(upstreams[0].options.handshakeTimeoutMs).toBe(PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS);

			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const controller = new AbortController();

			connectMock.mockImplementationOnce(() => verification.promise);

			const waiting = service.prepare(PORT, { signal: controller.signal }).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 2);
			expect(connectMock.mock.calls[1][0].signal?.aborted).toBe(false);
			controller.abort();

			await expect(waiting).resolves.toMatchObject({ category: 'cancelled' });
			await waitFor(() => connectMock.mock.calls[1][0].signal?.aborted === true);
		});

		it('times a short-deadline caller out alone while a longer joiner is verified', async () => {
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => verification.promise);

			const short = service.prepare(PORT, { deadlineMs: 50 }).catch((error: unknown) => error);
			const long = service.prepare(PORT, { deadlineMs: 5000 });

			await waitFor(() => connectMock.mock.calls.length === 1);
			await expect(short).resolves.toMatchObject({ category: 'timeout' });

			expect(connectMock.mock.calls[0][0].handshakeTimeoutMs).toBe(PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS);
			expect(connectMock.mock.calls[0][0].signal?.aborted).toBe(false);

			verification.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			await expect(long).resolves.toMatchObject({ host: '127.0.0.1' });
			expect(connectMock).toHaveBeenCalledTimes(1);
		});

		it('stops counting a waiter whose deadline passed, so the last waiter aborts the handshake', async () => {
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const controller = new AbortController();

			connectMock.mockImplementationOnce(() => verification.promise);

			const short = service.prepare(PORT, { deadlineMs: 50 }).catch((error: unknown) => error);
			const remaining = service.prepare(PORT, { signal: controller.signal }).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);
			await expect(short).resolves.toMatchObject({ category: 'timeout' });
			await tick();
			expect(connectMock.mock.calls[0][0].signal?.aborted).toBe(false);

			controller.abort();

			await expect(remaining).resolves.toMatchObject({ category: 'cancelled' });
			await waitFor(() => connectMock.mock.calls[0][0].signal?.aborted === true);
		});

		it('leaves no abort listener on the service lifetime after settled prepares', async () => {
			const lifetime = (service as unknown as { lifetime: AbortController }).lifetime.signal;
			const baseline = getEventListeners(lifetime, 'abort').length;

			for (let index = 0; index < 5; index += 1) {
				await service.prepare(PORT);
			}

			await tick();
			expect(getEventListeners(lifetime, 'abort').length).toBe(baseline);
		});

		it('rejects at once when no budget is left', async () => {
			await expect(service.prepare(PORT, { deadlineMs: 0 })).rejects.toMatchObject({ category: 'timeout' });
			expect(connectMock).not.toHaveBeenCalled();
		});

		it('makes one pre-flight handshake for concurrent prepares of one port', async () => {
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => verification.promise);

			const results = Array.from({ length: 40 }, () => service.prepare(PORT));

			await waitFor(() => connectMock.mock.calls.length === 1);
			await tick();
			verification.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			const endpoints = await Promise.all(results);

			expect(connectMock).toHaveBeenCalledTimes(1);
			expect(new Set(endpoints.map((endpoint) => endpoint.port)).size).toBe(1);
			expect(service.getVerification(UPSTREAM)).toBe('verified');
		});

		it('shares a failed handshake and lets a joiner give up on its own signal', async () => {
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const controller = new AbortController();

			connectMock.mockImplementationOnce(() => verification.promise);

			const patient = service.prepare(PORT).catch((error: unknown) => error);
			const impatient = service.prepare(PORT, { signal: controller.signal }).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);
			controller.abort();

			await expect(impatient).resolves.toMatchObject({ category: 'cancelled' });

			verification.reject(new ProtectApiError(ProtectErrorCategory.UNREACHABLE, 'tls'));

			await expect(patient).resolves.toMatchObject({ category: 'unreachable' });
			expect(connectMock).toHaveBeenCalledTimes(1);
		});

		it('counts pre-flights toward the handshake allowance', async () => {
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES; index += 1) {
				// Alternating ports keep every pre-flight separate from the last without reaching the listener cap.
				await service.prepare({ port: 7441 + (index % PROTECT_STREAM_BRIDGE_MAX_LISTENERS) });
				service.handleConfigUpdated();
			}

			// A completed pre-flight is not joined: each one above made (and consumed) its own handshake.
			expect(connectMock).toHaveBeenCalledTimes(PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES);

			await expect(service.prepare(PORT)).rejects.toMatchObject({ category: 'unavailable' });
			expect(connectMock).toHaveBeenCalledTimes(PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES);

			jest.advanceTimersByTime(PROTECT_STREAM_BRIDGE_HANDSHAKE_WINDOW_MS);

			await expect(service.prepare(PORT)).resolves.toMatchObject({ host: '127.0.0.1' });
			expect(connectMock).toHaveBeenCalledTimes(PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES + 1);
		});

		it('holds a connection slot during a pre-flight and releases it afterwards', async () => {
			const endpoint = await service.prepare(PORT);
			const open: { closed: boolean }[] = [];

			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS - 1; index += 1) {
				open.push(await connectClient(endpoint.port));
			}

			await waitFor(() => service.connectionCount === PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS - 1);

			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => verification.promise);

			// Fifteen connections plus this pre-flight fill the cap, so the next connection is refused.
			const pending = service.prepare({ port: 7442 });

			await waitFor(() => connectMock.mock.calls.length === 1 + (PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS - 1) + 1);

			const refused = await connectClient(endpoint.port);
			const another = await connectClient(endpoint.port);

			await waitFor(() => refused.closed && another.closed);
			expect(linesWith(logged, 'UniFi Protect stream bridge refused a connection (limit)')).not.toHaveLength(0);

			verification.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });
			await pending;

			// The slot is free again: one more connection is accepted.
			const accepted = await connectClient(endpoint.port);

			await waitFor(() => service.connectionCount === PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS);
			expect(accepted.closed).toBe(false);
		});

		it('rejects a prepare at the connection cap without a handshake', async () => {
			const endpoint = await service.prepare(PORT);

			for (let index = 0; index < PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS; index += 1) {
				await connectClient(endpoint.port);
			}

			await waitFor(() => service.connectionCount === PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS);

			const calls = connectMock.mock.calls.length;

			await expect(service.prepare({ port: 7442 })).rejects.toMatchObject({ category: 'unavailable' });
			expect(connectMock.mock.calls.length).toBe(calls);
		});

		it('rejects a pre-flight whose session ended meanwhile', async () => {
			const verification = deferred<Awaited<ReturnType<typeof connectVerifiedProtectTls>>>();
			const [bridgeEnd] = duplexPair();

			connectMock.mockImplementationOnce(() => verification.promise);

			const result = service.prepare(PORT).catch((error: unknown) => error);

			await waitFor(() => connectMock.mock.calls.length === 1);
			connector.endSession();
			verification.resolve({ socket: bridgeEnd as unknown as tls.TLSSocket, fingerprint: PIN });

			await expect(result).resolves.toMatchObject({ category: 'unavailable' });
			expect(bridgeEnd.destroyed).toBe(true);
			expect(service.getVerification(UPSTREAM)).toBe('unknown');
		});
	});

	it('never logs an address, a request line or an alias', async () => {
		const endpoint = await service.prepare(PORT);
		const client = await connectClient(endpoint.port);

		await waitFor(() => upstreams.length === 2);
		client.socket.write(OPTIONS_REQUEST);
		await waitFor(() => verifiedUpstream().received.length > 0);
		verifiedUpstream().consoleEnd.write(
			`RTSP/1.0 302 Found\r\nCSeq: 1\r\nLocation: rtsps://127.0.0.1:7441/${ALIAS}\r\n\r\n`,
		);
		await waitFor(() => client.closed);

		connectMock.mockImplementationOnce(() =>
			Promise.reject(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls')),
		);

		const refused = await connectClient(endpoint.port);

		refused.socket.write(OPTIONS_REQUEST);
		await waitFor(() => refused.closed);

		expect(logged.length).toBeGreaterThan(0);

		const material = logged.join('\n');

		expect(material).not.toContain('SENTINELALIAS');
		expect(material).not.toContain('rtsp://');
		expect(material).not.toContain('rtsps://');
		expect(material).not.toContain('127.0.0.1');
		expect(material).not.toContain(CONSOLE_HOST);
		expect(material).not.toContain(String(endpoint.port));
	});
});
