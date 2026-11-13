import { useContainer } from 'class-validator';
import { mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import WebSocket from 'ws';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { CameraStreamProviderRegistryService } from '../src/modules/cameras/services/camera-stream-provider.registry.service';
import { go2rtcStreamName } from '../src/modules/cameras/services/go2rtc-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { UserRole } from '../src/modules/users/users.constants';
import {
	DEVICES_THIRD_PARTY_PLUGIN_PREFIX,
	DEVICES_THIRD_PARTY_TYPE,
} from '../src/plugins/devices-third-party/devices-third-party.constants';
import { DevicesThirdPartyPlugin } from '../src/plugins/devices-third-party/devices-third-party.plugin';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from './support/fake-camera-stream.provider';
import { StubGo2rtcServer, rawDataToString } from './support/stub-go2rtc.server';

const MSE_REQUEST = JSON.stringify({ type: 'mse', value: 'avc1.640029' });
const MSE_REPLY = { type: 'mse', value: 'video/mp4; codecs="avc1.640029"' };
const EXPECTED_SOURCE = 'rtspx://fake-console:7441/SENTINELALIAS0123456789?enableSrtp';

interface LiveClient {
	ws: WebSocket;
	/** Text messages received, in order. */
	texts: string[];
	/** Number of binary messages received. */
	binary: number;
	/** Settles with the 101 or with the HTTP status of a refused handshake. */
	outcome: Promise<{ kind: 'open' } | { kind: 'refused'; status: number }>;
	closed: Promise<{ code: number; reason: string }>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean | Promise<boolean>, what: string, timeoutMs = 5000): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (await check()) {
			return;
		}

		await sleep(50);
	}

	throw new Error(`Timed out waiting for ${what}`);
}

async function within<T>(promise: Promise<T>, what: string, timeoutMs = 5000): Promise<T> {
	let timer: NodeJS.Timeout | undefined;

	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), timeoutMs);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

async function unusedPort(): Promise<number> {
	const server = createServer();

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	const address = server.address();
	const port = typeof address === 'object' && address !== null ? address.port : 0;

	await new Promise<void>((resolve) => server.close(() => resolve()));

	return port;
}

