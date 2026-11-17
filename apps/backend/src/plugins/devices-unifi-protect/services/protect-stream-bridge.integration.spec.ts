import * as net from 'net';

import { Logger } from '@nestjs/common';

import { FAKE_PROTECT_ALIAS, FakeProtectServer } from '../../../../test/support/fake-protect-server';
import { PROTECT_TEST_DIRECT_DOMAIN, PROTECT_TEST_TLS } from '../../../../test/support/protect-tls';
import { Go2rtcRelayStatus, Go2rtcService } from '../../../modules/cameras/services/go2rtc.service';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ProtectTlsSettings } from '../client/protect-tls-policy';

import { ProtectConnectorService, ProtectStreamTlsTarget } from './protect-connector.service';
import { ProtectBridgeEndpoint, ProtectStreamBridgeService } from './protect-stream-bridge.service';

// Real loopback sockets only: the fake console's TLS RTSP endpoint and a raw `net` client playing go2rtc.

const PINNED: ProtectTlsSettings = {
	mode: 'pinned',
	serverName: null,
	fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned,
};
const VERIFY: ProtectTlsSettings = { mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null };

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function waitFor(predicate: () => boolean, rounds = 2000): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		if (predicate()) {
			return;
		}

		await tick();
	}

	throw new Error('condition not reached');
}

interface RawClient {
	socket: net.Socket;
	received: Buffer[];
	closed: boolean;
	error: string | null;
}

/** Plays go2rtc: connects to the bridge and writes its first request at once, before any verification could end. */
function go2rtcClient(endpoint: ProtectBridgeEndpoint, request: string): Promise<RawClient> {
	return new Promise((resolve) => {
		const socket = net.connect({ host: endpoint.host, port: endpoint.port });
		const client: RawClient = { socket, received: [], closed: false, error: null };

		socket.on('data', (chunk: Buffer) => client.received.push(chunk));
		socket.on('error', (error: NodeJS.ErrnoException) => {
			client.error = error.code ?? 'error';
		});
		socket.on('close', () => {
			client.closed = true;
			resolve(client);
		});
		socket.once('connect', () => {
			socket.write(request);
			resolve(client);
		});
	});
}

const optionsRequest = (endpoint: ProtectBridgeEndpoint): string =>
	`OPTIONS rtsp://${endpoint.host}:${endpoint.port}/${FAKE_PROTECT_ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n`;

