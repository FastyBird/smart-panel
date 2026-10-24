import { useContainer } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { SqliteDataSource, createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import { DeviceCategory } from '../src/modules/devices/devices.constants';
import { DeviceStructureLockService } from '../src/modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../src/modules/devices/services/property-command-admission.registry.service';
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
	const get = (id: string) =>
		request(app.getHttpServer() as Parameters<typeof request>[0])
			.get(endpoint(id))
			.set('Authorization', `Bearer ${token}`);
	async function seed(comfort = baseConfiguration(), requestedMode: 'heat' | 'off' = 'heat') {
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
			expect(await prepared.runMigrations({ transaction: 'each' })).toHaveLength(49);
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

	it('returns exact independent A HTTP intent after ACK while a real later B completes and GET reads B', async () => {
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
			expect(Reflect.get(source.driver, 'databaseConnection')).not.toBe(
				Reflect.get(database.driver, 'databaseConnection'),
			);
			const realGet = comfort.get.bind(comfort) as VirtualThermostatComfortService['get'];
			let bDone = false;
			const final = jest.spyOn(comfort, 'get').mockImplementationOnce(async (controller) => {
				await other.select(
					id,
					{ expected_revision: 2, expected_graph_revision: input.expected_graph_revision + 1 },
					'away',
					false,
				);
				bDone = true;
				return realGet(controller);
			});
			const response = await post(id, { ...input, preset: 'eco', clear_user_off: false }).expect(201);
			expect(bDone).toBe(true);
			expect(final).toHaveBeenCalledTimes(1);
			expect((response.body as { data: unknown }).data).toEqual(expected(id, input, baseConfiguration(), 'eco'));
			final.mockRestore();
			const latest = await get(id).expect(200);
			expect((latest.body as { data: unknown }).data).toEqual(
				expected(
					id,
					{ expected_revision: 2, expected_graph_revision: input.expected_graph_revision + 1 },
					baseConfiguration(),
					'away',
				),
			);
			expect((await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).revision).toBe(
				3,
			);
		} finally {
			claims.onModuleDestroy();
			await source.destroy();
		}
	});
});
