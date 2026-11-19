import { useContainer } from 'class-validator';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import * as net from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { inspect } from 'util';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { CameraProfileUnavailableException } from '../src/modules/cameras/cameras.exceptions';
import { CameraSnapshotService } from '../src/modules/cameras/services/camera-snapshot.service';
import { CamerasService } from '../src/modules/cameras/services/cameras.service';
import { toGo2rtcSource } from '../src/modules/cameras/services/go2rtc-source';
import { Go2rtcRelayStatus, Go2rtcService } from '../src/modules/cameras/services/go2rtc.service';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../src/modules/devices/services/channels.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	PROTECT_TRUSTED_CA,
} from '../src/plugins/devices-unifi-protect/devices-unifi-protect.constants';
import { DevicesUnifiProtectPlugin } from '../src/plugins/devices-unifi-protect/devices-unifi-protect.plugin';
import { ProtectConnectorService } from '../src/plugins/devices-unifi-protect/services/protect-connector.service';
import {
	PROTECT_REALTIME_TIMINGS,
	ProtectRealtimeService,
} from '../src/plugins/devices-unifi-protect/services/protect-realtime.service';

import { FAKE_PROTECT_ALIAS, FAKE_PROTECT_API_KEY, FakeProtectServer } from './support/fake-protect-server';
import { PROTECT_TEST_TLS } from './support/protect-tls';

const SENTINELS = [FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS];
const ALIAS_SENTINELS = ['SENTINELALIAS', FAKE_PROTECT_ALIAS];

// `cameras.json`: one stream enabled (`high`), no package camera. `cameras-doorbell.json`: a doorbell with a package
// camera and full HD snapshots.
const CAMERA = '600cefafd5f365d6f83c4ef3';
const DOORBELL = '5f0000000000000000000a02';

interface StatusData {
	connection_state: string;
	realtime_state: string;
	ignored_event_count: number;
}

interface ProfileData {
	id: string;
	available: boolean;
	unavailable_reason?: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const colonUpper = (fingerprint: string): string => (fingerprint.match(/../g) ?? []).join(':').toUpperCase();

const listFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);

		return statSync(path).isDirectory() ? listFiles(path) : [path];
	});

/** Plays go2rtc against a bridge URL: connects and writes an RTSP request at once. */
interface RawClient {
	socket: net.Socket;
	received: Buffer[];
	closed: boolean;
	error: string | null;
}

