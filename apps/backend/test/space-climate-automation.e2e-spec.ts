import { useContainer } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import {
	ClimateAutomationDeletionEntity,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../src/modules/devices/entities/climate-automation.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../src/modules/devices/entities/devices.entity';
import { getPropertyMetadata } from '../src/modules/devices/utils/schema.utils';
import { SpaceLifecycleRegistryService } from '../src/modules/spaces/services/space-lifecycle-registry.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import {
	VirtualChannelEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
} from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../src/plugins/devices-virtual/entities/virtual-producer.entity';
import { VirtualThermostatConfigEntity } from '../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { VirtualDependencyGraphService } from '../src/plugins/devices-virtual/services/virtual-dependency-graph.service';
import { readThermostatRecreationHistory } from '../src/plugins/devices-virtual/services/virtual-thermostat-runtime-ownership';
import { VirtualThermostatRuntimeService } from '../src/plugins/devices-virtual/services/virtual-thermostat-runtime.service';
import { VirtualThermostatOwnershipSubscriber } from '../src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber';
import { ActivityDomain, ActivityMode } from '../src/plugins/spaces-home-control/activity/space-activity.constants';
import { defaultActivityConfiguration } from '../src/plugins/spaces-home-control/activity/space-activity.defaults';
import { RoomSpaceEntity } from '../src/plugins/spaces-home-control/entities/room-space.entity';

