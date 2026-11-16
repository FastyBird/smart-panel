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
import { ChannelInputOccurrencesService } from '../src/modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../src/modules/devices/services/channels.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { NotificationsService } from '../src/modules/notifications/services/notifications.service';
import { UserRole } from '../src/modules/users/users.constants';
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
const FIXTURES = join(__dirname, '..', 'src', 'plugins', 'devices-unifi-protect', '__fixtures__');

const FRONT_DOOR = '600cefafd5f365d6f83c4ef3';
const DOORBELL = '5f0000000000000000000a01';
const SENSOR = '5f0000000000000000000b01';
const RING_EVENT = '5f00000000000000000e0007';
const OCCURRENCE_EVENT = 'DevicesModule.ChannelInput.Occurrence';

interface Frame {
	type: string;
	item: Record<string, unknown>;
}

interface StatusData {
	connection_state: string;
	realtime_state: string;
	ignored_event_count: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const colonUpper = (fingerprint: string): string => (fingerprint.match(/../g) ?? []).join(':').toUpperCase();

const readFrames = (file: string): Frame[] =>
	readFileSync(join(FIXTURES, file), 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line) as Frame);

const eventFrame = (id: string, type: 'add' | 'update'): Frame => {
	const frame = readFrames('ws-events.jsonl').find((entry) => entry.item.id === id && entry.type === type);

	if (frame === undefined) {
		throw new Error(`No ${type} frame for event ${id}`);
	}

	return frame;
};

const deviceFrame = (predicate: (frame: Frame) => boolean): Frame => {
	const frame = readFrames('ws-devices.jsonl').find(predicate);

	if (frame === undefined) {
		throw new Error('No matching device frame');
	}

	return frame;
};

