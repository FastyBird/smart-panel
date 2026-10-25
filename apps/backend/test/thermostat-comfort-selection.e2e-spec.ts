import { useContainer } from 'class-validator';
import crypto, { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { DataSource } from 'typeorm';

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
import { DeviceCategory } from '../src/modules/devices/devices.constants';
import { DeviceStructureLockService } from '../src/modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../src/modules/devices/services/property-command-admission.registry.service';
import {
	ThermostatComfortPresetDto,
	ThermostatComfortRangeDto,
} from '../src/plugins/devices-virtual/dto/thermostat-comfort.dto';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../src/plugins/devices-virtual/entities/virtual-producer.entity';
import { VirtualThermostatConfigEntity } from '../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { VirtualDependencyGraphService } from '../src/plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from '../src/plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from '../src/plugins/devices-virtual/services/virtual-thermostat-comfort.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
} from '../src/plugins/devices-virtual/services/virtual-thermostat-comfort.utils';
import { VirtualThermostatRuntimeService } from '../src/plugins/devices-virtual/services/virtual-thermostat-runtime.service';
import { VirtualThermostatOwnershipSubscriber } from '../src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber';

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
	beforeAll(async () => {
		environment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
		directory = mkdtempSync(path.join(tmpdir(), 'p06a-http-'));
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
		await module?.get(VirtualThermostatRuntimeService).flush();
	});
	afterAll(async () => {
		try {
			await module?.get(VirtualThermostatRuntimeService).flush();
			await app?.close();
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
		await post(id, { ...input, expected_revision: 9, preset: 'eco', clear_user_off: false }).expect(422);
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
				await lifecyclePost(id, '/override', { ...(await fences(id)), ...body }).expect(201);
				await module.get(VirtualThermostatRuntimeService).flush();
			}
			const input = await fences(id),
				source = await new SqliteDataSource({
					type: 'sqlite',
					database: database.options.database as string,
					entities: [sourceRoot + '/**/*.entity.ts'],
				}).initialize();
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
				expect(lock).not.toBe(module.get(DeviceStructureLockService));
				expect(Reflect.get(source.driver, 'databaseConnection')).not.toBe(
					Reflect.get(database.driver, 'databaseConnection'),
				);
				expect(Reflect.get(comfort, 'leases')).not.toBe(Reflect.get(other, 'leases'));
				const original = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
				let bSuccess = 0;
				const final = jest.spyOn(comfort, 'get').mockImplementationOnce(async (controller, settle) => {
					jest.spyOn(crypto, 'randomUUID').mockReturnValue(bId);
					await other.override(
						id,
						{
							expected_revision: input.expected_revision + 1,
							expected_graph_revision: input.expected_graph_revision + 1,
						},
						{ preset: null, setpoints: { heating_setpoint: 19, cooling_setpoint: null }, expires_at: body.expires_at },
						'B',
						'panel',
					);
					bSuccess++;
					return original(controller, settle);
				});
				const response =
					kind === 'override'
						? await lifecyclePost(id, '/override', { ...input, ...body }).expect(201)
						: await lifecyclePost(id, '/override/cancel', { ...input, override_id: aId }).expect(201);
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
				clock.restore();
			}
		},
	);
});
