import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { AddressInfo } from 'net';
import * as tls from 'tls';

import {
	PROTECT_TEST_DIRECT_DOMAIN,
	PROTECT_TEST_TLS,
	protectTlsServerOptions,
} from '../../../../test/support/protect-tls';
import { ProtectApiError } from '../errors/protect-api.error';

import { ProtectHttpsAgent, inspectProtectCertificate } from './protect-https-agent';
import { ProtectTlsSettings } from './protect-tls-policy';

interface TestServer {
	port: number;
	secureConnections: number;
	requests: number;
	bytesReceived: number;
	close: () => Promise<void>;
}

async function startServer(options: https.ServerOptions = protectTlsServerOptions()): Promise<TestServer> {
	const state = { secureConnections: 0, requests: 0, bytesReceived: 0 };
	const sockets = new Set<net.Socket>();
	const server = https.createServer(options, (_req, res) => {
		state.requests += 1;
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end('ok');
	});

	server.on('secureConnection', (socket: tls.TLSSocket) => {
		state.secureConnections += 1;
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		socket.on('data', (chunk: Buffer) => {
			state.bytesReceived += chunk.length;
		});
		socket.on('error', () => undefined);
	});
	server.on('tlsClientError', () => undefined);

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	return {
		port: (server.address() as AddressInfo).port,
		get secureConnections() {
			return state.secureConnections;
		},
		get requests() {
			return state.requests;
		},
		get bytesReceived() {
			return state.bytesReceived;
		},
		close: () =>
			new Promise<void>((resolve) => {
				sockets.forEach((socket) => socket.destroy());
				server.close(() => resolve());
			}),
	};
}

describe('ProtectHttpsAgent', () => {
	let server: TestServer;
	const agents: ProtectHttpsAgent[] = [];

	beforeEach(async () => {
		server = await startServer();
	});

	afterEach(async () => {
		agents.splice(0).forEach((agent) => agent.destroy());
		await server.close();
	});

	function agentFor(tlsSettings: ProtectTlsSettings, extra: { trustedCa?: string; handshakeTimeoutMs?: number } = {}) {
		const agent = new ProtectHttpsAgent({ host: '127.0.0.1', port: server.port, tls: tlsSettings, ...extra });

		agents.push(agent);

		return agent;
	}

	function get(agent: https.Agent): Promise<{ status: number; body: string }> {
		return new Promise((resolve, reject) => {
			const req = https.get(
				{ host: '127.0.0.1', port: server.port, path: '/', agent, headers: { 'X-API-KEY': 'k' } },
				(res: http.IncomingMessage) => {
					const chunks: Buffer[] = [];

					res.on('data', (chunk: Buffer) => chunks.push(chunk));
					res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
					res.on('error', reject);
				},
			);

			req.on('error', reject);
		});
	}

	it('uses keepAlive with at most four sockets', () => {
		const agent = agentFor({ mode: 'verify', serverName: null, fingerprintSha256: null });

		expect(agent.maxSockets).toBe(4);
		expect(agent.options.keepAlive).toBe(true);
		expect(agent.plan).toEqual({ servername: undefined, rejectUnauthorized: true, pinnedFingerprint: null });
		expect(agent.lastPeerFingerprint).toBeNull();
	});

	it('verify mode with the console domain as SNI trusts the CA-signed certificate', async () => {
		const agent = agentFor(
			{ mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null },
			{ trustedCa: PROTECT_TEST_TLS.ca },
		);

		expect((await get(agent)).status).toBe(200);
		expect(agent.lastPeerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.console);
		expect(server.requests).toBe(1);
	});

	it('verify mode refuses the CA-signed certificate when the CA is not trusted', async () => {
		const agent = agentFor({ mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null });

		await expect(get(agent)).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);
	});

	it('verify mode refuses a self-signed certificate served for another server name', async () => {
		const agent = agentFor(
			{ mode: 'verify', serverName: 'other.id.ui.direct', fingerprintSha256: null },
			{ trustedCa: PROTECT_TEST_TLS.ca },
		);

		await expect(get(agent)).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);
	});

	it('verify mode refuses a CA-signed certificate checked against a different server name', async () => {
		// Every SNI gets the console certificate, so the chain is valid and only the name check can refuse it.
		await server.close();
		server = await startServer({ key: PROTECT_TEST_TLS.console.key, cert: PROTECT_TEST_TLS.console.cert });

		const agent = agentFor(
			{ mode: 'verify', serverName: 'other.id.ui.direct', fingerprintSha256: null },
			{ trustedCa: PROTECT_TEST_TLS.ca },
		);

		await expect(get(agent)).rejects.toMatchObject({ category: 'tls_untrusted' });
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);

		const matching = agentFor(
			{ mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null },
			{ trustedCa: PROTECT_TEST_TLS.ca },
		);

		expect((await get(matching)).status).toBe(200);
	});

	it('verify mode by IP refuses the self-signed certificate before any byte is sent', async () => {
		await expect(get(agentFor({ mode: 'verify', serverName: null, fingerprintSha256: null }))).rejects.toMatchObject({
			category: 'tls_untrusted',
		});
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);
	});

	it('pinned mode accepts the matching self-signed certificate', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned.toUpperCase().replace(/(..)(?!$)/g, '$1:'),
		});

		expect((await get(agent)).status).toBe(200);
		expect(agent.lastPeerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.selfSigned);
		expect(server.requests).toBe(1);
	});

	it('pinned mode refuses another certificate and sends no byte', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console,
		});

		await expect(get(agent)).rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);
		expect(agent.lastPeerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.selfSigned);
	});

	it('pinned mode does not check the chain or the name of the pinned certificate', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: PROTECT_TEST_DIRECT_DOMAIN,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console,
		});

		expect((await get(agent)).status).toBe(200);
		expect(agent.lastPeerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.console);
	});

	it('reports a pinned mismatch as a ProtectApiError whose message holds no fingerprint', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console,
		});
		const error = await get(agent).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ProtectApiError);
		expect((error as ProtectApiError).message).toBe("UniFi Protect request 'tls' failed (tls_fingerprint_mismatch)");
		expect((error as ProtectApiError).message).not.toContain(PROTECT_TEST_TLS.fingerprints.console);
	});

	it('reuses one verified socket for sequential requests', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned,
		});

		expect((await get(agent)).status).toBe(200);
		expect((await get(agent)).status).toBe(200);
		expect(server.requests).toBe(2);
		expect(server.secureConnections).toBe(1);
	});

	it('connects to the configured host and port whatever the request options say', async () => {
		const agent = agentFor({
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned,
		});
		const status = await new Promise<number>((resolve, reject) => {
			const req = https.get({ host: '192.0.2.1', port: 9, path: '/', agent }, (res) => {
				res.resume();
				resolve(res.statusCode ?? 0);
			});

			req.on('error', reject);
		});

		expect(status).toBe(200);
		expect(server.requests).toBe(1);
	});

	it('reports a closed port as unreachable', async () => {
		const port = server.port;

		await server.close();

		const agent = new ProtectHttpsAgent({
			host: '127.0.0.1',
			port,
			tls: { mode: 'verify', serverName: null, fingerprintSha256: null },
		});

		agents.push(agent);
		await expect(
			new Promise((resolve, reject) => {
				https.get({ host: '127.0.0.1', port, path: '/', agent }, resolve).on('error', reject);
			}),
		).rejects.toMatchObject({ category: 'unreachable' });

		server = await startServer();
	});

	it('times out a server that never completes the handshake', async () => {
		const silent = net.createServer((socket) => {
			socket.on('error', () => undefined);
			socket.resume();
		});

		await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));

		const port = (silent.address() as AddressInfo).port;
		const agent = new ProtectHttpsAgent({
			host: '127.0.0.1',
			port,
			tls: { mode: 'verify', serverName: null, fingerprintSha256: null },
			handshakeTimeoutMs: 200,
		});

		agents.push(agent);

		const started = Date.now();

		try {
			await expect(
				new Promise((resolve, reject) => {
					https.get({ host: '127.0.0.1', port, path: '/', agent }, resolve).on('error', reject);
				}),
			).rejects.toMatchObject({ category: 'timeout' });
			expect(Date.now() - started).toBeLessThan(1000);
		} finally {
			await new Promise<void>((resolve) => silent.close(() => resolve()));
		}
	});
});