describe('UniFi Protect streams (e2e)', () => {
	const api = '/api/v1';
	const base = `${api}/plugins/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}`;
	const configUrl = `${api}/modules/config/config/plugin/${DEVICES_UNIFI_PROTECT_PLUGIN_NAME}`;
	const camerasUrl = `${api}/modules/cameras/cameras`;
	const relayStatus: Go2rtcRelayStatus = {
		mode: 'managed',
		state: 'running',
		reason: null,
		version: 'test',
		generation: 1,
	};

	let app: NestFastifyApplication;
	let fake: FakeProtectServer;
	let configDirectory: string;
	let originalConfigPath: string | undefined;
	let ownerToken: string;
	let logSpies: jest.SpyInstance[] = [];
	let emitSpies: jest.SpyInstance[] = [];
	let relaySpies: jest.SpyInstance[] = [];
	let writesAfterAdoption = 0;
	// Every response the suite received, inspected for the sentinels at the end.
	const observed: unknown[] = [];
	const panelIds = new Map<string, string>();
	const openClients: RawClient[] = [];

	const record = <T extends { body: unknown; text: string; headers: unknown }>(response: T): T => {
		observed.push([response.body, response.text, response.headers]);

		return response;
	};

	const authed = (method: 'get' | 'post', path: string) =>
		request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${ownerToken}`);

	const patchConfig = async (data: Record<string, unknown>) =>
		record(
			await request(app.getHttpServer())
				.patch(configUrl)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data } }),
		);

	// The status route has its own 30 requests per minute budget; polling reads the same two services the controller
	// serves it from.
	const status = (): Promise<StatusData> => {
		const model = app.get(ProtectRealtimeService).decorateStatus(app.get(ProtectConnectorService).getStatus());

		return Promise.resolve({
			connection_state: model.connectionState,
			realtime_state: model.realtimeState,
			ignored_event_count: model.ignoredEventCount,
		});
	};

	const eventually = async (check: () => unknown, ms: number): Promise<void> => {
		const deadline = Date.now() + ms;

		for (;;) {
			try {
				await check();

				return;
			} catch (error) {
				if (Date.now() > deadline) {
					throw error;
				}
			}

			await sleep(100);
		}
	};

	const awaitStatus = (expected: Partial<StatusData>, ms: number): Promise<void> =>
		eventually(async () => expect(await status()).toMatchObject(expected), ms);

	const savedConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		enabled: true,
		host: fake.host,
		port: fake.port,
		api_key: FAKE_PROTECT_API_KEY,
		tls: { mode: 'pinned', fingerprint_sha256: colonUpper(PROTECT_TEST_TLS.fingerprints.selfSigned) },
		poll_interval_ms: 5000,
		...overrides,
	});

	const adoptBatch = async (devices: Record<string, unknown>[]): Promise<void> => {
		const response = record(
			await request(app.getHttpServer())
				.post(`${base}/adopt/batch`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { devices } }),
		);

		for (const result of (
			response.body as { data: { results: { device_id: string; status: string; panel_device_id: string }[] } }
		).data.results) {
			expect(['created', 'skipped']).toContain(result.status);
			panelIds.set(result.device_id, result.panel_device_id);
		}
	};

	const readValue = async (deviceId: string, channelIdentifier: string, propertyIdentifier: string) => {
		const channel = (await app.get(ChannelsService).findAll(deviceId)).find(
			(entry) => entry.identifier === channelIdentifier,
		);

		if (channel === undefined) {
			throw new Error(`Channel ${channelIdentifier} not found on device ${deviceId}`);
		}

		const property = (await app.get(ChannelsPropertiesService).findAll(channel.id)).find(
			(entry) => entry.identifier === propertyIdentifier,
		);

		if (property === undefined) {
			throw new Error(`Property ${propertyIdentifier} not found on channel ${channelIdentifier} of device ${deviceId}`);
		}

		return (await app.get(PropertyValueService).readLatest(property))?.value;
	};

	const cameraStatus = (protectId: string, channel = 'camera.main') =>
		readValue(panelIds.get(protectId), channel, 'status');

	const getCamera = async (protectId: string): Promise<ProfileData[]> => {
		const response = record(await authed('get', `${camerasUrl}/${panelIds.get(protectId)}`));

		expect(response.status).toBe(200);

		return (response.body as { data: { profiles: ProfileData[] } }).data.profiles;
	};

	const resolve = async (protectId: string, profile: string) => {
		const cameras = app.get(CamerasService);
		const { device, provider } = await cameras.getProviderOrThrow(panelIds.get(protectId));

		return cameras.resolveSource(device, provider, profile);
	};

	const streamReads = (protectId: string): number =>
		fake.requests.filter((entry) => entry.method === 'GET' && entry.path.endsWith(`/cameras/${protectId}/rtsps-stream`))
			.length;

	const snapshotRequests = () =>
		fake.requests.filter((entry) => entry.method === 'GET' && /\/cameras\/[^/]+\/snapshot$/.test(entry.path));

	/** Connects to a bridge URL and writes an OPTIONS request for it before any answer could arrive. */
	const connectRaw = (url: string): Promise<RawClient> =>
		new Promise((resolveClient) => {
			const target = new URL(url);
			const socket = net.connect({ host: target.hostname, port: Number(target.port) });
			const client: RawClient = { socket, received: [], closed: false, error: null };

			openClients.push(client);
			socket.on('data', (chunk: Buffer) => client.received.push(chunk));
			socket.on('error', (error: NodeJS.ErrnoException) => {
				client.error = error.code ?? 'error';
			});
			socket.on('close', () => {
				client.closed = true;
			});
			socket.once('connect', () => {
				socket.write(`OPTIONS ${url} RTSP/1.0\r\nCSeq: 1\r\n\r\n`);
				resolveClient(client);
			});
			// A refused connect never reaches 'connect': settle on close instead.
			socket.once('close', () => resolveClient(client));
		});

	const text = (client: RawClient): string => Buffer.concat(client.received).toString('latin1');

	const bootApp = async (): Promise<void> => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AppModule.register({
					moduleExtensions: [],
					pluginExtensions: [
						{ routePrefix: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX, extensionClass: DevicesUnifiProtectPlugin },
					],
				}),
			],
		})
			.overrideProvider(PROTECT_TRUSTED_CA)
			.useValue(PROTECT_TEST_TLS.ca)
			.overrideProvider(PROTECT_REALTIME_TIMINGS)
			.useValue({
				pingIntervalMs: 180_000,
				pongTimeoutMs: 30_000,
				degradedAfterFailures: 3,
				reconnectDelay: () => 100,
			})
			.compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		// Mirror the production wiring of main.ts so error responses have their real shape.
		app.useGlobalFilters(...createGlobalExceptionFilters(moduleFixture.get(ConfigService)));
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: true },
				exceptionFactory: (errors) => ValidationExceptionFactory.createException(errors),
			}),
		);
		app.setGlobalPrefix('api');
		app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
		useContainer(moduleFixture, { fallbackOnErrors: true });

		// A managed relay that "runs": the relay itself belongs to UP-3, the bridge only needs its status.
		const go2rtc = moduleFixture.get(Go2rtcService);

		relaySpies = [
			jest.spyOn(go2rtc, 'isRunning').mockReturnValue(true),
			jest.spyOn(go2rtc, 'getStatus').mockImplementation(() => ({ ...relayStatus })),
			jest.spyOn(go2rtc, 'getClient').mockReturnValue({ baseUrl: 'http://127.0.0.1:9' } as never),
		];

		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		await sleep(100);
	};

	beforeAll(async () => {
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-streams-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);
		emitSpies = (['emit', 'emitAsync'] as const).map((method) => jest.spyOn(EventEmitter2.prototype, method));

		fake = await FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'], rtsps: true });

		await bootApp();

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'protowner', password: 'securePassword123!', email: 'protowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'protowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		expect((await patchConfig(savedConfig())).status).toBe(200);
		await awaitStatus({ connection_state: 'connected' }, 10_000);

		// `high` is the only stream the console starts with; the doorbell gets its streams from adoption.
		await adoptBatch([
			{ device_id: CAMERA, model_key: 'camera', stream: { enabled: false } },
			{ device_id: DOORBELL, model_key: 'camera' },
		]);

		await awaitStatus({ realtime_state: 'streaming' }, 10_000);

		writesAfterAdoption = fake.writes.length;
	}, 120_000);

	beforeEach(() => {
		// A cached image would hide the request a test is about.
		for (const id of panelIds.values()) {
			app.get(CameraSnapshotService).evict(id);
		}
	});

	afterAll(async () => {
		openClients.forEach((client) => client.socket.destroy());

		await app?.close();
		await fake?.stop();

		logSpies.forEach((spy) => spy.mockRestore());
		emitSpies.forEach((spy) => spy.mockRestore());
		relaySpies.forEach((spy) => spy.mockRestore());

		rmSync(configDirectory, { recursive: true, force: true });

		if (originalConfigPath === undefined) {
			delete process.env.FB_CONFIG_PATH;
		} else {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		}
	});

	it('lists Protect profiles with availability and hints', async () => {
		const camera = await getCamera(CAMERA);

		expect(camera.map((profile) => profile.id)).toEqual(['medium', 'high', 'low']);
		expect(camera.find((profile) => profile.id === 'medium')).toMatchObject({
			available: false,
			unavailable_reason: 'stream_not_enabled',
		});
		expect(camera.find((profile) => profile.id === 'high')).toMatchObject({ available: true });

		const doorbell = await getCamera(DOORBELL);

		expect(doorbell.map((profile) => profile.id)).toEqual(['medium', 'high', 'low', 'package']);
		expect(doorbell.find((profile) => profile.id === 'medium')).toMatchObject({ available: true });
		expect(doorbell[doorbell.length - 1]).toMatchObject({ id: 'package', available: true });
	});

	it('lists profiles without a second console read', async () => {
		await getCamera(CAMERA);

		const reads = streamReads(CAMERA);

		await getCamera(CAMERA);

		expect(streamReads(CAMERA)).toBe(reads);
	});

	it('streams through the verified bridge', async () => {
		const source = await resolve(CAMERA, 'high');
		const url = new URL(source.url);

		expect(source.transport).toBe('rtsp');
		expect(url.protocol).toBe('rtsp:');
		expect(url.hostname).toBe('127.0.0.1');
		expect(Number(url.port)).not.toBe(0);
		expect(Number(url.port)).not.toBe(fake.rtspsPort);
		expect(url.pathname).toBe(`/${FAKE_PROTECT_ALIAS}`);
		expect(source.url).not.toContain('enableSrtp');
		expect(toGo2rtcSource(source)).toBe(source.url);

		fake.rtspRequestLines.length = 0;

		const client = await connectRaw(source.url);

		await eventually(() => expect(text(client)).toContain('RTSP/1.0 200 OK'), 5000);

		expect(fake.rtspRequestLines).toHaveLength(1);
		expect(fake.rtspRequestLines[0]).toContain(FAKE_PROTECT_ALIAS);

		client.socket.destroy();
	});

	it('bridges to stream_host_override', async () => {
		const bridgeUrl = (await resolve(CAMERA, 'high')).url;
		const before = await connectRaw(bridgeUrl);

		await eventually(() => expect(text(before)).toContain('RTSP/1.0 200 OK'), 5000);

		expect((await patchConfig({ stream_host_override: 'localhost' })).status).toBe(200);

		try {
			// The listener belongs to the relay and the upstream port, not to the host: the port stays (R1), the
			// connection to the old host closes.
			await eventually(() => expect(before.closed).toBe(true), 5000);

			const source = await resolve(CAMERA, 'high');

			expect(new URL(source.url).port).toBe(new URL(bridgeUrl).port);

			const after = await connectRaw(source.url);

			await eventually(() => expect(text(after)).toContain('RTSP/1.0 200 OK'), 5000);

			after.socket.destroy();
		} finally {
			expect((await patchConfig({ stream_host_override: null })).status).toBe(200);
		}

		const restored = await resolve(CAMERA, 'high');
		const client = await connectRaw(restored.url);

		await eventually(() => expect(text(client)).toContain('RTSP/1.0 200 OK'), 5000);

		client.socket.destroy();
	});

	it('fails closed when the stream port presents another certificate', async () => {
		// The endpoint is resolved while the console still presents the pinned certificate.
		const bridgeUrl = (await resolve(CAMERA, 'high')).url;
		const statusBefore = await cameraStatus(CAMERA);
		const bytesBefore = fake.rtspsBytesReceived.length;

		// The console's CA-signed certificate; the plugin pins the self-signed one.
		fake.set({ rtspsCertificate: 'console' });

		try {
			await expect(resolve(CAMERA, 'high')).rejects.toBeInstanceOf(CameraProfileUnavailableException);

			const profiles = await getCamera(CAMERA);

			// Only a quality with a known stream port can be reported as unverified.
			expect(profiles.find((profile) => profile.id === 'high')).toMatchObject({
				available: false,
				unavailable_reason: 'stream_tls_unverified',
			});

			const session = record(
				await authed('post', `${camerasUrl}/${panelIds.get(CAMERA)}/sessions`).send({
					data: { profile: 'high', transport: 'mse' },
				}),
			);

			expect(session.status).toBe(404);

			const client = await connectRaw(bridgeUrl);

			await eventually(() => expect(client.closed).toBe(true), 5000);

			expect(client.received).toHaveLength(0);
			expect(fake.rtspsBytesReceived.slice(bytesBefore).every((bytes) => bytes === 0)).toBe(true);
			expect(await cameraStatus(CAMERA)).toBe(statusBefore);
		} finally {
			fake.set({ rtspsCertificate: 'mirror' });
		}

		// A good handshake records the endpoint as verified again.
		await expect(resolve(CAMERA, 'high')).resolves.toMatchObject({ transport: 'rtsp' });
		expect((await getCamera(CAMERA)).find((profile) => profile.id === 'high')).toMatchObject({ available: true });
	});

	it('refuses a session for a quality that is not enabled', async () => {
		const response = record(
			await authed('post', `${camerasUrl}/${panelIds.get(CAMERA)}/sessions`).send({
				data: { profile: 'medium', transport: 'mse' },
			}),
		);

		expect(response.status).toBe(404);
	});

	it('serves a snapshot through the shared client', async () => {
		fake.requests.length = 0;

		const response = await authed('get', `${camerasUrl}/${panelIds.get(CAMERA)}/snapshot`)
			.buffer(true)
			.parse((res, cb) => {
				const chunks: Buffer[] = [];

				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => cb(null, Buffer.concat(chunks)));
			});

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('image/jpeg');
		expect((response.body as Buffer).subarray(0, 2).toString('hex')).toBe('ffd8');
		expect(snapshotRequests()).toHaveLength(1);
		expect(snapshotRequests()[0].query).toEqual({ highQuality: 'false' });

		expect((await authed('get', `${camerasUrl}/${panelIds.get(CAMERA)}/snapshot`)).status).toBe(200);
		expect(snapshotRequests()).toHaveLength(1);
	});

	it('asks for the package channel and for full HD only where supported', async () => {
		fake.requests.length = 0;

		const packageShot = await authed('get', `${camerasUrl}/${panelIds.get(DOORBELL)}/snapshot?profile=package&hq=true`);

		expect(packageShot.status).toBe(200);
		expect(snapshotRequests().map((entry) => entry.query)).toEqual([{ channel: 'package', highQuality: 'true' }]);

		fake.requests.length = 0;

		// `cameras.json` does not advertise full HD: the request stays standard quality.
		const standard = await authed('get', `${camerasUrl}/${panelIds.get(CAMERA)}/snapshot?hq=true`);

		expect(standard.status).toBe(200);
		expect(snapshotRequests().map((entry) => entry.query)).toEqual([{ highQuality: 'false' }]);
	});

	it('maps a console 503 to the offline answer', async () => {
		fake.enqueue(/\/snapshot$/, { status: 503 });

		const response = await authed('get', `${camerasUrl}/${panelIds.get(CAMERA)}/snapshot`);

		expect(response.status).toBe(503);
	});

	it('follows a camera offline and back', async () => {
		await eventually(async () => expect(await cameraStatus(CAMERA)).toBe('available'), 5000);

		fake.sendFrame('devices', { type: 'update', item: { id: CAMERA, modelKey: 'camera', state: 'DISCONNECTED' } });

		await eventually(async () => expect(await cameraStatus(CAMERA)).toBe('offline'), 5000);

		fake.requests.length = 0;

		expect((await authed('get', `${camerasUrl}/${panelIds.get(CAMERA)}/snapshot`)).status).toBe(503);
		expect(snapshotRequests()).toHaveLength(0);

		fake.sendFrame('devices', { type: 'update', item: { id: CAMERA, modelKey: 'camera', state: 'CONNECTED' } });

		// A reconnect inside the anti-flap window is deferred, not dropped: allow its 10 s.
		await eventually(() => expect(streamReads(CAMERA)).toBe(1), 20_000);
		await eventually(async () => expect(await cameraStatus(CAMERA)).toBe('available'), 5000);

		expect(streamReads(CAMERA)).toBe(1);
	}, 40_000);

	it('shows a stream disabled on the console as unavailable', async () => {
		fake.setStreams(CAMERA, []);

		try {
			await expect(resolve(CAMERA, 'high')).rejects.toBeInstanceOf(CameraProfileUnavailableException);

			await eventually(async () => expect(await cameraStatus(CAMERA)).toBe('unavailable'), 5000);
			expect((await getCamera(CAMERA)).find((profile) => profile.id === 'high')).toMatchObject({
				available: false,
				unavailable_reason: 'stream_not_enabled',
			});
		} finally {
			fake.setStreams(CAMERA, ['high']);
		}

		await expect(resolve(CAMERA, 'high')).resolves.toMatchObject({ transport: 'rtsp' });
		await eventually(async () => expect(await cameraStatus(CAMERA)).toBe('available'), 5000);
	});

	it('closes bridged connections when the plugin is disabled', async () => {
		const source = await resolve(CAMERA, 'high');
		const client = await connectRaw(source.url);

		await eventually(() => expect(text(client)).toContain('RTSP/1.0 200 OK'), 5000);

		expect((await patchConfig({ enabled: false })).status).toBe(200);

		try {
			await eventually(() => expect(client.closed).toBe(true), 5000);
		} finally {
			expect((await patchConfig(savedConfig())).status).toBe(200);
		}

		await awaitStatus({ connection_state: 'connected', realtime_state: 'streaming' }, 10_000);

		const refused = await connectRaw(source.url);

		// The listener closed with the plugin: nothing answers on the old port any more.
		await eventually(() => expect(refused.closed).toBe(true), 5000);

		expect(refused.received).toHaveLength(0);
	}, 40_000);

	it('never leaked a secret into responses, logs, events, the database, the config or diagnostics', async () => {
		record(await authed('get', `${base}/status`));
		record(await authed('get', `${base}/devices`));
		record(await authed('get', `${api}/modules/cameras/status`));
		record(await authed('get', `${api}/modules/extensions/services`));

		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls), observed],
			{ depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity },
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}

		// The spies saw real traffic, so the checks above are not vacuous.
		expect(spied).toContain('cameras/{id}/rtsps-stream');
		expect(spied).toContain('stream bridge');
		expect(spied).not.toContain('rtspx');
		expect(observed.length).toBeGreaterThan(10);

		const dataSource = app.get(DataSource);

		for (const table of ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties']) {
			const rows = inspect(await dataSource.query(`SELECT * FROM ${table}`), { depth: null, maxArrayLength: null });

			for (const sentinel of SENTINELS) {
				expect(rows).not.toContain(sentinel);
			}

			expect(rows).not.toContain('rtspx');
		}

		const files = listFiles(configDirectory);
		const aliasFiles = files.filter((file) => {
			const content = readFileSync(file).toString('latin1');

			return ALIAS_SENTINELS.some((sentinel) => content.includes(sentinel));
		});
		const keyFiles = files.filter((file) => readFileSync(file).toString('latin1').includes(FAKE_PROTECT_API_KEY));

		expect(files.length).toBeGreaterThan(0);
		expect(aliasFiles).toEqual([]);
		// The API key lives in the plugin config alone, as in the other Protect suites.
		expect(keyFiles.map((file) => file.slice(configDirectory.length + 1))).toEqual(['config.yaml']);

		expect(fake.forbiddenHits).toBe(0);
		// Only adoption writes to the console: the provider never creates or deletes a stream.
		expect(fake.writes).toHaveLength(writesAfterAdoption);
	});
});