describe('UniFi Protect real-time sync (e2e)', () => {
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
	let publishSpy: jest.SpyInstance;
	let logSpies: jest.SpyInstance[] = [];
	let emitSpies: jest.SpyInstance[] = [];
	// Every response the suite received, inspected for the sentinels at the end.
	const observed: unknown[] = [];
	const panelIds = new Map<string, string>();

	const record = <T extends { body: unknown; text: string; headers: unknown }>(response: T): T => {
		observed.push([response.body, response.text, response.headers]);

		return response;
	};

	const get = async (path: string, token?: string) => {
		const call = request(app.getHttpServer()).get(path);

		return record(await (token === undefined ? call : call.set('Authorization', `Bearer ${token}`)));
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

	const readValue = async (deviceId: string, channelIdentifier: string, propertyIdentifier: string) => {
		const channel = (await app.get(ChannelsService).findAll(deviceId)).find(
			(entry) => entry.identifier === channelIdentifier,
		);
		const property = (await app.get(ChannelsPropertiesService).findAll(channel?.id)).find(
			(entry) => entry.identifier === propertyIdentifier,
		);

		return (await app.get(PropertyValueService).readLatest(property as never))?.value;
	};

	const occurrences = (): { sourceOccurrenceId?: string; event?: string; nativeEventType?: string }[] =>
		emitSpies
			.flatMap((spy) => spy.mock.calls as unknown[][])
			.filter((args) => args[0] === OCCURRENCE_EVENT)
			.map((args) => args[1] as { sourceOccurrenceId?: string; event?: string; nativeEventType?: string });

	const securityAlerts = async () =>
		(
			(await get(`${api}/modules/security/status`, ownerToken)).body as {
				data: {
					has_critical_alert: boolean;
					active_alerts: { id: string; type: string; severity: string; source_device_id: string }[];
				};
			}
		).data;

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
		// Set before the app module is compiled: the PATCH requests persist the plugin configuration (with the key)
		// into this directory instead of the repository's data directory.
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-realtime-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);
		emitSpies = (['emit', 'emitAsync'] as const).map((method) => jest.spyOn(EventEmitter2.prototype, method));

		fake = await FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'] });

		await bootApp();

		publishSpy = jest.spyOn(app.get(ChannelInputOccurrencesService), 'publishOccurrence');

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

		expect((await patchConfig(savedConfig())).status).toBe(200);
		await awaitStatus({ connection_state: 'connected' }, 10_000);

		await adoptBatch([
			{ device_id: FRONT_DOOR, model_key: 'camera', stream: { enabled: false } },
			{ device_id: DOORBELL, model_key: 'camera', stream: { enabled: false } },
			{ device_id: SENSOR, model_key: 'sensor' },
		]);

		await awaitStatus({ realtime_state: 'streaming' }, 10_000);
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

	it('opens both subscriptions with the API key', () => {
		const paths = fake.upgrades.map((upgrade) => upgrade.path);

		expect(paths).toEqual(
			expect.arrayContaining([
				'/proxy/protect/integration/v1/subscribe/devices',
				'/proxy/protect/integration/v1/subscribe/events',
			]),
		);
		expect(fake.upgrades.every((upgrade) => upgrade.hadApiKey)).toBe(true);
		expect(fake.subscriptionCount('devices')).toBe(1);
		expect(fake.subscriptionCount('events')).toBe(1);
	});

	it('reports the realtime state and the ignored event count on GET status', async () => {
		const response = await get(statusUrl, userToken);

		expect(response.status).toBe(200);
		expect((response.body as { data: StatusData }).data).toMatchObject({
			connection_state: 'connected',
			realtime_state: 'streaming',
			ignored_event_count: 0,
		});
	});

	it('turns a smoke alarm event into a property and a critical security alert, and clears it on end', async () => {
		const frontDoor = panelIds.get(FRONT_DOOR);
		const alertId = `sensor:${frontDoor}:smoke`;

		fake.sendFrame('events', eventFrame('5f00000000000000000e0005', 'add'));

		await eventually(async () => expect(await readValue(frontDoor, 'smoke', 'detected')).toBe(true), 1000);

		const raised = await securityAlerts();

		expect(raised.has_critical_alert).toBe(true);
		expect(raised.active_alerts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: alertId,
					type: 'smoke',
					severity: 'critical',
					source_device_id: frontDoor,
				}),
			]),
		);

		fake.sendFrame('events', eventFrame('5f00000000000000000e0005', 'update'));

		await eventually(async () => expect(await readValue(frontDoor, 'smoke', 'detected')).toBe(false), 1000);

		expect((await securityAlerts()).active_alerts.map((alert) => alert.id)).not.toContain(alertId);
	});

	it('applies a recorded sensor frame within a second', async () => {
		const sensor = panelIds.get(SENSOR);

		fake.sendFrame(
			'devices',
			deviceFrame((frame) => frame.item.id === SENSOR && frame.item.isOpened === true),
		);

		await eventually(async () => expect(await readValue(sensor, 'contact', 'detected')).toBe(true), 1000);

		fake.sendFrame(
			'devices',
			deviceFrame((frame) => frame.item.id === SENSOR && JSON.stringify(frame.item.stats) === '{"light":{"value":8}}'),
		);

		await eventually(async () => {
			expect(await readValue(sensor, 'illuminance', 'illuminance')).toBe(8);
			expect(await readValue(sensor, 'illuminance', 'level')).toBe('dark');
		}, 1000);
	});

	it('publishes a doorbell ring once with the Protect event id', async () => {
		fake.sendFrame('events', eventFrame(RING_EVENT, 'add'));

		await eventually(() => expect(occurrences()).toHaveLength(1), 1000);

		expect(occurrences()[0]).toMatchObject({
			sourceOccurrenceId: RING_EVENT,
			event: 'single_press',
			nativeEventType: 'ring',
		});
		expect(publishSpy).toHaveBeenCalledTimes(1);

		fake.sendFrame('events', eventFrame(RING_EVENT, 'update'));

		// A motion event that starts and ends, so the reconnect test can prove it is not replayed.
		const frontDoor = panelIds.get(FRONT_DOOR);

		fake.sendFrame('events', eventFrame('5f00000000000000000e0001', 'add'));
		await eventually(async () => expect(await readValue(frontDoor, 'motion', 'detected')).toBe(true), 1000);
		fake.sendFrame('events', eventFrame('5f00000000000000000e0001', 'update'));
		await eventually(async () => expect(await readValue(frontDoor, 'motion', 'detected')).toBe(false), 1000);

		expect(panelIds.get(DOORBELL)).toBeDefined();
	});

	it('reconnects, re-primes and does not replay the ring', async () => {
		const frontDoor = panelIds.get(FRONT_DOOR);
		const upgrades = fake.upgrades.length;
		const cameraReads = (): number => fake.requests.filter((entry) => /\/cameras$/.test(entry.path)).length;
		const reads = cameraReads();

		fake.dropSubscriptions();

		await eventually(() => {
			expect(fake.upgrades.length).toBe(upgrades + 2);
			expect(fake.subscriptionCount('devices')).toBe(1);
			expect(fake.subscriptionCount('events')).toBe(1);
		}, 5000);
		await awaitStatus({ realtime_state: 'streaming' }, 5000);

		expect(cameraReads()).toBeGreaterThan(reads);

		fake.sendFrame('events', eventFrame(RING_EVENT, 'add'));
		fake.sendFrame('events', eventFrame('5f00000000000000000e0001', 'add'));

		// Frames of one subscription are applied in order: once this marker (a distinct baby-cry event) shows up,
		// the replayed ring and motion frames before it have been processed too, so no timed wait is needed.
		const marker = '5f00000000000000000e0006';
		const babyCry = async (): Promise<unknown> => readValue(frontDoor, 'sound_detection.baby_cry', 'detected');

		fake.sendFrame('events', eventFrame(marker, 'add'));
		await eventually(async () => expect(await babyCry()).toBe(true), 2000);
		fake.sendFrame('events', eventFrame(marker, 'update'));
		await eventually(async () => expect(await babyCry()).toBe(false), 2000);

		expect(publishSpy).toHaveBeenCalledTimes(1);
		expect(occurrences()).toHaveLength(1);
		expect(await readValue(frontDoor, 'motion', 'detected')).toBe(false);
	});

	it('marks a device removed on the console disconnected and keeps it', async () => {
		const sensor = panelIds.get(SENSOR);

		fake.sendFrame(
			'devices',
			deviceFrame((frame) => frame.type === 'remove' && frame.item.id === SENSOR),
		);

		await eventually(
			async () => expect(await readValue(sensor, 'device_information', 'connection_state')).toBe('disconnected'),
			1000,
		);

		expect((await get(`${api}/modules/devices/devices/${sensor}`, ownerToken)).status).toBe(200);

		// Scoped to the plugin: the influx plugin of the app keeps its own storage issue open.
		const active = await app.get(NotificationsService).findAll({
			status: 'active',
			source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
		});

		expect(active.map((row) => row.key)).toEqual([`device_removed:${SENSOR}`]);
	});

	it('polls while the sockets are refused and recovers', async () => {
		const frontDoor = panelIds.get(FRONT_DOOR);
		const issues = async () =>
			(
				await app.get(NotificationsService).findAll({ status: 'active', source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME })
			).filter((row) => row.key === 'realtime');
		// Each queued answer refuses one upgrade; keep topping the queue up for as long as the console is "down".
		const refuse = (): void => {
			for (let i = 0; i < 10; i += 1) {
				fake.refuseUpgrades({ status: 503 });
			}
		};
		const refusing = setInterval(refuse, 100);

		try {
			refuse();
			fake.dropSubscriptions();

			await awaitStatus({ connection_state: 'degraded', realtime_state: 'polling' }, 5000);

			await eventually(async () => expect(await issues()).toHaveLength(1), 2000);

			fake.updateDevice('cameras', FRONT_DOOR, { state: 'DISCONNECTED' });

			await eventually(
				async () => expect(await readValue(frontDoor, 'device_information', 'connection_state')).toBe('disconnected'),
				12_000,
			);
		} finally {
			clearInterval(refusing);
		}

		fake.updateDevice('cameras', FRONT_DOOR, { state: 'CONNECTED' });
		fake.refuseUpgrades(null);

		await awaitStatus({ connection_state: 'connected', realtime_state: 'streaming' }, 15_000);

		// The issue resolves only after 30 s of stable streaming (unit tests); here it is still open, and the plugin
		// stop in the next test resolves it.
		expect(await issues()).toHaveLength(1);
	}, 60_000);

	it('stops the sockets when the plugin is disabled', async () => {
		expect((await patchConfig({ enabled: false })).status).toBe(200);

		await eventually(() => {
			expect(fake.subscriptionCount('devices')).toBe(0);
			expect(fake.subscriptionCount('events')).toBe(0);
		}, 5000);
		await awaitStatus({ realtime_state: 'stopped' }, 5000);
		await eventually(
			async () =>
				expect(
					(
						await app.get(NotificationsService).findAll({ status: 'active', source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME })
					).filter((row) => row.key === 'realtime'),
				).toHaveLength(0),
			2000,
		);
	});

	it('never leaked a secret into responses, logs, events, notifications or the database', async () => {
		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls), observed],
			{ depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity },
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}

		expect(spied).toMatch(/subscribe\/devices|UniFi Protect/);

		const dataSource = app.get(DataSource);

		for (const table of [
			'devices_module_devices',
			'devices_module_channels',
			'devices_module_channels_properties',
			'notifications_module_notifications',
		]) {
			const rows = inspect(await dataSource.query(`SELECT * FROM ${table}`), { depth: null, maxArrayLength: null });

			for (const sentinel of SENTINELS) {
				expect(rows).not.toContain(sentinel);
			}
		}

		expect(fake.forbiddenHits).toBe(0);
	});

	it('streams from the first connector session after an application restart', async () => {
		// The saved configuration is enabled again, so the connector's first start() on boot must reach the realtime
		// service's listener (registered in onModuleInit).
		expect((await patchConfig({ enabled: true })).status).toBe(200);
		await awaitStatus({ realtime_state: 'streaming' }, 10_000);

		await app.close();

		await eventually(() => {
			expect(fake.subscriptionCount('devices')).toBe(0);
			expect(fake.subscriptionCount('events')).toBe(0);
		}, 5000);

		await bootApp();

		await eventually(() => {
			expect(fake.subscriptionCount('devices')).toBe(1);
			expect(fake.subscriptionCount('events')).toBe(1);
		}, 10_000);

		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls)],
			{
				depth: null,
				maxArrayLength: null,
				maxStringLength: null,
				breakLength: Infinity,
			},
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}
	}, 60_000);
});
