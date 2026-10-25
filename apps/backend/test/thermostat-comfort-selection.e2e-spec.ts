import { useContainer } from 'class-validator';
import crypto, { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { AfterQueryEvent, DataSource } from 'typeorm';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { SqliteDataSource, createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { TokensService } from '../src/modules/auth/services/tokens.service';
import { hashToken } from '../src/modules/auth/utils/token.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { IDevicePropertyData } from '../src/modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../src/modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../src/modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../src/modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandDispatchService } from '../src/modules/devices/services/property-command-dispatch.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { DisplayEntity } from '../src/modules/displays/entities/displays.entity';
import { WsAuthService } from '../src/modules/websocket/services/ws-auth.service';
import { VIRTUAL_THERMOSTAT_COMMAND_HANDLER } from '../src/plugins/devices-virtual/devices-virtual.constants';
import {
	ThermostatComfortPresetDto,
	ThermostatComfortRangeDto,
} from '../src/plugins/devices-virtual/dto/thermostat-comfort.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../src/plugins/devices-virtual/entities/virtual-producer.entity';
import {
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
} from '../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { VirtualDevicePlatform } from '../src/plugins/devices-virtual/platforms/virtual-device.platform';
import { VirtualDependencyGraphService } from '../src/plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from '../src/plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from '../src/plugins/devices-virtual/services/virtual-thermostat-comfort.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
} from '../src/plugins/devices-virtual/services/virtual-thermostat-comfort.utils';
import { VirtualThermostatConfigService } from '../src/plugins/devices-virtual/services/virtual-thermostat-config.service';
import { thermostatPropertyContract } from '../src/plugins/devices-virtual/services/virtual-thermostat-contract.utils';
import { VirtualThermostatRuntimeService } from '../src/plugins/devices-virtual/services/virtual-thermostat-runtime.service';
import { VirtualThermostatOwnershipSubscriber } from '../src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber';
import { RoomSpaceEntity } from '../src/plugins/spaces-home-control/entities/room-space.entity';
import {
	ClimateIntentService,
	PrimaryClimateDevice,
} from '../src/plugins/spaces-home-control/services/climate-intent.service';
import { SpaceClimateStateService } from '../src/plugins/spaces-home-control/services/space-climate-state.service';
import {
	ClimateIntentType,
	ClimateMode,
	ClimateRole,
} from '../src/plugins/spaces-home-control/spaces-home-control.constants';

interface SocketResult {
	status: string;
	message: string;
	results: unknown[];
}

const baseConfiguration = (): ThermostatComfortConfiguration => ({
	heating_range: { minimum: 10, maximum: 30 },
	cooling_range: null,
	presets: [
		{ preset: 'comfort', setpoints: { heating_setpoint: 23, cooling_setpoint: null } },
		{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } },
		{ preset: 'away', setpoints: { heating_setpoint: 12, cooling_setpoint: null } },
	],
	selected_preset: null,
	user_off: false,
	automation_enabled: false,
	temporary_override: null,
});

