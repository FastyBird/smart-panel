import { useContainer } from 'class-validator';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
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
import { DeviceConnectivityService } from '../src/modules/devices/services/device-connectivity.service';
import { DeviceValidationService } from '../src/modules/devices/services/device-validation.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { UserRole } from '../src/modules/users/users.constants';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_TRUSTED_CA,
} from '../src/plugins/devices-unifi-protect/devices-unifi-protect.constants';
import { DevicesUnifiProtectPlugin } from '../src/plugins/devices-unifi-protect/devices-unifi-protect.plugin';

import { FAKE_PROTECT_ALIAS, FAKE_PROTECT_API_KEY, FakeProtectServer } from './support/fake-protect-server';
import { PROTECT_TEST_TLS } from './support/protect-tls';

const SENTINELS = [FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS];
const EXPECTED = join(__dirname, '..', 'src', 'plugins', 'devices-unifi-protect', '__fixtures__', 'expected');

const FRONT_DOOR = '600cefafd5f365d6f83c4ef3';
const GARAGE = '6e9e3966e39b412ab18f3727';
const DOORBELL = '5f0000000000000000000a01';
const PACKAGE_DOORBELL = '5f0000000000000000000a02';
const SENSOR = '5f0000000000000000000b01';
const FLOODLIGHT = '5f0000000000000000000c01';

interface AdoptionResult {
	device_id: string;
	model_key: string;
	status: string;
	panel_device_id: string | null;
	failure_code: string | null;
	warnings: string[];
	stream: {
		status: string;
		quality: string | null;
		enabled_qualities: string[] | null;
		failure_category: string | null;
	} | null;
}

interface Golden {
	channels: { identifier: string }[];
}

const FIXTURE_CAMERAS = join(
	__dirname,
	'..',
	'src',
	'plugins',
	'devices-unifi-protect',
	'__fixtures__',
	'cameras.json',
);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const colonUpper = (fingerprint: string): string => (fingerprint.match(/../g) ?? []).join(':').toUpperCase();

const golden = (name: string): Golden => JSON.parse(readFileSync(join(EXPECTED, `${name}.json`), 'utf8')) as Golden;