// Real AppModule, migrations, authentication, authoring and activation. Physical qualification is a separate software fixture gate.
describe('Group A default-migrated authenticated activity climate automation', () => {
	let app: INestApplication;
	let module: TestingModule;
	let database: DataSource;
	let directory: string;
	let token: string;
	let closedCase: { directory: string; database: DataSource; runtime: VirtualThermostatRuntimeService } | undefined;
	const keys = ['NODE_ENV', 'FB_DB_PATH', 'FB_CONFIG_PATH', 'FB_DB_SYNC', 'FB_DB_MIGRATIONS_RUN'];
	let environment: Record<string, string | undefined>;
	const sourceRoot = path.resolve(__dirname, '../src');
	const comfortPath = (id: string) => `/plugins/devices-virtual/producers/thermostats/${id}/comfort`;
	const activityPath = (id: string) => `/modules/spaces/spaces/${id}/activity-modes`;
	const http = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
	const seed = async () => {
		const room = await database.manager.save(database.manager.create(RoomSpaceEntity, { name: 'HTTP activity room' }));
		await database.transaction((manager) => module.get(SpaceLifecycleRegistryService).reconcile(room, manager));
		const controllerId = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id: controllerId,
			name: 'HTTP activity thermostat',
			roomId: room.id,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: randomUUID(),
			device: controllerId,
			name: 'Heater',
			category: ChannelCategory.HEATER,
			identifier: 'heater',
		} as never);
		await database.manager.insert(VirtualThermostatConfigEntity, {
			controllerId,
			ownerDeviceId: controllerId,
			schemaVersion: 1,
			revision: 1,
			requestedMode: 'heat',
			locked: false,
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
		return { roomId: room.id, controllerId };
	};
	const enable = async (id: string) => {
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		await http()
			.put(comfortPath(id))
			.set('Authorization', `Bearer ${token}`)
			.send({
				expected_revision: row.revision,
				expected_graph_revision: await module.get(VirtualDependencyGraphService).revision(),
				heating_range: { minimum: 10, maximum: 30 },
				cooling_range: null,
				presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				automation_enabled: true,
			})
			.expect(200);
	};
	const author = async (roomId: string, climate: object, expected = 1) => {
		const configuration = defaultActivityConfiguration(ActivityMode.WORK);
		for (const domain of Object.values(ActivityDomain)) configuration[domain].enabled = false;
		Object.assign(configuration.climate, { enabled: true }, climate);
		const result = await http()
			.put(activityPath(roomId) + '/work/config')
			.set('Authorization', `Bearer ${token}`)
			.send({ data: { expected_revision: expected, enabled: true, display_order: 0, configuration } })
			.expect(200);
		return (result.body as { data: { activity_revision: number } }).data.activity_revision;
	};
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
		directory = mkdtempSync(path.join(tmpdir(), 'group-a-http-'));
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
		await app.listen(0, '127.0.0.1');
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
				if (app) {
					const originalServer = app.getHttpServer() as { listening: boolean; address(): unknown };
					await app.close();
					expect(originalServer.listening).toBe(false);
					expect(originalServer.address()).toBeNull();
				} else await module?.close();
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

	it.each([false, true])(
		'deletes an authenticated LIVE controller in its original native unit; rollback=%s',
		async (rollback) => {
			const { roomId, controllerId } = await seed();
			await enable(controllerId);
			const revision = await author(roomId, { thermostat_preset: 'eco' });
			await http()
				.post(activityPath(roomId) + '/work/activate')
				.set('Authorization', `Bearer ${token}`)
				.send({ data: { expected_revision: revision } })
				.expect(200);
			const beforeSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const beforeConfig = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect(beforeSlot.state).toBe('LIVE');
			expect(beforeConfig.comfort.automation_baseline).not.toBeNull();
			const events = module.get(EventEmitter2);
			const deleted: unknown[] = [];
			const listener = (value: unknown) => {
				deleted.push(value);
			};
			events.on(EventType.DEVICE_DELETED, listener);
			try {
				if (rollback)
					await database.query(`CREATE TEMP TRIGGER reject_http_delete AFTER DELETE ON devices_module_devices
				WHEN OLD.id='${controllerId}' BEGIN SELECT RAISE(ABORT, 'HTTP deletion rollback'); END`);
				const result = await http()
					.delete(`/modules/devices/devices/${controllerId}`)
					.set('Authorization', `Bearer ${token}`);
				if (rollback) {
					expect(result.status).toBeGreaterThanOrEqual(400);
					expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(
						beforeSlot,
					);
					expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
						beforeConfig,
					);
					expect(await database.manager.findOneBy(VirtualDeviceEntity, { id: controllerId })).not.toBeNull();
					expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
					expect(deleted).toEqual([]);
				} else {
					expect(result.status).toBe(204);
					const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
					const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					const proof = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId });
					expect(slot).toMatchObject({
						state: 'RETIRED',
						manualHold: true,
						controllerIncarnation: beforeSlot.controllerIncarnation,
					});
					expect(slot.slotRevision).toBeGreaterThan(beforeSlot.slotRevision);
					expect(config.ownerDeviceId).toBeNull();
					expect(config.comfort.automation_baseline).toBeNull();
					expect(config.revision).toBeGreaterThan(beforeConfig.revision);
					expect(JSON.parse(proof.nativeConfigurationEvidence)).toEqual(JSON.parse(proof.configurationEvidence));
					expect(await database.manager.findOneBy(VirtualDeviceEntity, { id: controllerId })).toBeNull();
					expect(deleted).toHaveLength(1);
				}
			} finally {
				events.off(EventType.DEVICE_DELETED, listener);
			}
		},
	);

	it.each([{ thermostat_preset: 'eco' }, { mode: 'heat', setpoint: 22 }])(
		'previews without native writes, activates %j through HTTP and deactivates the exact installation',
		async (selection) => {
			const { roomId, controllerId } = await seed();
			await enable(controllerId);
			const revision = await author(roomId, selection);
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const slots = await database.manager.find(ClimateAutomationSlotEntity);
			const graph = await database.manager.find(VirtualGraphRevisionEntity);
			const preview = await http()
				.post(activityPath(roomId) + '/work/preview')
				.set('Authorization', `Bearer ${token}`)
				.send({ data: { expected_revision: revision } })
				.expect(200);
			expect((preview.body as { data: object[] }).data).toContainEqual(
				expect.objectContaining({ domain: 'climate', status: 'ready' }),
			);
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(before);
			expect(await database.manager.find(ClimateAutomationSlotEntity)).toEqual(slots);
			expect(await database.manager.find(VirtualGraphRevisionEntity)).toEqual(graph);
			expect(await database.manager.count(ClimateAutomationSourceEntity)).toBe(0);
			const activated = await http()
				.post(activityPath(roomId) + '/work/activate')
				.set('Authorization', `Bearer ${token}`)
				.send({ data: { expected_revision: revision } })
				.expect(200);
			const state = (activated.body as { data: { activity_status: string; activation_id: string } }).data;
			expect(state.activity_status).toBe('active');
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(slot.state).toBe('LIVE');
			const result = await http().get(comfortPath(controllerId)).set('Authorization', `Bearer ${token}`).expect(200);
			expect((result.body as { data: { effective: object } }).data.effective).toMatchObject({
				source: 'automation',
				heating_setpoint: 'setpoint' in selection ? 22 : 17,
			});
			expect(module.get(VirtualThermostatRuntimeService).readDiagnostics(controllerId).effective_comfort).toMatchObject(
				{ source: 'automation', heating_setpoint: 'setpoint' in selection ? 22 : 17 },
			);
			expect(JSON.stringify(activated.body)).not.toMatch(
				/controllerIncarnation|installEvidence|baselineId|candidateId/,
			);
			await http()
				.post(activityPath(roomId) + '/deactivate')
				.set('Authorization', `Bearer ${token}`)
				.send({ data: { activation_id: state.activation_id } })
				.expect(200);
			expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
				state: 'RETIRED',
				generationId: slot.generationId,
				controllerIncarnation: slot.controllerIncarnation,
			});
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).comfort
					.automation_baseline,
			).toBeNull();
			const manual = await http().get(comfortPath(controllerId)).set('Authorization', `Bearer ${token}`).expect(200);
			expect((manual.body as { data: { effective: object } }).data.effective).toMatchObject({
				source: 'manual',
				heating_setpoint: 20,
			});
		},
	);
	it.each([false, true])(
		'recreates a natively deleted controller through authenticated authoring with fresh private authority and retained runtime; timestamp drift=%s',
		async (timestampDrift) => {
			const { controllerId } = await seed();
			await enable(controllerId);
			await module.get(VirtualThermostatRuntimeService).requestInstalled(controllerId);
			const original = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			await http()
				.delete(`/modules/devices/devices/${controllerId}`)
				.set('Authorization', `Bearer ${token}`)
				.expect(204);
			const retained = await readThermostatRecreationHistory(database.manager, controllerId);
			expect(retained.runtime).toHaveLength(1);
			const sensorDevice = randomUUID(),
				sensorChannel = randomUUID(),
				sensor = randomUUID();
			const relayDevice = randomUUID(),
				relayChannel = randomUUID(),
				relay = randomUUID();
			await database.manager.insert(DeviceEntity, {
				id: sensorDevice,
				name: 'HTTP sensor',
				category: DeviceCategory.SENSOR,
				enabled: true,
			});
			await database.manager.insert(ChannelEntity, {
				id: sensorChannel,
				device: sensorDevice,
				name: 'Temperature',
				identifier: 'temperature',
				category: ChannelCategory.TEMPERATURE,
			} as never);
			await database.manager.insert(ChannelPropertyEntity, {
				id: sensor,
				channel: sensorChannel,
				identifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				unit: '°C',
				permissions: [PermissionType.READ_ONLY],
			} as never);
			await database.manager.insert(ShellyNgDeviceEntity, {
				id: relayDevice,
				name: 'HTTP relay',
				identifier: 'shellyplus1pm-' + randomUUID(),
				canonicalMac: 'A8032ABE5084',
				category: DeviceCategory.SWITCHER,
				enabled: true,
			});
			await database.manager.insert(ShellyNgChannelEntity, {
				id: relayChannel,
				device: relayDevice,
				name: 'Switch',
				identifier: 'switch:0',
				category: ChannelCategory.SWITCHER,
			} as never);
			await database.manager.insert(ShellyNgChannelPropertyEntity, {
				id: relay,
				channel: relayChannel,
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
			const settings: { setting: string; property: string }[] = [];
			const property = (category: ChannelCategory, name: PropertyCategory, setting?: string) => {
				const metadata = getPropertyMetadata(category, name),
					id = randomUUID();
				if (setting) settings.push({ setting, property: id });
				return {
					id,
					type: 'virtual',
					identifier: name,
					category: name,
					data_type: metadata.data_type,
					permissions: [PermissionType.READ_ONLY],
					value_origin: 'local',
					format: metadata.format,
				};
			};
			const channel = (category: ChannelCategory, properties: ReturnType<typeof property>[]) => ({
				id: randomUUID(),
				type: 'virtual',
				identifier: category,
				name: category,
				category,
				properties,
			});
			const channels = [
				channel(ChannelCategory.TEMPERATURE, [property(ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE)]),
				channel(ChannelCategory.THERMOSTAT, [property(ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED, 'locked')]),
				channel(
					ChannelCategory.DEVICE_INFORMATION,
					[
						PropertyCategory.MANUFACTURER,
						PropertyCategory.MODEL,
						PropertyCategory.SERIAL_NUMBER,
						PropertyCategory.STATUS,
					].map((name) => property(ChannelCategory.DEVICE_INFORMATION, name)),
				),
				channel(ChannelCategory.HEATER, [
					property(ChannelCategory.HEATER, PropertyCategory.ON, 'heating_enabled'),
					property(ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, 'heating_setpoint'),
					property(ChannelCategory.HEATER, PropertyCategory.STATUS),
				]),
			];
			const create = {
				device: {
					id: controllerId,
					type: 'virtual',
					name: 'Recreated HTTP thermostat',
					category: DeviceCategory.THERMOSTAT,
					mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
					channels,
				},
				configuration: {
					schema_version: 1,
					expected_revision: 0,
					expected_graph_revision: await module.get(VirtualDependencyGraphService).revision(),
					requested_mode: 'off',
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
					contact_opening_ms: 0,
					contact_closing_ms: 0,
					sources: [{ role: 'ambient', source_property: sensor, maximum_age_seconds: 300 }],
					actuators: [{ role: 'heating', source_property: relay, lease_seconds: 30 }],
					settings,
				},
			};
			await http().post('/plugins/devices-virtual/producers/thermostats').send(create).expect(401);
			const beforeConfig = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const beforeSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const beforeProof = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId });
			let crossed = false;
			const intruder: EntitySubscriberInterface<ChannelPropertyEntity> = {
				listenTo: () => ChannelPropertyEntity,
				beforeUpdate: (event: UpdateEvent<ChannelPropertyEntity>) => {
					if (timestampDrift && event.entity?.permissions) {
						crossed = true;
						event.entity.updatedAt = new Date(0);
					}
				},
			};
			const created: unknown[] = [];
			const onCreated = (value: unknown) => {
				created.push(value);
			};
			module.get(EventEmitter2).on(EventType.DEVICE_CREATED, onCreated);
			database.subscribers.push(intruder);
			let response: request.Response;
			try {
				response = await http()
					.post('/plugins/devices-virtual/producers/thermostats')
					.set('Authorization', `Bearer ${token}`)
					.send(create);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(intruder), 1);
				module.get(EventEmitter2).off(EventType.DEVICE_CREATED, onCreated);
			}
			if (timestampDrift) {
				expect(crossed).toBe(true);
				expect(response.status).toBe(422);
				expect(response.body as unknown).toMatchObject({
					message: 'Thermostat affected rows changed during the native operation.',
				});
				expect(await database.manager.findOneBy(VirtualDeviceEntity, { id: controllerId })).toBeNull();
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					beforeConfig,
				);
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(
					beforeSlot,
				);
				expect(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId })).toEqual(
					beforeProof,
				);
				for (const channel of channels) {
					expect(await database.manager.findOneBy(ChannelEntity, { id: channel.id })).toBeNull();
					for (const property of channel.properties)
						expect(await database.manager.findOneBy(ChannelPropertyEntity, { id: property.id })).toBeNull();
				}
				expect(created).toEqual([]);
				return;
			}
			expect(crossed).toBe(false);
			expect(created).toHaveLength(1);
			expect(response.status === 201 ? null : (response.body as unknown)).toBeNull();
			expect(response.status).toBe(201);
			expect(JSON.stringify(response.body)).not.toMatch(
				/controllerIncarnation|recreationArchive|nativeConfigurationEvidence|consumedByIncarnation/,
			);
			const successor = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(successor.state).toBe('EMPTY');
			expect(successor.controllerIncarnation).not.toBe(original.controllerIncarnation);
			expect(successor.slotRevision).toBeGreaterThan(original.slotRevision);
			const proof = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { controllerId });
			expect(proof.consumedByIncarnation).toBe(successor.controllerIncarnation);
			const archive = JSON.parse(proof.controllerEvidence) as {
				recreationArchive: { history: { runtime: { decisionRevision: number }[] } };
			};
			expect(archive.recreationArchive.history.runtime).toHaveLength(1);
			expect(archive.recreationArchive.history.runtime[0].decisionRevision).toBeGreaterThanOrEqual(
				retained.runtime[0].decisionRevision as number,
			);
			const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect(config.comfort?.automation_enabled ?? false).toBe(false);
			expect(config.comfort?.automation_baseline ?? null).toBeNull();
		},
	);

	it('requires authentication and explicit opt-in, and never derives an unsupported preset from the activity name', async () => {
		const { roomId, controllerId } = await seed();
		const revision = await author(roomId, { thermostat_preset: 'comfort' });
		await http()
			.post(activityPath(roomId) + '/work/activate')
			.send({ data: { expected_revision: revision } })
			.expect(401);
		const attempt = async () =>
			http()
				.post(activityPath(roomId) + '/work/activate')
				.set('Authorization', `Bearer ${token}`)
				.send({ data: { expected_revision: revision } })
				.expect(200);
		const disabled = await attempt();
		expect((disabled.body as { data: { activity_results: object[] } }).data.activity_results).toContainEqual(
			expect.objectContaining({ domain: 'climate', status: 'unsupported' }),
		);
		expect(await database.manager.countBy(ClimateAutomationSlotEntity, { state: 'LIVE' })).toBe(0);
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).comfort,
		).toBeNull();
		await enable(controllerId);
		const unsupported = await attempt();
		expect((unsupported.body as { data: { activity_results: object[] } }).data.activity_results).toContainEqual(
			expect.objectContaining({ domain: 'climate', status: 'unsupported' }),
		);
		expect(await database.manager.countBy(ClimateAutomationSlotEntity, { state: 'LIVE' })).toBe(0);
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).policy.heatingSetpoint,
		).toBe(20);
	});
});