describe('ProtectStreamBridgeService (loopback integration)', () => {
	let fake: FakeProtectServer;
	let target: ProtectStreamTlsTarget | null;
	let service: ProtectStreamBridgeService | null;
	let clients: net.Socket[];
	let logged: string[];

	const status: Go2rtcRelayStatus = {
		mode: 'managed',
		state: 'running',
		reason: null,
		version: '1.9.15',
		generation: 1,
	};

	const build = (tls: ProtectTlsSettings, trustedCa?: string): ProtectStreamBridgeService => {
		target = { consoleHost: '127.0.0.1', tls };

		const connector = { getStreamTlsTarget: () => target, onSessionChange: () => () => undefined };
		const go2rtc = {
			getStatus: () => ({ ...status }),
			getClient: () => ({ baseUrl: 'http://127.0.0.1:1984' }),
			subscribe: () => () => undefined,
		};
		const configService = { getPluginConfig: () => ({ enabled: true, streamHostOverride: null }) };
		const created = new ProtectStreamBridgeService(
			connector as unknown as ProtectConnectorService,
			go2rtc as unknown as Go2rtcService,
			configService as unknown as ConfigService,
			trustedCa,
		);

		created.onModuleInit();
		service = created;

		return created;
	};

	const connect = async (endpoint: ProtectBridgeEndpoint): Promise<RawClient> => {
		const client = await go2rtcClient(endpoint, optionsRequest(endpoint));

		clients.push(client.socket);

		return client;
	};

	beforeAll(async () => {
		fake = await FakeProtectServer.start({ rtsps: true });
	});

	afterAll(async () => {
		await fake.stop();
	});

	beforeEach(() => {
		fake.reset();
		service = null;
		clients = [];
		logged = [];

		for (const level of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args.map(String).join(' '));
			});
		}
	});

	afterEach(async () => {
		clients.forEach((socket) => socket.destroy());
		await service?.onModuleDestroy();
		jest.restoreAllMocks();

		expect(logged.join('\n')).not.toContain('SENTINELALIAS');
	});

	it('serves stream URLs on its own RTSPS port', () => {
		expect(fake.rtspsPort).toBeGreaterThan(0);
		expect(fake.rtspsPort).not.toBe(7441);
	});

	it('pipes a verified pinned session byte for byte', async () => {
		const bridge = build(PINNED);
		const endpoint = await bridge.prepare({ host: '127.0.0.1', port: fake.rtspsPort });

		expect(endpoint.host).toBe('127.0.0.1');
		expect(bridge.getVerification({ host: '127.0.0.1', port: fake.rtspsPort })).toBe('verified');

		const client = await connect(endpoint);

		await waitFor(() => Buffer.concat(client.received).toString().endsWith('\r\n\r\n'));

		expect(Buffer.concat(client.received).toString()).toBe('RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n');
		// The console got the alias over the verified hop, exactly as go2rtc sent it.
		expect(fake.rtspRequestLines).toEqual([
			`OPTIONS rtsp://${endpoint.host}:${endpoint.port}/${FAKE_PROTECT_ALIAS} RTSP/1.0`,
		]);
		expect(client.closed).toBe(false);
	});

	it('pipes a verified session in verify mode', async () => {
		const bridge = build(VERIFY, PROTECT_TEST_TLS.ca);
		const endpoint = await bridge.prepare({ host: '127.0.0.1', port: fake.rtspsPort });
		const client = await connect(endpoint);

		await waitFor(() => Buffer.concat(client.received).toString().endsWith('\r\n\r\n'));

		expect(Buffer.concat(client.received).toString()).toBe('RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n');
		expect(fake.rtspRequestLines).toHaveLength(1);
		expect(fake.rtspRequestLines[0]).toContain(FAKE_PROTECT_ALIAS);
	});

	it('fails closed on a wrong pin without forwarding a byte', async () => {
		const bridge = build(PINNED);
		const upstream = { host: '127.0.0.1', port: fake.rtspsPort };
		// The listener outlives a failed verification (go2rtc keeps re-dialling its URL); open it while the pin matches.
		const endpoint = await bridge.prepare(upstream);

		fake.set({ rtspsCertificate: 'console' });

		await expect(bridge.prepare(upstream)).rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
		expect(bridge.getVerification(upstream)).toBe('unverified');

		fake.rtspsBytesReceived.length = 0;

		const client = await connect(endpoint);

		await waitFor(() => client.closed);

		expect(client.received).toHaveLength(0);
		expect(fake.rtspRequestLines).toHaveLength(0);
		// Whether or not the console saw the handshake complete, the bridge sent it nothing.
		expect(fake.rtspsBytesReceived.every((bytes) => bytes === 0)).toBe(true);
	});

	it('fails closed on an untrusted certificate in verify mode', async () => {
		const bridge = build(PINNED);
		const upstream = { host: '127.0.0.1', port: fake.rtspsPort };
		const endpoint = await bridge.prepare(upstream);

		// A new session in verify mode, without the test CA: the console certificate does not chain to a trusted root.
		target = { consoleHost: '127.0.0.1', tls: VERIFY };

		await expect(bridge.prepare(upstream)).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(bridge.getVerification(upstream)).toBe('unverified');

		fake.rtspsBytesReceived.length = 0;

		const client = await connect(endpoint);

		await waitFor(() => client.closed);

		expect(client.received).toHaveLength(0);
		expect(fake.rtspRequestLines).toHaveLength(0);
		// The handshake never completed, so not even an empty secure connection reached the console.
		expect(fake.rtspsBytesReceived.every((bytes) => bytes === 0)).toBe(true);
	});

	it('closes both sides on a redirect from the console', async () => {
		const bridge = build(PINNED);
		const endpoint = await bridge.prepare({ host: '127.0.0.1', port: fake.rtspsPort });

		fake.rtspAnswer('RTSP/1.0 302 Found\r\nCSeq: 1\r\nLocation: rtsps://127.0.0.1:7441/x\r\n\r\n');

		const client = await connect(endpoint);

		await waitFor(() => client.closed);

		expect(client.received).toHaveLength(0);
		expect(fake.rtspRequestLines).toHaveLength(1);
		expect(bridge.connectionCount).toBe(0);
	});

	it('releases everything on module destroy', async () => {
		const bridge = build(PINNED);
		const endpoint = await bridge.prepare({ host: '127.0.0.1', port: fake.rtspsPort });
		const open = await connect(endpoint);

		await waitFor(() => open.received.length > 0);
		await bridge.onModuleDestroy();
		await waitFor(() => open.closed);

		const refused = await go2rtcClient(endpoint, optionsRequest(endpoint));

		await waitFor(() => refused.closed);

		expect(refused.error).toBe('ECONNREFUSED');
		expect(bridge.connectionCount).toBe(0);
	});
});