describe('UniFi Protect adoption (e2e)', () => {
	const api = '/api/v1';
	const base = `${api}/plugins/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}`;
	const statusUrl = `${base}/status`;
	const configUrl = `${api}/modules/config/config/plugin/${DEVICES_UNIFI_PROTECT_PLUGIN_NAME}`;

	let app: NestFastifyApplication;
	let fake: FakeProtectServer;
	let configDirectory: string;
	let originalConfigPath: string | undefined;
	let ownerToken: string;
	let userToken: string;
	let logSpies: jest.SpyInstance[] = [];
	let emitSpies: jest.SpyInstance[] = [];
	// Every response the suite received, inspected for the sentinels at the end.
	const observed: unknown[] = [];
	const adopted = new Map<string, string>();

	const record = <T extends { body: unknown; text: string; headers: unknown }>(response: T): T => {
		observed.push([response.body, response.text, response.headers]);

		return response;
	};

	const get = async (path: string, token?: string) => {
		const call = request(app.getHttpServer()).get(path);

		return record(await (token === undefined ? call : call.set('Authorization', `Bearer ${token}`)));
	};

	const post = async (path: string, token: string | undefined, body: Record<string, unknown>) => {
		const call = request(app.getHttpServer()).post(path);

		return record(await (token === undefined ? call : call.set('Authorization', `Bearer ${token}`)).send(body));
	};

	const patchConfig = async (data: Record<string, unknown>) =>
		record(
			await request(app.getHttpServer())
				.patch(configUrl)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data } }),
		);

	const connectionState = async (): Promise<string> =>
		((await get(statusUrl, userToken)).body as { data: { connection_state: string } }).data.connection_state;

	const awaitConnected = async (): Promise<void> => {
		const deadline = Date.now() + 10_000;

		while ((await connectionState()) !== 'connected') {
			if (Date.now() > deadline) {
				throw new Error('Timed out waiting for the console connection');
			}

			await sleep(100);
		}
	};

	const savedConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		enabled: true,
		host: fake.host,
		port: fake.port,
		api_key: FAKE_PROTECT_API_KEY,
		tls: { mode: 'pinned', fingerprint_sha256: colonUpper(PROTECT_TEST_TLS.fingerprints.selfSigned) },
		...overrides,
	});

	const adoptOne = async (data: Record<string, unknown>): Promise<AdoptionResult> =>
		((await post(`${base}/adopt`, ownerToken, { data })).body as { data: AdoptionResult }).data;

	const batchBody = (): Record<string, unknown>[] => [
		{ device_id: FRONT_DOOR, model_key: 'camera', stream: { quality: 'medium' } },
		{ device_id: PACKAGE_DOORBELL, model_key: 'camera', stream: { quality: 'high' } },
		{ device_id: SENSOR, model_key: 'sensor' },
		{ device_id: FLOODLIGHT, model_key: 'light' },
		{ device_id: GARAGE, model_key: 'camera', stream: { enabled: false } },
	];

	const adoptBatch = async (devices: Record<string, unknown>[]): Promise<AdoptionResult[]> =>
		(
			(await post(`${base}/adopt/batch`, ownerToken, { data: { devices } })).body as {
				data: { results: AdoptionResult[] };
			}
		).data.results;

	const count = async (table: string): Promise<number> => {
		const rows: { n: number }[] = await app.get(DataSource).query(`SELECT COUNT(*) AS n FROM ${table}`);

		return Number(rows[0].n);
	};

	const rowCounts = async (): Promise<number[]> => [
		await count('devices_module_devices'),
		await count('devices_module_channels'),
		await count('devices_module_channels_properties'),
	];

	beforeAll(async () => {
		// Set before the app module is compiled: the PATCH requests persist the plugin configuration (with the key)
		// into this directory instead of the repository's data directory.
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-adoption-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		// Every log call and emitted event of the suite is inspected at the end; the spies live until `afterAll`.
		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);
		emitSpies = (['emit', 'emitAsync'] as const).map((method) => jest.spyOn(EventEmitter2.prototype, method));

		fake = await FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'] });

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

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'protowner', password: 'securePassword123!', email: 'protowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'protowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		await request(app.getHttpServer())
			.post(`${api}/modules/users/users`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'protuser',
					password: 'securePassword123!',
					email: 'protuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'protuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;
	}, 120_000);

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

	it('rejects unauthenticated requests with 401 and users with 403 on all five routes', async () => {
		const device = { device_id: FRONT_DOOR, model_key: 'camera' };
		const calls: [string, () => Promise<{ status: number }>, () => Promise<{ status: number }>][] = [
			['GET devices', () => get(`${base}/devices`), () => get(`${base}/devices`, userToken)],
			[
				'GET devices/{id}',
				() => get(`${base}/devices/${FRONT_DOOR}`),
				() => get(`${base}/devices/${FRONT_DOOR}`, userToken),
			],
			[
				'POST mapping-preview',
				() => post(`${base}/mapping-preview`, undefined, { data: device }),
				() => post(`${base}/mapping-preview`, userToken, { data: device }),
			],
			[
				'POST adopt',
				() => post(`${base}/adopt`, undefined, { data: device }),
				() => post(`${base}/adopt`, userToken, { data: device }),
			],
			[
				'POST adopt/batch',
				() => post(`${base}/adopt/batch`, undefined, { data: { devices: [device] } }),
				() => post(`${base}/adopt/batch`, userToken, { data: { devices: [device] } }),
			],
		];

		for (const [route, anonymous, asUser] of calls) {
			expect([route, (await anonymous()).status]).toEqual([route, 401]);
			expect([route, (await asUser()).status]).toEqual([route, 403]);
		}
	});

	it('answers 503 on inventory and preview, and unavailable on adopt, before the console is connected', async () => {
		expect((await get(`${base}/devices`, ownerToken)).status).toBe(503);
		expect(
			(await post(`${base}/mapping-preview`, ownerToken, { data: { device_id: FRONT_DOOR, model_key: 'camera' } }))
				.status,
		).toBe(503);

		const result = await adoptOne({ device_id: FRONT_DOOR, model_key: 'camera' });

		expect(result).toMatchObject({ status: 'failed', failure_code: 'unavailable', panel_device_id: null });
		expect(fake.requests).toHaveLength(0);
	});

	it('lists the six console devices once connected', async () => {
		expect((await patchConfig(savedConfig())).status).toBe(200);
		await awaitConnected();

		const response = await get(`${base}/devices`, ownerToken);
		const devices = (
			response.body as { data: { id: string; category?: string; suggested_category: string; adopted: boolean }[] }
		).data;

		expect(response.status).toBe(200);
		expect(devices.map((device) => device.id).sort()).toEqual(
			[FRONT_DOOR, GARAGE, DOORBELL, PACKAGE_DOORBELL, SENSOR, FLOODLIGHT].sort(),
		);
		expect(Object.fromEntries(devices.map((device) => [device.id, device.suggested_category]))).toEqual({
			[FRONT_DOOR]: 'camera',
			[GARAGE]: 'camera',
			[DOORBELL]: 'doorbell',
			[PACKAGE_DOORBELL]: 'doorbell',
			[SENSOR]: 'sensor',
			[FLOODLIGHT]: 'lighting',
		});
		expect(devices.every((device) => !device.adopted)).toBe(true);
	});

	it('previews the captured camera cleanly and a package doorbell with stream warnings', async () => {
		const before = await rowCounts();
		const preview = async (id: string) =>
			(
				(await post(`${base}/mapping-preview`, ownerToken, { data: { device_id: id, model_key: 'camera' } })).body as {
					data: { warnings: { code: string }[]; ready_to_adopt: boolean };
				}
			).data;

		expect((await preview(FRONT_DOOR)).warnings).toEqual([]);
		expect((await preview(FRONT_DOOR)).ready_to_adopt).toBe(true);
		expect((await preview(PACKAGE_DOORBELL)).ready_to_adopt).toBe(true);
		expect(await rowCounts()).toEqual(before);
		expect(before[0]).toBe(0);
		expect((await preview(PACKAGE_DOORBELL)).warnings.map((warning) => warning.code)).toEqual([
			'stream_not_enabled',
			'stream_not_enabled',
		]);
	});

	it('leaves zero device, channel and property rows when the creation transaction fails', async () => {
		const before = await rowCounts();
		let calls = 0;

		// eslint-disable-next-line @typescript-eslint/unbound-method -- called back with the real `this`
		const original = ChannelsPropertiesService.prototype.create;
		const forced = jest.spyOn(ChannelsPropertiesService.prototype, 'create').mockImplementation(function (
			this: ChannelsPropertiesService,
			...args: Parameters<typeof original>
		) {
			calls += 1;

			if (calls >= 3) {
				return Promise.reject(new Error('forced property failure'));
			}

			return original.apply(this, args) as Promise<unknown>;
		} as never);

		try {
			const result = await adoptOne({ device_id: FLOODLIGHT, model_key: 'light' });

			expect(result).toMatchObject({ status: 'failed', failure_code: 'persistence_failed', panel_device_id: null });
			expect(forced.mock.calls.length).toBeGreaterThanOrEqual(3);
		} finally {
			forced.mockRestore();
		}

		expect(await rowCounts()).toEqual(before);
	});

	it('adopts a batch with per-item results and only the requested stream writes', async () => {
		const results = await adoptBatch(batchBody());

		expect(results.map((result) => [result.device_id, result.status])).toEqual([
			[FRONT_DOOR, 'created'],
			[PACKAGE_DOORBELL, 'created'],
			[SENSOR, 'created'],
			[FLOODLIGHT, 'created'],
			[GARAGE, 'created'],
		]);
		results.forEach((result) => adopted.set(result.device_id, result.panel_device_id));

		const stream = (id: string) => results.find((result) => result.device_id === id)?.stream;

		expect(stream(FRONT_DOOR)).toMatchObject({ status: 'enabled', enabled_qualities: ['high', 'medium'] });
		expect(stream(PACKAGE_DOORBELL)).toMatchObject({ status: 'enabled', enabled_qualities: ['high', 'package'] });
		// Not requested: the console state is reported as read (the Garage camera starts with `high`).
		expect(stream(GARAGE)).toMatchObject({ status: 'not_requested', enabled_qualities: ['high'] });
		expect(stream(SENSOR)).toBeNull();
		expect(stream(FLOODLIGHT)).toBeNull();
		expect(fake.streamPosts).toEqual([
			{ cameraId: FRONT_DOOR, qualities: ['high', 'medium'] },
			{ cameraId: PACKAGE_DOORBELL, qualities: ['high', 'package'] },
		]);
		expect(fake.writes.length).toBeGreaterThan(0);
		fake.writes.forEach((write) => {
			expect(write.method).toBe('POST');
			expect(write.path).toMatch(/\/cameras\/[0-9a-f]{24}\/rtsps-stream$/);
		});
	});

	it('stores spec-valid devices with the documented identifiers and values', async () => {
		const validation = app.get(DeviceValidationService);
		const channels = app.get(ChannelsService);
		const expected: [string, string][] = [
			[FRONT_DOOR, 'camera'],
			[PACKAGE_DOORBELL, 'doorbell-package'],
			[SENSOR, 'sensor'],
			[FLOODLIGHT, 'floodlight'],
		];

		for (const [protectId, name] of expected) {
			const panelId = adopted.get(protectId);
			const result = await validation.validateDeviceById(panelId);

			expect([protectId, result?.isValid, result?.issues]).toEqual([protectId, true, []]);

			const stored = (await channels.findAll(panelId)).map((channel) => channel.identifier).sort();

			expect(stored).toEqual(
				golden(name)
					.channels.map((channel) => channel.identifier)
					.sort(),
			);
		}

		const properties = app.get(ChannelsPropertiesService);
		const values = app.get(PropertyValueService);
		const frontDoor = adopted.get(FRONT_DOOR);
		const read = async (channelIdentifier: string, propertyIdentifier: string) => {
			const channel = (await channels.findAll(frontDoor)).find((entry) => entry.identifier === channelIdentifier);
			const property = (await properties.findAll(channel?.id)).find((entry) => entry.identifier === propertyIdentifier);

			return (await values.readLatest(property as never))?.value;
		};

		expect(await read('camera.main', 'status')).toBe('available');
		expect(await read('camera.main', 'source')).toBe(`unifi-protect:${FRONT_DOOR}:main`);
		expect(await read('device_information', 'connection_state')).toBe('connected');
	});

	it('re-adopts idempotently without new console writes', async () => {
		const devices = await rowCounts();
		const posts = fake.streamPosts.length;
		const results = await adoptBatch(batchBody());

		expect(results.map((result) => result.status)).toEqual(['skipped', 'skipped', 'skipped', 'skipped', 'skipped']);
		results.forEach((result) => expect(result.panel_device_id).toBe(adopted.get(result.device_id)));
		expect(results.filter((result) => result.stream !== null).map((result) => result.stream?.status)).toEqual([
			'already_enabled',
			'already_enabled',
			'not_requested',
		]);
		expect(fake.streamPosts).toHaveLength(posts);
		expect(await rowCounts()).toEqual(devices);
	});

	it('reads one inventory device with its adoption state', async () => {
		const response = await get(`${base}/devices/${FRONT_DOOR}`, ownerToken);
		const device = (
			response.body as { data: { id: string; model_key: string; adopted: boolean; adopted_device_id: string } }
		).data;

		expect(response.status).toBe(200);
		expect(device).toMatchObject({
			id: FRONT_DOOR,
			model_key: 'camera',
			adopted: true,
			adopted_device_id: adopted.get(FRONT_DOOR),
		});
		expect((await get(`${base}/devices/5f00000000000000000fffff`, ownerToken)).status).toBe(404);
	});

	describe('re-adoption against real storage', () => {
		const channelIds = async (panelId: string): Promise<Map<string, string>> => {
			const channels = await app.get(ChannelsService).findAll(panelId);
			const properties = app.get(ChannelsPropertiesService);
			const ids = new Map<string, string>();

			for (const channel of channels) {
				ids.set(`channel:${channel.identifier}`, channel.id);

				for (const property of await properties.findAll(channel.id)) {
					ids.set(`${channel.identifier}:${property.identifier}`, property.id);
				}
			}

			return ids;
		};

		it('accepts a connection_state property recreated without a mapping name (A20)', async () => {
			const panelId = adopted.get(FRONT_DOOR);
			const channels = app.get(ChannelsService);
			const properties = app.get(ChannelsPropertiesService);
			const information = (await channels.findAll(panelId)).find((entry) => entry.identifier === 'device_information');
			const original = (await properties.findAll(information?.id)).find(
				(entry) => entry.identifier === 'connection_state',
			);

			expect(original).toBeDefined();
			await properties.remove(original?.id);
			expect(
				await app.get(DeviceConnectivityService).trySetConnectionState(panelId, { state: 'connected' as never }),
			).toBe(true);

			const recreated = (await properties.findAll(information?.id)).find(
				(entry) => entry.identifier === 'connection_state',
			);

			expect(recreated).toBeDefined();
			expect(recreated?.id).not.toBe(original?.id);
			expect((recreated as unknown as { protectMappingName: string | null }).protectMappingName ?? null).toBeNull();

			const result = await adoptOne({ device_id: FRONT_DOOR, model_key: 'camera', stream: { quality: 'medium' } });

			expect(['updated', 'skipped']).toContain(result.status);
			expect(result.failure_code).toBeNull();
		});

		it('updates a changed camera: adds and prunes detection channels, keeps the user name and untouched ids', async () => {
			const panelId = adopted.get(FRONT_DOOR);
			const rename = await request(app.getHttpServer())
				.patch(`${api}/modules/devices/devices/${panelId}`)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_TYPE, name: 'My renamed door' } });

			expect(rename.status).toBe(200);

			const before = await channelIds(panelId);

			expect(before.has('channel:object_detection.vehicle')).toBe(true);
			expect(before.has('channel:object_detection.animal')).toBe(true);
			expect(before.has('channel:object_detection.license_plate')).toBe(false);

			const camera = (
				JSON.parse(readFileSync(FIXTURE_CAMERAS, 'utf8')) as { id: string; featureFlags?: Record<string, unknown> }[]
			).find((entry) => entry.id === FRONT_DOOR);

			fake.enqueue(
				new RegExp(`/cameras/${FRONT_DOOR}$`),
				{
					status: 200,
					headers: { 'content-type': 'application/json; charset=utf-8' },
					body: JSON.stringify({
						...camera,
						featureFlags: { ...camera?.featureFlags, smartDetectTypes: ['person', 'licensePlate'] },
					}),
				},
				'GET',
			);

			const result = await adoptOne({ device_id: FRONT_DOOR, model_key: 'camera', stream: { quality: 'medium' } });

			expect(result).toMatchObject({ status: 'updated', failure_code: null, panel_device_id: panelId });

			const after = await channelIds(panelId);

			expect(after.has('channel:object_detection.license_plate')).toBe(true);
			expect(after.has('channel:object_detection.vehicle')).toBe(false);
			expect(after.has('channel:object_detection.animal')).toBe(false);

			const pruned = /^(channel:)?object_detection\.(vehicle|animal)/;

			for (const [key, id] of before) {
				if (!pruned.test(key)) {
					expect([key, after.get(key)]).toEqual([key, id]);
				}
			}

			expect((await app.get(DevicesService).findOne(panelId))?.name).toBe('My renamed door');
		});
	});

	it('keeps the adoption when the stream POST fails', async () => {
		fake.enqueue(/rtsps-stream$/, { status: 500 }, 'POST');

		const result = await adoptOne({ device_id: DOORBELL, model_key: 'camera' });

		expect(result.status).toBe('created');
		expect(result.panel_device_id).not.toBeNull();
		expect(result.stream).toMatchObject({ status: 'failed', failure_category: 'unavailable' });
	});

	it('reports device_not_found inside a batch without failing the others', async () => {
		const results = await adoptBatch([
			{ device_id: '5f00000000000000000fffff', model_key: 'camera' },
			{ device_id: SENSOR, model_key: 'sensor' },
		]);

		expect(results[0]).toMatchObject({ status: 'failed', failure_code: 'device_not_found' });
		expect(results[1]).toMatchObject({ status: 'skipped' });
	});

	it.each([
		[{ data: { device_id: '../x', model_key: 'camera' } }],
		[{ data: { device_id: 'a', model_key: 'chime' } }],
		[{ data: { device_id: 'a', model_key: 'camera', stream: { quality: 'package' } } }],
		[{ data: { device_id: 'a', model_key: 'camera', extra: 1 } }],
	])('rejects adopt body %j with 400', async (body) => {
		expect((await post(`${base}/adopt`, ownerToken, body)).status).toBe(400);
	});

	it('rejects a batch of 51 with 400', async () => {
		const devices = Array.from({ length: 51 }, () => ({ device_id: FRONT_DOOR, model_key: 'camera' }));

		expect((await post(`${base}/adopt/batch`, ownerToken, { data: { devices } })).status).toBe(400);
	});

	it('never leaked a secret into responses, logs, events or the database', async () => {
		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls), observed],
			{ depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity },
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}

		expect(spied).toContain('Front door');
		expect(spied).toContain('created');

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
