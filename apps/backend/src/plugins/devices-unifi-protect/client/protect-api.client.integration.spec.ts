import { readFileSync } from 'fs';
import * as https from 'https';
import * as net from 'net';
import { join, resolve as resolvePath } from 'path';

import { Logger } from '@nestjs/common';

import {
	FAKE_PROTECT_ALIAS,
	FAKE_PROTECT_API_KEY,
	FakeProtectServer,
} from '../../../../test/support/fake-protect-server';
import {
	PROTECT_TEST_DIRECT_DOMAIN,
	PROTECT_TEST_TLS,
	protectTlsServerOptions,
} from '../../../../test/support/protect-tls';
import { PROTECT_MAX_FRAME_BYTES } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectApiClient, ProtectApiClientOptions } from './protect-api.client';
import { fetchProtectConsoleSystem } from './protect-console-system';
import { NodeProtectSubscription } from './protect-subscription';

const CAMERA_ID = '600cefafd5f365d6f83c4ef3';
const BASE = '/proxy/protect/integration/v1';
const JSON_CT = { 'content-type': 'application/json; charset=utf-8' };

describe('FakeProtectServer', () => {
	it('stops at once while a client is still negotiating TLS', async () => {
		const server = await FakeProtectServer.start();
		const raw = net.connect(server.port, server.host);

		raw.on('error', () => undefined);
		await new Promise((resolve) => raw.once('connect', resolve));

		const startedAt = Date.now();

		// No TLS bytes are sent, so the connection never reaches `secureConnection`.
		await server.stop();

		expect(Date.now() - startedAt).toBeLessThan(1000);
		raw.destroy();
	});

	it.each(['toString', 'constructor', '__proto__'])('answers 404 for the inherited name %s', async (name) => {
		const server = await FakeProtectServer.start();

		try {
			const status = await new Promise<number | undefined>((resolve, reject) => {
				https
					.get(
						{
							host: server.host,
							port: server.port,
							path: `/proxy/protect/integration/v1/${name}`,
							headers: { 'X-API-KEY': FAKE_PROTECT_API_KEY },
							// The fake console's own self-signed certificate; this request only probes its routing.
							rejectUnauthorized: false,
						},
						(res) => {
							res.resume();
							resolve(res.statusCode);
						},
					)
					.on('error', reject);
			});

			expect(status).toBe(404);
		} finally {
			await server.stop();
		}
	});
});

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

	it('creates a stream on the fake console and reads it back', async () => {
		const client = build();
		const [first] = await client.listCameras();

		fake.setStreams(first.id, []);

		const created = await client.createRtspsStreams(first.id, ['high', 'medium']);

		expect(created.high).toContain('SENTINELALIAS');
		expect(created.medium).toContain('SENTINELALIAS');
		expect(created.low).toBeNull();
		expect(created.package).toBeNull();
		expect(await client.getRtspsStreams(first.id)).toEqual(created);
		expect(fake.streamPosts).toEqual([{ cameraId: first.id, qualities: ['high', 'medium'] }]);
		expect(fake.writes).toHaveLength(1);
	});

	it('keeps already enabled qualities when another quality is added', async () => {
		const client = build();
		const streams = await client.createRtspsStreams(CAMERA_ID, ['medium']);

		expect(streams.high).not.toBeNull();
		expect(streams.medium).not.toBeNull();
	});

	it('serves doorbells and single sensors and lights when configured', async () => {
		const extra = await FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'] });
		const client = new ProtectApiClient({
			host: extra.host,
			port: extra.port,
			apiKey: FAKE_PROTECT_API_KEY,
			tls: { mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
		});

		try {
			expect(await client.listCameras()).toHaveLength(4);
			expect((await client.getCamera('5f0000000000000000000a02')).hasPackageCamera).toBe(true);
			expect((await client.getSensor('5f0000000000000000000b01')).raw._state as string).toBe(
				'idle (closed, no motion, no leak, no tamper)',
			);
			expect((await client.getLight('5f0000000000000000000c01')).cameraId).toBe('600cefafd5f365d6f83c4ef3');
			await expect(client.getSensor('missing')).rejects.toMatchObject({ category: 'not_found' });

			const streams = await client.getRtspsStreams('5f0000000000000000000a01');

			expect(streams).toEqual({ high: null, medium: null, low: null, package: null });
		} finally {
			client.close();
			await extra.stop();
		}
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
		expect(Date.now() - started).toBeLessThan(5000);
		expect(fake.requests).toHaveLength(2);
	});

	it('ends a hung snapshot within its timeout', async () => {
		fake.set({ hangPaths: [/snapshot/] });

		const started = Date.now();

		await expect(build({ timeoutMs: 500, maxAttempts: 1 }).getSnapshot(CAMERA_ID)).rejects.toMatchObject({
			category: 'timeout',
		});
		expect(Date.now() - started).toBeLessThan(5000);
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

		// A POST of the stream endpoint is a real write now; without qualities it is a bad request, any other verb 405.
		expect(await send('POST', `${BASE}/cameras/${CAMERA_ID}/rtsps-stream`)).toBe(400);
		expect(await send('DELETE', `${BASE}/cameras/${CAMERA_ID}/rtsps-stream`)).toBe(405);
		expect(await send('POST', `${BASE}/cameras/${CAMERA_ID}/disable-mic-permanently`)).toBe(405);
		expect(await send('GET', '/proxy/protect/api')).toBe(401);
		expect(await send('GET', `${BASE}/nothing`)).toBe(404);
		expect(fake.writes).toHaveLength(3);
		expect(fake.forbiddenHits).toBe(1);
	});

	it('fetches the console system without the key', async () => {
		const system = await fetchProtectConsoleSystem({ host: fake.host, port: fake.port });

		expect(system.directConnectDomain).toBe(PROTECT_TEST_DIRECT_DOMAIN);
		expect(fake.requests.find((request) => request.path === '/api/system')?.hadApiKey).toBe(false);
	});

	describe('subscriptions', () => {
		const firstLine = (name: string): string =>
			readFileSync(join(resolvePath(__dirname, '../__fixtures__'), name), 'utf8').split('\n')[0];
		const makeHandlers = (): {
			message: jest.Mock<void, [string]>;
			pong: jest.Mock<void, []>;
			closed: jest.Mock<void, [ProtectApiError]>;
		} => ({
			message: jest.fn<void, [string]>(),
			pong: jest.fn<void, []>(),
			closed: jest.fn<void, [ProtectApiError]>(),
		});
		const until = async (predicate: () => boolean): Promise<void> => {
			const startedAt = Date.now();

			while (!predicate()) {
				if (Date.now() - startedAt > 5000) {
					throw new Error('condition not reached');
				}

				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		};

		it('opens both subscriptions with the key and receives text frames', async () => {
			const client = build();
			const devices = makeHandlers();
			const events = makeHandlers();
			const deviceSub = await client.openSubscription('devices', devices);
			const eventSub = await client.openSubscription('events', events);
			const line = firstLine('ws-events.jsonl');

			expect(deviceSub.topic).toBe('devices');
			expect(eventSub.topic).toBe('events');
			expect(fake.upgrades).toHaveLength(2);
			expect(fake.upgrades.every((upgrade) => upgrade.hadApiKey)).toBe(true);
			expect(fake.upgrades.map((upgrade) => upgrade.path)).toEqual([
				`${BASE}/subscribe/devices`,
				`${BASE}/subscribe/events`,
			]);
			expect(fake.requests).toHaveLength(0);

			fake.sendFrame('events', JSON.parse(line));
			await until(() => events.message.mock.calls.length === 1);

			expect(events.message).toHaveBeenCalledWith(line);
			expect(devices.message).not.toHaveBeenCalled();
		});

		it('rejects a subscription that settled during the open handshake and never registers it', async () => {
			const client = build();
			const realOpen = NodeProtectSubscription.open.bind(
				NodeProtectSubscription,
			) as typeof NodeProtectSubscription.open;
			const spy = jest.spyOn(NodeProtectSubscription, 'open').mockImplementationOnce(async (connection) => {
				const opened = await realOpen(connection);

				// An oversized frame processed between the upgrade and the caller's continuation ends the socket.
				opened.close();

				return opened;
			});

			try {
				await expect(client.openSubscription('events', makeHandlers())).rejects.toMatchObject({
					category: ProtectErrorCategory.UNAVAILABLE,
					operation: 'subscribe/events',
				});
				expect((client as unknown as { subscriptions: Set<unknown> }).subscriptions.size).toBe(0);
			} finally {
				spy.mockRestore();
			}
		});

		it('ignores binary frames and reports pongs', async () => {
			const client = build();
			const handlers = makeHandlers();
			const sub = await client.openSubscription('devices', handlers);

			fake.sendRaw('devices', Buffer.from('x'), true);
			sub.ping();
			await until(() => handlers.pong.mock.calls.length === 1);

			expect(handlers.message).not.toHaveBeenCalled();
			expect(fake.pingsReceived).toBe(1);
		});

		it('reports a dropped socket once and nothing after close()', async () => {
			const client = build();
			const dropped = makeHandlers();
			const closedByCaller = makeHandlers();

			await client.openSubscription('devices', dropped);

			const second = await client.openSubscription('events', closedByCaller);

			second.close();
			second.close();
			fake.dropSubscriptions();
			await until(() => dropped.closed.mock.calls.length === 1);
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(dropped.closed).toHaveBeenCalledTimes(1);
			expect(dropped.closed.mock.calls[0][0]).toMatchObject({
				category: ProtectErrorCategory.UNAVAILABLE,
				operation: 'subscribe/devices',
			});
			expect(closedByCaller.closed).not.toHaveBeenCalled();
		});

		it.each([
			[401, 'authentication'],
			[403, 'authorization'],
			[404, 'not_found'],
			[503, 'unavailable'],
		])('maps an upgrade answered %i to %s', async (status, category) => {
			const client = build();

			fake.refuseUpgrades({ status });

			await expect(client.openSubscription('devices', makeHandlers())).rejects.toMatchObject({
				category,
				operation: 'subscribe/devices',
				status,
			});
		});

		it('maps a 429 upgrade with Retry-After and backs the pacer off', async () => {
			const client = build();

			fake.refuseUpgrades({ status: 429, headers: { 'retry-after': '2' } });

			const failure = (await client
				.openSubscription('events', makeHandlers())
				.catch((e: unknown) => e)) as ProtectApiError;

			expect(failure.category).toBe(ProtectErrorCategory.RATE_LIMITED);
			expect(failure.retryAfterMs).toBeGreaterThanOrEqual(1900);
			expect(failure.retryAfterMs).toBeLessThanOrEqual(2000);

			// The pacer is paused, so a cancelled wait (not an upgrade) is what the next open sees.
			const controller = new AbortController();
			const next = client.openSubscription('events', makeHandlers(), { signal: controller.signal });

			setTimeout(() => controller.abort(), 100);

			await expect(next).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			expect(fake.upgrades).toHaveLength(1);
		});

		it('backs the pacer off by the base delay for a 429 upgrade without Retry-After', async () => {
			const client = build();

			fake.refuseUpgrades({ status: 429 });

			await expect(client.openSubscription('events', makeHandlers())).rejects.toMatchObject({
				category: ProtectErrorCategory.RATE_LIMITED,
				retryAfterMs: null,
			});

			const controller = new AbortController();
			const next = client.openSubscription('events', makeHandlers(), { signal: controller.signal });

			setTimeout(() => controller.abort(), 100);

			// The 500 ms pause is longer than the 100 ms abort, so nothing reaches the console.
			await expect(next).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			expect(fake.upgrades).toHaveLength(1);
		});

		it('refuses a wrong pin before the key is sent', async () => {
			const client = build({
				tls: { mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console },
			});

			await expect(client.openSubscription('devices', makeHandlers())).rejects.toMatchObject({
				category: ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH,
				operation: 'subscribe/devices',
			});
			expect(fake.upgrades).toHaveLength(0);
		});

		it('maps an opening handshake that times out to a timeout', async () => {
			// TLS completes, then the upgrade is never answered: only the WebSocket handshake timeout can end it.
			const silent = https.createServer(protectTlsServerOptions());

			silent.on('upgrade', (_req, socket) => {
				socket.on('error', () => undefined);
			});
			silent.on('tlsClientError', () => undefined);

			await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));

			try {
				const client = new ProtectApiClient({
					host: '127.0.0.1',
					port: (silent.address() as net.AddressInfo).port,
					apiKey: FAKE_PROTECT_API_KEY,
					tls: { mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned },
					timeoutMs: 200,
				});

				clients.push(client);

				await expect(client.openSubscription('devices', makeHandlers())).rejects.toMatchObject({
					category: ProtectErrorCategory.TIMEOUT,
					operation: 'subscribe/devices',
				});
			} finally {
				silent.closeAllConnections();
				await new Promise<void>((resolve) => silent.close(() => resolve()));
			}
		});

		it('closes a frame larger than the limit as a protocol failure', async () => {
			const client = build();
			const handlers = makeHandlers();

			await client.openSubscription('events', handlers);
			fake.sendRaw('events', 'x'.repeat(PROTECT_MAX_FRAME_BYTES + 1));
			await until(() => handlers.closed.mock.calls.length === 1);

			expect(handlers.closed.mock.calls[0][0]).toMatchObject({ category: ProtectErrorCategory.PROTOCOL });
			expect(handlers.message).not.toHaveBeenCalled();
		});

		it('terminates subscriptions when the client is closed', async () => {
			const client = build();
			const handlers = makeHandlers();

			await client.openSubscription('devices', handlers);
			expect(fake.subscriptionCount('devices')).toBe(1);

			client.close();
			await until(() => fake.subscriptionCount('devices') === 0);
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(handlers.closed).not.toHaveBeenCalled();
		});

		it('cancels a pending open when the client is closed', async () => {
			const client = build();
			const pending = client.openSubscription('devices', makeHandlers());

			client.close();

			await expect(pending).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(fake.subscriptionCount('devices')).toBe(0);
		});

		it('never puts the key into errors or log lines of a failed upgrade', async () => {
			const client = build();
			const errors: string[] = [];

			fake.refuseUpgrades({ status: 401 });
			errors.push(
				(await client
					.openSubscription('devices', makeHandlers())
					.catch((e: unknown) => (e as Error).message)) as string,
			);
			errors.push(
				await client.openSubscription('events', makeHandlers()).then(
					() => 'opened',
					(e: unknown) => JSON.stringify(e),
				),
			);

			const material = [...errors, ...logged].join('\n');

			expect(material).not.toContain(FAKE_PROTECT_API_KEY);
			expect(material).toContain('subscribe/devices');
			expect(logged.join('\n')).toContain('WS subscribe/devices failed (authentication)');
			expect(logged.join('\n')).toContain('WS subscribe/events open');
		});

		it('serves the REST overlay and removals', async () => {
			const client = build();
			const [first, second] = await client.listCameras();

			fake.updateDevice('cameras', first.id, { state: 'DISCONNECTED' });

			expect((await client.listCameras())[0].state).toBe('DISCONNECTED');
			expect((await client.getCamera(first.id)).state).toBe('DISCONNECTED');

			fake.removeDevice('cameras', second.id);

			expect((await client.listCameras()).map((camera) => camera.id)).not.toContain(second.id);
			await expect(client.getCamera(second.id)).rejects.toMatchObject({ category: 'not_found' });

			fake.reset();

			expect((await client.getCamera(first.id)).state).not.toBe('DISCONNECTED');
		});
	});
});