describe('P06a default-migrated authenticated manual selection HTTP', () => {
	let app: INestApplication;
	let module: TestingModule;
	let database: DataSource;
	let directory: string;
	let token: string;
	let closedCase: { directory: string; database: DataSource; runtime: VirtualThermostatRuntimeService } | undefined;
	const keys = ['NODE_ENV', 'FB_DB_PATH', 'FB_CONFIG_PATH', 'FB_DB_SYNC', 'FB_DB_MIGRATIONS_RUN'];
	let environment: Record<string, string | undefined>;
	const sourceRoot = path.resolve(__dirname, '../src');
	const endpoint = (id: string) => `/plugins/devices-virtual/producers/thermostats/${id}/comfort`;
	const fences = async (id: string) => ({
		expected_revision: (await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }))
			.revision,
		expected_graph_revision: await module.get(VirtualDependencyGraphService).revision(),
	});
	const post = (id: string, body: object) =>
		request(app.getHttpServer() as Parameters<typeof request>[0])
			.post(endpoint(id) + '/selection')
			.set('Authorization', `Bearer ${token}`)
			.send(body);
	const put = (id: string, body: object) =>
		request(app.getHttpServer() as Parameters<typeof request>[0])
			.put(endpoint(id))
			.set('Authorization', `Bearer ${token}`)
			.send(body);
	const definition = () => ({
		heating_range: { minimum: 11, maximum: 29 },
		cooling_range: null,
		presets: [
			{ preset: 'away' as const, setpoints: { heating_setpoint: 13, cooling_setpoint: null } },
			{ preset: 'eco' as const, setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
			{ preset: 'comfort' as const, setpoints: { heating_setpoint: 24, cooling_setpoint: null } },
		],
	});
	const defined = (): ThermostatComfortConfiguration => ({
		heating_range: { minimum: 11, maximum: 29 },
		cooling_range: null,
		presets: [
			{ preset: 'away', setpoints: { heating_setpoint: 13, cooling_setpoint: null } },
			{ preset: 'eco', setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
			{ preset: 'comfort', setpoints: { heating_setpoint: 24, cooling_setpoint: null } },
		],
		selected_preset: null,
		user_off: false,
		automation_enabled: false,
		automation_baseline: null,
		temporary_override: null,
	});
	const definitionExpected = (
		id: string,
		input: Awaited<ReturnType<typeof fences>>,
		selected: 'away' | null = null,
	) => ({
		controller: id,
		revision: input.expected_revision + 1,
		graph_revision: input.expected_graph_revision + 1,
		configuration: { ...defined(), selected_preset: selected },
		effective: {
			source: selected ? 'preset' : 'manual',
			preset: selected,
			heating_setpoint: selected ? 13 : 20,
			cooling_setpoint: null,
			override_id: null,
			expires_at: null,
		},
		clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
	});
	const get = (id: string) =>
		request(app.getHttpServer() as Parameters<typeof request>[0])
			.get(endpoint(id))
			.set('Authorization', `Bearer ${token}`);
	async function seed(
		comfort: ThermostatComfortConfiguration | null = baseConfiguration(),
		requestedMode: 'heat' | 'off' = 'heat',
	) {
		const id = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id,
			name: 'HTTP manual thermostat',
			enabled: true,
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualThermostatConfigEntity, {
			controllerId: id,
			ownerDeviceId: id,
			revision: 1,
			schemaVersion: 1,
			requestedMode,
			locked: false,
			comfort,
			policy: {
				heatingSetpoint: 20,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 0,
				changeoverMs: 0,
				floor: null,
			},
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
		});
		return id;
	}
	function expected(
		id: string,
		input: Awaited<ReturnType<typeof fences>>,
		comfort: ThermostatComfortConfiguration,
		preset: ThermostatPreset | null,
		clear = false,
	) {
		const override = comfort.temporary_override;
		const configured = { ...comfort, selected_preset: preset, user_off: clear ? false : comfort.user_off };
		const publicOverride = override
			? {
					id: override.id,
					source: override.source,
					actor_id: override.actor_id,
					revision: override.revision,
					created_at: override.created_at,
					expires_at: override.expires_at,
					status: override.status,
					terminated_at: override.terminated_at,
					preset: override.preset,
					setpoints: override.setpoints,
					resolved_setpoints: override.resolved_setpoints,
				}
			: null;
		const effectivePreset = override?.preset ?? preset;
		const heating = override ? 23 : preset === 'comfort' ? 23 : preset === 'eco' ? 17 : preset === 'away' ? 12 : 20;
		return {
			controller: id,
			revision: input.expected_revision + 1,
			graph_revision: input.expected_graph_revision + 1,
			configuration: { ...configured, temporary_override: publicOverride },
			effective: {
				source: configured.user_off ? 'user_off' : override ? 'override' : preset ? 'preset' : 'manual',
				preset: effectivePreset,
				heating_setpoint: heating,
				cooling_setpoint: null,
				override_id: override?.id ?? null,
				expires_at: override?.expires_at ?? null,
			},
			clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
		};
	}
	// Controllers, runtime timer/queues and clocks belong to one test case, including each it.each variant.
	// A later case must never inherit an earlier controller's structural maintenance in its SQLite graph.
	beforeEach(async () => {
		app = undefined;
		module = undefined;
		database = undefined;
		directory = undefined;
		if (closedCase) {
			expect(closedCase.database.isInitialized).toBe(false);
			expect((Reflect.get(closedCase.runtime, 'queues') as Map<string, unknown>).size).toBe(0);
			expect((Reflect.get(closedCase.runtime, 'contexts') as Map<string, unknown>).size).toBe(0);
			expect(Reflect.get(closedCase.runtime, 'active')).toBe(false);
		}
		environment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
		directory = mkdtempSync(path.join(tmpdir(), 'p06a-http-'));
		if (closedCase) expect(directory).not.toBe(closedCase.directory);
		Object.assign(process.env, {
			NODE_ENV: 'production',
			FB_DB_PATH: directory,
			FB_CONFIG_PATH: directory,
			FB_DB_SYNC: 'false',
			FB_DB_MIGRATIONS_RUN: 'false',
		});
		writeFileSync(
			path.join(directory, 'config.yaml'),
			JSON.stringify({ plugins: { 'influx-v1-plugin': { enabled: false } }, modules: {} }),
		);
		const prepared = await createSqliteDataSource({
			type: 'sqlite',
			database: path.join(directory, 'database.sqlite'),
			entities: [sourceRoot + '/**/*.entity.ts'],
			subscribers: [sourceRoot + '/**/*.subscriber.ts'],
			migrations: [sourceRoot + '/migrations/*.ts'],
			migrationsTransactionMode: 'each',
		});
		try {
			const expectedNames = Object.freeze(
				prepared.migrations.map((migration) => migration.name ?? migration.constructor.name).sort(),
			);
			const expectedCount = expectedNames.length;
			expect(expectedCount).toBeGreaterThan(0);
			const applied = await prepared.runMigrations({ transaction: 'each' });
			expect(applied).toHaveLength(expectedCount);
			expect(applied.map((migration) => migration.name).sort()).toEqual(expectedNames);
		} finally {
			await prepared.destroy();
		}
		module = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();
		database = module.get(DataSource);
		expect(database.options.synchronize).toBe(false);
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(module, { fallbackOnErrors: true });
		await app.init();
		const runtime = module.get(VirtualThermostatRuntimeService);
		expect(Reflect.get(runtime, 'active')).toBe(true);
		expect((Reflect.get(runtime, 'contexts') as Map<string, unknown>).size).toBe(0);
		expect((Reflect.get(runtime, 'queues') as Map<string, unknown>).size).toBe(0);
		expect(database.subscribers.some((subscriber) => subscriber instanceof VirtualThermostatOwnershipSubscriber)).toBe(
			true,
		);
		await request(app.getHttpServer() as Parameters<typeof request>[0])
			.post('/modules/auth/auth/register')
			.send({ data: { username: 'selection', password: 'securePassword123!', email: 'selection@example.com' } })
			.expect(204);
		const login = await request(app.getHttpServer() as Parameters<typeof request>[0])
			.post('/modules/auth/auth/login')
			.send({ data: { username: 'selection', password: 'securePassword123!' } })
			.expect(201);
		token = (login.body as { data: { access_token: string } }).data.access_token;
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		const runtime = module?.get(VirtualThermostatRuntimeService);
		try {
			try {
				// Preserve the existing maintenance join, now scoped to this case's actual application.
				await runtime?.flush();
			} finally {
				if (app) await app.close();
				else await module?.close();
			}
			if (database && runtime) {
				expect(database.isInitialized).toBe(false);
				expect((Reflect.get(runtime, 'queues') as Map<string, unknown>).size).toBe(0);
				expect((Reflect.get(runtime, 'contexts') as Map<string, unknown>).size).toBe(0);
				expect(Reflect.get(runtime, 'active')).toBe(false);
				closedCase = { directory, database, runtime };
			}
		} finally {
			useContainer({ get: <T>(type: new () => T): T => new type() }, { fallbackOnErrors: true });
			for (const key of keys) {
				if (environment[key] === undefined) delete process.env[key];
				else process.env[key] = environment[key];
			}
			if (directory) rmSync(directory, { recursive: true, force: true });
		}
	});

	it('returns all six wire fields for every explicit preset/null and preserves requested mode and OFF choices', async () => {
		for (const preset of ['comfort', 'eco', 'away', null] as const) {
			const config = baseConfiguration();
			config.user_off = true;
			const id = await seed(config, 'off');
			for (const clear of [false, true]) {
				const input = await fences(id);
				const response = await post(id, { ...input, preset, clear_user_off: clear }).expect(201);
				expect((response.body as { data: unknown }).data).toEqual(expected(id, input, config, preset, clear));
				expect(response.body as object).toMatchObject({
					status: 'success',
					method: 'POST',
					path: endpoint(id) + '/selection',
				});
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).requestedMode,
				).toBe('off');
			}
		}
	});

	it.each(['active', 'clock_uncertain'] as const)(
		'retains full %s override wire without internal watermark or duration',
		async (status) => {
			const config = baseConfiguration();
			const now = Date.now();
			config.temporary_override = {
				id: randomUUID(),
				source: 'panel',
				actor_id: 'display:fixture:token:fixture',
				revision: 1,
				created_at: new Date(now).toISOString(),
				expires_at: new Date(now + 60000).toISOString(),
				original_duration_ms: 60000,
				wall_watermark_ms: now,
				preset: 'comfort',
				setpoints: null,
				resolved_setpoints: { heating_setpoint: 23, cooling_setpoint: null },
				status,
				terminated_at: null,
			};
			const id = await seed(config),
				input = await fences(id);
			const response = await post(id, { ...input, preset: 'eco', clear_user_off: false }).expect(201);
			expect((response.body as { data: unknown }).data).toEqual(expected(id, input, config, 'eco'));
		},
	);

	it('keeps HTTP authentication/validation, missing preset/comfort/owner and safe revision refusal atomic', async () => {
		const id = await seed();
		await request(app.getHttpServer() as Parameters<typeof request>[0])
			.post(endpoint(id) + '/selection')
			.send({ ...(await fences(id)), preset: 'eco', clear_user_off: false })
			.expect(401);
		await post(id, { ...(await fences(id)), preset: 'sleep', clear_user_off: false }).expect(400);
		const input = await fences(id);
		await post(id, { ...input, preset: 'eco', clear_user_off: 'true' }).expect(400);
		await post(id, {
			...input,
			expected_revision: Number.MAX_SAFE_INTEGER + 1,
			preset: 'eco',
			clear_user_off: false,
		}).expect(422);
		await post(id, {
			...input,
			expected_graph_revision: Number.MAX_SAFE_INTEGER + 1,
			preset: 'eco',
			clear_user_off: false,
		}).expect(422);
		await post(id, { ...input, expected_revision: 9, preset: 'eco', clear_user_off: false })
			.expect((response) => {
				// Characterize the installed response on an existing expected refusal, without another request.
				observeIndependentFailure('expected422:stale-row', response);
			})
			.expect(422);
		await post(id, {
			...input,
			expected_graph_revision: input.expected_graph_revision + 1,
			preset: 'eco',
			clear_user_off: false,
		}).expect(422);
		for (const change of [
			{ locked: true },
			{ locked: false, comfort: { ...baseConfiguration(), presets: [] } },
			{ comfort: null },
		]) {
			await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, change);
			await post(id, { ...input, preset: 'eco', clear_user_off: false }).expect(422);
		}
		await database.manager.delete(VirtualDeviceEntity, { id });
		await database.manager.insert(VirtualDeviceEntity, {
			id,
			name: 'Same UUID successor',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await post(id, { ...input, preset: null, clear_user_off: false }).expect(422);
		expect(await fences(id)).toEqual(input);
		await database.manager.delete(VirtualThermostatConfigEntity, { controllerId: id });
		await post(id, { ...input, preset: null, clear_user_off: false }).expect(404);
		const overflow = await seed();
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: overflow },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		await post(overflow, { ...(await fences(overflow)), preset: 'eco', clear_user_off: false }).expect(422);
		await database.manager.update(VirtualGraphRevisionEntity, { id: 1 }, { revision: Number.MAX_SAFE_INTEGER });
		await post(overflow, { ...(await fences(overflow)), preset: 'eco', clear_user_off: false }).expect(422);
		await database.manager.update(VirtualGraphRevisionEntity, { id: 1 }, { revision: input.expected_graph_revision });
	});

	it('PUT authors first comfort=null and replaces definitions using real transformed DTOs and literal full wire/row', async () => {
		const id = await seed(null);
		const service = module.get(VirtualThermostatComfortService);
		const configure = jest.spyOn(service, 'configure');
		const input = await fences(id);
		const first = await put(id, { ...input, ...definition() }).expect(200);
		expect(first.body as object).toMatchObject({ status: 'success', method: 'PUT', path: endpoint(id) });
		expect((first.body as { data: unknown }).data).toEqual(definitionExpected(id, input));
		expect(configure.mock.calls[0][2].heating_range).toBeInstanceOf(ThermostatComfortRangeDto);
		expect(configure.mock.calls[0][2].presets[0]).toBeInstanceOf(ThermostatComfortPresetDto);
		const stored = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		expect(stored.comfort).toEqual(defined());
		expect(stored.revision).toBe(2);
		expect((await fences(id)).expected_graph_revision).toBe(input.expected_graph_revision + 1);
		const next = await fences(id);
		const replaced = await put(id, { ...next, ...definition(), presets: [], automation_enabled: false }).expect(200);
		expect((replaced.body as { data: unknown }).data).toEqual({
			...definitionExpected(id, next),
			configuration: { ...defined(), presets: [] },
		});
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).comfort,
		).toEqual({ ...defined(), presets: [] });
		await request(app.getHttpServer() as Parameters<typeof request>[0])
			.put(endpoint(id))
			.send({ ...next, ...definition() })
			.expect(401);
	});

	it.each(['active', 'clock_uncertain'] as const)(
		'PUT keeps complete %s captured override wire and omits internal metadata',
		async (status) => {
			const config = baseConfiguration(),
				now = Date.now();
			const override = {
				id: randomUUID(),
				source: 'panel' as const,
				actor_id: 'retained-display',
				revision: 1,
				created_at: new Date(now).toISOString(),
				expires_at: new Date(now + 60000).toISOString(),
				original_duration_ms: 60000,
				wall_watermark_ms: now,
				preset: 'comfort' as const,
				setpoints: null,
				resolved_setpoints: { heating_setpoint: 23, cooling_setpoint: null },
				status,
				terminated_at: null,
			};
			config.temporary_override = override;
			const id = await seed(config),
				input = await fences(id);
			const response = await put(id, { ...input, ...definition() }).expect(200);
			const { original_duration_ms: duration, wall_watermark_ms: watermark, ...publicOverride } = override;
			expect(duration).toBe(60000);
			expect(watermark).toBe(now);
			expect((response.body as { data: unknown }).data).toEqual({
				...definitionExpected(id, input),
				configuration: { ...defined(), temporary_override: publicOverride },
				effective: {
					source: 'override',
					preset: 'comfort',
					heating_setpoint: 23,
					cooling_setpoint: null,
					override_id: override.id,
					expires_at: override.expires_at,
				},
			});
			const persisted = (await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }))
				.comfort.temporary_override;
			expect(persisted).toEqual({ ...override, wall_watermark_ms: expect.any(Number) as number });
		},
	);

	it.each(['selection', 'definition'] as const)(
		'returns exact independent %s A HTTP after ACK while completed native B wins latest',
		async (kind) => {
			const id = await seed(),
				input = await fences(id),
				comfort = module.get(VirtualThermostatComfortService);
			const source = await new SqliteDataSource({
				type: 'sqlite',
				database: database.options.database as string,
				entities: [sourceRoot + '/**/*.entity.ts'],
			}).initialize();
			const lock = new DeviceStructureLockService(),
				graph = new VirtualDependencyGraphService(source),
				events = new EventEmitter2();
			const claims = new VirtualThermostatClaimsService(
				source,
				lock,
				graph,
				new PropertyCommandAdmissionRegistryService(),
				events,
			);
			const other = new VirtualThermostatComfortService(source, lock, graph, claims, events);
			try {
				await new VirtualThermostatOwnershipSubscriber(source, claims).onApplicationBootstrap();
				await claims.onApplicationBootstrap();
				expect(lock).not.toBe(module.get(DeviceStructureLockService));
				expect(Reflect.get(source.driver, 'databaseConnection')).not.toBe(
					Reflect.get(database.driver, 'databaseConnection'),
				);
				const realGet = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
				let bSuccess = 0;
				const final = jest.spyOn(comfort, 'get').mockImplementationOnce(async (controller) => {
					await other.select(
						id,
						{ expected_revision: 2, expected_graph_revision: input.expected_graph_revision + 1 },
						'away',
						false,
					);
					bSuccess++;
					return realGet(controller);
				});
				const response =
					kind === 'selection'
						? await post(id, { ...input, preset: 'eco', clear_user_off: false }).expect(201)
						: await put(id, { ...input, ...definition() }).expect(200);
				expect(bSuccess).toBe(1);
				expect(final).toHaveBeenCalledTimes(1);
				expect((response.body as { data: unknown }).data).toEqual(
					kind === 'selection' ? expected(id, input, baseConfiguration(), 'eco') : definitionExpected(id, input),
				);
				final.mockRestore();
				const latest = await get(id).expect(200);
				expect((latest.body as { data: unknown }).data).toEqual(
					kind === 'selection'
						? expected(
								id,
								{ expected_revision: 2, expected_graph_revision: input.expected_graph_revision + 1 },
								baseConfiguration(),
								'away',
							)
						: definitionExpected(
								id,
								{ expected_revision: 2, expected_graph_revision: input.expected_graph_revision + 1 },
								'away',
							),
				);
				const durable = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				if (kind === 'definition') expect(durable.comfort).toEqual({ ...defined(), selected_preset: 'away' });
				expect(
					(await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).revision,
				).toBe(3);
			} finally {
				claims.onModuleDestroy();
				await source.destroy();
			}
		},
	);
	const aId = 'e1d7660a-a4c6-48ac-9abb-251908c9bda1',
		bId = 'e2d7660a-a4c6-48ac-9abb-251908c9bdb2';
	const lifecyclePost = (id: string, route: string, body: object, bearer = token) =>
		request(app.getHttpServer() as Parameters<typeof request>[0])
			.post(endpoint(id) + route)
			.set('Authorization', `Bearer ${bearer}`)
			.send(body);
	const readDiagnosticField = (object: unknown, key: string): unknown =>
		object && typeof object === 'object' ? (Object.getOwnPropertyDescriptor(object, key)?.value as unknown) : undefined;
	let independentDiagnostic:
		| {
				stage: string;
				input?: { expected_revision: number; expected_graph_revision: number };
				queries: {
					stage: string;
					source: 'A' | 'B';
					operation: string;
					table: string;
					success: boolean;
					target: boolean;
					revision?: number;
				}[];
		  }
		| undefined;
	const observeIndependentQuery = (source: 'A' | 'B', controllerId: string) => ({
		afterQuery(event: AfterQueryEvent<unknown>): void {
			try {
				if (!independentDiagnostic) return;
				const table = event.query.includes('"devices_virtual_thermostat_configs"')
					? 'config'
					: event.query.includes('"devices_virtual_graph_revision"')
						? 'graph'
						: undefined;
				if (!table) return;
				const raw: unknown = event.rawResults;
				const first: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : undefined;
				const revision =
					table === 'graph'
						? (readDiagnosticField(first, 'VirtualGraphRevisionEntity_revision') ??
							readDiagnosticField(first, 'graph_revision') ??
							readDiagnosticField(first, 'revision'))
						: (readDiagnosticField(first, 'VirtualThermostatConfigEntity_revision') ??
							readDiagnosticField(first, 'config_revision') ??
							readDiagnosticField(first, 'revision'));
				independentDiagnostic.queries.push({
					stage: independentDiagnostic.stage,
					source,
					operation: event.query.trimStart().split(' ', 1)[0].slice(0, 12),
					table,
					success: event.success,
					target:
						table === 'graph' ||
						event.parameters?.includes(controllerId) === true ||
						readDiagnosticField(first, 'VirtualThermostatConfigEntity_controllerId') === controllerId ||
						readDiagnosticField(first, 'config_controllerId') === controllerId,
					revision: typeof revision === 'number' ? revision : undefined,
				});
				if (independentDiagnostic.queries.length > 40) independentDiagnostic.queries.shift();
			} catch {
				// Passive scalar observation never issues SQL or changes the original query outcome.
			}
		},
	});
	const observeIndependentFailure = (phase: string, value: unknown, service = false): void => {
		try {
			const read = readDiagnosticField;
			const status = service ? undefined : read(value, 'status');
			if (status === 201) return;
			// Installed Superagent Response.body is a prototype accessor over these own data slots.
			// Read only the already parsed body; never invoke arbitrary accessors or serialize a response.
			const body = read(value, 'body') ?? read(value, '_body') ?? read(read(value, 'res'), 'body');
			const error = service ? (value instanceof Error ? value : undefined) : read(body, 'error');
			const details = read(error, 'details');
			const fields =
				service && error instanceof Error
					? [error.name, error.message]
					: [
							read(error, 'code') ?? read(body, 'error'),
							read(error, 'message') ?? read(body, 'message'),
							read(Array.isArray(details) ? read(details, '0') : details, 'reason'),
						];
			const strings = fields
				.filter((field): field is string => typeof field === 'string')
				.slice(0, 3)
				.map((field) => field.slice(0, 200));
			console.error('P06c independent HTTP failure', {
				phase,
				status: typeof status === 'number' ? status : undefined,
				strings,
			});
			if (independentDiagnostic) console.error('P06c independent SQL evidence', JSON.stringify(independentDiagnostic));
		} catch {
			// Observation cannot change the original response or service rejection, including falsy causes.
		}
	};
	const frozenClock = () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Date'),
			OriginalDate = Date;
		const wall = Date.UTC(2026, 9, 25);
		class SystemDate extends OriginalDate {
			constructor(value: number | string = wall) {
				super(value);
			}
		}
		Object.defineProperty(globalThis, 'Date', { ...descriptor, value: SystemDate });
		jest.spyOn(Date, 'now').mockReturnValue(wall);
		jest.spyOn(performance, 'now').mockReturnValue(100);
		return { wall, restore: () => Object.defineProperty(globalThis, 'Date', descriptor) };
	};
	const publicRecord = (
		revision: number,
		actor: string,
		source: 'user' | 'panel',
		identity = aId,
		setpoint: number | null = null,
	) => ({
		id: identity,
		source,
		actor_id: actor,
		revision,
		created_at: '2026-10-25T00:00:00.000Z',
		expires_at: '2026-10-25T00:01:00.000Z',
		preset: setpoint === null ? ('comfort' as const) : null,
		setpoints: setpoint === null ? null : { heating_setpoint: setpoint, cooling_setpoint: null },
		resolved_setpoints: { heating_setpoint: setpoint ?? 23, cooling_setpoint: null },
		status: 'active' as 'active' | 'cancelled',
		terminated_at: null as string | null,
	});
	const lifecycleExpected = (
		id: string,
		input: Awaited<ReturnType<typeof fences>>,
		override: ReturnType<typeof publicRecord>,
		config = baseConfiguration(),
	) => {
		const active = override.status === 'active';
		return {
			controller: id,
			revision: input.expected_revision + 1,
			graph_revision: input.expected_graph_revision + 1,
			configuration: { ...config, temporary_override: override },
			effective: {
				source: config.user_off ? 'user_off' : active ? 'override' : 'manual',
				preset: active ? override.preset : null,
				heating_setpoint: active ? override.resolved_setpoints.heating_setpoint : 20,
				cooling_setpoint: null,
				override_id: active ? override.id : null,
				expires_at: active ? override.expires_at : null,
			},
			clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
		};
	};

	it('runs real authenticated user and display override/replacement/exact-cancel lifecycle with private lifetime and public omissions', async () => {
		const clock = frozenClock(),
			jwt = Reflect.get(module.get(AuthService), 'jwtService') as JwtService;
		const actor = jwt.decode<{ sub: string }>(token).sub;
		const displayId = randomUUID(),
			bearer = jwt.sign({ sub: displayId, type: TokenOwnerType.DISPLAY });
		const credential = await module.get(TokensService).createLongLiveToken({
			token: bearer,
			ownerType: TokenOwnerType.DISPLAY,
			ownerId: displayId,
			name: 'P06c fixture',
			description: null,
			expiresAt: null,
		});
		const displayActor = `display:${displayId}:token:${credential.id}`;
		expect(await module.get(TokensService).findAuthenticationTokenByHash(hashToken(bearer))).toMatchObject({
			id: credential.id,
			ownerType: TokenOwnerType.DISPLAY,
			ownerId: displayId,
			revoked: false,
		});
		await expect(jwt.verifyAsync(bearer)).resolves.toMatchObject({ sub: displayId, type: TokenOwnerType.DISPLAY });
		const config = { ...baseConfiguration(), user_off: true },
			id = await seed(config, 'off');
		const requestOverride = { preset: 'comfort', setpoints: null, expires_at: '2026-10-25T02:01:00+02:00' };
		try {
			let input = await fences(id);
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			const a = await lifecyclePost(id, '/override', { ...input, ...requestOverride }).expect(201);
			const expectedA = publicRecord(2, actor, 'user');
			expect((a.body as { data: unknown }).data).toEqual(lifecycleExpected(id, input, expectedA, config));
			expect(a.body as object).toMatchObject({ status: 'success', method: 'POST', path: endpoint(id) + '/override' });
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).comfort
					.temporary_override,
			).toEqual({ ...expectedA, original_duration_ms: 60000, wall_watermark_ms: clock.wall });
			input = await fences(id);
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
			const b = await lifecyclePost(
				id,
				'/override',
				{
					...input,
					preset: null,
					setpoints: { heating_setpoint: 19, cooling_setpoint: null },
					expires_at: '2026-10-25T00:01:00Z',
				},
				bearer,
			).expect(201);
			const expectedB = publicRecord(3, displayActor, 'panel', bId, 19);
			expect((b.body as { data: unknown }).data).toEqual(lifecycleExpected(id, input, expectedB, config));
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).comfort
					.temporary_override,
			).toEqual({ ...expectedB, original_duration_ms: 60000, wall_watermark_ms: clock.wall });
			for (const body of [
				{ ...input, ...requestOverride, source: 'panel' },
				{ ...input, ...requestOverride, actor_id: displayActor },
				{ ...input, ...requestOverride, id: bId },
			])
				await lifecyclePost(id, '/override', body).expect(400);
			await lifecyclePost(id, '/override/cancel', { ...(await fences(id)), override_id: aId }, bearer).expect(422);
			input = await fences(id);
			const cancel = await lifecyclePost(id, '/override/cancel', { ...input, override_id: bId }).expect(201); // current user may cancel a display-created override
			const terminal = { ...expectedB, status: 'cancelled' as const, terminated_at: '2026-10-25T00:00:00.000Z' };
			expect((cancel.body as { data: unknown }).data).toEqual(lifecycleExpected(id, input, terminal, config));
			const stored = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			expect(stored.comfort.temporary_override).toEqual({
				...terminal,
				original_duration_ms: 60000,
				wall_watermark_ms: clock.wall,
			});
			expect(stored.requestedMode).toBe('off');
			await lifecyclePost(id, '/override/cancel', { ...(await fences(id)), override_id: bId }, bearer).expect(422);
			await request(app.getHttpServer() as Parameters<typeof request>[0])
				.post(endpoint(id) + '/override')
				.send({ ...(await fences(id)), ...requestOverride })
				.expect(401);
			await lifecyclePost(id, '/override', {
				...(await fences(id)),
				...requestOverride,
				setpoints: { heating_setpoint: 19, cooling_setpoint: null },
			}).expect(422);
			await lifecyclePost(id, '/override', {
				...(await fences(id)),
				preset: null,
				setpoints: null,
				expires_at: requestOverride.expires_at,
			}).expect(422);
		} finally {
			await module.get(VirtualThermostatRuntimeService).flush();
			clock.restore();
		}
	});

	it.each(['override', 'cancel'] as const)(
		'returns exact independent %s A HTTP after a completed genuine B override',
		async (kind) => {
			const clock = frozenClock(),
				id = await seed(),
				comfort = module.get(VirtualThermostatComfortService),
				actor = module.get(JwtService).decode<{ sub: string }>(token).sub;
			jest.spyOn(crypto, 'randomUUID').mockReturnValue(aId);
			const body = { preset: 'comfort', setpoints: null, expires_at: '2026-10-25T00:01:00Z' };
			if (kind === 'cancel') {
				await lifecyclePost(id, '/override', { ...(await fences(id)), ...body })
					.expect((response) => observeIndependentFailure(`${kind}:preliminary-create`, response))
					.expect(201);
			}
			independentDiagnostic = { stage: 'independent-initialize', queries: [] };
			const queryObserver = observeIndependentQuery('A', id);
			database.subscribers.push(queryObserver);
			const source = await new SqliteDataSource({
				type: 'sqlite',
				database: database.options.database as string,
				entities: [sourceRoot + '/**/*.entity.ts'],
			}).initialize();
			independentDiagnostic.stage = 'independent-bootstrap';
			const secondQueryObserver = observeIndependentQuery('B', id);
			source.subscribers.push(secondQueryObserver);
			const lock = new DeviceStructureLockService(),
				graph = new VirtualDependencyGraphService(source),
				events = new EventEmitter2(),
				claims = new VirtualThermostatClaimsService(
					source,
					lock,
					graph,
					new PropertyCommandAdmissionRegistryService(),
					events,
				),
				other = new VirtualThermostatComfortService(source, lock, graph, claims, events);
			try {
				await new VirtualThermostatOwnershipSubscriber(source, claims).onApplicationBootstrap();
				await claims.onApplicationBootstrap();
				// Finish owned setup and the existing cancellation maintenance join before request fencing.
				if (kind === 'cancel') await module.get(VirtualThermostatRuntimeService).flush();
				independentDiagnostic.stage = 'capture';
				const input = await fences(id);
				independentDiagnostic.input = input;
				expect(lock).not.toBe(module.get(DeviceStructureLockService));
				expect(Reflect.get(source.driver, 'databaseConnection')).not.toBe(
					Reflect.get(database.driver, 'databaseConnection'),
				);
				expect(Reflect.get(comfort, 'leases')).not.toBe(Reflect.get(other, 'leases'));
				independentDiagnostic.stage = 'owned-setup-complete';
				const original = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
				let bSuccess = 0;
				const final = jest.spyOn(comfort, 'get').mockImplementationOnce(async (controller, settle) => {
					independentDiagnostic.stage = 'B-final-get';
					jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
					await other
						.override(
							id,
							{
								expected_revision: input.expected_revision + 1,
								expected_graph_revision: input.expected_graph_revision + 1,
							},
							{
								preset: null,
								setpoints: { heating_setpoint: 19, cooling_setpoint: null },
								expires_at: body.expires_at,
							},
							'B',
							'panel',
						)
						.catch((cause: unknown) => {
							observeIndependentFailure(`${kind}:B-in-final-get`, cause, true);
							throw cause;
						});
					bSuccess++;
					return original(controller, settle);
				});
				independentDiagnostic.stage = 'A-request';
				const response =
					kind === 'override'
						? await lifecyclePost(id, '/override', { ...input, ...body })
								.expect((response) => observeIndependentFailure(`${kind}:A-create`, response))
								.expect(201)
						: await lifecyclePost(id, '/override/cancel', { ...input, override_id: aId })
								.expect((response) => observeIndependentFailure(`${kind}:A-cancel`, response))
								.expect(201);
				expect(bSuccess).toBe(1);
				expect(final).toHaveBeenCalledTimes(1);
				const a = publicRecord(2, actor, 'user');
				if (kind === 'cancel') {
					a.status = 'cancelled';
					a.terminated_at = '2026-10-25T00:00:00.000Z';
				}
				expect((response.body as { data: unknown }).data).toEqual(lifecycleExpected(id, input, a));
				final.mockRestore();
				await module.get(VirtualThermostatRuntimeService).flush();
				const b = publicRecord(input.expected_revision + 2, 'B', 'panel', bId, 19),
					current = await get(id).expect(200);
				expect((current.body as { data: unknown }).data).toEqual(
					lifecycleExpected(
						id,
						{
							expected_revision: input.expected_revision + 1,
							expected_graph_revision: input.expected_graph_revision + 1,
						},
						b,
					),
				);
				const stored = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				expect(stored.comfort.temporary_override).toEqual({
					...b,
					original_duration_ms: 60000,
					wall_watermark_ms: clock.wall,
				});
				expect(stored.revision).toBe(input.expected_revision + 2);
			} finally {
				await module.get(VirtualThermostatRuntimeService).flush();
				claims.onModuleDestroy();
				await source.destroy();
				database.subscribers.splice(database.subscribers.indexOf(queryObserver), 1);
				independentDiagnostic = undefined;
				clock.restore();
			}
		},
	);
	it('P06d uses persisted display socket authentication, installed command handler/dispatch/DI and real room dispatch', async () => {
		const id = await seed(null, 'off');
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: id },
			{
				policy: {
					heatingSetpoint: 20,
					coolingSetpoint: 24,
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 0,
					floor: null,
				},
			},
		);
		const targets: IDevicePropertyData[] = [];
		const branchChannels = new Map<ChannelCategory, string>();
		for (const [role, category, propertyCategory, value] of [
			['heating_setpoint', ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, 24],
			['cooling_setpoint', ChannelCategory.COOLER, PropertyCategory.TEMPERATURE, 28],
			['heating_enabled', ChannelCategory.HEATER, PropertyCategory.ON, true],
			['cooling_enabled', ChannelCategory.COOLER, PropertyCategory.ON, true],
		] as const) {
			let channelId = branchChannels.get(category);
			if (!channelId) {
				channelId = randomUUID();
				branchChannels.set(category, channelId);
				await database.manager.insert(VirtualChannelEntity, {
					id: channelId,
					device: id,
					name: category,
					identifier: category,
					category,
				});
			}
			const propertyId = randomUUID();
			await database.manager.insert(VirtualChannelPropertyEntity, {
				id: propertyId,
				channel: channelId,
				identifier: propertyCategory,
				category: propertyCategory,
				permissions: [PermissionType.READ_WRITE],
				dataType: typeof value === 'number' ? DataTypeType.FLOAT : DataTypeType.BOOL,
				format: typeof value === 'number' ? [5, 40] : null,
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
			});
			const property = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
				where: { id: propertyId },
				relations: ['channel', 'channel.device'],
			});
			const channel = property.channel as VirtualChannelEntity,
				device = channel.device as VirtualDeviceEntity;
			await database.manager.insert(VirtualThermostatSettingEntity, {
				propertyId,
				controllerId: id,
				setting: role,
				contractFingerprint: thermostatPropertyContract(property, channel, device),
			});
			targets.push({ property, channel, device, value });
		}
		const displayId = randomUUID();
		await database.manager.insert(DisplayEntity, { id: displayId, macAddress: '02:00:00:00:06:04' });
		// This fixture intentionally has no shared environment secret. Use the installed socket verifier's signer.
		const jwt = Reflect.get(module.get(WsAuthService), 'jwtService') as JwtService;
		const bearer = jwt.sign({ sub: displayId, type: TokenOwnerType.DISPLAY });
		const credential = await module.get(TokensService).createLongLiveToken({
			token: bearer,
			ownerType: TokenOwnerType.DISPLAY,
			ownerId: displayId,
			name: 'P06d socket',
			description: null,
			expiresAt: null,
		});
		expect(await database.manager.findOneBy(DisplayEntity, { id: displayId })).not.toBeNull();
		expect(await module.get(TokensService).findAuthenticationTokenByHash(hashToken(bearer))).toMatchObject({
			id: credential.id,
			revoked: false,
		});
		const configs = module.get(VirtualThermostatConfigService),
			platform = module.get(VirtualDevicePlatform);
		expect(module.get(VIRTUAL_THERMOSTAT_COMMAND_HANDLER)).toBe(configs);
		expect(module.get(PlatformRegistryService).get(targets[0].device)).toBe(platform);
		const command = jest.spyOn(configs, 'command'),
			dispatch = jest.spyOn(module.get(PropertyCommandDispatchService), 'dispatchBatch');
		const authenticated = jest.spyOn(module.get(WsAuthService), 'validateClient');
		await app.listen(0, '127.0.0.1');
		const socket = new WebSocket(
			`ws://127.0.0.1:${new URL(await app.getUrl()).port}/socket.io/?EIO=4&transport=websocket`,
		);
		let connected: () => void, failed: (cause: unknown) => void;
		const connection = new Promise<void>((resolve, reject) => {
			connected = resolve;
			failed = reject;
		});
		const acks = new Map<number, (result: SocketResult) => void>();
		let sequence = 0;
		socket.addEventListener('error', failed);
		socket.addEventListener('message', (message) => {
			const packet = message.data as string;
			if (packet.startsWith('0')) socket.send('40' + JSON.stringify({ token: bearer }));
			else if (packet.startsWith('40')) connected();
			else if (packet.startsWith('44')) failed(new Error('Socket namespace authentication refused'));
			else if (packet === '2') socket.send('3');
			else if (packet.startsWith('43')) {
				const index = packet.indexOf('['),
					key = Number(packet.slice(2, index));
				acks.get(key)((JSON.parse(packet.slice(index)) as SocketResult[])[0]);
				acks.delete(key);
			}
		});
		const send = (updates: IDevicePropertyData[]) =>
			new Promise<SocketResult>((resolve) => {
				const request = ++sequence;
				acks.set(request, resolve);
				socket.send(
					`42${request}` +
						JSON.stringify([
							'command',
							{
								event: 'DevicesModule.ChannelProperty.Set',
								payload: {
									request_id: randomUUID(),
									context: { origin: 'panel.device', display_id: displayId },
									properties: updates.map((entry) => ({
										device: id,
										channel: entry.channel.id,
										property: entry.property.id,
										value: entry.value,
									})),
								},
							},
						]),
				);
			});
		try {
			await connection;
			expect(authenticated).toHaveBeenCalledTimes(1);
			await expect(authenticated.mock.results[0].value).resolves.toBe(true);
			const principal = authenticated.mock.calls[0][0].data as {
				user: { type: string; ownerType: string; id: string };
			};
			expect(principal.user).toMatchObject({ type: 'token', ownerType: TokenOwnerType.DISPLAY, id: displayId });
			let revision = 1,
				g = await module.get(VirtualDependencyGraphService).revision();
			for (const updates of [targets.slice(2), targets.slice(0, 2)]) {
				const response = await send(updates);
				expect(response).toMatchObject({
					status: 'ok',
					message: 'Event handled successfully',
					results: [
						{
							handler: 'DevicesModule.Internal.SetPropertyValue',
							success: true,
							data: { results: [{ device: id, success: true }] },
						},
					],
				});
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).revision,
				).toBe(++revision);
				expect(await module.get(VirtualDependencyGraphService).revision()).toBe(++g);
			}
			expect(command).toHaveBeenCalledTimes(2);
			expect(dispatch).toHaveBeenCalledTimes(2);
			const spaceId = randomUUID();
			await database.manager.insert(RoomSpaceEntity, { id: spaceId, name: 'P06d room' });
			const state = module.get(SpaceClimateStateService);
			// Discovery is fixed fixture data; command service, dispatcher, registered platform and useExisting writer remain real.
			jest.spyOn(state, 'getClimateState').mockResolvedValue({
				hasClimate: true,
				mode: ClimateMode.AUTO,
				lastAppliedMode: ClimateMode.AUTO,
				heatingSetpoint: 24,
				coolingSetpoint: 28,
				minSetpoint: 5,
				maxSetpoint: 40,
			} as never);
			jest.spyOn(state, 'getPrimaryClimateDevicesInSpace').mockResolvedValue([
				{
					device: Object.assign(targets[0].device, { status: { online: true, status: ConnectionState.CONNECTED } }),
					deviceCategory: DeviceCategory.THERMOSTAT,
					role: ClimateRole.AUTO,
					heaterChannel: targets[2].channel,
					heaterOnProperty: targets[2].property,
					heaterSetpointProperty: targets[0].property,
					coolerChannel: targets[3].channel,
					coolerOnProperty: targets[3].property,
					coolerSetpointProperty: targets[1].property,
					heaterMinSetpoint: 5,
					heaterMaxSetpoint: 40,
					coolerMinSetpoint: 5,
					coolerMaxSetpoint: 40,
					supportsHeating: true,
					supportsCooling: true,
				} as PrimaryClimateDevice,
			]);
			const result = await module.get(ClimateIntentService).executeClimateIntent(spaceId, {
				type: ClimateIntentType.CLIMATE_SET,
				mode: ClimateMode.HEAT,
				heatingSetpoint: 21,
				coolingSetpoint: 25,
			});
			await expect(dispatch.mock.results[2].value).resolves.toMatchObject({ success: true });
			expect(result).toMatchObject({ success: true, affectedDevices: 1 });
			expect(command).toHaveBeenCalledTimes(3);
			expect(dispatch).toHaveBeenCalledTimes(3);
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).toMatchObject(
				{
					revision: 4,
					requestedMode: 'heat',
					policy: { heatingSetpoint: 21, coolingSetpoint: 25 },
				},
			);
			expect(await module.get(VirtualDependencyGraphService).revision()).toBe(g + 1);
			const write = jest.spyOn(module.get(PropertyValueService), 'write').mockRejectedValueOnce(false);
			const response = await send([{ ...targets[0], value: 22 }]);
			expect(response).toMatchObject({
				status: 'ok',
				results: [{ handler: 'DevicesModule.Internal.SetPropertyValue', success: false, reason: 'Internal error' }],
			});
			expect(write).toHaveBeenCalled();
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).revision,
			).toBe(5);
		} finally {
			if (socket.readyState !== WebSocket.CLOSED) {
				const closed = new Promise<void>((resolve) =>
					socket.addEventListener('close', () => resolve(), { once: true }),
				);
				socket.close();
				await closed;
			}
		}
	});
});