describe('Cameras live streaming (e2e)', () => {
	let app: NestFastifyApplication;
	let stub: StubGo2rtcServer;
	let stubUrl: string;
	let origin: string;
	let ownerToken: string;
	let userToken: string;
	let cameraA: string;
	let cameraB: string;
	let cameraC: string;
	let provider: FakeCameraStreamProvider;
	let logSpies: jest.SpyInstance[];
	let configDirectory: string;
	let originalConfigPath: string | undefined;

	const clients: LiveClient[] = [];
	const tokens: string[] = [];
	// Carried from one case to the next, in the order the cases run.
	let socketA: LiveClient;
	let socketB: LiveClient;
	let usedUrl: string;

	const api = '/api/v1';
	const camerasUrl = (suffix = '') => `${api}/modules/cameras/cameras${suffix}`;
	const statusUrl = `${api}/modules/cameras/status`;
	const configUrl = `${api}/modules/config/config/module/cameras-module`;

	const get = (path: string, token: string) =>
		request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

	const patchConfig = (data: Record<string, unknown>) =>
		request(app.getHttpServer())
			.patch(configUrl)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({ data: { type: 'cameras-module', ...data } });

	const relayState = async (): Promise<{ state: string; reason: string | null } | null> => {
		const response = await get(statusUrl, userToken);

		if (response.status !== 200) {
			return null;
		}

		const relay = (response.body as { data: { relay: { state: string; reason: string | null } } }).data.relay;

		return { state: relay.state, reason: relay.reason };
	};

	const waitForRelay = (state: string, reason: string | null = null) =>
		waitFor(async () => {
			const current = await relayState();

			return current?.state === state && current.reason === reason;
		}, `relay ${state}`);

	/** Creates a session and returns the relative url the gateway serves. */
	const createSession = async (deviceId: string): Promise<string> => {
		const response = await request(app.getHttpServer())
			.post(camerasUrl(`/${deviceId}/sessions`))
			.set('Authorization', `Bearer ${userToken}`)
			.send({ data: { transport: 'mse' } })
			.expect(201);

		const url = (response.body as { data: { url: string } }).data.url;

		tokens.push(new URL(url, 'http://placeholder').searchParams.get('session') ?? '');

		return url;
	};

	const connect = (url: string): LiveClient => {
		const ws = new WebSocket(`${origin.replace(/^http/, 'ws')}${url}`);
		const client: LiveClient = {
			ws,
			texts: [],
			binary: 0,
			outcome: new Promise((resolve) => {
				ws.once('open', () => resolve({ kind: 'open' }));
				ws.once('unexpected-response', (_req, res) => {
					resolve({ kind: 'refused', status: res.statusCode ?? 0 });
					res.resume();
					ws.terminate();
				});
			}),
			closed: new Promise((resolve) => {
				ws.once('close', (code, reason) => resolve({ code, reason: reason.toString('utf8') }));
			}),
		};

		ws.on('error', () => undefined);
		ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
			if (isBinary) {
				client.binary++;
			} else {
				client.texts.push(rawDataToString(data));
			}
		});

		clients.push(client);

		return client;
	};

	const openAndRequest = async (deviceId: string): Promise<LiveClient> => {
		const client = connect(await createSession(deviceId));

		expect(await within(client.outcome, 'the handshake')).toEqual({ kind: 'open' });

		client.ws.send(MSE_REQUEST);

		return client;
	};

	const property = (category: PropertyCategory, dataType: DataTypeType, value: unknown, format?: unknown[]) => ({
		type: DEVICES_THIRD_PARTY_TYPE,
		category,
		identifier: category,
		name: category,
		permissions: [PermissionType.READ_ONLY],
		data_type: dataType,
		...(format ? { format } : {}),
		value,
	});

	const channel = (category: ChannelCategory, properties: unknown[]) => ({
		type: DEVICES_THIRD_PARTY_TYPE,
		category,
		name: category,
		properties,
	});

	const createCamera = async (name: string, serial: string): Promise<string> => {
		const response = await request(app.getHttpServer())
			.post(`${api}/modules/devices/devices`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					type: DEVICES_THIRD_PARTY_TYPE,
					service_address: 'http://127.0.0.1:9999',
					category: DeviceCategory.CAMERA,
					name,
					channels: [
						channel(ChannelCategory.CAMERA, [
							property(PropertyCategory.STATUS, DataTypeType.ENUM, 'available', ['available', 'offline']),
							property(PropertyCategory.SOURCE, DataTypeType.STRING, 'main'),
						]),
						channel(ChannelCategory.DEVICE_INFORMATION, [
							property(PropertyCategory.MANUFACTURER, DataTypeType.STRING, 'Fake'),
							property(PropertyCategory.MODEL, DataTypeType.STRING, 'F1'),
							property(PropertyCategory.SERIAL_NUMBER, DataTypeType.STRING, serial),
						]),
					],
				},
			});

		const id = (response.body as { data?: { id?: string } }).data?.id;

		if (!id) {
			throw new Error(`E2E setup failed: device creation ${response.status} ${JSON.stringify(response.body)}`);
		}

		return id;
	};

	beforeAll(async () => {
		// Set before the app module is compiled: the PATCH requests below persist the module configuration into this
		// directory instead of the repository's data directory.
		configDirectory = mkdtempSync(join(tmpdir(), 'cameras-live-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		// Every log call of the suite is inspected at the end; the spies live until `afterAll`.
		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);

		stub = new StubGo2rtcServer();
		stubUrl = await stub.start();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AppModule.register({
					moduleExtensions: [],
					pluginExtensions: [
						{ routePrefix: DEVICES_THIRD_PARTY_PLUGIN_PREFIX, extensionClass: DevicesThirdPartyPlugin },
					],
				}),
			],
		}).compile();

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

		// A real listening server: socket.io's upgrade listener is attached to it, as when the app runs.
		await app.listen(0, '127.0.0.1');

		origin = await app.getUrl();

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'livowner', password: 'securePassword123!', email: 'livowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'livowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		await request(app.getHttpServer())
			.post(`${api}/modules/users/users`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'livuser',
					password: 'securePassword123!',
					email: 'livuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'livuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;

		cameraA = await createCamera('Camera A', 'SNA');
		cameraB = await createCamera('Camera B', 'SNB');
		cameraC = await createCamera('Camera C', 'SNC');

		provider = new FakeCameraStreamProvider(DEVICES_THIRD_PARTY_TYPE);
		app.get(CameraStreamProviderRegistryService).register(provider);
	}, 120_000);

	afterAll(async () => {
		for (const client of clients) {
			client.ws.terminate();
		}

		await app?.close();
		await stub?.stop();

		logSpies?.forEach((spy) => spy.mockRestore());

		rmSync(configDirectory, { recursive: true, force: true });

		if (originalConfigPath === undefined) {
			delete process.env.FB_CONFIG_PATH;
		} else {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		}
	});

	it('switches the relay to the stub go2rtc and reports it running', async () => {
		const response = await patchConfig({
			go2rtc: { mode: 'external', external_url: stubUrl },
			max_sessions: 2,
			max_sessions_per_camera: 1,
		}).expect(200);

		expect((response.body as { data: { go2rtc: { mode: string } } }).data.go2rtc.mode).toBe('external');

		await waitForRelay('running');
	});

	it('proxies a session to the stub and registers the camera source once', async () => {
		usedUrl = await createSession(cameraA);

		socketA = connect(usedUrl);

		expect(await within(socketA.outcome, 'the handshake')).toEqual({ kind: 'open' });

		socketA.ws.send(MSE_REQUEST);

		await waitFor(() => socketA.texts.length > 0 && socketA.binary > 0, 'the mse reply and a media frame');

		expect(JSON.parse(socketA.texts[0])).toEqual(MSE_REPLY);
		expect(stub.puts).toEqual([{ name: go2rtcStreamName(cameraA, 'medium'), src: EXPECTED_SOURCE }]);
		// The relay forwards a rebuilt request, never the client's raw frame.
		expect(stub.requests).toEqual([MSE_REQUEST]);
	});

	it('refuses the same session token a second time with 401', async () => {
		const client = connect(usedUrl);

		expect(await within(client.outcome, 'the refusal')).toEqual({ kind: 'refused', status: 401 });
	});

	it('closes a second session for the same camera while the first is open', async () => {
		const client = connect(await createSession(cameraA));

		expect(await within(client.outcome, 'the handshake')).toEqual({ kind: 'open' });
		expect(await within(client.closed, 'the close')).toEqual({ code: 1013, reason: 'camera_session_limit' });
		expect(socketA.ws.readyState).toBe(WebSocket.OPEN);
	});

	it('reports the relay and the open sockets on the status route without a source url', async () => {
		const response = await get(statusUrl, userToken).expect(200);
		const data = (response.body as { data: { relay: unknown; sessions: Record<string, number> } }).data;

		expect(data.relay).toEqual({ mode: 'external', state: 'running', reason: null, version: '1.9.9-stub' });
		expect(data.sessions.max).toBe(2);
		expect(data.sessions.max_per_camera).toBe(1);
		expect(data.sessions.active).toBeGreaterThanOrEqual(1);
		expect(JSON.stringify(response.body)).not.toContain('rtsp');
	});

	it('keeps a socket open while go2rtc is slow to accept the upstream upgrade', async () => {
		stub.acceptDelayMs = 1500;

		try {
			socketB = await openAndRequest(cameraB);

			await sleep(2000);

			expect(socketB.ws.readyState).toBe(WebSocket.OPEN);

			await waitFor(() => socketB.texts.length > 0 && socketB.binary > 0, 'media after the delayed accept');

			expect(JSON.parse(socketB.texts[0])).toEqual(MSE_REPLY);
		} finally {
			stub.acceptDelayMs = 0;
		}
	});

	it('answers 404 to a plain GET of a session url without consuming the session', async () => {
		const url = await createSession(cameraC);

		await request(app.getHttpServer()).get(url).expect(404);

		// The token was not consumed by the plain request: the upgrade is admitted and then met by the session limit
		// (cameras A and B are streaming, `max_sessions` is 2), which only an unconsumed, valid token can reach.
		const client = connect(url);

		expect(await within(client.outcome, 'the handshake')).toEqual({ kind: 'open' });
		expect(await within(client.closed, 'the close')).toEqual({ code: 1013, reason: 'session_limit' });
	});

	it('rejects clearing external_url while the mode is external', async () => {
		await patchConfig({ go2rtc: { external_url: null } }).expect(400);

		const current = await relayState();

		expect(current).toEqual({ state: 'running', reason: null });
	});

	it('closes a socket with revoked and deletes its stream when the camera is deleted', async () => {
		await request(app.getHttpServer())
			.delete(`${api}/modules/devices/devices/${cameraB}`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.expect(204);

		expect(await within(socketB.closed, 'the close')).toEqual({ code: 4000, reason: 'revoked' });

		await waitFor(() => stub.deletes.includes(go2rtcStreamName(cameraB, 'medium')), 'the stream delete');

		expect(stub.deletes).toContain(go2rtcStreamName(cameraB, 'medium'));
	});

	it('closes an open socket with module_disabled and hides the status route when the module is disabled', async () => {
		expect(socketA.ws.readyState).toBe(WebSocket.OPEN);

		await patchConfig({ enabled: false }).expect(200);

		expect(await within(socketA.closed, 'the close')).toEqual({ code: 4001, reason: 'module_disabled' });

		await get(statusUrl, userToken).expect(404);
	});

	it('serves again once the module is enabled', async () => {
		await patchConfig({ enabled: true }).expect(200);

		await waitForRelay('running');

		const response = await get(statusUrl, userToken).expect(200);

		expect((response.body as { data: { relay: { mode: string } } }).data.relay.mode).toBe('external');
	});

	it('closes sockets and refuses sessions when the relay becomes unreachable, but still serves snapshots', async () => {
		const live = await openAndRequest(cameraC);

		await waitFor(() => live.binary > 0, 'media before the relay is lost');

		const closedPort = await unusedPort();

		await patchConfig({ go2rtc: { external_url: `http://127.0.0.1:${closedPort}` } }).expect(200);

		await waitForRelay('unavailable', 'external_unreachable');

		expect(await within(live.closed, 'the close')).toEqual({ code: 1013, reason: 'relay_unavailable' });

		const refused = await request(app.getHttpServer())
			.post(camerasUrl(`/${cameraC}/sessions`))
			.set('Authorization', `Bearer ${userToken}`)
			.send({ data: { transport: 'mse' } })
			.expect(503);

		expect(JSON.stringify(refused.body)).toContain('Live view relay is not available');

		const snapshot = await get(camerasUrl(`/${cameraC}/snapshot`), userToken).expect(200);

		expect(snapshot.headers['content-type']).toContain('image/jpeg');
	});

	it('never logged a source url, a session token or a password', () => {
		const emitted = JSON.stringify(logSpies.map((spy): unknown[] => spy.mock.calls as unknown[]));

		// The check is only meaningful when the suite really logged the live streams it exercised.
		expect(emitted).toContain('Live stream opened');
		expect(emitted).toContain('go2rtc stream registered');
		expect(tokens).toHaveLength(5);

		expect(FAKE_CAMERA_SECRET_URL).toContain('SENTINELALIAS');
		expect(emitted).not.toContain('SENTINELALIAS');
		expect(emitted).not.toContain('fake-console');
		expect(emitted).not.toContain('PW_SENTINEL');

		for (const token of tokens) {
			expect(token).toHaveLength(43);
			expect(emitted).not.toContain(token);
		}
	});
});
