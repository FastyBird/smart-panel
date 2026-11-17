import { useContainer } from 'class-validator';
import { mkdtempSync, rmSync } from 'fs';
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
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../src/modules/devices/services/channels.service';
import { PropertyCommandService } from '../src/modules/devices/services/property-command.service';
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

const CAMERA = '600cefafd5f365d6f83c4ef3';
const FLOODLIGHT = '5f0000000000000000000c01';

interface StatusData {
	connection_state: string;
	realtime_state: string;
	ignored_event_count: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const colonUpper = (fingerprint: string): string => (fingerprint.match(/../g) ?? []).join(':').toUpperCase();

describe('UniFi Protect control (e2e)', () => {
	const api = '/api/v1';
	const base = `${api}/plugins/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}`;
	const configUrl = `${api}/modules/config/config/plugin/${DEVICES_UNIFI_PROTECT_PLUGIN_NAME}`;

	let app: NestFastifyApplication;
	let fake: FakeProtectServer;
	let configDirectory: string;
	let originalConfigPath: string | undefined;
	let ownerToken: string;
	let logSpies: jest.SpyInstance[] = [];
	let emitSpies: jest.SpyInstance[] = [];
	// Every response the suite received, inspected for the sentinels at the end.
	const observed: unknown[] = [];
	const panelIds = new Map<string, string>();

	const record = <T extends { body: unknown; text: string; headers: unknown }>(response: T): T => {
		observed.push([response.body, response.text, response.headers]);

		return response;
	};

	const patchConfig = async (data: Record<string, unknown>) =>
		record(
			await request(app.getHttpServer())
				.patch(configUrl)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data } }),
		);

	// The status route has its own 30 requests per minute budget; polling reads the same two services the controller
	// serves it from, and one test checks the HTTP response itself.
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

			await sleep(25);
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

	const channelProperty = async (deviceId: string, channelIdentifier: string, propertyIdentifier: string) => {
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

		return { channel, property };
	};

	const readValue = async (deviceId: string, channelIdentifier: string, propertyIdentifier: string) => {
		const { property } = await channelProperty(deviceId, channelIdentifier, propertyIdentifier);

		return (await app.get(PropertyValueService).readLatest(property))?.value;
	};

	const propertyId = async (deviceId: string, channelIdentifier: string, propertyIdentifier: string) =>
		(await channelProperty(deviceId, channelIdentifier, propertyIdentifier)).property?.id;

	const command = async (entries: [string, string, string, unknown][]) =>
		app.get(PropertyCommandService).executePropertyCommands(
			await Promise.all(
				entries.map(async ([deviceId, channelIdentifier, propertyIdentifier, value]) => ({
					propertyId: await propertyId(deviceId, channelIdentifier, propertyIdentifier),
					value,
				})),
			),
		);

	const getsAfterPatch = (resourcePath: RegExp): number => {
		const index = fake.requests.findIndex((entry) => entry.method === 'PATCH');

		return fake.requests.slice(index + 1).filter((entry) => entry.method === 'GET' && resourcePath.test(entry.path))
			.length;
	};

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

		await app.init();
		await app.getHttpAdapter().getInstance().ready();
		await sleep(100);
	};

	beforeAll(async () => {
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-control-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);
		emitSpies = (['emit', 'emitAsync'] as const).map((method) => jest.spyOn(EventEmitter2.prototype, method));

		fake = await FakeProtectServer.start({ cameraFixtures: ['cameras.json'] });

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

		await adoptBatch([
			{ device_id: CAMERA, model_key: 'camera', stream: { enabled: false } },
			{ device_id: FLOODLIGHT, model_key: 'light' },
		]);

		await awaitStatus({ realtime_state: 'streaming' }, 10_000);
	}, 120_000);

	beforeEach(() => {
		// Not reset(): that would also drop the overlays the earlier tests built on.
		fake.patches.length = 0;
		fake.echoPatches(true);
	});

	afterAll(async () => {
		await app?.close();
		await fake?.stop();

		logSpies.forEach((spy) => spy.mockRestore());
		emitSpies.forEach((spy) => spy.mockRestore());

		rmSync(configDirectory, { recursive: true, force: true });

		if (originalConfigPath === undefined) {
			delete process.env.FB_CONFIG_PATH;
		} else {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		}
	});

	it('turns the floodlight on with one PATCH and stores the console state from the frame', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);

		fake.requests.length = 0;

		const result = await command([[floodlight, 'light', 'on', true]]);

		expect(result.success).toBe(true);
		expect(fake.patches).toEqual([{ resource: 'lights', id: FLOODLIGHT, body: { isLightForceEnabled: true } }]);
		expect(await readValue(floodlight, 'light', 'on')).toBe(true);
		expect(getsAfterPatch(new RegExp(`/lights/${FLOODLIGHT}$`))).toBe(0);
	});

	it('sends brightness and the status LED of one floodlight in one PATCH', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);

		const result = await command([
			[floodlight, 'light', 'brightness', 40],
			[floodlight, 'indicator', 'on', false],
		]);

		expect(result.success).toBe(true);
		expect(fake.patches).toEqual([
			{ resource: 'lights', id: FLOODLIGHT, body: { lightDeviceSettings: { ledLevel: 2, isIndicatorEnabled: false } } },
		]);
		expect(await readValue(floodlight, 'light', 'brightness')).toBe(33);
		expect(await readValue(floodlight, 'indicator', 'on')).toBe(false);
	});

	it('sets the camera status LED and microphone volume in one PATCH', async () => {
		const camera = panelIds.get(CAMERA);

		const result = await command([
			[camera, 'indicator', 'on', true],
			[camera, 'microphone', 'volume', 60],
		]);

		expect(result.success).toBe(true);
		expect(fake.patches).toEqual([
			{ resource: 'cameras', id: CAMERA, body: { ledSettings: { isEnabled: true }, micVolume: 60 } },
		]);
		expect(await readValue(camera, 'indicator', 'on')).toBe(true);
		expect(await readValue(camera, 'microphone', 'volume')).toBe(60);
	});

	it('confirms by GET when the console sends no frame', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);

		fake.echoPatches(false);
		fake.requests.length = 0;

		const result = await command([[floodlight, 'light', 'brightness', 100]]);

		expect(result.success).toBe(true);
		expect(fake.patches).toHaveLength(1);
		expect(getsAfterPatch(new RegExp(`/lights/${FLOODLIGHT}$`))).toBeGreaterThanOrEqual(1);
		expect(await readValue(floodlight, 'light', 'brightness')).toBe(100);
	}, 30_000);

	it('keeps the stored value when the console rejects the change', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);

		fake.requests.length = 0;
		fake.enqueue(/\/lights\//, { status: 400, body: '{"error":"x","name":"BAD_REQUEST"}' }, 'PATCH');

		const result = await command([[floodlight, 'light', 'on', false]]);

		expect(result.success).toBe(false);
		expect(result.results[0].reason).toBe('Execution failed');
		expect(await readValue(floodlight, 'light', 'on')).toBe(true);
		expect(getsAfterPatch(new RegExp(`/lights/${FLOODLIGHT}$`))).toBe(0);
	});

	it('answers a REST property PATCH without writing the requested value', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);
		const { channel, property } = await channelProperty(floodlight, 'light', 'on');

		const response = record(
			await request(app.getHttpServer())
				.patch(`${api}/modules/devices/channels/${channel.id}/properties/${property.id}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, value: false } }),
		);

		expect(response.status).toBe(200);
		expect((response.body as { data: { value: { value: unknown } } }).data.value.value).toBe(true);

		await eventually(async () => expect(await readValue(floodlight, 'light', 'on')).toBe(false), 3000);
	});

	it('never sends a PATCH for a property outside the allow-list', async () => {
		const camera = panelIds.get(CAMERA);

		const result = await command([[camera, 'microphone', 'active', false]]);

		expect(result.success).toBe(false);
		expect(fake.patches).toHaveLength(0);
		expect(fake.forbiddenHits).toBe(0);
	});

	it('fails without a request while the console is disconnected', async () => {
		const floodlight = panelIds.get(FLOODLIGHT);

		expect((await patchConfig({ enabled: false })).status).toBe(200);
		await awaitStatus({ connection_state: 'disconnected' }, 5000);

		const writes = fake.writes.length;
		const result = await command([[floodlight, 'light', 'on', true]]);

		expect(result.success).toBe(false);
		expect(fake.writes.length).toBe(writes);

		expect((await patchConfig(savedConfig())).status).toBe(200);
		await awaitStatus({ connection_state: 'connected', realtime_state: 'streaming' }, 10_000);
	}, 30_000);

	it('never leaked a secret into responses, logs, events or the database', async () => {
		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls), observed],
			{ depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity },
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}

		expect(spied).toContain('lights/{id}');

		const dataSource = app.get(DataSource);

		for (const table of ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties']) {
			const rows = inspect(await dataSource.query(`SELECT * FROM ${table}`), { depth: null, maxArrayLength: null });

			for (const sentinel of SENTINELS) {
				expect(rows).not.toContain(sentinel);
			}
		}

		expect(fake.forbiddenHits).toBe(0);
	});
});
