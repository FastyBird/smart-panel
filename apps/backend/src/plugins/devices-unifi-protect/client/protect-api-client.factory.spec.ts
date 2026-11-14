import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { Test } from '@nestjs/testing';

import { ProtectTestServer, startProtectTestServer } from '../../../../test/support/protect-test-server';
import { PROTECT_TEST_DIRECT_DOMAIN, PROTECT_TEST_TLS } from '../../../../test/support/protect-tls';
import { PROTECT_TRUSTED_CA } from '../devices-unifi-protect.constants';
import { DevicesUnifiProtectPlugin } from '../devices-unifi-protect.plugin';
import { ProtectApiError } from '../errors/protect-api.error';

import {
	DefaultProtectApiClientFactory,
	PROTECT_API_CLIENT_FACTORY,
	ProtectApiClientFactory,
} from './protect-api-client.factory';
import { ProtectApiClient } from './protect-api.client';
import { ProtectRatePacer } from './protect-rate-pacer';

const KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
const fixture = (name: string): string => readFileSync(join(resolve(__dirname, '../__fixtures__'), name), 'utf8');

describe('ProtectApiClientFactory', () => {
	let server: ProtectTestServer | undefined;
	const clients: ProtectApiClient[] = [];

	const fastPacer = (): ProtectRatePacer => new ProtectRatePacer({ sleep: () => Promise.resolve() });

	afterEach(async () => {
		clients.splice(0).forEach((c) => c.close());
		await server?.close();
		server = undefined;
	});

	const create = (
		factory: ProtectApiClientFactory,
		tls: ConstructorParameters<typeof ProtectApiClient>[0]['tls'],
		port: number,
	): ProtectApiClient => {
		const client = factory.create({ host: '127.0.0.1', port, apiKey: KEY, tls, pacer: fastPacer() });

		clients.push(client);

		return client;
	};

	it('is wired in the plugin module with the extra trusted CA left undefined', () => {
		const providers = Reflect.getMetadata('providers', DevicesUnifiProtectPlugin) as unknown[];

		expect(providers).toContain(DefaultProtectApiClientFactory);
		expect(providers).toContainEqual({ provide: PROTECT_TRUSTED_CA, useValue: undefined });
		expect(providers).toContainEqual({
			provide: PROTECT_API_CLIENT_FACTORY,
			useExisting: DefaultProtectApiClientFactory,
		});
	});

	it('resolves without a trusted CA and with a test override', async () => {
		const plain = await Test.createTestingModule({ providers: [DefaultProtectApiClientFactory] }).compile();
		const overridden = await Test.createTestingModule({
			providers: [DefaultProtectApiClientFactory, { provide: PROTECT_TRUSTED_CA, useValue: PROTECT_TEST_TLS.ca }],
		}).compile();

		expect(plain.get(DefaultProtectApiClientFactory)).toBeInstanceOf(DefaultProtectApiClientFactory);
		expect(overridden.get(DefaultProtectApiClientFactory)).toBeInstanceOf(DefaultProtectApiClientFactory);
	});

	it('verifies the CA-signed certificate by the console domain and sends the key only afterwards', async () => {
		server = await startProtectTestServer((_req, res) => res.end(fixture('meta-info.json')));

		const factory = new DefaultProtectApiClientFactory(PROTECT_TEST_TLS.ca);
		const client = create(
			factory,
			{ mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null },
			server.port,
		);

		expect(client.peerFingerprint).toBeNull();
		expect(await client.getMetaInfo()).toEqual({ applicationVersion: '7.3.74' });
		expect(server.requests[0].url).toBe('/proxy/protect/integration/v1/meta/info');
		expect(server.requests[0].headers['x-api-key']).toBe(KEY);
		expect(server.requests[0].headers.accept).toBe('application/json');
		expect(client.peerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.console);
	});

	it('without the extra CA (production) the same console is untrusted and receives nothing', async () => {
		server = await startProtectTestServer((_req, res) => res.end(fixture('meta-info.json')));

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null },
			server.port,
		);
		const error = await client.getMetaInfo().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ProtectApiError);
		expect(error).toMatchObject({ category: 'tls_untrusted', operation: 'meta/info' });
		expect(server.requests).toHaveLength(0);
		expect(JSON.stringify([error, (error as Error).message, (error as Error).stack])).not.toContain(KEY);
	});

	it('a pinned mismatch fails without any request and never retries', async () => {
		server = await startProtectTestServer((_req, res) => res.end('{}'));

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console },
			server.port,
		);

		await expect(client.getMetaInfo()).rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
		expect(server.requests).toHaveLength(0);
		await new Promise((r) => setTimeout(r, 100));
		// One handshake at most (the server may not even register a socket closed right after it): no retry.
		expect(server.secureConnections).toBeLessThanOrEqual(1);
		expect(client.peerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.selfSigned);
	});

	it('gives every client its own agent, so no pooled socket is shared between clients', async () => {
		server = await startProtectTestServer((_req, res) => res.end(fixture('meta-info.json')));

		const pinned = {
			mode: 'pinned' as const,
			serverName: null,
			fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned,
		};
		const factory = new DefaultProtectApiClientFactory();
		const first = create(factory, pinned, server.port);
		const second = create(factory, pinned, server.port);

		await first.getMetaInfo();
		await first.getMetaInfo();
		expect(server.secureConnections).toBe(1);

		await second.getMetaInfo();
		expect(server.secureConnections).toBe(2);
	});

	it('retries once on a keep-alive socket the console closed in the meantime', async () => {
		let handled = 0;

		server = await startProtectTestServer((req, res) => {
			handled += 1;

			if (handled === 2) {
				req.socket.destroy();

				return;
			}

			res.end('[]');
		});

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
			server.port,
		);

		expect(await client.listCameras()).toEqual([]);
		expect(await client.listCameras()).toEqual([]);
		expect(handled).toBe(3);
		expect(server.secureConnections).toBe(2);
	});

	it('close() cancels a call waiting on a silent console and destroys its sockets', async () => {
		server = await startProtectTestServer(() => undefined);

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
			server.port,
		);
		const pending = client.listCameras();

		await new Promise((r) => setTimeout(r, 100));
		client.close();

		await expect(pending).rejects.toMatchObject({ category: 'cancelled' });
	});

	it('times out a silent console after the configured timeout and does not retry', async () => {
		server = await startProtectTestServer(() => undefined);

		const client = factoryClient(server.port, { timeoutMs: 150 });
		const started = Date.now();

		await expect(client.listCameras()).rejects.toMatchObject({ category: 'timeout', operation: 'cameras' });
		expect(Date.now() - started).toBeLessThan(2000);
		expect(server.requests).toHaveLength(1);

		function factoryClient(port: number, extra: { timeoutMs: number }): ProtectApiClient {
			const created = new DefaultProtectApiClientFactory().create({
				host: '127.0.0.1',
				port,
				apiKey: KEY,
				tls: { mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
				pacer: fastPacer(),
				...extra,
			});

			clients.push(created);

			return created;
		}
	});

	it('refuses a body over the JSON cap without retrying it', async () => {
		server = await startProtectTestServer((_req, res) => {
			res.writeHead(200, { 'Content-Length': String(3 * 1024 * 1024) });
			res.end(Buffer.alloc(3 * 1024 * 1024, 0x20));
		});

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
			server.port,
		);

		await expect(client.listCameras()).rejects.toMatchObject({ category: 'protocol', operation: 'cameras' });
		expect(server.requests).toHaveLength(1);
	});

	it('a 429 with Retry-After is retried through the real transport', async () => {
		let handled = 0;

		server = await startProtectTestServer((_req, res) => {
			handled += 1;

			if (handled === 1) {
				res.writeHead(429, { 'Retry-After': '0' });
				res.end('{}');

				return;
			}

			res.end('[]');
		});

		const client = create(
			new DefaultProtectApiClientFactory(),
			{ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
			server.port,
		);

		expect(await client.listCameras()).toEqual([]);
		expect(handled).toBe(2);
	});
});
