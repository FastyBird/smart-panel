import * as https from 'https';

import { Logger } from '@nestjs/common';

import {
	FAKE_PROTECT_ALIAS,
	FAKE_PROTECT_API_KEY,
	FakeProtectServer,
} from '../../../../test/support/fake-protect-server';
import { PROTECT_TEST_DIRECT_DOMAIN, PROTECT_TEST_TLS } from '../../../../test/support/protect-tls';
import { ProtectApiError } from '../errors/protect-api.error';

import { ProtectApiClient, ProtectApiClientOptions } from './protect-api.client';
import { fetchProtectConsoleSystem } from './protect-console-system';

const CAMERA_ID = '600cefafd5f365d6f83c4ef3';
const BASE = '/proxy/protect/integration/v1';

describe('ProtectApiClient against the fake console', () => {
	let fake: FakeProtectServer;
	let clients: ProtectApiClient[];
	let logged: string[];

	const build = (extra: Partial<ProtectApiClientOptions> = {}): ProtectApiClient => {
		const client = new ProtectApiClient({
			host: fake.host,
			port: fake.port,
			apiKey: FAKE_PROTECT_API_KEY,
			tls: { mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
			...extra,
		});

		clients.push(client);

		return client;
	};

	beforeAll(async () => {
		fake = await FakeProtectServer.start();
	});

	afterAll(async () => {
		await fake.stop();
	});

	beforeEach(() => {
		fake.reset();
		fake.set({
			apiKey: FAKE_PROTECT_API_KEY,
			applicationVersion: null,
			rateLimit: { quota: 10, windowSeconds: 1 },
			hangPaths: [],
		});
		clients = [];
		logged = [];

		for (const level of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
			});
		}
	});

	afterEach(() => {
		clients.forEach((client) => client.close());
		jest.restoreAllMocks();
		expect(logged.join('\n')).not.toContain(FAKE_PROTECT_API_KEY);
		expect(logged.join('\n')).not.toContain(FAKE_PROTECT_ALIAS);
	});

	it('reads every endpoint the client offers', async () => {
		const client = build();

		expect((await client.getMetaInfo()).applicationVersion).toBe('7.3.74');
		expect((await client.getNvr()).modelKey).toBe('nvr');
		expect(await client.listCameras()).toHaveLength(2);
		expect((await client.getCamera(CAMERA_ID)).id).toBe(CAMERA_ID);
		expect((await client.listSensors()).length).toBeGreaterThan(0);
		expect((await client.listLights()).length).toBeGreaterThan(0);

		const streams = await client.getRtspsStreams(CAMERA_ID);

		expect(streams.high).toContain(`:7441/${FAKE_PROTECT_ALIAS}`);
		expect(streams.high).toContain('127.0.0.1');
		expect(streams.medium).toBeNull();

		const snapshot = await client.getSnapshot(CAMERA_ID);

		expect(snapshot.contentType).toBe('image/jpeg');
		expect(snapshot.data.length).toBeGreaterThan(0);
		await expect(client.getSnapshot(CAMERA_ID, { highQuality: true })).rejects.toMatchObject({
			category: 'unsupported',
		});
		expect(fake.requests.every((request) => request.method === 'GET' && request.hadApiKey)).toBe(true);
		expect(fake.requests.map((request) => request.path)).toEqual(
			expect.arrayContaining([
				`${BASE}/meta/info`,
				`${BASE}/nvrs`,
				`${BASE}/cameras`,
				`${BASE}/cameras/${CAMERA_ID}`,
				`${BASE}/sensors`,
				`${BASE}/lights`,
				`${BASE}/cameras/${CAMERA_ID}/rtsps-stream`,
				`${BASE}/cameras/${CAMERA_ID}/snapshot`,
			]),
		);
		expect([fake.writes.length, fake.forbiddenHits]).toEqual([0, 0]);
	});

	it('serves the captured meta-info unless a version is set', async () => {
		fake.set({ applicationVersion: '7.2.1' });

		expect((await build().getMetaInfo()).applicationVersion).toBe('7.2.1');
	});

	it('verifies the console certificate by its direct-connect name with the test CA', async () => {
		const client = build({
			tls: { mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null },
			trustedCa: PROTECT_TEST_TLS.ca,
		});

		expect((await client.getMetaInfo()).applicationVersion).toBe('7.3.74');
		expect(fake.requests[0].servername).toBe(PROTECT_TEST_DIRECT_DOMAIN);
	});

	it('the fake enforces 10-in-1sec like the console', async () => {
		const get = (): Promise<number> =>
			new Promise((resolve, reject) => {
				const req = https.request(
					{
						host: fake.host,
						port: fake.port,
						path: `${BASE}/meta/info`,
						headers: { 'X-API-KEY': FAKE_PROTECT_API_KEY },
						rejectUnauthorized: false,
						agent: false,
					},
					(res) => {
						res.resume();
						res.on('end', () => resolve(res.statusCode ?? 0));
					},
				);

				req.on('error', reject);
				req.end();
			});
		const statuses = await Promise.all(Array.from({ length: 15 }, get));

		expect(statuses.filter((status) => status === 200)).toHaveLength(10);
		expect(statuses.filter((status) => status === 429)).toHaveLength(5);
		expect(fake.rateLimited).toBe(5);
	});

	it('15 parallel reads through one client produce no 429', async () => {
		const client = build();
		const results = await Promise.allSettled(Array.from({ length: 15 }, () => client.getCamera(CAMERA_ID)));

		expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
		expect(fake.rateLimited).toBe(0);
		expect(fake.requests).toHaveLength(15);
	});

	it('recovers from an injected 429 using Retry-After', async () => {
		fake.enqueue(/cameras$/, {
			status: 429,
			headers: { ...JSON_CT, 'retry-after': '1', ratelimit: '"10-in-1sec"; r=0; t=1' },
			body: '{"error":"Too Many Requests","name":"RATE_LIMITED"}',
		});

		const started = Date.now();
		const cameras = await build().listCameras();

		expect(cameras).toHaveLength(2);
		expect(Date.now() - started).toBeGreaterThanOrEqual(980);
		expect(Date.now() - started).toBeLessThan(2500);
		expect(fake.requests).toHaveLength(2);
	});

	it('ends a hung snapshot within its timeout', async () => {
		fake.set({ hangPaths: [/snapshot/] });

		const started = Date.now();

		await expect(build({ timeoutMs: 500, maxAttempts: 1 }).getSnapshot(CAMERA_ID)).rejects.toMatchObject({
			category: 'timeout',
		});
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it('cuts off an oversized body as protocol', async () => {
		fake.enqueue(/meta\/info/, {
			status: 200,
			headers: JSON_CT,
			body: Buffer.alloc(3 * 1024 * 1024, 0x20),
		});

		await expect(build().getMetaInfo()).rejects.toMatchObject({ category: 'protocol' });
	});

	it('reports a wrong key as authentication, once, without leaking either key', async () => {
		const wrongKey = 'WRONG_KEY_SENTINEL_0123456789abcdef';
		const error: unknown = await build({ apiKey: wrongKey })
			.listCameras()
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ProtectApiError);
		expect(error).toMatchObject({ category: 'authentication', status: 401 });

		const dump = `${(error as Error).message} ${JSON.stringify(error)} ${logged.join('\n')}`;

		expect(dump).not.toContain(wrongKey);
		expect(dump).not.toContain(FAKE_PROTECT_API_KEY);
		expect(fake.requests).toHaveLength(1);
	});

	it('reports an unknown camera as not found', async () => {
		await expect(build().getCamera('does-not-exist')).rejects.toMatchObject({ category: 'not_found' });
	});

	it('the fake records writes and forbidden endpoints and answers them 405', async () => {
		const send = (method: string, path: string): Promise<number> =>
			new Promise((resolve, reject) => {
				const req = https.request(
					{
						host: fake.host,
						port: fake.port,
						method,
						path,
						headers: { 'X-API-KEY': FAKE_PROTECT_API_KEY },
						rejectUnauthorized: false,
						agent: false,
					},
					(res) => {
						res.resume();
						res.on('end', () => resolve(res.statusCode ?? 0));
					},
				);

				req.on('error', reject);
				req.end();
			});

		expect(await send('POST', `${BASE}/cameras/${CAMERA_ID}/rtsps-stream`)).toBe(405);
		expect(await send('POST', `${BASE}/cameras/${CAMERA_ID}/disable-mic-permanently`)).toBe(405);
		expect(await send('GET', '/proxy/protect/api')).toBe(401);
		expect(await send('GET', `${BASE}/nothing`)).toBe(404);
		expect(fake.writes).toHaveLength(2);
		expect(fake.forbiddenHits).toBe(1);
	});

	it('fetches the console system without the key', async () => {
		const system = await fetchProtectConsoleSystem({ host: fake.host, port: fake.port });

		expect(system.directConnectDomain).toBe(PROTECT_TEST_DIRECT_DOMAIN);
		expect(fake.requests.find((request) => request.path === '/api/system')?.hadApiKey).toBe(false);
	});
});

const JSON_CT = { 'content-type': 'application/json; charset=utf-8' };