describe('inspectProtectCertificate', () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startServer();
	});

	afterEach(async () => {
		await server.close();
	});

	it('inspects both SNI variants without sending application data', async () => {
		const byIp = await inspectProtectCertificate({ host: '127.0.0.1', port: server.port, serverName: null });

		expect(byIp).toMatchObject({
			subjectCommonName: 'unifi.local',
			issuerCommonName: 'unifi.local',
			subjectAltNames: ['unifi.local'],
			selfSigned: true,
			trusted: false,
			trustError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned,
		});

		const byDomain = await inspectProtectCertificate({
			host: '127.0.0.1',
			port: server.port,
			serverName: PROTECT_TEST_DIRECT_DOMAIN,
			trustedCa: PROTECT_TEST_TLS.ca,
		});

		expect(byDomain).toMatchObject({
			subjectCommonName: PROTECT_TEST_DIRECT_DOMAIN,
			issuerCommonName: 'Smart Panel Test CA',
			subjectAltNames: [PROTECT_TEST_DIRECT_DOMAIN],
			selfSigned: false,
			trusted: true,
			trustError: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console,
		});
		expect(new Date(byDomain.validFrom).toISOString()).toBe(byDomain.validFrom);
		expect(new Date(byDomain.validTo).getTime()).toBeGreaterThan(Date.now());
		expect(server.requests).toBe(0);
		expect(server.bytesReceived).toBe(0);
	});

	it('reports an untrusted chain when the CA is not trusted', async () => {
		const info = await inspectProtectCertificate({
			host: '127.0.0.1',
			port: server.port,
			serverName: PROTECT_TEST_DIRECT_DOMAIN,
		});

		expect(info).toMatchObject({ trusted: false, trustError: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' });
	});

	it('times out against a silent server', async () => {
		const silent = net.createServer((socket) => {
			socket.on('error', () => undefined);
			socket.resume();
		});

		await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));

		try {
			await expect(
				inspectProtectCertificate({
					host: '127.0.0.1',
					port: (silent.address() as AddressInfo).port,
					serverName: null,
					timeoutMs: 200,
				}),
			).rejects.toMatchObject({ category: 'timeout' });
		} finally {
			await new Promise<void>((resolve) => silent.close(() => resolve()));
		}
	});

	it('reports a refused connection as unreachable', async () => {
		const port = server.port;

		await server.close();
		await expect(inspectProtectCertificate({ host: '127.0.0.1', port, serverName: null })).rejects.toMatchObject({
			category: 'unreachable',
		});

		server = await startServer();
	});
});
