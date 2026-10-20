/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { createProtectionProbe, memberInstallationSetup } from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource, hasCurrentSqliteConnectionLease } from '../../../common/database/sqlite-data-source';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { AddVirtualThermostatClaims1000000000031 } from '../../../migrations/1000000000031-AddVirtualThermostatClaims';
import { AddVirtualThermostatRuntime1000000000032 } from '../../../migrations/1000000000032-AddVirtualThermostatRuntime';
import { AddVirtualThermostatRecoveries1000000000034 } from '../../../migrations/1000000000034-AddVirtualThermostatRecoveries';
import { AddVirtualThermostatComfort1000000000039 } from '../../../migrations/1000000000039-AddVirtualThermostatComfort';
import { AddThermostatBranchGroups1000000000040 } from '../../../migrations/1000000000040-AddThermostatBranchGroups';
import { AddThermostatMemberProtection1000000000041 } from '../../../migrations/1000000000041-AddThermostatMemberProtection';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import { OpenApiResponseInterceptor } from '../../../modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../../../modules/api/interceptors/transform-response.interceptor';
import { ConfigService as ModuleConfigService } from '../../../modules/config/services/config.service';
import {
	ClimateAutomationRuntimeCheckpoint,
	ClimateAutomationRuntimeConsumer,
} from '../../../modules/devices/contracts/climate-automation.contract';
import { ClimateAutomationWriteError } from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { SceneActionEntity, SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { SceneExecutorService } from '../../../modules/scenes/services/scene-executor.service';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { nativeVoltmeterVoltageIdentity } from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { LocalScenePlatform } from '../../scenes-local/platforms/local-scene.platform';
import { SCENES_LOCAL_TYPE } from '../../scenes-local/scenes-local.constants';
import { ClimateIntentService } from '../../spaces-home-control/services/climate-intent.service';
import { PrimaryClimateDevice } from '../../spaces-home-control/services/space-climate-state.service';
import { ClimateIntentType, ClimateMode, ClimateRole } from '../../spaces-home-control/spaces-home-control.constants';
import { VirtualThermostatConfigController } from '../controllers/virtual-thermostat-config.controller';
import { ConfigureVirtualThermostatDto } from '../dto/thermostat-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatInstallationAuditEntity } from '../entities/thermostat-installation.entity';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';
import { VirtualDevicePlatform } from '../platforms/virtual-device.platform';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import {
	resolveThermostatProtectionSource,
	validateThermostatProtectionRows,
} from './thermostat-protection-source.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import {
	ThermostatCommandAuthority,
	ThermostatInstalledQualification,
	VirtualThermostatClaimsService,
} from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { effectiveThermostatComfort } from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import { VirtualThermostatTransportService } from './virtual-thermostat-transport.service';
import { VirtualTransformResolver } from './virtual-transform-resolver';

/** Erased original-function view: same function object, explicit original receiver and result. */
type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFunctions<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };

const nativeObjectEvidence: Readonly<{
	getOwnPropertyDescriptor: (
		receiver: object,
		key: PropertyKey,
	) => (Omit<PropertyDescriptor, 'value'> & { readonly value?: unknown }) | undefined;
}> = Object;

jest.setTimeout(30_000);

describe('thermostat persistent ownership and draft configuration', () => {
	let directory: string;
	let database: SqliteDataSource;
	let second: SqliteDataSource;
	let registry: PropertyCommandAdmissionRegistryService;
	let claims: VirtualThermostatClaimsService;
	let configs: VirtualThermostatConfigService;
	let events: EventEmitter2;
	let values: PropertyValueService;
	let structure: DeviceStructureLockService;
	let graph: VirtualDependencyGraphService;
	let pipeline: TestingModule;
	let backend: StoragePlugin;
	let writer: ClimateAutomationWriterService;
	let ownership: ClimateAutomationRegistryService;
	let automation: VirtualThermostatAutomationService;
	let comfort: VirtualThermostatComfortService;
	const registerOriginal = (
		configurations = configs,
		actualWriter = writer,
		actualRegistry = ownership,
		actualGraph = graph,
		actualComfort = comfort,
	) => {
		if (actualRegistry === ownership) automation?.onModuleDestroy();
		const next = new VirtualThermostatAutomationService(
			actualWriter,
			actualRegistry,
			actualGraph,
			new NestConfigService({ FB_CLI: 'off' }),
			undefined,
			configurations,
			actualComfort,
		);
		next.onModuleInit();
		if (actualRegistry === ownership) automation = next;
		return next;
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-thermostat-'));
		const options = {
			type: 'sqlite' as const,
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		};
		database = await new SqliteDataSource({ ...options, synchronize: true }).initialize();
		// Synchronized test schemas omit migration27's installed graph singleton seed.
		await database.query('INSERT INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)');
		expect(await database.query('SELECT "id", "revision" FROM "devices_virtual_graph_revision" ORDER BY "id"')).toEqual(
			[{ id: 1, revision: 0 }],
		);
		second = await new SqliteDataSource(options).initialize();
		await database.query('PRAGMA busy_timeout = 5000');
		await second.query('PRAGMA busy_timeout = 5000');
		registry = new PropertyCommandAdmissionRegistryService();
		events = new EventEmitter2();
		structure = new DeviceStructureLockService();
		ownership = new ClimateAutomationRegistryService();
		writer = new ClimateAutomationWriterService(
			database,
			structure,
			ownership,
			new NestConfigService({ FB_CLI: 'off' }),
		);
		graph = new VirtualDependencyGraphService(database, new NestConfigService({ FB_CLI: 'off' }), writer);
		claims = new VirtualThermostatClaimsService(database, structure, graph, registry, events);
		pipeline = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				PropertyValueLockService,
				PropertyValueSourceRegistryService,
				PropertyProducerRegistryService,
				StorageService,
				{ provide: DataSource, useValue: database },
				{ provide: EventEmitter2, useValue: events },
				{ provide: NestConfigService, useValue: new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{
					provide: ModuleConfigService,
					useValue: {
						getModuleConfig: () =>
							Object.assign(new StorageConfigModel(), { primaryStorage: 'existing-config-fixture' }),
					},
				},
			],
		}).compile();
		const storage = pipeline.get(StorageService);
		const plugin: StoragePlugin = {
			name: 'existing-config-fixture',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => true,
			writePoints: () => Promise.resolve(),
			query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('No raw fixture history')),
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		backend = plugin;
		storage.registerPlugin(plugin.name, plugin);
		values = pipeline.get(PropertyValueService);
		configs = new VirtualThermostatConfigService(database, structure, graph, claims, events, values, undefined, writer);
		comfort = new VirtualThermostatComfortService(database, structure, graph, claims, events, writer);
		registerOriginal();
		await graph.onApplicationBootstrap();
		await claims.onApplicationBootstrap();
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
	});
	afterEach(async () => {
		automation?.onModuleDestroy();
		comfort?.onModuleDestroy();
		claims?.onModuleDestroy();
		await pipeline?.close();
		ownership?.onModuleDestroy();
		if (second?.isInitialized) await second.destroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const owner = async () => {
		const id = uuid();
		await database.getRepository(VirtualDeviceEntity).insert({
			id,
			name: 'Thermostat',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		return id;
	};
	const ambient = async (mode?: VirtualDeviceMode) => {
		const device = uuid(),
			channel = uuid(),
			property = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: device,
			name: 'Room temperature',
			category: DeviceCategory.SENSOR,
			enabled: true,
			...(mode ? { mode } : {}),
		} as never);
		await database.getRepository(mode ? VirtualChannelEntity : ChannelEntity).insert({
			id: channel,
			name: 'Temperature',
			identifier: 'temperature',
			device,
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id: property,
			channel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		return property;
	};
	const actuator = async (mac = 'A8032ABE5084') => {
		const device = uuid(),
			channel = uuid(),
			property = uuid();
		await database.getRepository(ShellyNgDeviceEntity).insert({
			id: device,
			name: '1PM',
			identifier: 'shellyplus1pm-' + mac.toLowerCase(),
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: mac,
		});
		await database.getRepository(ShellyNgChannelEntity).insert({
			id: channel,
			name: 'Switch',
			identifier: 'switch:0',
			device,
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.getRepository(ShellyNgChannelPropertyEntity).insert({
			id: property,
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		return property;
	};
	const setting = async (controller: string, category: ChannelCategory, propertyCategory: PropertyCategory) => {
		const channel = uuid(),
			property = uuid();
		await database
			.getRepository(VirtualChannelEntity)
			.insert({ id: channel, name: 'Control', category, device: controller } as never);
		await database.getRepository(VirtualChannelPropertyEntity).insert({
			id: property,
			channel,
			category: propertyCategory,
			identifier: propertyCategory,
			dataType: propertyCategory === PropertyCategory.TEMPERATURE ? DataTypeType.FLOAT : DataTypeType.BOOL,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.LOCAL,
		} as never);
		return property;
	};
	const target = async (id: string, value: boolean | number): Promise<IDevicePropertyData> => {
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		return { property, channel, device: channel.device as DeviceEntity, value };
	};
	const dto = (sensor: string, heat: string): ConfigureVirtualThermostatDto => ({
		schemaVersion: 1,
		expectedRevision: 0,
		requestedMode: 'off',
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
		sources: [{ role: 'ambient', sourcePropertyId: sensor, maximumAgeSeconds: 300 }],
		actuators: [{ role: 'heating', sourcePropertyId: heat, leaseSeconds: 30 }],
		settings: [],
	});

	const protectMembers = async (input: ConfigureVirtualThermostatDto) => {
		input.policy.floor = { limit: 30, recoveryHysteresis: 2 };
		for (const member of input.actuators.filter((entry) => entry.role === 'heating')) {
			const probe = await createProtectionProbe(database, member.sourcePropertyId);
			member.protection = {
				schemaVersion: 1,
				kind: 'local_floor',
				sourcePropertyId: probe.sourceId,
				maximumAgeSeconds: 5,
			};
		}
	};

	it('requires explicit protection for every parallel heating member and retains it through omission, null and missing source edits', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			first = await actuator(),
			secondRelay = await actuator('A8032ABE5099');
		const input = dto(sensor, first);
		input.actuators.push({ role: 'heating', sourcePropertyId: secondRelay, leaseSeconds: 30 });
		await expect(configs.configure(controller, input)).rejects.toThrow(/protection|floor source/);
		await protectMembers(input);
		const configured = await configs.configure(controller, input);
		const changed = {
			...input,
			expectedRevision: configured.revision,
			actuators: input.actuators.map((member) => ({ ...member })),
		};
		delete changed.actuators[0].protection;
		await expect(configs.configure(controller, changed)).rejects.toThrow(/protection|floor source/);
		changed.actuators[0].protection = null;
		await expect(configs.configure(controller, changed)).rejects.toThrow(/local floor|floor source/);
		changed.actuators[0].protection = { ...input.actuators[1].protection };
		await expect(configs.configure(controller, changed)).rejects.toThrow('actuator Shelly');
		expect((await configs.get(controller)).actuators.map((member) => member.id)).toEqual(
			configured.actuators.map((member) => member.id),
		);
	});
	it('keeps a selected display member separate from a retained mandatory global floor input', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			globalFloor = await ambient(),
			first = await actuator(),
			secondRelay = await actuator('A8032ABE5099');
		const input = dto(sensor, first);
		input.actuators.push({ role: 'heating', sourcePropertyId: secondRelay, leaseSeconds: 30 });
		await protectMembers(input);
		input.sources.push({ role: 'floor', sourcePropertyId: globalFloor, maximumAgeSeconds: 5 });
		const configured = await configs.configure(controller, input);
		const selected = await configs.configure(controller, {
			...input,
			expectedRevision: configured.revision,
			displayFloorClaimId: configured.actuators[0].id,
		});
		expect(selected.display_floor_claim).toBe(configured.actuators[0].id);
		expect(selected.sources.some((source) => source.role === 'floor' && source.source_property === globalFloor)).toBe(
			true,
		);
		expect(selected.actuators.every((member) => member.protection?.kind === 'local_floor')).toBe(true);
	});

	it('bounds mandatory members across both branches and preserves same-mode identities without opposed qualification', async () => {
		const controller = await owner(),
			sensor = await ambient();
		const members = await Promise.all(
			Array.from({ length: 9 }, (_, index) => actuator(`A8032ABE50${String(index).padStart(2, '0')}`)),
		);
		const input = dto(sensor, members[0]);
		input.actuators = members.map((sourcePropertyId) => ({ role: 'heating', sourcePropertyId, leaseSeconds: 30 }));
		await expect(configs.configure(controller, input)).rejects.toThrow('branches');
		const mixed: ConfigureVirtualThermostatDto = {
			...input,
			policy: { ...input.policy, coolingSetpoint: 24 },
			actuators: input.actuators.map((member, index) => ({ ...member, role: index < 4 ? 'heating' : 'cooling' })),
		};
		await expect(configs.preview(controller, mixed)).rejects.toThrow('branches');
		mixed.actuators.pop();
		await protectMembers(mixed);
		expect((await configs.preview(controller, mixed)).actuators).toHaveLength(8);
		input.actuators.pop();
		await protectMembers(input);
		const configured = await configs.configure(controller, input);
		expect(configured.actuators).toHaveLength(8);
		const retained = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			id: configured.actuators[0].id,
		});
		claims.recordQualification({
			physicalIdentity: retained.physicalIdentity,
			qualificationGeneration: retained.qualificationGeneration,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'installed-fixture',
				model: 'SNSW-001P16EU',
				firmware: 'fixture-only',
				componentId: 0,
				evidenceId: 'installed-fixture',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		expect(claims.qualification(retained, false)).not.toBeNull();
		await expect(
			database.manager.insert(VirtualThermostatActuatorClaimEntity, {
				...retained,
				id: uuid(),
				physicalIdentity: 'ninth-physical-member',
			}),
		).rejects.toThrow('eight');

		expect(new Set(configured.actuators.map((claim) => claim.group_identity)).size).toBe(1);
		const changed = await configs.configure(controller, { ...input, expectedRevision: configured.revision });
		expect(changed.actuators.map((claim) => claim.id)).toEqual(configured.actuators.map((claim) => claim.id));
		await expect(registry.assertAllowed(await target(members[7], true))).rejects.toThrow('reserved');
		const duplicate = dto(sensor, members[8]);
		duplicate.actuators.push({ ...duplicate.actuators[0] });
		await expect(configs.preview(await owner(), duplicate)).rejects.toThrow('same physical actuator');
		const detached = { ...input, expectedRevision: changed.revision, actuators: input.actuators.slice(1) };
		await expect(configs.configure(controller, detached)).rejects.toThrow('cannot be detached');
		const opposed = dto(sensor, members[8]);
		opposed.policy.coolingSetpoint = 24;
		opposed.actuators.push({ ...opposed.actuators[0], role: 'cooling' });
		await expect(configs.preview(await owner(), opposed)).rejects.toThrow('same physical actuator');
	});

	it('upgrades actual legacy singleton rows in place with unresolved journal, release state and qualification generation', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const runner = database.createQueryRunner();
		for (const table of [
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_thermostat_runtime',
			'devices_virtual_thermostat_recoveries',
			'devices_virtual_thermostat_settings',
			'devices_virtual_thermostat_sources',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_configs',
		])
			await runner.query(`DROP TABLE "${table}"`);
		await new AddVirtualThermostatClaims1000000000031().up(runner);
		await new AddVirtualThermostatRuntime1000000000032().up(runner);
		await new AddVirtualThermostatRecoveries1000000000034().up(runner);
		const policy = dto(sensor, relay).policy,
			claimId = uuid();
		const physical = await target(relay, false);
		const identity = `shelly-ng:A8032ABE5084:switch:0:output`;
		await runner.query(
			`INSERT INTO "devices_virtual_thermostat_configs" ("controllerId", "ownerDeviceId", "schemaVersion", "revision", "requestedMode", "locked", "policy", "contactOpeningMs", "contactClosingMs", "configuredAt", "releaseRequestedAt") VALUES (?, ?, 1, 7, 'off', 0, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			[controller, controller, JSON.stringify(policy)],
		);
		await runner.query(
			`INSERT INTO "devices_virtual_thermostat_actuator_claims" ("id", "controllerId", "role", "physicalIdentity", "sourcePropertyId", "sourcePropertyIdentity", "sourceDeviceId", "sourceDeviceIdentity", "contractFingerprint", "revision", "qualificationGeneration", "state", "leaseSeconds", "reason", "releaseRequestedAt", "releaseEvidence") VALUES (?, ?, 'heating', ?, ?, ?, ?, ?, 'legacy-contract', 9, 'legacy-generation', 'releasing', 30, 'explicit_release_requested', CURRENT_TIMESTAMP, ?)`,
			[
				claimId,
				controller,
				identity,
				relay,
				relay,
				physical.device.id,
				physical.device.id,
				JSON.stringify({ evidenceId: 'previous-proof' }),
			],
		);
		const commandId = uuid();
		await runner.query(
			`INSERT INTO "devices_virtual_thermostat_command_journal" ("id", "controllerId", "claimId", "claimRevision", "configurationRevision", "decisionRevision", "action", "status", "preparedAt", "dispatchedAt", "fault") VALUES (?, ?, ?, 8, 6, 12, 'on', 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'late_on')`,
			[commandId, controller, claimId],
		);
		await runner.query(
			`INSERT INTO "devices_virtual_thermostat_branch_runtime" ("claimId", "activity", "lastVerifiedOffAt", "releaseProofId", "releaseAttempts", "nextReleaseAt", "fault") VALUES (?, 'unknown', CURRENT_TIMESTAMP, 'earlier-proof', 3, CURRENT_TIMESTAMP, 'release_pending')`,
			[claimId],
		);
		const beforeBranch: unknown = await runner.query('SELECT * FROM "devices_virtual_thermostat_branch_runtime"');
		const beforeConfig: unknown = await runner.query('SELECT * FROM "devices_virtual_thermostat_configs"');
		const beforeClaims: unknown = await runner.query('SELECT * FROM "devices_virtual_thermostat_actuator_claims"');
		const beforeJournal: unknown = await runner.query('SELECT * FROM "devices_virtual_thermostat_command_journal"');
		await new AddVirtualThermostatComfort1000000000039().up(runner);
		await new AddThermostatBranchGroups1000000000040().up(runner);
		await runner.query('DROP TABLE "devices_virtual_thermostat_member_protection"');
		await runner.query('ALTER TABLE "devices_shelly_ng_sample_sources" DROP COLUMN "installationSnapshot"');
		await new AddThermostatMemberProtection1000000000041().up(runner);
		await runner.query('DROP TABLE "devices_module_climate_automation_slots"');
		await runner.query('DROP TABLE "devices_module_climate_automation_sources"');
		await new AddClimateAutomationOwnership1000000000047().up(runner);
		expect(
			(
				(await runner.query('SELECT * FROM "devices_virtual_thermostat_branch_runtime"')) as Record<string, unknown>[]
			).map(({ floorLatched: _latch, ...row }) => row),
		).toEqual(beforeBranch);
		const afterConfig = (await runner.query('SELECT * FROM "devices_virtual_thermostat_configs"')) as Record<
			string,
			unknown
		>[];
		expect(
			afterConfig.map(
				({ controlStrategy: _strategy, comfort: _comfort, displayFloorClaimId: _display, ...row }) => row,
			),
		).toEqual(beforeConfig);

		expect(afterConfig[0].comfort).toBeNull();
		expect(await runner.query('SELECT * FROM "devices_virtual_thermostat_command_journal"')).toEqual(beforeJournal);
		const afterClaims = (await runner.query('SELECT * FROM "devices_virtual_thermostat_actuator_claims"')) as Record<
			string,
			unknown
		>[];
		expect(afterClaims.map(({ providerProfile: _profile, providerProfileVersion: _version, ...row }) => row)).toEqual(
			beforeClaims,
		);
		await claims.refresh();
		expect((await configs.get(controller)).actuators[0]).toMatchObject({
			id: claimId,
			revision: 9,
			qualification_generation: 'legacy-generation',
			state: 'releasing',
			provider_profile: 'shelly-ng.guarded-switch',
			group_identity: `${controller}:heating`,
		});
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
		await runner.release();
	});

	it('retains sibling ownership and release demand through parallel disable, delete refusal, remap refusal and member recovery', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			first = await actuator(),
			second = await actuator('A8032ABE5099');
		const input = dto(sensor, first);
		input.actuators.push({ role: 'heating', sourcePropertyId: second, leaseSeconds: 30 });
		await protectMembers(input);
		const configured = await configs.configure(controller, input);
		await expect(database.manager.delete(DeviceEntity, { id: controller })).rejects.toThrow('reserved');
		await expect(
			configs.configure(controller, {
				...input,
				expectedRevision: configured.revision,
				actuators: [input.actuators[0]],
			}),
		).rejects.toThrow('cannot be detached');
		await database.manager.update(DeviceEntity, { id: controller }, { enabled: false });
		const disabled = await configs.get(controller);
		expect(disabled.actuators.every((claim) => claim.state === 'releasing')).toBe(true);
		const firstClaim = disabled.actuators.find((claim) => claim.source_property === first);
		const siblingClaim = disabled.actuators.find((claim) => claim.source_property === second);
		const restored = await configs.restoreActuator(
			controller,
			firstClaim.id,
			{
				expectedRevision: disabled.revision,
				expectedClaimRevision: firstClaim.revision,
				physicalIdentity: firstClaim.physical_identity,
				sourcePropertyId: first,
				reason: 'operator checked the same retained physical actuator',
				disconnectionAcknowledged: true,
			},
			'operator',
		);
		expect(restored.actuators.find((claim) => claim.id === siblingClaim.id)).toEqual(siblingClaim);
		expect(restored.actuators.find((claim) => claim.id === firstClaim.id)).toMatchObject({
			id: firstClaim.id,
			state: 'releasing',
			physical_identity: firstClaim.physical_identity,
		});
		expect(restored.actuators.find((claim) => claim.id === firstClaim.id).qualification_generation).not.toBe(
			firstClaim.qualification_generation,
		);
		await expect(registry.assertAllowed(await target(second, true))).rejects.toThrow('reserved');
	});

	it('roundtrips draft authoring over HTTP with durable identities, exclusive claims and revision validation', async () => {
		const controller = await owner(),
			competitor = await owner(),
			sensor = await ambient(),
			floor = await ambient(),
			relay = await actuator(),
			heatingSetting = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
		const input = dto(sensor, relay);
		const payload = {
			schema_version: input.schemaVersion,
			expected_revision: input.expectedRevision,
			requested_mode: input.requestedMode,
			policy: { ...input.policy, floor: { limit: 30, recoveryHysteresis: 1 } },
			contact_opening_ms: input.contactOpeningMs,
			contact_closing_ms: input.contactClosingMs,
			sources: [
				{ role: 'ambient', source_property: sensor, maximum_age_seconds: 300 },
				{ role: 'floor', source_property: floor, maximum_age_seconds: 120 },
			],
			actuators: [{ role: 'heating', source_property: relay, lease_seconds: 30 }],
			settings: [{ property: heatingSetting, setting: 'heating_setpoint' }],
		};
		// These authoring routes do not inspect or activate runtime; auth guards are outside this harness.
		const module = await Test.createTestingModule({
			controllers: [VirtualThermostatConfigController],
			providers: [
				{ provide: VirtualThermostatConfigService, useValue: configs },
				{ provide: VirtualThermostatRuntimeService, useValue: {} },
			],
		}).compile();
		const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		try {
			const reflector = module.get(Reflector);
			app.useGlobalInterceptors(new OpenApiResponseInterceptor(reflector), new TransformResponseInterceptor(reflector));
			app.useGlobalPipes(
				new ValidationPipe({
					transform: true,
					whitelist: true,
					forbidNonWhitelisted: true,
					transformOptions: { enableImplicitConversion: true },
					exceptionFactory: (errors) => ValidationExceptionFactory.createException(errors),
				}),
			);
			await app.init();
			const url = `/producers/thermostats/${controller}`;
			const preview = await app.inject({ method: 'POST', url: `${url}/preview`, payload });
			expect(preview.statusCode).toBe(201);
			expect(preview.json<{ data: VirtualThermostatConfigurationModel }>().data).toMatchObject({
				controller,
				readiness: 'draft',
				policy: payload.policy,
			});
			for (const entity of [
				VirtualThermostatConfigEntity,
				VirtualThermostatSourceEntity,
				VirtualThermostatActuatorClaimEntity,
				VirtualThermostatSettingEntity,
			])
				expect(await database.manager.count(entity)).toBe(0);
			expect((await target(heatingSetting, 20)).property.permissions).toEqual([PermissionType.READ_ONLY]);

			const configured = await app.inject({ method: 'PUT', url, payload });
			expect(configured.statusCode).toBe(200);
			const created = configured.json<{ data: VirtualThermostatConfigurationModel }>().data;
			expect(created).toMatchObject({
				controller,
				schema_version: 1,
				revision: 1,
				requested_mode: 'off',
				readiness: 'draft',
				policy: payload.policy,
				sources: expect.arrayContaining([
					expect.objectContaining({
						id: expect.any(String),
						role: 'ambient',
						source_property: sensor,
						source_identity: sensor,
						physical_identity: `property:${sensor}`,
						maximum_age_seconds: 300,
					}),
					expect.objectContaining({ role: 'floor', source_property: floor, maximum_age_seconds: 120 }),
				]),
				actuators: [
					expect.objectContaining({
						id: expect.any(String),
						source_property: relay,
						source_identity: relay,
						physical_identity: expect.any(String),
						revision: 1,
						state: 'reserved',
						lease_seconds: 30,
					}),
				],
				settings: payload.settings,
			});
			expect(created.reasons).toContain('heating_hardware_qualification_missing');
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(
				await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: controller }),
			).toMatchObject({
				id: created.actuators[0].id,
				physicalIdentity: created.actuators[0].physical_identity,
				state: 'reserved',
			});
			const read = await app.inject({ method: 'GET', url });
			expect(read.statusCode).toBe(200);
			expect(read.json<{ data: VirtualThermostatConfigurationModel }>().data).toEqual(created);

			const conflict = await app.inject({
				method: 'PUT',
				url: `/producers/thermostats/${competitor}`,
				payload: { ...payload, settings: [] },
			});
			expect(conflict.statusCode).toBe(422);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);

			const editedPayload = {
				...payload,
				expected_revision: 1,
				policy: { ...payload.policy, heatingSetpoint: 21 },
				sources: payload.sources.map((source) => ({
					...source,
					id: created.sources.find((binding) => binding.role === source.role).id,
				})),
			};
			const edit = await app.inject({ method: 'PUT', url, payload: editedPayload });
			expect(edit.statusCode).toBe(200);
			const edited = edit.json<{ data: VirtualThermostatConfigurationModel }>().data;
			expect(edited.revision).toBe(2);
			expect(edited.policy.heatingSetpoint).toBe(21);
			expect(edited.sources).toEqual(created.sources);
			expect(edited.actuators.map((claim) => claim.id)).toEqual(created.actuators.map((claim) => claim.id));
			expect(edited.settings).toEqual(created.settings);

			const stale = await app.inject({ method: 'PUT', url, payload: editedPayload });
			expect(stale.statusCode).toBe(422);
			expect(stale.json<{ message: string }>().message).toMatch(/revision/i);
			const invalid = await app.inject({
				method: 'PUT',
				url,
				payload: {
					...editedPayload,
					expected_revision: 2,
					sources: [{ ...editedPayload.sources[0], maximum_age_seconds: 0 }],
				},
			});
			expect(invalid.statusCode).toBe(400);
			expect(invalid.json<{ message: string[] }>().message.join(' ')).toContain('maximumAgeSeconds');
			const invalidId = await app.inject({ method: 'GET', url: '/producers/thermostats/not-a-uuid' });
			expect(invalidId.statusCode).toBe(400);
			const afterRejected = await app.inject({ method: 'GET', url });
			expect(afterRejected.statusCode).toBe(200);
			expect(afterRejected.json<{ data: VirtualThermostatConfigurationModel }>().data).toEqual(edited);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		} finally {
			await app.close();
		}
	});

	it('previews without writes; OFF and absent hardware evidence retain exclusive reservation and fail energizing closed', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const input = dto(sensor, relay);
		expect((await configs.preview(controller, input)).reasons).toContain('heating_hardware_qualification_missing');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		const entry = registry.capture();
		const result = await configs.configure(controller, input);
		expect(result.readiness).toBe('draft');
		expect(result.actuators[0].state).toBe('reserved');
		expect(entry.isCurrent()).toBe(false);
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
		expect(() => claims.mintAuthority(result.actuators[0].id, 'on')).toThrow('not admitted');
		const off = claims.mintAuthority(result.actuators[0].id, 'off');
		const reservation = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			id: result.actuators[0].id,
		});
		expect(claims.isAuthorized(off, await target(relay, false))).toBe(true);
		expect(claims.isAuthorized({ ...off } as ThermostatCommandAuthority, await target(relay, false))).toBe(false);
		expect(claims.isAuthorized(off, await target(relay, true))).toBe(false);
		expect(() =>
			claims.recordQualifiedRelease(off, {
				outputConfirmedOff: true,
				pendingOnDrained: false,
				evidenceId: 'readback-only',
				controllerRevision: 1,
				qualification: claims.qualification(reservation, false),
				isCurrent: () => true,
			}),
		).toThrow('drainage');
	});

	it('holds shared structural access through response hydration', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		let release: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		let started: () => void;
		const hydrated = new Promise<void>((resolve) => (started = resolve));
		const qualification = jest.spyOn(claims, 'qualification').mockImplementation(() => {
			started();
			return null;
		});
		const revision = await graph.revision();
		jest.spyOn(graph, 'revision').mockImplementation(async () => {
			await gate;
			return revision;
		});
		const reading = configs.get(controller);
		await hydrated;
		let written = false;
		const writer = structure.runExclusive(() => {
			written = true;
			return Promise.resolve();
		});
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(written).toBe(false);
		release();
		await reading;
		await writer;
		expect(written).toBe(true);
		qualification.mockRestore();
	});

	it('arbitrates concurrent controller creation across two SQLite connections and rolls losing config back', async () => {
		const controllerA = await owner(),
			controllerB = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const secondStructure = new DeviceStructureLockService(),
			secondRegistry = new ClimateAutomationRegistryService(),
			secondWriter = new ClimateAutomationWriterService(
				second,
				secondStructure,
				secondRegistry,
				new NestConfigService({ FB_CLI: 'off' }),
			),
			secondGraph = new VirtualDependencyGraphService(second, new NestConfigService({ FB_CLI: 'off' }), secondWriter);
		const secondClaims = new VirtualThermostatClaimsService(
			second,
			secondStructure,
			secondGraph,
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		const secondConfigs = new VirtualThermostatConfigService(
			second,
			secondStructure,
			secondGraph,
			secondClaims,
			new EventEmitter2(),
			values,
			undefined,
			secondWriter,
		);
		const secondComfort = new VirtualThermostatComfortService(
			second,
			secondStructure,
			secondGraph,
			secondClaims,
			events,
			secondWriter,
		);
		const secondAutomation = registerOriginal(secondConfigs, secondWriter, secondRegistry, secondGraph, secondComfort);
		const outcomes = await Promise.allSettled([
			configs.configure(controllerA, dto(sensor, relay)),
			secondConfigs.configure(controllerB, dto(sensor, relay)),
		]);
		secondAutomation.onModuleDestroy();
		secondComfort.onModuleDestroy();
		secondClaims.onModuleDestroy();
		secondRegistry.onModuleDestroy();
		expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
	});

	it('merged single-bound setpoint validation rolls back configuration and local value writes', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			heat = await actuator(),
			cool = await actuator('A8032ABE5085');
		const heatSetting = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
		const input = dto(sensor, heat);
		input.policy.coolingSetpoint = 24;
		input.actuators.push({ role: 'cooling', sourcePropertyId: cool, leaseSeconds: 30 });
		input.settings = [{ propertyId: heatSetting, setting: 'heating_setpoint' }];
		await configs.configure(controller, input);
		expect((await target(heatSetting, 22)).property.permissions).toEqual([PermissionType.READ_WRITE]);
		const originalMutationMethods: OriginalFunctions<{
			writeMutationWithState: PropertyValueService['writeMutationWithState'];
		}> = values;
		const originalMutation = originalMutationMethods.writeMutationWithState;
		const mutation = jest
			.spyOn(values, 'writeMutationWithState')
			.mockImplementation((...args) => originalMutation.call(values, ...args));
		registerOriginal();
		mutation.mockClear();
		await expect(configs.command([await target(heatSetting, 23)])).rejects.toThrow('overlapping_setpoints');
		expect((await configs.get(controller)).policy.heatingSetpoint).toBe(20);
		expect(mutation).not.toHaveBeenCalled();
		await expect(configs.command([await target(heatSetting, 22)])).resolves.toBe(true);
		expect((await configs.get(controller)).policy.heatingSetpoint).toBe(22);
		expect(mutation).toHaveBeenCalledTimes(1);
	});

	it('routes room climate mode and setpoint pairs through one configured virtual controller command', async () => {
		const controller = await owner();
		const sensor = await ambient();
		const heat = await actuator();
		const cool = await actuator('A8032ABE5085');
		const heatOn = await setting(controller, ChannelCategory.HEATER, PropertyCategory.ON);
		const heatSetpoint = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
		const coolOn = await setting(controller, ChannelCategory.COOLER, PropertyCategory.ON);
		const coolSetpoint = await setting(controller, ChannelCategory.COOLER, PropertyCategory.TEMPERATURE);
		const locked = await setting(controller, ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED);
		await database.manager.update(
			VirtualChannelPropertyEntity,
			{ id: heatSetpoint },
			{
				channel: (await target(heatOn, false)).channel.id,
			},
		);
		await database.manager.update(
			VirtualChannelPropertyEntity,
			{ id: coolSetpoint },
			{
				channel: (await target(coolOn, false)).channel.id,
			},
		);
		const input = dto(sensor, heat);
		input.policy.coolingSetpoint = 24;
		input.actuators.push({ role: 'cooling', sourcePropertyId: cool, leaseSeconds: 30 });
		input.settings = [
			{ propertyId: heatOn, setting: 'heating_enabled' },
			{ propertyId: heatSetpoint, setting: 'heating_setpoint' },
			{ propertyId: coolOn, setting: 'cooling_enabled' },
			{ propertyId: coolSetpoint, setting: 'cooling_setpoint' },
			{ propertyId: locked, setting: 'locked' },
		];
		await configs.configure(controller, input);
		const heatOnTarget = await target(heatOn, false);
		const heatSetpointTarget = await target(heatSetpoint, 20);
		const coolOnTarget = await target(coolOn, false);
		const coolSetpointTarget = await target(coolSetpoint, 24);
		for (const configured of [heatOnTarget, heatSetpointTarget, coolOnTarget, coolSetpointTarget])
			expect(await configs.isRegisteredSetting(configured.property as VirtualChannelPropertyEntity)).toBe(true);
		const device = Object.assign(heatOnTarget.device, {
			status: { online: true, status: ConnectionState.CONNECTED },
		});
		const primary = {
			device,
			deviceCategory: DeviceCategory.THERMOSTAT,
			role: ClimateRole.AUTO,
			temperatureChannel: null,
			temperatureProperty: null,
			humidityChannel: null,
			humidityProperty: null,
			heaterChannel: heatOnTarget.channel,
			heaterOnProperty: heatOnTarget.property,
			heaterStatusProperty: null,
			heaterSetpointProperty: heatSetpointTarget.property,
			heaterMinSetpoint: 15,
			heaterMaxSetpoint: 30,
			coolerChannel: coolOnTarget.channel,
			coolerOnProperty: coolOnTarget.property,
			coolerStatusProperty: null,
			coolerSetpointProperty: coolSetpointTarget.property,
			coolerMinSetpoint: 15,
			coolerMaxSetpoint: 30,
			supportsHeating: true,
			supportsCooling: true,
			thermostatChannel: null,
			thermostatLockedProperty: null,
			fanChannel: null,
			fanOnProperty: null,
		} as PrimaryClimateDevice;
		const platforms = { get: jest.fn(), getCommandTtlMs: jest.fn().mockReturnValue(3000) };
		const virtual = new VirtualDevicePlatform(
			{} as never,
			platforms as never,
			new VirtualDependencyGraphService(database),
			configs,
		);
		platforms.get.mockReturnValue(virtual);
		const dispatchBatch = jest.fn(async (updates: IDevicePropertyData[]) => ({
			success: await virtual.processBatch(updates),
		}));
		const intent = new ClimateIntentService(
			{ findOne: jest.fn().mockResolvedValue({ id: uuid() }) } as never,
			platforms as never,
			{ dispatchBatch } as unknown as PropertyCommandDispatchService,
			{
				getClimateState: jest.fn().mockResolvedValue({
					hasClimate: true,
					mode: ClimateMode.OFF,
					lastAppliedMode: ClimateMode.OFF,
					heatingSetpoint: 20,
					coolingSetpoint: 24,
					minSetpoint: 15,
					maxSetpoint: 30,
				}),
				getPrimaryClimateDevicesInSpace: jest.fn().mockResolvedValue([primary]),
			} as never,
			{ captureSnapshot: jest.fn().mockResolvedValue(null) } as never,
			{ pushSnapshot: jest.fn() } as never,
			{ storeClimateModeChange: jest.fn().mockResolvedValue(undefined) } as never,
			events,
			{} as never,
			{ createIntent: jest.fn().mockReturnValue({ id: uuid() }), completeIntent: jest.fn() } as never,
		);
		for (const [mode, bounds, expectedCount] of [
			[ClimateMode.HEAT, { heatingSetpoint: 21 }, 3],
			[ClimateMode.COOL, { coolingSetpoint: 25 }, 3],
			[ClimateMode.AUTO, { heatingSetpoint: 24, coolingSetpoint: 28 }, 4],
			[ClimateMode.OFF, { heatingSetpoint: 21 }, 3],
		] as const) {
			if (mode === ClimateMode.AUTO)
				await expect(configs.command([await target(heatSetpoint, 24)])).rejects.toThrow('overlapping_setpoints');
			const before = dispatchBatch.mock.calls.length;
			const result = await intent.executeClimateIntent(uuid(), {
				type: ClimateIntentType.CLIMATE_SET,
				mode,
				...bounds,
			});
			expect(dispatchBatch.mock.calls.length).toBe(before + 1);
			expect(result?.success).toBe(true);
			expect(dispatchBatch.mock.calls[before][0]).toHaveLength(expectedCount);
			expect((await configs.get(controller)).requested_mode).toBe(mode);
		}
		expect((await configs.get(controller)).policy).toMatchObject({ heatingSetpoint: 21, coolingSetpoint: 28 });
		const scene = new LocalScenePlatform(
			{} as never,
			{} as never,
			{} as never,
			platforms as never,
			{ dispatchBatch } as unknown as PropertyCommandDispatchService,
			{} as never,
		);
		const byId = new Map(
			[heatOnTarget, heatSetpointTarget, coolOnTarget, coolSetpointTarget].map((entry) => [entry.property.id, entry]),
		);
		jest.spyOn(scene, 'validateActionWithDetails').mockImplementation((action) => {
			const resolved = byId.get((action as { propertyId?: string }).propertyId);
			return Promise.resolve(
				resolved
					? { valid: true, device, channel: resolved.channel, property: resolved.property }
					: { valid: false, error: 'Unknown setting' },
			);
		});
		const sceneActions = [
			{ id: uuid(), type: SCENES_LOCAL_TYPE, deviceId: controller, propertyId: heatOn, value: true },
			{ id: uuid(), type: SCENES_LOCAL_TYPE, deviceId: controller, propertyId: coolOn, value: true },
			{ id: uuid(), type: SCENES_LOCAL_TYPE, deviceId: controller, propertyId: heatSetpoint, value: 27 },
			{ id: uuid(), type: SCENES_LOCAL_TYPE, deviceId: controller, propertyId: coolSetpoint, value: 30 },
		].map((action, order) => ({
			...action,
			order,
			enabled: true,
			configuration: {
				device_id: controller,
				property_id: action.propertyId,
			},
		})) as never;
		await expect(configs.command([await target(heatSetpoint, 27)])).rejects.toThrow('overlapping_setpoints');
		const sceneEntity = Object.assign(new SceneEntity(), {
			id: uuid(),
			name: 'Comfort',
			enabled: true,
			triggerable: true,
			actions: sceneActions,
		});
		const executor = new SceneExecutorService(
			{ getOneOrThrow: () => Promise.resolve(sceneEntity), updateLastTriggered: () => Promise.resolve() } as never,
			events,
			{
				createIntent: jest.fn().mockReturnValue({ id: uuid(), expiresAt: new Date(Date.now() + 10_000) }),
				completeIntent: jest.fn(),
			} as never,
		);
		executor.registerPlatform(scene);
		const beforeScene = dispatchBatch.mock.calls.length;
		expect((await executor.triggerScene(sceneEntity.id)).actionResults.map((result) => result.success)).toEqual([
			true,
			true,
			true,
			true,
		]);
		expect(dispatchBatch.mock.calls.length).toBe(beforeScene + 1);
		expect((await configs.get(controller)).requested_mode).toBe('auto');
		await configs.command([await target(locked, true)]);
		const beforeLocked = dispatchBatch.mock.calls.length;
		const denied = await intent.executeClimateIntent(uuid(), {
			type: ClimateIntentType.CLIMATE_SET,
			mode: ClimateMode.HEAT,
			heatingSetpoint: 23,
		});
		expect(denied?.success).toBe(false);
		expect(dispatchBatch.mock.calls.length).toBe(beforeLocked + 1);
		expect((await executor.triggerScene(sceneEntity.id)).actionResults.map((result) => result.success)).toEqual([
			false,
			false,
			false,
			false,
		]);
		expect(dispatchBatch.mock.calls.length).toBe(beforeLocked + 2);
		expect((await configs.get(controller)).requested_mode).toBe('auto');
		// An explicit unlock is an ordered scene boundary; mode and bounds remain a following atomic batch.
		byId.set(locked, await target(locked, false));
		(sceneEntity as SceneEntity).actions = [
			{
				id: uuid(),
				type: SCENES_LOCAL_TYPE,
				deviceId: controller,
				propertyId: locked,
				value: false,
				order: -1,
				enabled: true,
				configuration: { device_id: controller, property_id: locked },
			} as unknown as SceneActionEntity,
			...(sceneEntity.actions as SceneActionEntity[]),
		];
		const beforeUnlock = dispatchBatch.mock.calls.length;
		expect((await executor.triggerScene(sceneEntity.id)).actionResults.map((result) => result.success)).toEqual([
			true,
			true,
			true,
			true,
			true,
		]);
		expect(dispatchBatch.mock.calls.length).toBe(beforeUnlock + 2);
		expect(dispatchBatch.mock.calls[beforeUnlock][0]).toHaveLength(1);
		expect(dispatchBatch.mock.calls[beforeUnlock + 1][0]).toHaveLength(4);
		const release = await configs.requestRelease(controller, (await configs.get(controller)).revision);
		expect(release.actuators.every((actuator) => actuator.state === 'releasing')).toBe(true);
		await intent.executeClimateIntent(uuid(), {
			type: ClimateIntentType.CLIMATE_SET,
			mode: ClimateMode.HEAT,
			heatingSetpoint: 22,
		});
		await expect(registry.assertAllowed(await target(heat, true))).rejects.toThrow('reserved');
		const claim = (await configs.get(controller)).actuators[0];
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
	});

	it('registers only matching local settings and never authorizes arbitrary owned writers', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const arbitrary = await setting(controller, ChannelCategory.THERMOSTAT, PropertyCategory.ON);
		const input = dto(sensor, relay);
		input.settings = [{ propertyId: arbitrary, setting: 'heating_enabled' }];
		await expect(configs.configure(controller, input)).rejects.toThrow('matching its thermostat role');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatSettingEntity)).toBe(0);
		await expect(configs.command([await target(arbitrary, true)])).rejects.toThrow('registered');
	});

	it('retains missing physical identity and unresolved claims after source deletion; remap never promotes a successor', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const original = await configs.configure(controller, dto(sensor, relay));
		const claim = original.actuators[0];
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: relay });
		claims.invalidate();
		await claims.refresh();
		const missing = (await configs.get(controller)).actuators[0];
		expect(missing.source_property).toBeNull();
		expect(missing.physical_identity).toBe(claim.physical_identity);
		expect(missing.source_identity).toBe(relay);
		const replacement = uuid();
		const channel = await database.manager.findOneByOrFail(ShellyNgChannelEntity, { identifier: 'switch:0' });
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: replacement,
			channel: channel.id,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const input = dto(sensor, replacement);
		input.expectedRevision = 1;
		await expect(configs.configure(controller, input)).rejects.toThrow('release');
		await expect(registry.assertAllowed(await target(replacement, true))).rejects.toThrow('reserved');
	});

	it('restores only the same canonical missing endpoint with CAS, audit and fresh qualification', async () => {
		const controller = await owner();
		const sensor = await ambient();
		const oldProperty = await actuator();
		const configured = await configs.configure(controller, dto(sensor, oldProperty));
		const oldClaim = configured.actuators[0];
		const priorQualification: ThermostatInstalledQualification = {
			physicalIdentity: oldClaim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'qualified-test-firmware',
				componentId: 0,
				evidenceId: 'prior-installation',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		};
		claims.recordQualification(priorQualification);
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: oldProperty });
		await claims.refresh();
		const old = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: oldClaim.id });
		expect(old.sourcePropertyId).toBeNull();
		const channel = await database.manager.findOneByOrFail(ShellyNgChannelEntity, { identifier: 'switch:0' });
		const replacement = uuid();
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: replacement,
			channel: channel.id,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const restore = {
			expectedRevision: configured.revision,
			expectedClaimRevision: old.revision,
			physicalIdentity: old.physicalIdentity,
			sourcePropertyId: replacement,
			reason: 'Rediscovered the same physical relay after database endpoint loss',
			disconnectionAcknowledged: true as const,
		};
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, expectedClaimRevision: 999 }, 'operator'),
		).rejects.toThrow('revision');
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, physicalIdentity: 'different' }, 'operator'),
		).rejects.toThrow('canonical');
		const foreign = await actuator('A8032ABE5085');
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, sourcePropertyId: foreign }, 'operator'),
		).rejects.toThrow('same canonical');
		const restored = await configs.restoreActuator(controller, old.id, restore, 'operator');
		expect(restored.requested_mode).toBe('off');
		expect(restored.actuators[0]).toMatchObject({
			id: old.id,
			state: 'reserved',
			source_property: replacement,
			physical_identity: old.physicalIdentity,
			revision: old.revision + 1,
		});
		expect(
			claims.qualification(
				await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: old.id }),
				false,
			),
		).toBeNull();
		await expect(registry.assertAllowed(await target(replacement, true))).rejects.toThrow('reserved');
		const audit = await database.manager.findOneByOrFail(VirtualThermostatRecoveryEntity, { claimId: old.id });
		expect(audit).toMatchObject({
			actorId: 'operator',
			previousPropertyIdentity: oldProperty,
			restoredPropertyId: replacement,
			disconnectionAcknowledged: true,
		});
		await expect(configs.restoreActuator(controller, old.id, restore, 'operator')).rejects.toThrow('revision');
		const restarted = new VirtualThermostatClaimsService(
			second,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(second),
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		await restarted.refresh();
		const restoredClaim = await second.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: old.id });
		restarted.recordQualification(priorQualification);
		expect(restarted.qualification(restoredClaim, false)).toBeNull();
		restarted.recordQualification({
			...priorQualification,
			qualificationGeneration: restoredClaim.qualificationGeneration,
			profile: { ...priorQualification.profile, evidenceId: 'new-installation' },
		});
		expect(restarted.qualification(restoredClaim, false)?.profile.evidenceId).toBe('new-installation');
		const restoredTarget = await target(replacement, true);
		expect(() => restarted.assertAllowed(restoredTarget)).toThrow('reserved');
		await expect(second.manager.countBy(VirtualThermostatRecoveryEntity, { claimId: old.id })).resolves.toBe(1);
	});

	it.each([
		{ endpointMissing: false, demand: 'both' },
		{ endpointMissing: true, demand: 'both' },
		{ endpointMissing: true, demand: 'config' },
		{ endpointMissing: true, demand: 'claim' },
		{ endpointMissing: false, demand: 'state' },
	])('preserves $demand release demand when restoring (endpointMissing=$endpointMissing)', async (scenario) => {
		const controller = await owner();
		const sensor = await ambient();
		const relay = await actuator();
		const input = dto(sensor, relay);
		input.requestedMode = 'heat';
		const configured = await configs.configure(controller, input);
		const requested = await configs.requestRelease(controller, configured.revision);
		const claimId = requested.actuators[0].id;
		let restoredProperty = relay;
		if (scenario.endpointMissing) {
			await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
			await database.manager.delete(ChannelPropertyEntity, { id: relay });
			const channel = await database.manager.findOneByOrFail(ShellyNgChannelEntity, { identifier: 'switch:0' });
			restoredProperty = uuid();
			await database.manager.insert(ShellyNgChannelPropertyEntity, {
				id: restoredProperty,
				channel: channel.id,
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
		}
		if (scenario.demand === 'config' || scenario.demand === 'state')
			await database.manager.update(
				VirtualThermostatActuatorClaimEntity,
				{ id: claimId },
				{ releaseRequestedAt: null },
			);
		if (scenario.demand === 'claim' || scenario.demand === 'state')
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: controller },
				{ releaseRequestedAt: null },
			);
		if (scenario.endpointMissing)
			await database.manager.update(VirtualThermostatActuatorClaimEntity, { id: claimId }, { state: 'missing' });
		const priorConfig = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: controller,
		});
		const priorClaim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claimId });
		const restored = await configs.restoreActuator(
			controller,
			claimId,
			{
				expectedRevision: priorConfig.revision,
				expectedClaimRevision: priorClaim.revision,
				physicalIdentity: priorClaim.physicalIdentity,
				sourcePropertyId: restoredProperty,
				reason: 'The same physical relay has returned after discovery loss',
				disconnectionAcknowledged: true,
			},
			'operator',
		);
		expect(restored.requested_mode).toBe('off');
		expect(restored.actuators[0]).toMatchObject({ id: claimId, state: 'releasing', source_property: restoredProperty });
		const savedConfig = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: controller,
		});
		const savedClaim = await second.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claimId });
		expect(savedConfig.releaseRequestedAt).toEqual(priorConfig.releaseRequestedAt);
		expect(savedClaim.releaseRequestedAt).toEqual(priorClaim.releaseRequestedAt ?? priorConfig.releaseRequestedAt);
		expect(savedClaim.reason).toBe(priorClaim.reason);
		expect(savedClaim.releaseEvidence).toBeNull();
		expect(savedClaim.qualificationGeneration).not.toBe(priorClaim.qualificationGeneration);
		expect(() => claims.mintAuthority(claimId, 'on')).toThrow('not admitted');
		await expect(registry.assertAllowed(await target(restoredProperty, true))).rejects.toThrow('reserved');
	});

	it.each([
		{ outcome: 'commit', failure: 'post-commit' },
		{ outcome: 'commit', failure: 'final' },
		{ outcome: 'validation', failure: 'final' },
	])('preserves the restore $outcome outcome when the $failure reload fails', async ({ outcome, failure }) => {
		const controller = await owner();
		const sensor = await ambient();
		const relay = await actuator();
		const configured = await configs.configure(controller, dto(sensor, relay));
		const claim = configured.actuators[0];
		const relayTarget = await target(relay, true);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const originalFind: typeof database.manager.find = database.manager.find.bind(database.manager);
		let failRefresh = outcome === 'validation';
		const refresh = jest.spyOn(database.manager, 'find').mockImplementation(async (...args) => {
			if (failRefresh && args[0] === VirtualThermostatActuatorClaimEntity) throw new Error('final reload unavailable');
			return (await originalFind(...args)) as Record<string, unknown>[];
		});
		const publicationPhases: Readonly<{ acknowledged: boolean; structural: boolean; connection: boolean }>[] = [];
		if (outcome === 'commit' && failure === 'post-commit') {
			const originalPublisherMethods: OriginalFunctions<{
				publishExistingAcknowledged: VirtualThermostatConfigService['publishExistingAcknowledged'];
			}> = configs;
			const originalPublisher = originalPublisherMethods.publishExistingAcknowledged;
			jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementationOnce((...args) => {
				publicationPhases.push(
					Object.freeze({
						acknowledged: writer.isExistingPlanAcknowledged(args[1].descriptor),
						structural: structure.hasCurrentStructuralLease(),
						connection: hasCurrentSqliteConnectionLease(database),
					}),
				);
				failRefresh = true;
				return originalPublisher.call(configs, ...args);
			});
			registerOriginal();
		} else if (outcome === 'commit') {
			const originalPublisherMethods: OriginalFunctions<{
				publishExistingAcknowledged: VirtualThermostatConfigService['publishExistingAcknowledged'];
			}> = configs;
			const originalPublisher = originalPublisherMethods.publishExistingAcknowledged;
			jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementationOnce((...args) => {
				publicationPhases.push(
					Object.freeze({
						acknowledged: writer.isExistingPlanAcknowledged(args[1].descriptor),
						structural: structure.hasCurrentStructuralLease(),
						connection: hasCurrentSqliteConnectionLease(database),
					}),
				);
				return originalPublisher.call(configs, ...args);
			});
			registerOriginal();
			events.once(THERMOSTAT_CONFIG_CHANGED, () => (failRefresh = true));
		}
		try {
			const restore = configs.restoreActuator(
				controller,
				claim.id,
				{
					expectedRevision: configured.revision + (outcome === 'validation' ? 1 : 0),
					expectedClaimRevision: claim.revision,
					physicalIdentity: claim.physical_identity,
					sourcePropertyId: relay,
					reason: 'The same physical relay has returned after discovery loss',
					disconnectionAcknowledged: true,
				},
				'operator',
			);
			if (outcome === 'commit') {
				await expect(restore).resolves.toMatchObject({ revision: configured.revision + 1, requested_mode: 'off' });
			} else {
				await expect(restore).rejects.toBeInstanceOf(DevicesValidationException);
				await expect(restore).rejects.toThrow('revision changed');
			}
			expect(publicationPhases).toEqual(
				outcome === 'commit' ? [{ acknowledged: true, structural: false, connection: false }] : [],
			);
			expect(refresh).toHaveBeenCalled();
			expect(() => claims.assertAllowed(relayTarget)).toThrow('reconciling');
			expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
			expect(jest.getTimerCount()).toBe(1);
			expect(await second.manager.countBy(VirtualThermostatRecoveryEntity, { claimId: claim.id })).toBe(
				outcome === 'commit' ? 1 : 0,
			);
			expect(
				(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
			).toBe(configured.revision + (outcome === 'commit' ? 1 : 0));
			failRefresh = false;
			const retryRefresh = jest.spyOn(claims, 'refresh');
			await jest.advanceTimersByTimeAsync(1000);
			expect(retryRefresh).toHaveBeenCalledTimes(1);
			await (retryRefresh.mock.results[0].value as Promise<void>);
			expect(jest.getTimerCount()).toBe(0);
			// A successful retry proves the recovery fence was released, including on rollback.
			expect(() => claims.assertAllowed(relayTarget)).toThrow('reserved');
		} finally {
			refresh.mockRestore();
			claims.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('revokes queued ON sends at restore entry and keeps them revoked after rollback or commit', async () => {
		const controller = await owner();
		const sensor = await ambient();
		const relay = await actuator();
		const input = dto(sensor, relay);
		input.requestedMode = 'heat';
		const configured = await configs.configure(controller, input);
		const claim = configured.actuators[0];
		claims.recordQualification({
			physicalIdentity: claim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'qualified-test-firmware',
				componentId: 0,
				evidenceId: 'prior-installation',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		const alternateProperty = await actuator('A8032ABE5086');
		await expect(
			configs.restoreActuator(
				controller,
				claim.id,
				{
					expectedRevision: configured.revision,
					expectedClaimRevision: claim.revision,
					physicalIdentity: claim.physical_identity,
					sourcePropertyId: alternateProperty,
					reason: 'The old endpoint was disconnected and must be restored',
					disconnectionAcknowledged: true,
				},
				'operator',
			),
		).rejects.toThrow('retained alias reservation');
		const stop = claims.registerRuntimeAdmission(() => true);
		const relayTarget = await target(relay, true);
		const restore = {
			expectedRevision: configured.revision,
			expectedClaimRevision: claim.revision,
			physicalIdentity: claim.physical_identity,
			sourcePropertyId: relay,
			reason: 'The relay was disconnected and has returned under the same endpoint',
			disconnectionAcknowledged: true as const,
		};
		const pendingOn = claims.mintAuthority(claim.id, 'on');
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(true);
		const runtimeAdmission = claims.capture();
		expect(runtimeAdmission.isCurrent()).toBe(true);
		let releaseReader!: () => void;
		let readerEntered!: () => void;
		const readerGate = new Promise<void>((resolve) => (releaseReader = resolve));
		const readerStarted = new Promise<void>((resolve) => (readerEntered = resolve));
		const reader = structure.runShared(async () => {
			readerEntered();
			await readerGate;
		});
		await readerStarted;
		const failedRestore = configs.restoreActuator(
			controller,
			claim.id,
			{ ...restore, expectedClaimRevision: claim.revision + 1 },
			'operator',
		);
		let guardedSends = 0;
		if (claims.isAuthorized(pendingOn, relayTarget)) guardedSends++;
		expect(guardedSends).toBe(0);
		expect(runtimeAdmission.isCurrent()).toBe(false);
		const blockedRefresh = claims.refresh();
		expect(claims.capture().isCurrent()).toBe(false);
		expect(claims.capture().isRequestCurrent?.()).toBe(true);
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		releaseReader();
		await reader;
		await expect(failedRestore).rejects.toThrow('revision');
		await blockedRefresh;
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		expect(runtimeAdmission.isCurrent()).toBe(false);
		expect(claims.capture().isCurrent()).toBe(true);
		const nextOn = claims.mintAuthority(claim.id, 'on');
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(true);
		const secondReaderGate = new Promise<void>((resolve) => (releaseReader = resolve));
		const secondReaderStarted = new Promise<void>((resolve) => (readerEntered = resolve));
		const secondReader = structure.runShared(async () => {
			readerEntered();
			await secondReaderGate;
		});
		await secondReaderStarted;
		const restorePromise = configs.restoreActuator(controller, claim.id, restore, 'operator');
		if (claims.isAuthorized(nextOn, relayTarget)) guardedSends++;
		expect(guardedSends).toBe(0);
		const restoredRefresh = claims.refresh();
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		releaseReader();
		await secondReader;
		const restored = await restorePromise;
		await restoredRefresh;
		expect(restored.requested_mode).toBe('off');
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		stop();
	});

	it('disabled owners demand release and keep reservations; removal requires explicit qualified proof', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const device = await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: controller });
		device.enabled = false;
		await database.manager.save(device);
		await claims.refresh();
		const claim = (await configs.get(controller)).actuators[0];
		expect(claim.state).toBe('releasing');
		const off = claims.mintAuthority(claim.id, 'off');
		expect(claims.isAuthorized(off, await target(relay, false))).toBe(true);
		await expect(database.manager.remove(device)).rejects.toThrow('reserved');
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
	});

	it('refuses detach while release is pending and does not infer proof from user OFF', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const release = await configs.requestRelease(controller, 1);
		expect(release.actuators[0].state).toBe('releasing');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		await expect(
			claims.completeRelease({
				claimId: release.actuators[0].id,
				revision: release.actuators[0].revision,
				evidenceId: 'forged',
			}),
		).rejects.toThrow('Internal release proof');
		await expect(configs.requestRelease(controller, 1)).rejects.toThrow('revision');
	});

	it('accepts ambient aggregate and independent heuristic without physical contacts; rejects derived floor role', async () => {
		const controller = await owner(),
			sensor = await ambient(VirtualDeviceMode.SENSOR_AGGREGATE),
			relay = await actuator();
		const input = dto(sensor, relay);
		input.heuristic = {
			sampleWindowMs: 60000,
			minimumSamples: 3,
			minimumSpanMs: 10000,
			maximumSampleAgeMs: 10000,
			slopeThresholdCPerMinute: 1,
			confirmationMs: 5000,
			recoveryMs: 10000,
			maximumPauseMs: 300000,
			cooldownMs: 10000,
		};
		await expect(configs.configure(controller, input)).resolves.toMatchObject({ readiness: 'draft' });
		input.expectedRevision = 1;
		input.policy.floor = { limit: 30, recoveryHysteresis: 1 };
		input.sources.push({ role: 'floor', sourcePropertyId: sensor, maximumAgeSeconds: 300 });
		await expect(configs.configure(controller, input)).rejects.toThrow('Temperature roles');
	});

	it('SQL guards refuse bulk deletion, metadata changes and relation moves before commit and revoke old admission', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const source = await target(relay, false);
		const other = await target(sensor, false);
		const entry = registry.capture();
		await expect(
			database.getRepository(ChannelPropertyEntity).update(relay, { permissions: [PermissionType.READ_ONLY] }),
		).rejects.toThrow('reserved');
		expect(entry.isCurrent()).toBe(false);
		await expect(database.getRepository(ChannelPropertyEntity).delete(relay)).rejects.toThrow('reserved');
		await expect(
			database.createQueryBuilder().delete().from(ChannelEntity).where('id = :id', { id: source.channel.id }).execute(),
		).rejects.toThrow('reserved');
		await expect(database.getRepository(DeviceEntity).delete(source.device.id)).rejects.toThrow('reserved');
		await expect(
			database.getRepository(ChannelEntity).update(source.channel.id, { device: other.device.id }),
		).rejects.toThrow('reserved');
		await expect(
			database.getRepository(ChannelPropertyEntity).update(relay, { channel: other.channel.id }),
		).rejects.toThrow('reserved');
		source.channel.device = other.device;
		await expect(database.manager.save(source.channel)).rejects.toThrow(/reserved/i);
		const fresh = await target(relay, false);
		expect(fresh.device.id).toBe(source.device.id);
		await expect(registry.assertAllowed(fresh)).rejects.toThrow('reserved');
	});

	it('bulk disable atomically requests release; rollback recovers ownership readiness without reviving old ON authority', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const original = (await configs.get(controller)).actuators[0];
		const authority = claims.mintAuthority(original.id, 'off');
		const snapshot = registry.capture();
		await expect(
			database.transaction(async (manager) => {
				await manager.update(DeviceEntity, { id: controller }, { enabled: false });
				throw new Error('rollback fixture');
			}),
		).rejects.toThrow('rollback fixture');
		expect(snapshot.isCurrent()).toBe(false);
		expect(claims.isAuthorized(authority, await target(relay, false))).toBe(false);
		expect((await configs.get(controller)).actuators[0].state).toBe('reserved');
		expect(claims.isAuthorized(claims.mintAuthority(original.id, 'off'), await target(relay, false))).toBe(true);
		await database.manager.update(DeviceEntity, { id: controller }, { enabled: false });
		expect((await configs.get(controller)).actuators[0].state).toBe('releasing');
		expect((await configs.get(controller)).actuators[0].revision).toBe(original.revision + 1);
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
	});

	it.each([
		{ operator: VirtualNumericTransformOperator.AFFINE, scale: 2, offset: 1 },
		{
			operator: VirtualNumericTransformOperator.PIECEWISE_LINEAR,
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 100 },
			],
		},
		{
			operator: VirtualNumericTransformOperator.NTC_BETA,
			referenceVoltage: 10,
			seriesResistance: 10_000,
			nominalResistance: 10_000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		},
		{
			operator: VirtualNumericTransformOperator.STEINHART_HART,
			referenceVoltage: 10,
			seriesResistance: 10_000,
			coefficientA: 0.0010351024725298568,
			coefficientB: 0.0002338353574079741,
			coefficientC: 7.917851073336009e-8,
			thermistorLeg: 'low',
		},
	] as const)(
		'admits built-in $operator floor configuration without granting installation certification',
		async (policy) => {
			const controller = await owner(),
				sensor = await ambient(),
				transformedFloor = await ambient(VirtualDeviceMode.SENSOR_TRANSFORM),
				relay = await actuator();
			const nativeFloor = uuid(),
				nativeChannel = uuid(),
				nativeDevice = uuid();
			const voltage = nativeVoltmeterVoltageIdentity(
				'voltmeter:100',
				{ id: 100, range: 0, report_thr: 0.1, xvoltage: { expr: null, unit: null } },
				{ voltmeter: { 'voltmeter:100': {} } },
				'A8032ABE5085',
			);
			await database.manager.insert(ShellyNgDeviceEntity, {
				id: nativeDevice,
				name: 'Voltmeter',
				category: DeviceCategory.SENSOR,
				canonicalMac: 'A8032ABE5085',
			} as never);
			await database.manager.insert(ShellyNgChannelEntity, {
				id: nativeChannel,
				name: 'Raw voltage',
				identifier: voltage.channelIdentifier,
				category: ChannelCategory.ANALOG_INPUT,
				device: nativeDevice,
			} as never);
			await database.manager.insert(ShellyNgChannelPropertyEntity, {
				id: nativeFloor,
				channel: nativeChannel,
				identifier: 'voltage',
				category: PropertyCategory.VALUE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			} as never);
			const physical = await database.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: nativeFloor },
				relations: ['channel', 'channel.device'],
			});
			expect(resolvePropertyUnit(physical)).toBe('V');
			await database.manager.insert(VirtualTransformConfigEntity, {
				outputPropertyId: transformedFloor,
				schemaVersion: 1,
				revision: 3,
				maximumAgeSeconds: 300,
				quantity: 'temperature',
				unit: '°C',
				configuredAt: new Date(),
				policy: {
					...policy,
					inputRange: { minimum: 0, maximum: 10 },
					outputRange: { minimum: -100, maximum: 150 },
				},
			});
			await database.manager.insert(VirtualTransformSourceEntity, {
				id: uuid(),
				outputPropertyId: transformedFloor,
				sourcePropertyId: nativeFloor,
				sourcePropertyIdentity: nativeFloor,
				quantity: 'value',
				unit: 'V',
			});
			const input = dto(sensor, relay);
			input.policy.floor = { limit: 30, recoveryHysteresis: 1 };
			input.sources.push({ role: 'floor', sourcePropertyId: nativeFloor, maximumAgeSeconds: 300 });
			await expect(configs.preview(controller, input)).rejects.toThrow('Temperature roles');
			input.sources.pop();
			input.sources.push({ role: 'floor', sourcePropertyId: transformedFloor, maximumAgeSeconds: 300 });
			expect((await configs.preview(controller, input)).sources).toEqual(
				expect.arrayContaining([expect.objectContaining({ role: 'floor', source_identity: transformedFloor })]),
			);
			const configured = await configs.configure(controller, input);
			const floor = configured.sources.find((source) => source.role === 'floor');
			expect(floor.physical_identity).toBe('property:' + nativeFloor);
			expect(floor.source_identity).toBe(transformedFloor);
			await database.manager.update(
				VirtualTransformConfigEntity,
				{ outputPropertyId: transformedFloor },
				{ revision: 4 },
			);
			input.expectedRevision = 1;
			const revised = await configs.preview(controller, input);
			expect(revised.sources.find((source) => source.role === 'floor').contract_fingerprint).not.toBe(
				floor.contract_fingerprint,
			);
			const operators = new VirtualNumericOperatorRegistry();
			operators.activate('@fixture/floor', [
				{
					contractVersion: 1,
					name: 'steinhart_hart',
					operatorVersion: 1,
					input: { quantity: 'value', unit: 'V' },
					output: { quantity: 'temperature', unit: '°C' },
					inputRange: { minimum: 0, maximum: 10 },
					outputRange: { minimum: -100, maximum: 150 },
					parameters: {},
					evaluate: () => 20,
				},
			]);
			await database.manager.update(
				VirtualTransformConfigEntity,
				{ outputPropertyId: transformedFloor },
				{
					policy: {
						operator: VirtualNumericTransformOperator.EXTENSION,
						contractVersion: 1,
						operatorId: '@fixture/floor:steinhart_hart',
						operatorVersion: 1,
						parameters: {},
						inputRange: { minimum: 0, maximum: 10 },
						outputRange: { minimum: -100, maximum: 150 },
					},
				},
			);
			const customConfigs = new VirtualThermostatConfigService(
				database,
				structure,
				graph,
				claims,
				events,
				values,
				new VirtualTransformResolver(operators),
				writer,
			);
			registerOriginal(customConfigs);
			await expect(customConfigs.preview(controller, input)).rejects.toThrow('Transformed thermostat temperatures');
			await expect(customConfigs.configure(controller, input)).rejects.toThrow('Transformed thermostat temperatures');
			await database.query('UPDATE devices_virtual_transform_configs SET policy = ? WHERE outputPropertyId = ?', [
				'null',
				transformedFloor,
			]);
			await expect(customConfigs.preview(controller, input)).rejects.toBeInstanceOf(DevicesValidationException);
			await expect(customConfigs.configure(controller, input)).rejects.toBeInstanceOf(DevicesValidationException);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
			).toBe(1);
		},
	);

	it('only an internal qualified OFF and drained-ON proof frees a releasing reservation', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const pending = await configs.requestRelease(controller, 1);
		const claim = pending.actuators[0];
		claims.recordQualification({
			physicalIdentity: claim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'fixture-firmware',
				componentId: 0,
				evidenceId: 'fixture-installed-profile',
				revision: 1,
				testedLeaseSeconds: { min: 10, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		const off = claims.mintAuthority(claim.id, 'off');
		const reservation = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id });
		const qualification = claims.qualification(reservation, false);
		const controllerRevision = (
			await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })
		).revision;
		expect(() =>
			claims.recordQualifiedRelease(off, {
				outputConfirmedOff: true,
				pendingOnDrained: false,
				evidenceId: 'unrelated-readback',
				controllerRevision,
				qualification,
				isCurrent: () => true,
			}),
		).toThrow('drainage');
		const proof = claims.recordQualifiedRelease(off, {
			outputConfirmedOff: true,
			pendingOnDrained: true,
			evidenceId: 'fixture-ordered-release',
			controllerRevision,
			qualification,
			isCurrent: () => true,
		});
		await claims.completeRelease(proof);
		await expect(registry.assertAllowed(await target(relay, true))).resolves.toBeUndefined();
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).releaseEvidence,
		).toMatchObject({ pendingOnDrained: true });
	});

	it.each(['source', 'qualification', 'revoked'])(
		'rolls back claim release when %s expires during the awaited UPDATE',
		async (mode) => {
			const controller = await owner(),
				sensor = await ambient(),
				relay = await actuator();
			await configs.configure(controller, dto(sensor, relay));
			const pending = await configs.requestRelease(controller, 1);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				id: pending.actuators[0].id,
			});
			claims.recordQualification({
				physicalIdentity: claim.physicalIdentity,
				upstreamWritersExcluded: true,
				opposedOutputsInterlocked: false,
				profile: {
					deviceId: 'shellyplus1pm-a8032abe5084',
					model: 'SNSW-001P16EU',
					firmware: 'fixture-firmware',
					componentId: 0,
					evidenceId: 'fixture-installed-profile',
					revision: 1,
					testedLeaseSeconds: { min: 10, max: 60 },
					releaseOrderingQualified: true,
					independentProtectionQualified: true,
				},
			});
			const qualification = claims.qualification(claim, false);
			let sourceCurrent = true;
			const evidence = {
				outputConfirmedOff: true,
				pendingOnDrained: true,
				evidenceId: 'ordered-release',
				controllerRevision: (
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })
				).revision,
				qualification,
				isCurrent: () => sourceCurrent,
			};
			const proof = claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), evidence);
			const createRunner = database.createQueryRunner.bind(database) as typeof database.createQueryRunner;
			const watched = new WeakSet<object>();
			let invalidated = false;
			const hook = jest.spyOn(database, 'createQueryRunner').mockImplementation((...parameters) => {
				const runner = createRunner(...parameters);
				if (!watched.has(runner)) {
					watched.add(runner);
					const query = runner.query.bind(runner) as typeof runner.query;
					jest.spyOn(runner, 'query').mockImplementation(async (...args: Parameters<typeof runner.query>) => {
						const result: unknown = await query(...args);
						if (
							!invalidated &&
							typeof args[0] === 'string' &&
							Array.isArray(args[1]) &&
							args[0].startsWith('UPDATE "devices_virtual_thermostat_actuator_claims"') &&
							args[1]?.includes('released')
						) {
							invalidated = true;
							if (mode === 'source') sourceCurrent = false;
							else if (mode === 'qualification') claims.recordQualification({ ...qualification });
							else
								(claims as unknown as { qualifications: Map<string, unknown> }).qualifications.delete(
									claim.physicalIdentity,
								);
						}
						return result;
					});
				}
				return runner;
			});
			try {
				await expect(claims.completeRelease(proof)).rejects.toThrow('no longer current');
			} finally {
				hook.mockRestore();
			}
			expect(invalidated).toBe(true);
			expect(
				await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id }),
			).toMatchObject({ state: 'releasing', revision: claim.revision, releaseEvidence: null, releasedAt: null });
			await expect(registry.assertAllowed(await target(relay, true))).rejects.toThrow('reserved');
			await expect(claims.completeRelease(proof)).rejects.toThrow('Internal release proof');
			sourceCurrent = true;
			claims.recordQualification(qualification);
			const fresh = claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), {
				...evidence,
				qualification: claims.qualification(claim, false),
				evidenceId: 'fresh-ordered-release',
			});
			await claims.completeRelease(fresh);
			expect(
				await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id }),
			).toMatchObject({ state: 'released', releaseEvidence: { evidenceId: 'fresh-ordered-release' } });
			await expect(registry.assertAllowed(await target(relay, true))).resolves.toBeUndefined();
		},
	);

	it('requires a current exact qualification at proof recording and retains disabled reservations as suspended', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		await database.manager.update(VirtualDeviceEntity, { id: controller }, { enabled: false });
		await claims.refresh();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			controllerId: controller,
		});
		expect(claim).toMatchObject({ state: 'releasing', reason: 'device_disabled' });
		claims.recordQualification({
			physicalIdentity: claim.physicalIdentity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'fixture-firmware',
				componentId: 0,
				evidenceId: 'fixture-installed-profile',
				revision: 1,
				testedLeaseSeconds: { min: 10, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		const qualification = claims.qualification(claim, false);
		const evidence = {
			outputConfirmedOff: true,
			pendingOnDrained: true,
			evidenceId: 'disabled-ordered-release',
			controllerRevision: (
				await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })
			).revision,
			qualification,
			isCurrent: () => true,
		};
		expect(() =>
			claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), { ...evidence, isCurrent: () => false }),
		).toThrow('drainage');
		claims.recordQualification({ ...qualification });
		expect(() => claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), evidence)).toThrow('drainage');
		const fresh = claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), {
			...evidence,
			qualification: claims.qualification(claim, false),
		});
		await claims.completeRelease(fresh);
		expect(
			await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id }),
		).toMatchObject({ state: 'suspended', releaseEvidence: { evidenceId: 'disabled-ordered-release' } });
		await expect(registry.assertAllowed(await target(relay, true))).rejects.toThrow('reserved');
	});

	it('preserves override and explicit OFF through legacy commands and atomic range reconfiguration', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const enable = await setting(controller, ChannelCategory.HEATER, PropertyCategory.ON);
		const setpoint = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
		const input = dto(sensor, relay);
		input.requestedMode = 'heat';
		input.settings = [
			{ propertyId: enable, setting: 'heating_enabled' },
			{ propertyId: setpoint, setting: 'heating_setpoint' },
		];
		input.comfort = { heating_range: { minimum: 10, maximum: 30 }, cooling_range: null, presets: [] };
		await configs.configure(controller, input);
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
		config.comfort.temporary_override = {
			id: uuid(),
			source: 'user',
			actor_id: 'operator',
			revision: config.revision,
			created_at: new Date().toISOString(),
			expires_at: new Date(Date.now() + 60_000).toISOString(),
			preset: null,
			setpoints: { heating_setpoint: 24, cooling_setpoint: null },
			resolved_setpoints: { heating_setpoint: 24, cooling_setpoint: null },
			status: 'active',
			terminated_at: null,
		};
		await database.manager.save(config);
		await configs.command([await target(enable, false)]);
		await configs.command([await target(setpoint, 18)]);
		let current = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
		expect(current).toMatchObject({
			requestedMode: 'off',
			policy: { heatingSetpoint: 18 },
			comfort: { user_off: true, temporary_override: { resolved_setpoints: { heating_setpoint: 24 } } },
		});
		await configs.configure(controller, { ...input, expectedRevision: current.revision });
		current = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
		expect(current.comfort.user_off).toBe(false);
		await configs.command([await target(enable, true)]);
		current = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
		expect(current.comfort.user_off).toBe(false);
		await expect(
			configs.configure(controller, {
				...input,
				expectedRevision: current.revision,
				policy: { ...input.policy, heatingSetpoint: 31 },
				comfort: undefined,
			}),
		).rejects.toThrow('setpoint_range');
		await configs.configure(controller, {
			...input,
			expectedRevision: current.revision,
			policy: { ...input.policy, heatingSetpoint: 31 },
			comfort: { heating_range: { minimum: 10, maximum: 35 }, cooling_range: null, presets: [] },
		});
		expect((await configs.get(controller)).policy.heatingSetpoint).toBe(31);
	});

	it('migration matches synchronized reservation constraints and stable SET NULL foreign keys', async () => {
		const runner = database.createQueryRunner();
		await runner.dropTable('devices_virtual_thermostat_recoveries');
		for (const table of [
			'devices_virtual_thermostat_settings',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_sources',
			'devices_virtual_thermostat_configs',
		])
			await runner.dropTable(table);
		const migration = new AddVirtualThermostatClaims1000000000031();
		await migration.up(runner);
		const recoveryMigration = new AddVirtualThermostatRecoveries1000000000034();
		await recoveryMigration.up(runner);
		const branchMigration = new AddThermostatBranchGroups1000000000040();
		await branchMigration.up(runner);
		await new AddVirtualThermostatComfort1000000000039().up(runner);
		await runner.query('DROP TABLE "devices_virtual_thermostat_member_protection"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_branch_runtime" DROP COLUMN "floorLatched"');
		await runner.query('ALTER TABLE "devices_shelly_ng_sample_sources" DROP COLUMN "installationSnapshot"');
		await new AddThermostatMemberProtection1000000000041().up(runner);
		const indexes = await runner.query('PRAGMA index_list("devices_virtual_thermostat_actuator_claims")');
		expect(indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'UQ_virtual_thermostat_physical_reservation', unique: 1, partial: 1 }),
			]),
		);
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: relay });
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: controller }))
				.sourcePropertyId,
		).toBeNull();
		await new AddThermostatMemberProtection1000000000041().down(runner);
		await branchMigration.down(runner);
		const cleanupRunner = database.createQueryRunner();
		await recoveryMigration.down(cleanupRunner);
		await migration.down(cleanupRunner);
		await cleanupRunner.release();
		await runner.release();
	});
	it('forms the fixed initial creation response without a query, qualification, live value or clock read', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			heat = await actuator();
		const prepared = await configs.prepare(database.manager, controller, dto(sensor, heat));
		const identities = prepared.actuators.map((row) => ({ id: row.id, generation: row.qualificationGeneration }));
		const configuredAt = prepared.config.configuredAt.toISOString();
		const statements: string[] = [];
		const observer = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
				statements.push(event.query);
			},
		};
		database.subscribers.push(observer);
		const qualification = jest.spyOn(claims, 'qualification');
		try {
			const fixed = configs.describeCreated(prepared, 7);
			expect(fixed.controller).toBe(controller);
			expect(fixed.graph_revision).toBe(7);
			expect(fixed.readiness).toBe('draft');
			expect(fixed.reasons).toEqual(['controller_runtime_unavailable', 'heating_hardware_qualification_missing']);
			expect(fixed.actuators[0].cooling_diagnostics).toBeNull();
			expect(fixed.released_actuators).toEqual([]);
			expect(statements).toEqual([]);
			expect(qualification).not.toHaveBeenCalled();
			expect(prepared.config.configuredAt.toISOString()).toBe(configuredAt);
			expect(prepared.actuators.map((row) => ({ id: row.id, generation: row.qualificationGeneration }))).toEqual(
				identities,
			);
			expect(JSON.stringify(fixed)).not.toMatch(/manualGeneration|controllerIncarnation|installEvidence|candidateId/);
		} finally {
			qualification.mockRestore();
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
		}
	});
	describe('closed persisted protection row validation', () => {
		it.each([false, true])(
			'matches the original loader for actual persisted converted=%s lineage without I/O in the checker',
			async (converted) => {
				const relay = await actuator();
				const probe = await createProtectionProbe(database, relay, converted);
				const readProperty = (id: string) =>
					database.manager
						.createQueryBuilder(ChannelPropertyEntity, 'property')
						.leftJoinAndSelect('property.channel', 'channel')
						.leftJoinAndSelect('channel.device', 'device')
						.where('property.id = :id', { id })
						.callListeners(false)
						.getOneOrFail();
				const property = await readProperty(probe.sourceId);
				const leaf = converted ? await readProperty(probe.physicalId) : property;
				const transform = await database.manager.findOneBy(VirtualTransformConfigEntity, {
					outputPropertyId: property.id,
				});
				const transformSource = await database.manager.findOneBy(VirtualTransformSourceEntity, {
					outputPropertyId: property.id,
				});
				const metadata = await database.manager.findOneByOrFail(ShellySampleSourceEntity, {
					propertyId: leaf.id,
					active: true,
				});
				const physicalIdentity = 'shelly-ng:' + probe.device.canonicalMac.toUpperCase() + ':switch:0:output';
				const ordinary = await resolveThermostatProtectionSource(database.manager, property.id, physicalIdentity);
				const rows = { property, leaf, transform, transformSource, metadata };
				let queries = 0;
				const observer = {
					beforeQuery: () => {
						queries++;
					},
				};
				const emitted = jest.spyOn(events, 'emit');
				database.subscribers.push(observer);
				try {
					const checked = validateThermostatProtectionRows(rows, physicalIdentity);
					expect(checked).toEqual(ordinary);
					expect(checked.property).toBe(property);
					expect(checked.leaf).toBe(leaf);
					expect(checked.metadata).toBe(metadata);
					expect(() =>
						validateThermostatProtectionRows(
							{ ...rows, metadata: { ...metadata, propertyId: uuid() } },
							physicalIdentity,
						),
					).toThrow(DevicesValidationException);
					expect(() =>
						validateThermostatProtectionRows({ ...rows, metadata: { ...metadata, active: false } }, physicalIdentity),
					).toThrow(DevicesValidationException);
					expect(() => validateThermostatProtectionRows(rows, 'shelly-ng:A8032ABEFFFF:switch:0:output')).toThrow(
						DevicesValidationException,
					);
					expect(queries).toBe(0);
					expect(emitted).not.toHaveBeenCalled();
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
					emitted.mockRestore();
				}
			},
		);
	});

	// BEGIN closed existing-controller route regressions (SOURCE ONLY; every case UNRUN)
	describe('actual reserved existing-controller route family', () => {
		const whole = async (source = database) => {
			const result: Record<string, unknown[]> = {};
			for (const table of [
				'devices_virtual_thermostat_configs',
				'devices_virtual_thermostat_sources',
				'devices_virtual_thermostat_actuator_claims',
				'devices_virtual_thermostat_settings',
				'devices_virtual_thermostat_member_protection',
				'devices_virtual_thermostat_cooling_dependencies',
				'devices_virtual_thermostat_recoveries',
				'devices_virtual_thermostat_command_journal',
				'devices_virtual_thermostat_runtime',
				'devices_virtual_thermostat_branch_runtime',
				'devices_virtual_thermostat_installations',
				'devices_virtual_thermostat_installation_audit',
				'devices_module_devices',
				'devices_module_channels',
				'devices_module_channels_properties',
				'devices_shelly_ng_sample_sources',
				'devices_virtual_dew_point_configs',
				'devices_virtual_dew_point_sources',
				'devices_virtual_transform_configs',
				'devices_virtual_transform_sources',
				'devices_virtual_aggregate_configs',
				'devices_virtual_aggregate_inputs',
				'devices_virtual_light_group_configs',
				'devices_virtual_light_group_members',
				'devices_virtual_light_group_bindings',
				'devices_module_climate_automation_slots',
				'devices_module_climate_automation_sources',
				'devices_virtual_graph_revision',
			])
				result[table] = await source.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`);
			return result;
		};
		const barrier = () => {
			let open: () => void = () => {
				throw new Error('Barrier not initialized');
			};
			const promise = new Promise<void>((resolve) => {
				open = resolve;
			});
			return { promise, open: () => open() };
		};
		it('bootstraps only genuinely absent existing configuration and slot, then exact repetition is zero business churn', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const input = dto(sensor, heat);
			const beforeGraph = await graph.revision();
			const first = await configs.configure(controller, input);
			const original = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
				controllerId: controller,
			});
			expect(first.revision).toBe(1);
			expect(first.graph_revision).toBe(beforeGraph + 1);
			expect(original).toMatchObject({
				providerKey: 'virtual-thermostat:v1',
				manualHold: true,
				state: 'EMPTY',
				slotRevision: 1,
				manualCounter: 1,
			});
			const before = await whole();
			const notified = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, notified);
			const secondResult = await configs.configure(controller, { ...input, expectedRevision: first.revision });
			expect(secondResult.revision).toBe(first.revision);
			expect(secondResult.graph_revision).toBe(first.graph_revision);
			expect(await whole()).toEqual(before);
			expect(notified).not.toHaveBeenCalled();
			expect(secondResult.actuators[0].id).toBe(first.actuators[0].id);
			expect(secondResult.actuators[0].qualification_generation).toBe(first.actuators[0].qualification_generation);
		});
		it('allows true no-op at retained maximum counters but rejects an actual controller increment before any row changes', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			await configs.configure(controller, input);
			await database.query('UPDATE devices_virtual_thermostat_configs SET revision = ? WHERE controllerId = ?', [
				Number.MAX_SAFE_INTEGER,
				controller,
			]);
			await database.query(
				'UPDATE devices_module_climate_automation_slots SET slotRevision = ?, manualCounter = ? WHERE controllerId = ?',
				[Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, controller],
			);
			const before = await whole();
			expect(
				(await configs.configure(controller, { ...input, expectedRevision: Number.MAX_SAFE_INTEGER })).revision,
			).toBe(Number.MAX_SAFE_INTEGER);
			expect(await whole()).toEqual(before);
			await expect(
				configs.configure(controller, { ...input, expectedRevision: Number.MAX_SAFE_INTEGER, requestedMode: 'heat' }),
			).rejects.toThrow();
			expect(await whole()).toEqual(before);
		});
		it('refuses stale identical payload and existing-config absent-slot without GET adoption or replacement', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			await configs.configure(controller, input);
			const before = await whole();
			await expect(configs.configure(controller, input)).rejects.toThrow('revision');
			expect(await whole()).toEqual(before);
			await database.manager.delete(ClimateAutomationSlotEntity, { controllerId: controller });
			const missing = await whole();
			await configs.get(controller);
			await expect(configs.configure(controller, { ...input, expectedRevision: 1 })).rejects.toThrow();
			expect(await whole()).toEqual(missing);
		});
		it('performs same-value numeric takeover using the real setting route while preserving nullable comfort', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const settingId = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE),
				input = dto(sensor, heat);
			input.settings = [{ propertyId: settingId, setting: 'heating_setpoint' }];
			await configs.configure(controller, input);
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
				controllerId: controller,
			});
			expect(before.comfort).toBeNull();
			expect(await configs.command([await target(settingId, 20)])).toBe(true);
			const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			expect(after.comfort).toBeNull();
			expect(after.revision).toBe(before.revision);
			await comfort.configure(
				controller,
				{ expected_revision: after.revision, expected_graph_revision: await graph.revision() },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					automation_enabled: true,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			expect(
				(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller })).manualHold,
			).toBe(false);
			expect(await configs.command([await target(settingId, 20)])).toBe(true);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller });
			expect(slot.manualHold).toBe(true);
			expect((await comfort.get(controller)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
		});
		it.each([
			{ preset: null, clear: false },
			{ preset: null, clear: true },
			{ preset: 'eco', clear: false },
			{ preset: 'eco', clear: true },
		])(
			'preserves independent OFF, requested mode and private hold for preset=$preset clear=$clear',
			async ({ preset, clear }) => {
				const controller = await owner(),
					sensor = await ambient(),
					heat = await actuator(),
					input = dto(sensor, heat);
				await configs.configure(controller, input);
				await comfort.configure(
					controller,
					{ expected_revision: 1, expected_graph_revision: await graph.revision() },
					{
						heating_range: { minimum: 10, maximum: 30 },
						cooling_range: null,
						presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
					},
				);
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				const exactPreset = preset === 'eco' ? 'eco' : null;
				const result = await comfort.select(
					controller,
					{ expected_revision: before.revision, expected_graph_revision: await graph.revision() },
					exactPreset,
					clear,
				);
				expect(result.configuration.selected_preset).toBe(preset);
				expect(result.configuration.user_off).toBe(!clear);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }))
						.requestedMode,
				).toBe('off');
				expect(
					(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }))
						.manualHold,
				).toBe(preset === null);
			},
		);
		it('keeps idempotent opt-in exact and derives one RESET without adopting or replaying a historical source', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			await configs.configure(controller, dto(sensor, heat));
			const definition = {
				heating_range: { minimum: 10, maximum: 30 },
				cooling_range: null,
				automation_enabled: true,
				presets: [],
			};
			const first = await comfort.configure(
				controller,
				{ expected_revision: 1, expected_graph_revision: await graph.revision() },
				definition,
			);
			const before = await whole();
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller });
			expect(slot.manualHold).toBe(false);
			expect(slot.manualCounter).toBe(2);
			await comfort.configure(
				controller,
				{ expected_revision: first.revision, expected_graph_revision: first.graph_revision },
				definition,
			);
			expect(await whole()).toEqual(before);
			expect(
				(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }))
					.manualGeneration,
			).toBe(slot.manualGeneration);
		});
		it('uses actual original ACK and release before a mirror, then refuses later A effects after a real peer changes its parent', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const settingId = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE),
				input = dto(sensor, heat);
			input.settings = [{ propertyId: settingId, setting: 'heating_setpoint' }];
			const entered = barrier(),
				resume = barrier(),
				original = backend.writePoints;
			const writes = jest.spyOn(backend, 'writePoints').mockImplementationOnce(async (...args) => {
				await original.call(backend, ...args);
				entered.open();
				await resume.promise;
			});
			const properties = jest.fn();
			events.on(EventType.CHANNEL_PROPERTY_UPDATED, properties);
			const result = configs.configure(controller, input);
			void result.catch(() => undefined);
			try {
				await entered.promise;
				expect(
					(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
				).toBe(1);
				await second.query('UPDATE devices_module_devices SET name = ? WHERE id = ?', ['peer B committed', controller]);
				resume.open();
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(writes).toHaveBeenCalledTimes(1);
				expect(properties).not.toHaveBeenCalled();
				expect((await second.manager.findOneByOrFail(DeviceEntity, { id: controller })).name).toBe('peer B committed');
				expect(
					(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
				).toBe(1);
			} finally {
				resume.open();
				await result.catch(() => undefined);
				writes.mockRestore();
			}
		});
		it('refuses a fixed A response when an independent same-revision configuration mutation commits before B3', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const entered = barrier(),
				resume = barrier();
			let held = false;
			const producers = pipeline.get(PropertyProducerRegistryService);
			expect(producers.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
			// No settings/mirror slots in this input: the first active finite observation is the native B2 sample capture.
			const observer = {
				beforeTransactionStart: async () => {
					if (held || producers.readCreationObservationCounts().active === 0) return;
					held = true;
					entered.open();
					await resume.promise;
				},
			};
			database.subscribers.push(observer);
			const result = configs.configure(controller, input);
			void result.catch(() => undefined);
			try {
				await entered.promise;
				await second.query('UPDATE devices_virtual_thermostat_configs SET locked = 1 WHERE controllerId = ?', [
					controller,
				]);
				resume.open();
				await expect(result).rejects.toBeInstanceOf(ClimateAutomationWriteError);
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(
					(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).locked,
				).toBe(true);
			} finally {
				resume.open();
				await result.catch(() => undefined);
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});
		it('preserves a native after-ACK primary and performs no mirrors or response capture on that failed return', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const primary = new Error('native after-ACK sentinel');
			let once = false;
			const observer = {
				afterTransactionCommit: () => {
					if (!once) {
						once = true;
						throw primary;
					}
				},
			};
			database.subscribers.push(observer);
			let preciseOriginalView1: OriginalFunctions<typeof values>;
			const original = ((preciseOriginalView1 = values), preciseOriginalView1.captureDiagnosticSamples);
			const capture = jest
				.spyOn(values, 'captureDiagnosticSamples')
				.mockImplementation((...args) => original.call(values, ...args));
			registerOriginal();
			const write = jest.spyOn(backend, 'writePoints');
			try {
				await expect(configs.configure(controller, input)).rejects.toMatchObject({
					commitOutcome: 'committed',
					cause: primary,
				});
				expect(
					(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
				).toBe(1);
				expect(capture).not.toHaveBeenCalled();
				expect(write).not.toHaveBeenCalled();
			} finally {
				capture.mockRestore();
				write.mockRestore();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});
		it('restores a removed setting to read-only while retaining the native catalog and advancing only the actual structural delta', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const propertyId = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
			input.settings = [{ propertyId, setting: 'heating_setpoint' }];
			const first = await configs.configure(controller, input);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: controller,
			});
			const result = await configs.configure(controller, { ...input, expectedRevision: first.revision, settings: [] });
			expect(result.revision).toBe(first.revision + 1);
			expect(result.graph_revision).toBe(first.graph_revision + 1);
			expect(
				(await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: propertyId })).permissions,
			).toEqual([PermissionType.READ_ONLY]);
			expect(await database.manager.countBy(VirtualThermostatSettingEntity, { propertyId })).toBe(0);
			expect(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).toEqual(
				claim,
			);
			const retained = await whole();
			await configs.configure(controller, { ...input, expectedRevision: result.revision, settings: [] });
			expect(await whole()).toEqual(retained);
		});
		it('persists only an override watermark without intent churn, then durably inhibits a backwards clock without graph churn', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const first = await configs.configure(controller, dto(sensor, heat));
			const definition = await comfort.configure(
				controller,
				{ expected_revision: first.revision, expected_graph_revision: first.graph_revision },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
			try {
				const start = Date.now();
				const created = await comfort.override(
					controller,
					{ expected_revision: definition.revision, expected_graph_revision: definition.graph_revision },
					{ preset: 'eco', setpoints: null, expires_at: new Date(start + 30_000).toISOString() },
					'clock-test-actor',
				);
				const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller });
				const eventsBefore = jest.fn();
				events.on(THERMOSTAT_CONFIG_CHANGED, eventsBefore);
				jest.setSystemTime(start + 2000);
				await comfort.settle(controller);
				const watermark = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				expect(watermark.revision).toBe(created.revision);
				expect(await graph.revision()).toBe(created.graph_revision);
				expect(watermark.comfort?.temporary_override).toMatchObject({
					id: created.configuration.temporary_override.id,
					status: 'active',
					wall_watermark_ms: start + 2000,
					expires_at: new Date(start + 30_000).toISOString(),
				});
				expect(
					await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }),
				).toEqual(slot);
				expect(eventsBefore).not.toHaveBeenCalled();
				jest.setSystemTime(start + 1000);
				await comfort.settle(controller);
				const uncertain = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				expect(uncertain.revision).toBe(created.revision + 1);
				expect(await graph.revision()).toBe(created.graph_revision);
				expect(uncertain.comfort?.temporary_override).toMatchObject({
					id: created.configuration.temporary_override.id,
					status: 'clock_uncertain',
				});
				expect(comfort.isCurrent(uncertain)).toBe(false);
				expect(eventsBefore).toHaveBeenCalledTimes(1);
				expect(
					await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }),
				).toEqual(slot);
			} finally {
				jest.useRealTimers();
			}
		});
		it('preserves every retained Recovery column on a true no-op and refuses invalid UUID history before any mutation', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const configured = await configs.configure(controller, input),
				claim = configured.actuators[0];
			const retained = database.manager.create(VirtualThermostatRecoveryEntity, {
				id: uuid(),
				controllerId: controller,
				claimId: claim.id,
				physicalIdentity: claim.physical_identity,
				previousPropertyIdentity: 'ordinary retained historical identity',
				restoredPropertyId: heat,
				actorId: 'ordinary historical actor',
				reason: 'ordinary retained historical reason',
				disconnectionAcknowledged: true,
				configurationRevision: Number.MAX_SAFE_INTEGER,
				claimRevision: Number.MAX_SAFE_INTEGER,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
			});
			await database.manager.insert(VirtualThermostatRecoveryEntity, retained);
			const before = await whole();
			await configs.configure(controller, { ...input, expectedRevision: configured.revision });
			expect(await whole()).toEqual(before);
			await database.query('UPDATE devices_virtual_thermostat_recoveries SET restoredPropertyId = ? WHERE id = ?', [
				'not-a-uuid',
				retained.id,
			]);
			const malformed = await whole();
			await expect(
				configs.configure(controller, {
					...input,
					expectedRevision: configured.revision,
					policy: { ...input.policy, heatingSetpoint: 21 },
				}),
			).rejects.toThrow();
			expect(await whole()).toEqual(malformed);
		});

		it('refuses a substituted original STI getter across B3 without invoking the replacement or hydrating successor facts', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const entered = barrier(),
				resume = barrier();
			let held = false,
				replacementCalls = 0;
			const producers = pipeline.get(PropertyProducerRegistryService);
			expect(producers.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
			const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
			if (!descriptor?.get) throw new Error('Actual virtual device type getter required');
			const read: Readonly<{ call: (receiver: VirtualDeviceEntity) => unknown }> = descriptor.get;
			const observer = {
				beforeTransactionStart: async () => {
					if (held || producers.readCreationObservationCounts().active === 0) return;
					held = true;
					entered.open();
					await resume.promise;
				},
			};
			database.subscribers.push(observer);
			const result = configs.configure(controller, input);
			void result.catch(() => undefined);
			try {
				await entered.promise;
				Object.defineProperty(VirtualDeviceEntity.prototype, 'type', {
					...descriptor,
					get(this: VirtualDeviceEntity) {
						replacementCalls++;
						return read.call(this);
					},
				});
				resume.open();
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(replacementCalls).toBe(0);
				expect(
					(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
				).toBe(1);
			} finally {
				Object.defineProperty(VirtualDeviceEntity.prototype, 'type', descriptor);
				resume.open();
				await result.catch(() => undefined);
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});
		it('finishes the actual graph plan in NORMALIZE before APPLY and rolls back when its original generation is revoked while held', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat),
				before = await whole();
			const entered = barrier(),
				resume = barrier(),
				originalPlan = graph.validateReservedReplacement;
			const plan = jest.spyOn(graph, 'validateReservedReplacement').mockImplementationOnce(async (...args) => {
				await originalPlan.call(graph, ...args);
				entered.open();
				await resume.promise;
			});
			registerOriginal();
			const result = configs.configure(controller, input);
			void result.catch(() => undefined);
			try {
				await entered.promise;
				expect(await whole(second)).toEqual(before);
				graph.invalidateValidation();
				resume.open();
				await expect(result).rejects.toThrow();
				expect(await whole()).toEqual(before);
			} finally {
				resume.open();
				await result.catch(() => undefined);
				plan.mockRestore();
				registerOriginal();
			}
			await graph.refreshQuarantine();
			expect((await configs.configure(controller, input)).revision).toBe(1);
		});

		// BEGIN original clock-owner correction drafts (UNRUN)
		const activeClock = async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const first = await configs.configure(controller, dto(sensor, heat));
			const definition = await comfort.configure(
				controller,
				{ expected_revision: first.revision, expected_graph_revision: first.graph_revision },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			const created = await comfort.override(
				controller,
				{ expected_revision: definition.revision, expected_graph_revision: definition.graph_revision },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'original-clock-owner',
			);
			return { controller, created };
		};
		// BEGIN lint397 malformed persisted timestamp drafts (UNRUN; cold genuine owners)
		const coldClockRead = async (controllerId: string): Promise<boolean> => {
			const coldStructure = new DeviceStructureLockService();
			const coldRegistry = new ClimateAutomationRegistryService();
			const coldWriter = new ClimateAutomationWriterService(
				database,
				coldStructure,
				coldRegistry,
				new NestConfigService({ FB_CLI: 'off' }),
			);
			const coldGraph = new VirtualDependencyGraphService(
				database,
				new NestConfigService({ FB_CLI: 'off' }),
				coldWriter,
			);
			const coldClaims = new VirtualThermostatClaimsService(
				database,
				coldStructure,
				coldGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
			);
			const coldConfigs = new VirtualThermostatConfigService(
				database,
				coldStructure,
				coldGraph,
				coldClaims,
				events,
				values,
				undefined,
				coldWriter,
			);
			const coldComfort = new VirtualThermostatComfortService(
				database,
				coldStructure,
				coldGraph,
				coldClaims,
				events,
				coldWriter,
			);
			const coldAutomation = registerOriginal(coldConfigs, coldWriter, coldRegistry, coldGraph, coldComfort);
			try {
				await coldGraph.onApplicationBootstrap();
				await coldClaims.onApplicationBootstrap();
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const intent = await coldComfort.readIntentInManager(database.manager, row);
				try {
					return intent.isOverrideCurrent();
				} finally {
					intent.close();
				}
			} finally {
				coldAutomation.onModuleDestroy();
				coldComfort.onModuleDestroy();
				coldClaims.onModuleDestroy();
				coldRegistry.onModuleDestroy();
			}
		};
		it('preserves a valid future timestamp string under a genuinely cold original writer and provider', async () => {
			const { controller } = await activeClock();
			const before = await whole();
			expect(await coldClockRead(controller)).toBe(true);
			expect(await whole()).toEqual(before);
		});
		it.each(['created_at', 'expires_at'] satisfies readonly ('created_at' | 'expires_at')[])(
			'refuses malformed persisted %s in a cold original owner without changing same-incarnation rows',
			async (field) => {
				const { controller } = await activeClock();
				const original = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				if (!original.comfort?.temporary_override) throw new Error('Actual persisted active override required');
				const values: readonly unknown[] = [
					Date.parse(original.comfort.temporary_override[field]),
					[original.comfort.temporary_override[field]],
					{ timestamp: original.comfort.temporary_override[field] },
				];
				for (const value of values) {
					// Complete stored JSON bypasses no authority: it is malformed data to be refused.
					await second.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = ? WHERE "controllerId" = ?', [
						JSON.stringify({
							...original.comfort,
							temporary_override: { ...original.comfort.temporary_override, [field]: value },
						}),
						controller,
					]);
					const peer = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
						controllerId: controller,
					});
					expect(peer.revision).toBe(original.revision);
					expect(peer.comfort?.temporary_override?.id).toBe(original.comfort.temporary_override.id);
					const before = await whole();
					expect(await coldClockRead(controller)).toBe(false);
					expect(await whole()).toEqual(before);
				}
			},
		);
		// END lint397 malformed persisted timestamp drafts
		it.each(['expires_at', 'original_duration_ms', 'wall_watermark_ms'] satisfies readonly (
			| 'expires_at'
			| 'original_duration_ms'
			| 'wall_watermark_ms'
		)[])(
			'rejects a committed independent peer same-ID/revision %s rewrite without giving it a new budget',
			async (field) => {
				const { controller, created } = await activeClock();
				const before = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				if (!before.comfort?.temporary_override) throw new Error('Actual active override required');
				const original = before.comfort.temporary_override;
				if (typeof original.original_duration_ms !== 'number' || typeof original.wall_watermark_ms !== 'number')
					throw new Error('Actual materialized lifetime required');
				const replacement = {
					...original,
					[field]:
						field === 'expires_at'
							? new Date(Date.parse(original.expires_at) + 1000).toISOString()
							: field === 'original_duration_ms'
								? original.original_duration_ms + 1000
								: original.wall_watermark_ms + 1,
				};
				await second.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = ? WHERE "controllerId" = ?', [
					JSON.stringify({ ...before.comfort, temporary_override: replacement }),
					controller,
				]);
				const peer = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
				expect(peer.revision).toBe(created.revision);
				expect(peer.comfort.temporary_override.id).toBe(original.id);
				const token = await comfort.readIntentInManager(database.manager, peer);
				try {
					expect(token.isOverrideCurrent()).toBe(false);
				} finally {
					token.close();
				}
				expect(
					await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }),
				).toEqual(peer);
				await comfort.settle(controller);
				const refused = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				expect(refused.comfort.temporary_override.id).toBe(original.id);
				expect(refused.comfort.temporary_override.status).toBe('clock_uncertain');
			},
		);
		it('refuses a real peer rewrite at B3 and leaves no successful A clock candidate', async () => {
			const { controller } = await activeClock(),
				before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			let preciseOriginalView2: OriginalFunctions<typeof writer>;
			const entered = barrier(),
				resume = barrier(),
				originalProbe = ((preciseOriginalView2 = writer), preciseOriginalView2.probeExistingPlanResponse);
			let probes = 0;
			jest.spyOn(writer, 'probeExistingPlanResponse').mockImplementation(async (descriptor) => {
				if (++probes === 2) {
					entered.open();
					await resume.promise;
				}
				return originalProbe.call(writer, descriptor);
			});
			registerOriginal();
			const result = comfort.select(
				controller,
				{ expected_revision: before.revision, expected_graph_revision: await graph.revision() },
				'eco',
				false,
			);
			void result.catch(() => undefined);
			try {
				await entered.promise;
				const a = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
				if (!a.comfort?.temporary_override || typeof a.comfort.temporary_override.wall_watermark_ms !== 'number')
					throw new Error('Actual committed override required');
				const changed = {
					...a.comfort,
					temporary_override: {
						...a.comfort.temporary_override,
						wall_watermark_ms: a.comfort.temporary_override.wall_watermark_ms + 1,
					},
				};
				await second.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = ? WHERE "controllerId" = ?', [
					JSON.stringify(changed),
					controller,
				]);
				resume.open();
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				const b = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }),
					intent = await comfort.readIntentInManager(database.manager, b);
				try {
					expect(intent.isOverrideCurrent()).toBe(false);
				} finally {
					intent.close();
				}
				expect(b.comfort).toEqual(changed);
			} finally {
				resume.open();
				await result.catch(() => undefined);
			}
		});
		it('keeps observed same-instance restore sticky and an old owner close cannot remove a clean B owner', async () => {
			const captures: NonNullable<ReturnType<ClimateAutomationWriterService['existingOverrideLeaseForPlan']>>[] = [];
			let preciseOriginalView3: OriginalFunctions<typeof writer>;
			const original = ((preciseOriginalView3 = writer), preciseOriginalView3.existingOverrideLeaseForPlan);
			jest.spyOn(writer, 'existingOverrideLeaseForPlan').mockImplementation((descriptor) => {
				const value = original.call(writer, descriptor);
				if (value && captures.length === 0) captures.push(value);
				return value;
			});
			registerOriginal();
			const { controller, created } = await activeClock(),
				a = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			const captured = captures[0];
			if (!captured) throw new Error('Actual original owner token required');
			await database.query(
				'UPDATE "devices_virtual_thermostat_configs" SET "comfort" = "comfort" WHERE "controllerId" = ?',
				[controller],
			);
			const old = await comfort.readIntentInManager(database.manager, a);
			try {
				expect(old.isOverrideCurrent()).toBe(false);
			} finally {
				old.close();
			}
			await comfort.cancel(
				controller,
				{ expected_revision: a.revision, expected_graph_revision: await graph.revision() },
				created.configuration.temporary_override.id,
			);
			const latest = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
				controllerId: controller,
			});
			const b = await comfort.override(
				controller,
				{ expected_revision: latest.revision, expected_graph_revision: await graph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 20_000).toISOString() },
				'clean-B-owner',
			);
			writer.closeExistingOverrideLease(captured.token);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }),
				intent = await comfort.readIntentInManager(database.manager, row);
			try {
				expect(intent.isOverrideCurrent()).toBe(true);
			} finally {
				intent.close();
			}
			expect(row.comfort.temporary_override.id).toBe(b.configuration.temporary_override.id);
		});
		it('replaces membership generation after a real file-peer claims write and original refresh, never reviving A captures', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const configured = await configs.configure(controller, dto(sensor, heat));
			await claims.refresh();
			const original = claims.capture(),
				claim = configured.actuators[0],
				leaf = await target(heat, false);
			const authority = claims.mintAuthority(claim.id, 'off');
			expect(original.isCurrent()).toBe(true);
			expect(original.isCurrent(leaf)).toBe(true);
			expect(claims.isAuthorized(authority, leaf)).toBe(true);
			await second.query(
				'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = "revision" + 1 WHERE "id" = ?',
				[claim.id],
			);
			await claims.refresh();
			expect(original.isCurrent()).toBe(false);
			expect(original.isCurrent(leaf)).toBe(false);
			expect(claims.isAuthorized(authority, leaf)).toBe(false);
			expect(claims.capture().isCurrent()).toBe(true);
			expect(claims.isAuthorized(claims.mintAuthority(claim.id, 'off'), leaf)).toBe(true);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).revision,
			).toBe(claim.revision + 1);
		});

		// BEGIN enabled-lock clock-admission regression drafts (UNRUN)
		const enableRealMirrorLocks = async (): Promise<void> => {
			// Replace the fixture-owned false-mode DI assembly, not a readonly flag or lock implementation.
			automation.onModuleDestroy();
			comfort.onModuleDestroy();
			await pipeline.close();
			pipeline = await Test.createTestingModule({
				providers: [
					PropertyValueService,
					PropertyValueLockService,
					PropertyValueSourceRegistryService,
					PropertyProducerRegistryService,
					StorageService,
					{ provide: DataSource, useValue: database },
					{ provide: EventEmitter2, useValue: events },
					{ provide: NestConfigService, useValue: new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }) },
					{
						provide: ModuleConfigService,
						useValue: {
							getModuleConfig: () =>
								Object.assign(new StorageConfigModel(), { primaryStorage: 'enabled-lock-clock-fixture' }),
						},
					},
				],
			}).compile();
			const plugin: StoragePlugin = {
				name: 'enabled-lock-clock-fixture',
				initialize: () => Promise.resolve(),
				destroy: () => Promise.resolve(),
				isAvailable: () => true,
				writePoints: () => Promise.resolve(),
				query: <T>() => Promise.resolve<T[]>([]),
				queryRaw: <T>() => Promise.reject<T>(new Error('No raw fixture history')),
				registerSchema: () => undefined,
				dropMeasurement: () => Promise.resolve(),
				getMeasurements: () => Promise.resolve([]),
			};
			backend = plugin;
			pipeline.get(StorageService).registerPlugin(plugin.name, plugin);
			values = pipeline.get(PropertyValueService);
			configs = new VirtualThermostatConfigService(
				database,
				structure,
				graph,
				claims,
				events,
				values,
				undefined,
				writer,
			);
			comfort = new VirtualThermostatComfortService(database, structure, graph, claims, events, writer);
			expect(pipeline.get(PropertyValueLockService).isEnabled()).toBe(true);
			registerOriginal();
		};
		it.each([false, true])(
			'seals fixed A after real enabled mirror lock INSERT/DELETE with active override=%s and still closes on a later native write',
			async (active) => {
				await enableRealMirrorLocks();
				const controller = await owner(),
					sensor = await ambient(),
					heat = await actuator();
				const settingId = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE),
					input = dto(sensor, heat);
				input.settings = [{ propertyId: settingId, setting: 'heating_setpoint' }];
				const captures: NonNullable<ReturnType<ClimateAutomationWriterService['existingOverrideLeaseForPlan']>>[] = [];
				let preciseOriginalView4: OriginalFunctions<typeof writer>;
				const originalLease = ((preciseOriginalView4 = writer), preciseOriginalView4.existingOverrideLeaseForPlan);
				const capture = jest.spyOn(writer, 'existingOverrideLeaseForPlan').mockImplementation((descriptor) => {
					const lease = originalLease.call(writer, descriptor);
					if (lease) captures.push(lease);
					return lease;
				});
				registerOriginal();
				const writes: { query: string; parameters: readonly unknown[] }[] = [];
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (/^(?:INSERT INTO|DELETE FROM) "devices_module_property_value_locks"/.test(event.query)) {
							const preciseEventView5: Readonly<{ parameters?: readonly unknown[] }> = event;
							writes.push({ query: event.query, parameters: Object.freeze([...(preciseEventView5.parameters ?? [])]) });
						}
					},
				};
				database.subscribers.push(observer);
				const submitted = jest.spyOn(backend, 'writePoints');
				try {
					const first = await configs.configure(controller, input);
					if (active) {
						const definition = await comfort.configure(
							controller,
							{ expected_revision: first.revision, expected_graph_revision: first.graph_revision },
							{
								heating_range: { minimum: 10, maximum: 30 },
								cooling_range: null,
								presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
							},
						);
						await comfort.override(
							controller,
							{ expected_revision: definition.revision, expected_graph_revision: definition.graph_revision },
							{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
							'enabled-lock-clock-owner',
						);
					}
					const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
						controllerId: controller,
					});
					const originalOwner = captures.at(-1);
					writes.length = 0;
					submitted.mockClear();
					const fixed = await configs.configure(controller, {
						...input,
						expectedRevision: before.revision,
						policy: { ...input.policy, heatingSetpoint: 21 },
					});
					expect(fixed.controller).toBe(controller);
					expect(fixed.revision).toBe(before.revision + 1);
					expect(fixed.policy.heatingSetpoint).toBe(21);
					if (!active)
						expect(
							(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }))
								.comfort,
						).toBeNull();
					expect(await configs.command([await target(settingId, 22)])).toBe(true);
					const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
						controllerId: controller,
					});
					expect(after.policy.heatingSetpoint).toBe(22);
					expect(after.revision).toBe(fixed.revision + 1);
					expect(submitted).toHaveBeenCalled();
					const inserts = writes.filter(
						(item) =>
							item.query ===
							'INSERT INTO "devices_module_property_value_locks" ("propertyId", "ownerToken", "expiresAt") VALUES (?, ?, ?) ON CONFLICT("propertyId") DO NOTHING',
					);
					const deletes = writes.filter(
						(item) =>
							item.query ===
							'DELETE FROM "devices_module_property_value_locks" WHERE "propertyId" = ? AND "ownerToken" = ?',
					);
					expect(inserts.length).toBeGreaterThanOrEqual(2);
					expect(deletes).toHaveLength(inserts.length);
					expect(writes).toHaveLength(inserts.length + deletes.length);
					for (const insert of inserts) {
						expect(insert.parameters).toHaveLength(3);
						expect(insert.parameters[0]).toBe(settingId);
						expect(typeof insert.parameters[1]).toBe('string');
						expect(typeof insert.parameters[2]).toBe('number');
						expect(
							deletes.filter(
								(item) =>
									item.parameters.length === 2 &&
									item.parameters[0] === insert.parameters[0] &&
									item.parameters[1] === insert.parameters[1],
							),
						).toHaveLength(1);
					}
					expect(await database.query('SELECT * FROM "devices_module_property_value_locks"')).toEqual([]);
					if (active) {
						const installed = captures.at(-1);
						if (!originalOwner || !installed || !after.comfort?.temporary_override)
							throw new Error('Actual original active lifetime and installed owner required');
						expect(installed.id).toBe(originalOwner.id);
						expect(installed.deadline).toBe(originalOwner.deadline);
						expect(after.comfort.temporary_override.status).toBe('active');
						const joined = await comfort.readIntentInManager(database.manager, after);
						try {
							expect(joined.isOverrideCurrent()).toBe(true);
							// A real affected-one write after admission closes this owner even if persisted A bytes are identical.
							await database.query(
								'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" WHERE "controllerId" = ?',
								[controller],
							);
							expect(await database.query('SELECT changes() AS count')).toEqual([{ count: 1 }]);
							expect(joined.isOverrideCurrent()).toBe(false);
						} finally {
							joined.close();
						}
						const unchanged = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
							controllerId: controller,
						});
						expect(unchanged).toEqual(after);
						const fresh = await comfort.readIntentInManager(database.manager, unchanged);
						try {
							expect(fresh.isOverrideCurrent()).toBe(false);
						} finally {
							fresh.close();
						}
						await comfort.settle(controller);
						const refused = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
							controllerId: controller,
						});
						expect(refused.comfort?.temporary_override).toMatchObject({ id: installed.id, status: 'clock_uncertain' });
						const conservative = captures.at(-1);
						if (!conservative) throw new Error('Actual conservative retained owner required');
						expect(conservative.deadline).toBe(installed.deadline);
					}
				} finally {
					capture.mockRestore();
					submitted.mockRestore();
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
			},
		);
		// END enabled-lock clock-admission regression drafts

		// END original clock-owner correction drafts
	});
	// END closed existing-controller route regressions
	// BEGIN genuine STI sibling native projection regressions (SOURCE-ONLY; UNEXECUTED)
	describe('authentic STI sibling columns remain full native facts', () => {
		const fullRows = async (): Promise<Record<string, unknown[]>> => {
			const rows: Record<string, unknown[]> = {};
			for (const table of [
				'devices_virtual_thermostat_configs',
				'devices_virtual_thermostat_sources',
				'devices_virtual_thermostat_actuator_claims',
				'devices_virtual_thermostat_settings',
				'devices_virtual_thermostat_member_protection',
				'devices_virtual_thermostat_cooling_dependencies',
				'devices_virtual_thermostat_recoveries',
				'devices_virtual_thermostat_command_journal',
				'devices_virtual_thermostat_runtime',
				'devices_virtual_thermostat_branch_runtime',
				'devices_virtual_thermostat_installations',
				'devices_virtual_thermostat_installation_audit',
				'devices_module_devices',
				'devices_module_channels',
				'devices_module_channels_properties',
				'devices_shelly_ng_sample_sources',
				'devices_virtual_dew_point_configs',
				'devices_virtual_dew_point_sources',
				'devices_virtual_transform_configs',
				'devices_virtual_transform_sources',
				'devices_virtual_aggregate_configs',
				'devices_virtual_aggregate_inputs',
				'devices_virtual_light_group_configs',
				'devices_virtual_light_group_members',
				'devices_virtual_light_group_bindings',
				'devices_module_climate_automation_slots',
				'devices_module_climate_automation_sources',
				'devices_virtual_graph_revision',
			])
				rows[table] = await database.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`);
			return rows;
		};
		it('configures a genuine virtual controller while retaining its non-NULL physical sibling cell', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const entity = await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: controller });
			const column = database.getMetadata(DeviceEntity).columns.find((item) => item.propertyName === 'hasEthernet');
			if (!column) throw new Error('Actual STI sibling column required');
			expect(column.target).toBe(ShellyNgDeviceEntity);
			expect(column.isNullable).toBe(true);
			expect(entity).not.toBeInstanceOf(ShellyNgDeviceEntity);
			const hydrated: unknown = column.getEntityValue(entity);
			expect(hydrated).toBeUndefined();
			const before = await database.query<Record<string, unknown>[]>(
				'SELECT * FROM "devices_module_devices" WHERE "id" = ?',
				[controller],
			);
			expect(before).toHaveLength(1);
			const row = before[0];
			if (!row) throw new Error('Actual controller raw row required');
			expect(row.hasEthernet).not.toBeNull();
			expect(row.hasEthernet).not.toBeUndefined();
			const configured = await configs.configure(controller, dto(sensor, heat));
			expect(configured.revision).toBe(1);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })).revision,
			).toBe(1);
			expect(
				(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller })).manualHold,
			).toBe(true);
			expect(await database.query('SELECT * FROM "devices_module_devices" WHERE "id" = ?', [controller])).toEqual(
				before,
			);
		});

		it('refuses an applicable ORM projection mismatch and rolls back without altering persisted rows', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const before = await fullRows();
			let patched = 0,
				rollbacks = 0;
			let faultRunner: import('typeorm').QueryRunner | undefined;
			// readRowsInManager deliberately disables afterLoad; the real driver emits this event BEFORE hydration.
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (patched || !event.success || !event.query.includes('FROM "devices_module_devices" "row"')) return;
					const result: unknown = event.rawResults;
					if (!Array.isArray(result)) return;
					const rows: readonly unknown[] = result;
					for (const row of rows) {
						if (!row || typeof row !== 'object') continue;
						const id: unknown = nativeObjectEvidence.getOwnPropertyDescriptor(row, 'row_id')?.value;
						if (id !== controller) continue;
						const name = nativeObjectEvidence.getOwnPropertyDescriptor(row, 'row_name');
						if (!name || name.get !== undefined || name.set !== undefined || typeof name.value !== 'string') return;
						faultRunner = event.queryRunner;
						Object.defineProperty(row, 'row_name', { ...name, value: 'applicable hydrated projection fault' });
						patched++;
						return;
					}
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					if (event.queryRunner === faultRunner) rollbacks++;
				},
			};
			database.subscribers.push(observer);
			try {
				await expect(configs.configure(controller, dto(sensor, heat))).rejects.toThrow(
					'Native and hydrated thermostat column disagrees.',
				);
				expect(patched).toBe(1);
				expect(rollbacks).toBe(1);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
			expect(await fullRows()).toEqual(before);
		});

		it('detects a same-revision sibling mutation in the admitted manager and rolls back the whole unit', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const configured = await configs.configure(controller, input);
			const before = await fullRows();
			const cells = await database.query<{ hasEthernet: unknown }[]>(
				'SELECT "hasEthernet" FROM "devices_module_devices" WHERE "id" = ?',
				[controller],
			);
			const initial = cells[0];
			if (cells.length !== 1 || !initial || (initial.hasEthernet !== 0 && initial.hasEthernet !== 1))
				throw new Error('Actual native boolean sibling cell required');
			const replacement = initial.hasEthernet === 0 ? 1 : 0;
			let entered = false,
				rollbacks = 0,
				appliedConfigUpdates = 0,
				postApplyRawReads = 0;
			let admittedRunner: import('typeorm').QueryRunner | undefined;
			let postReadRunner: import('typeorm').QueryRunner | undefined;
			let observedDuring: readonly { hasEthernet: unknown }[] | undefined;
			let revisionDuring: readonly { revision: number }[] | undefined;
			let postApplySibling: unknown;
			const updatePrefix = 'UPDATE "devices_virtual_thermostat_configs" SET ';
			const observer = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> => {
					if (entered || !event.query.startsWith(updatePrefix)) return;
					entered = true;
					admittedRunner = event.queryRunner;
					expect(event.manager.queryRunner).toBe(admittedRunner);
					expect(admittedRunner.isTransactionActive).toBe(true);
					// The actual broadcaster awaits BeforeQuery; THIS manager joins the existing native lease, never the peer.
					await event.manager.query('UPDATE "devices_module_devices" SET "hasEthernet" = ? WHERE "id" = ?', [
						replacement,
						controller,
					]);
					observedDuring = await event.manager.query<{ hasEthernet: unknown }[]>(
						'SELECT "hasEthernet" FROM "devices_module_devices" WHERE "id" = ?',
						[controller],
					);
					revisionDuring = await event.manager.query<{ revision: number }[]>(
						'SELECT "revision" FROM "devices_virtual_thermostat_configs" WHERE "controllerId" = ?',
						[controller],
					);
				},
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (!event.success || event.queryRunner !== admittedRunner) return;
					if (event.query.startsWith(updatePrefix)) appliedConfigUpdates++;
					if (
						!appliedConfigUpdates ||
						!event.query.startsWith('SELECT * FROM "devices_module_devices" WHERE "id" IN (')
					)
						return;
					const result: unknown = event.rawResults;
					if (!Array.isArray(result)) return;
					const rows: readonly unknown[] = result;
					for (const row of rows) {
						if (!row || typeof row !== 'object') continue;
						const id: unknown = nativeObjectEvidence.getOwnPropertyDescriptor(row, 'id')?.value;
						if (id !== controller) continue;
						postApplySibling = nativeObjectEvidence.getOwnPropertyDescriptor(row, 'hasEthernet')?.value;
						postReadRunner = event.queryRunner;
						postApplyRawReads++;
					}
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					if (event.queryRunner === admittedRunner) rollbacks++;
				},
			};
			const changed = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, changed);
			database.subscribers.push(observer);
			try {
				await expect(
					configs.configure(controller, {
						...input,
						expectedRevision: configured.revision,
						policy: { ...input.policy, heatingSetpoint: 21 },
					}),
				).rejects.toThrow('Thermostat revision or private initialization changed.');
				expect(entered).toBe(true);
				expect(observedDuring).toEqual([{ hasEthernet: replacement }]);
				expect(revisionDuring).toEqual([{ revision: configured.revision }]);
				expect(appliedConfigUpdates).toBe(1);
				expect(postApplyRawReads).toBe(1);
				expect(postApplySibling).toBe(replacement);
				expect(postReadRunner).toBe(admittedRunner);
				expect(rollbacks).toBe(1);
				expect(changed).not.toHaveBeenCalled();
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				events.off(THERMOSTAT_CONFIG_CHANGED, changed);
			}
			expect(await fullRows()).toEqual(before);
		});
	});
	// END genuine STI sibling native projection regressions
	// BEGIN independently planned final claim-selector regression drafts (UNEXECUTED)
	describe('independently planned final claim selectors', () => {
		const whole = async (): Promise<Record<string, unknown[]>> => {
			const rows: Record<string, unknown[]> = {};
			for (const table of [
				'devices_module_devices',
				'devices_module_channels',
				'devices_module_channels_properties',
				'devices_virtual_thermostat_configs',
				'devices_virtual_thermostat_sources',
				'devices_virtual_thermostat_actuator_claims',
				'devices_virtual_thermostat_settings',
				'devices_virtual_thermostat_member_protection',
				'devices_virtual_thermostat_cooling_dependencies',
				'devices_virtual_thermostat_recoveries',
				'devices_virtual_thermostat_command_journal',
				'devices_virtual_thermostat_runtime',
				'devices_virtual_thermostat_branch_runtime',
				'devices_virtual_thermostat_installations',
				'devices_virtual_thermostat_installation_audit',
				'devices_module_climate_automation_slots',
				'devices_module_climate_automation_sources',
				'devices_virtual_graph_revision',
			])
				rows[table] = await database.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`);
			return rows;
		};
		// Typed retained offline installation history only; never an installed qualification or physical proof.
		const auditSnapshot = (fingerprint: string): ThermostatInstallationAuditEntity['snapshot'] => ({
			setup: {
				...memberInstallationSetup(),
				effectiveFloorCutoffC: 30,
				floorDomainC: { minimum: -40, maximum: 100 },
				floorMaximumAgeMs: 5000,
				floorComponentType: 'temperature',
				floorComponentId: 0,
				floorAttribute: 'tC',
				floorConfigurationJson: JSON.stringify({ id: 0, type: 'DS18B20' }),
				peripheralsJson: JSON.stringify({ temperature: { 'temperature:0': { addr: 'offline-fixture' } } }),
			},
			attestations: [],
			bindingFingerprint: fingerprint,
		});
		const branchHistory = (claimId: string): Omit<VirtualThermostatBranchRuntimeEntity, 'claim'> => ({
			claimId,
			activity: 'unknown',
			lastVerifiedOffAt: null,
			releaseProofId: null,
			releaseAttempts: 3,
			nextReleaseAt: null,
			fault: 'retained_offline_history',
			floorLatched: null,
		});

		it('reads complete final native claim selectors before first controller persistence and completes first configuration', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const trace: string[] = [];
			const selected: { table: string; claimId: string; rows: number; runner: import('typeorm').QueryRunner }[] = [];
			let persistenceStarted = false;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
					if (event.query.startsWith('INSERT INTO "devices_virtual_thermostat_configs"')) {
						persistenceStarted = true;
						trace.push('controller_insert');
					}
				},
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (persistenceStarted || !event.success) return;
					for (const table of [
						'devices_virtual_thermostat_branch_runtime',
						'devices_virtual_thermostat_installation_audit',
					]) {
						if (!event.query.startsWith(`SELECT * FROM "${table}" WHERE "claimId" IN (`)) continue;
						const parameters: readonly unknown[] = event.parameters ?? [];
						const raw: unknown = event.rawResults;
						if (parameters.length !== 1 || typeof parameters[0] !== 'string' || !Array.isArray(raw))
							throw new Error('Actual final claim selector evidence required');
						expect(event.queryRunner.isTransactionActive).toBe(true);
						selected.push({ table, claimId: parameters[0], rows: raw.length, runner: event.queryRunner });
						trace.push(table);
					}
				},
			};
			database.subscribers.push(observer);
			try {
				const configured = await configs.configure(controller, dto(sensor, heat));
				const claims = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
					controllerId: controller,
				});
				expect(claims).toHaveLength(1);
				const claim = claims[0];
				if (!claim) throw new Error('Actual newly persisted claim required');
				expect(configured.revision).toBe(1);
				expect(selected.map(({ table, claimId, rows }) => ({ table, claimId, rows }))).toEqual([
					{ table: 'devices_virtual_thermostat_branch_runtime', claimId: claim.id, rows: 0 },
					{ table: 'devices_virtual_thermostat_installation_audit', claimId: claim.id, rows: 0 },
				]);
				expect(selected[0]?.runner).toBe(selected[1]?.runner);
				expect(trace.slice(0, 3)).toEqual([
					'devices_virtual_thermostat_branch_runtime',
					'devices_virtual_thermostat_installation_audit',
					'controller_insert',
				]);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});

		it('extends complete membership without changing retained native history and refuses unresolved removal without churn', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				first = await actuator(),
				second = await actuator('A8032ABE5099');
			const input = dto(sensor, first);
			const configured = await configs.configure(controller, input);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: controller,
			});
			await database.manager.insert(VirtualThermostatBranchRuntimeEntity, branchHistory(claim.id));
			await database.manager.insert(ThermostatInstallationAuditEntity, {
				id: uuid(),
				claimId: claim.id,
				revision: 1,
				action: 'staged',
				actorId: null,
				occurredAt: new Date('2026-10-01T00:00:00.000Z'),
				snapshot: auditSnapshot(claim.contractFingerprint),
			});
			const branch = await database.query(
				'SELECT * FROM "devices_virtual_thermostat_branch_runtime" ORDER BY "claimId"',
			);
			const audit = await database.query('SELECT * FROM "devices_virtual_thermostat_installation_audit" ORDER BY "id"');
			input.actuators.push({ role: 'heating', sourcePropertyId: second, leaseSeconds: 30 });
			await protectMembers(input);
			const extended = await configs.configure(controller, { ...input, expectedRevision: configured.revision });
			expect(extended.revision).toBe(configured.revision + 1);
			const claims = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId: controller });
			expect(claims).toHaveLength(2);
			expect(claims.some((row) => row.id === claim.id)).toBe(true);
			expect(
				await database.query('SELECT * FROM "devices_virtual_thermostat_branch_runtime" ORDER BY "claimId"'),
			).toEqual(branch);
			expect(
				await database.query('SELECT * FROM "devices_virtual_thermostat_installation_audit" ORDER BY "id"'),
			).toEqual(audit);
			const beforeRemoval = await whole();
			await expect(
				configs.configure(controller, {
					...input,
					expectedRevision: extended.revision,
					actuators: [input.actuators[0]],
				}),
			).rejects.toThrow('cannot be detached');
			expect(await whole()).toEqual(beforeRemoval);
		});

		it('rolls back an actual no-FK audit insert after the final-selector read and before the original controller INSERT', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const before = await whole();
			let selectedClaim: string | undefined, selectedRunner: import('typeorm').QueryRunner | undefined;
			let expectedRead = 0,
				inserted = 0,
				controllerWrites = 0,
				rollbacks = 0;
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (!event.success) return;
					if (
						!selectedClaim &&
						event.query.startsWith('SELECT * FROM "devices_virtual_thermostat_installation_audit" WHERE "claimId" IN (')
					) {
						const parameters: readonly unknown[] = event.parameters ?? [];
						if (parameters.length !== 1 || typeof parameters[0] !== 'string')
							throw new Error('Original planned claim required');
						selectedClaim = parameters[0];
						selectedRunner = event.queryRunner;
						expectedRead++;
						expect(event.rawResults).toEqual([]);
					}
					if (event.query.startsWith('INSERT INTO "devices_virtual_thermostat_configs"')) controllerWrites++;
				},
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> => {
					if (inserted || !event.query.startsWith('INSERT INTO "devices_virtual_thermostat_configs"')) return;
					if (!selectedClaim || !selectedRunner) throw new Error('Expected read must precede mutation');
					inserted++;
					expect(event.queryRunner).toBe(selectedRunner);
					expect(event.manager.queryRunner).toBe(selectedRunner);
					await event.manager.insert(ThermostatInstallationAuditEntity, {
						id: uuid(),
						claimId: selectedClaim,
						revision: 1,
						action: 'staged',
						actorId: null,
						occurredAt: new Date('2026-10-01T00:00:00.000Z'),
						snapshot: auditSnapshot('unexpected_preapply_history'),
					});
					expect(await event.manager.countBy(ThermostatInstallationAuditEntity, { claimId: selectedClaim })).toBe(1);
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					if (event.queryRunner === selectedRunner) rollbacks++;
				},
			};
			const changed = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, changed);
			database.subscribers.push(observer);
			try {
				await expect(configs.configure(controller, dto(sensor, heat))).rejects.toThrow(
					'Thermostat revision or private initialization changed.',
				);
				expect(expectedRead).toBe(1);
				expect(inserted).toBe(1);
				expect(controllerWrites).toBe(1);
				expect(rollbacks).toBe(1);
				expect(changed).not.toHaveBeenCalled();
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				events.off(THERMOSTAT_CONFIG_CHANGED, changed);
			}
			expect(await whole()).toEqual(before);
		});

		it('rolls back a same-revision retained branch history mutation after the independent plan read', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator(),
				input = dto(sensor, heat);
			const configured = await configs.configure(controller, input);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: controller,
			});
			await database.manager.insert(VirtualThermostatBranchRuntimeEntity, branchHistory(claim.id));
			const before = await whole();
			let mutated = false,
				updates = 0,
				rollbacks = 0;
			let runner: import('typeorm').QueryRunner | undefined;
			const observer = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> => {
					if (mutated || !event.query.startsWith('UPDATE "devices_virtual_thermostat_configs" SET ')) return;
					mutated = true;
					runner = event.queryRunner;
					expect(event.manager.queryRunner).toBe(runner);
					await event.manager.update(
						VirtualThermostatBranchRuntimeEntity,
						{ claimId: claim.id },
						{ releaseAttempts: 4 },
					);
					expect(
						(await event.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id }))
							.releaseAttempts,
					).toBe(4);
				},
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (event.success && event.query.startsWith('UPDATE "devices_virtual_thermostat_configs" SET ')) updates++;
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					if (event.queryRunner === runner) rollbacks++;
				},
			};
			database.subscribers.push(observer);
			try {
				await expect(
					configs.configure(controller, {
						...input,
						expectedRevision: configured.revision,
						policy: { ...input.policy, heatingSetpoint: 21 },
					}),
				).rejects.toThrow('Thermostat revision or private initialization changed.');
				expect(mutated).toBe(true);
				expect(updates).toBe(1);
				expect(rollbacks).toBe(1);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
			expect(await whole()).toEqual(before);
		});
	});
	// END independently planned final claim-selector regression drafts
	// BEGIN original publication A versus terminal B probe regression drafts (UNEXECUTED)
	describe('original preterminal publication and terminal response probes', () => {
		type PublicationArguments = Parameters<VirtualThermostatConfigService['publishExistingAcknowledged']>;
		it('completes real publication and reconciliation before one terminal prepare and both terminal probes', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const trace: string[] = [];
			const publisherView: OriginalFunctions<Pick<VirtualThermostatConfigService, 'publishExistingAcknowledged'>> =
				configs;
			const comfortView: OriginalFunctions<Pick<VirtualThermostatComfortService, 'reconcileExistingAcknowledged'>> =
				comfort;
			const writerView: OriginalFunctions<
				Pick<ClimateAutomationWriterService, 'prepareExistingRecoveryForPlan' | 'probeExistingPlanResponse'>
			> = writer;
			const publish = publisherView.publishExistingAcknowledged,
				reconcile = comfortView.reconcileExistingAcknowledged;
			const prepare = writerView.prepareExistingRecoveryForPlan,
				terminal = writerView.probeExistingPlanResponse;
			const publication = jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementation((...args) => {
				expect(writer.isExistingPlanAcknowledged(args[1].descriptor)).toBe(true);
				expect(structure.hasCurrentStructuralLease()).toBe(false);
				expect(hasCurrentSqliteConnectionLease(database)).toBe(false);
				trace.push('publication');
				return publish.call(configs, ...args);
			});
			const reconciliation = jest.spyOn(comfort, 'reconcileExistingAcknowledged').mockImplementation((...args) => {
				trace.push('reconcile');
				return reconcile.call(comfort, ...args);
			});
			const preparation = jest.spyOn(writer, 'prepareExistingRecoveryForPlan').mockImplementation((...args) => {
				trace.push('prepare');
				return prepare.call(writer, ...args);
			});
			const probes = jest.spyOn(writer, 'probeExistingPlanResponse').mockImplementation((...args) => {
				trace.push('terminal');
				return terminal.call(writer, ...args);
			});
			const changed = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, changed);
			registerOriginal();
			try {
				const result = await configs.configure(controller, dto(sensor, heat));
				expect(result.revision).toBe(1);
				expect(trace).toEqual(['publication', 'reconcile', 'prepare', 'terminal', 'terminal']);
				expect(publication).toHaveBeenCalledTimes(1);
				expect(reconciliation).toHaveBeenCalledTimes(1);
				expect(preparation).toHaveBeenCalledTimes(1);
				expect(probes).toHaveBeenCalledTimes(2);
				expect(changed).toHaveBeenCalledTimes(1);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }))
						.revision,
				).toBe(1);
				expect(
					(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }))
						.manualHold,
				).toBe(true);
			} finally {
				events.off(THERMOSTAT_CONFIG_CHANGED, changed);
				publication.mockRestore();
				reconciliation.mockRestore();
				preparation.mockRestore();
				probes.mockRestore();
			}
		});

		it('refuses a genuine early terminal descriptor probe before SQL then still completes the original publication and terminal response', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const view: OriginalFunctions<Pick<VirtualThermostatConfigService, 'publishExistingAcknowledged'>> = configs;
			const original = view.publishExistingAcknowledged;
			let attempted = 0,
				earlyQueries = 0;
			const publication = jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementation(async (...args) => {
				attempted++;
				const descriptor = args[1].descriptor;
				expect(writer.isExistingPlanAcknowledged(descriptor)).toBe(true);
				const observer = {
					beforeQuery: (): void => {
						earlyQueries++;
					},
				};
				database.subscribers.push(observer);
				try {
					await expect(writer.probeExistingPlanResponse(descriptor)).rejects.toThrow(
						'Original response plan unavailable',
					);
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
				expect(earlyQueries).toBe(0);
				expect(writer.isExistingPlanAcknowledged(descriptor)).toBe(true);
				return original.call(configs, ...args);
			});
			registerOriginal();
			try {
				const result = await configs.configure(controller, dto(sensor, heat));
				expect(result.revision).toBe(1);
				expect(attempted).toBe(1);
				expect(earlyQueries).toBe(0);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }))
						.revision,
				).toBe(1);
			} finally {
				publication.mockRestore();
			}
		});

		it('keeps a committed peer same-revision native fact after original release and refuses A before its first publication submission', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const propertyId = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
			const input = dto(sensor, heat);
			input.settings = [{ propertyId, setting: 'heating_setpoint' }];
			const view: OriginalFunctions<Pick<VirtualThermostatConfigService, 'publishExistingAcknowledged'>> = configs;
			const original = view.publishExistingAcknowledged;
			let entered = 0,
				committedRevision: number | undefined;
			const writes = jest.spyOn(values, 'writeMutationWithState');
			const publication = jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementation(async (...args) => {
				entered++;
				expect(writer.isExistingPlanAcknowledged(args[1].descriptor)).toBe(true);
				expect(structure.hasCurrentStructuralLease()).toBe(false);
				expect(hasCurrentSqliteConnectionLease(database)).toBe(false);
				committedRevision = (
					await second.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller })
				).revision;
				await second.query('UPDATE "devices_module_devices" SET "name" = ? WHERE "id" = ?', [
					'Committed peer B name',
					controller,
				]);
				expect((await second.manager.findOneByOrFail(DeviceEntity, { id: controller })).name).toBe(
					'Committed peer B name',
				);
				return original.call(configs, ...args);
			});
			const changed = jest.fn();
			events.on(THERMOSTAT_CONFIG_CHANGED, changed);
			registerOriginal();
			try {
				await expect(configs.configure(controller, input)).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(entered).toBe(1);
				expect(committedRevision).toBe(1);
				expect(writes).not.toHaveBeenCalled();
				expect(changed).not.toHaveBeenCalled();
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				expect(after.revision).toBe(1);
				expect((await database.manager.findOneByOrFail(DeviceEntity, { id: controller })).name).toBe(
					'Committed peer B name',
				);
				expect(
					(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller }))
						.slotRevision,
				).toBe(1);
			} finally {
				events.off(THERMOSTAT_CONFIG_CHANGED, changed);
				publication.mockRestore();
				writes.mockRestore();
			}
		});

		it('refuses a foreign writer and later closed original publication lease without SQL or changes to the successful fixed result', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const foreignRegistry = new ClimateAutomationRegistryService();
			const foreign = new ClimateAutomationWriterService(
				database,
				structure,
				foreignRegistry,
				new NestConfigService({ FB_CLI: 'off' }),
			);
			const view: OriginalFunctions<Pick<VirtualThermostatConfigService, 'publishExistingAcknowledged'>> = configs;
			const original = view.publishExistingAcknowledged;
			let captured: PublicationArguments[0] | undefined,
				foreignQueries = 0,
				closedQueries = 0;
			const publication = jest.spyOn(configs, 'publishExistingAcknowledged').mockImplementation(async (...args) => {
				captured = args[0];
				const observer = {
					beforeQuery: (): void => {
						foreignQueries++;
					},
				};
				database.subscribers.push(observer);
				try {
					await expect(foreign.probeExistingResponse(args[0])).rejects.toThrow(
						'Original controller response unavailable',
					);
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
				expect(foreignQueries).toBe(0);
				return original.call(configs, ...args);
			});
			registerOriginal();
			try {
				const result = await configs.configure(controller, dto(sensor, heat));
				if (!captured) throw new Error('Actual original publication lease required');
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				const observer = {
					beforeQuery: (): void => {
						closedQueries++;
					},
				};
				database.subscribers.push(observer);
				try {
					await expect(writer.probeExistingResponse(captured)).rejects.toThrow();
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
				expect(closedQueries).toBe(0);
				expect(foreignQueries).toBe(0);
				expect(result.revision).toBe(1);
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller }),
				).toEqual(before);
			} finally {
				publication.mockRestore();
				foreignRegistry.onModuleDestroy();
			}
		});
	});
	// END original publication A versus terminal B probe regression drafts
	// BEGIN original native intent INSERT delimiter regression drafts (SOURCE-ONLY; UNEXECUTED)
	describe('original native intent and actual ORM INSERT delimiters', () => {
		const protectedRows = async () => ({
			configurations: await database.query<unknown[]>(
				'SELECT * FROM "devices_virtual_thermostat_configs" ORDER BY "controllerId"',
			),
			slots: await database.query<unknown[]>(
				'SELECT * FROM "devices_module_climate_automation_slots" ORDER BY "controllerId"',
			),
			sources: await database.query<unknown[]>(
				'SELECT * FROM "devices_module_climate_automation_sources" ORDER BY "generationId"',
			),
		});

		it('keeps the genuine original intent current across actual adjacent-column journal, runtime and branch INSERTs', async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const configured = await configs.configure(controller, dto(sensor, heat));
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId: controller,
			});
			const commandTable = database.getMetadata(VirtualThermostatCommandEntity).tableName,
				runtimeTable = database.getMetadata(VirtualThermostatRuntimeEntity).tableName,
				branchTable = database.getMetadata(VirtualThermostatBranchRuntimeEntity).tableName;
			const tables = [commandTable, runtimeTable, branchTable],
				inserts: string[] = [];
			const before = await protectedRows();
			expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId: controller })).toBe(0);
			expect(await database.manager.countBy(VirtualThermostatRuntimeEntity, { controllerId: controller })).toBe(0);
			expect(await database.manager.countBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id })).toBe(0);
			const intent = await comfort.readIntentInManager(database.manager, row);
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
					const table = tables.find((name) => event.query.startsWith(`INSERT INTO "${name}"`));
					if (table === undefined) return;
					expect(event.query.startsWith(`INSERT INTO "${table}"(`)).toBe(true);
					inserts.push(table);
				},
			};
			database.subscribers.push(observer);
			const command = {
				id: uuid(),
				controllerId: controller,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: configured.revision,
				decisionRevision: 1,
				action: 'off',
				status: 'prepared',
				preparedAt: new Date(),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			} satisfies Omit<VirtualThermostatCommandEntity, 'config' | 'claim'>;
			try {
				expect(intent.isCurrent()).toBe(true);
				await database.manager.insert(VirtualThermostatCommandEntity, command);
				expect(inserts).toEqual([commandTable]);
				expect(intent.isCurrent()).toBe(true);
				await database.manager.insert(VirtualThermostatRuntimeEntity, {
					controllerId: controller,
					decisionRevision: 1,
					configurationRevision: configured.revision,
					floorLatched: false,
					heuristicHold: null,
					previousDemand: 'off',
					reasons: [],
					evaluatedAt: command.preparedAt,
				});
				expect(inserts).toEqual([commandTable, runtimeTable]);
				expect(intent.isCurrent()).toBe(true);
				await database.manager.insert(VirtualThermostatBranchRuntimeEntity, {
					claimId: claim.id,
					activity: 'unknown',
					lastVerifiedOffAt: null,
					releaseProofId: null,
					releaseAttempts: 0,
					nextReleaseAt: null,
					fault: null,
					floorLatched: null,
				});
				expect(inserts).toEqual(tables);
				expect(intent.isCurrent()).toBe(true);
				expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).toEqual(
					expect.objectContaining(command),
				);
				expect(await database.manager.countBy(VirtualThermostatRuntimeEntity, { controllerId: controller })).toBe(1);
				expect(await database.manager.countBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id })).toBe(1);
				expect(await protectedRows()).toEqual(before);
			} finally {
				intent.close();
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
			}
		});

		it.each(['configuration', 'slot', 'empty-source-attempt'])(
			'closes the original intent on a protected %s same-value write even after native rollback',
			async (kind) => {
				const controller = await owner(),
					sensor = await ambient(),
					heat = await actuator();
				await configs.configure(controller, dto(sensor, heat));
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
				const before = await protectedRows();
				// There is no producer/adoption permission: exercise an empty source-table write attempt, not a fabricated owner.
				expect(before.sources).toEqual([]);
				const table = database.getMetadata(
					kind === 'configuration'
						? VirtualThermostatConfigEntity
						: kind === 'slot'
							? ClimateAutomationSlotEntity
							: ClimateAutomationSourceEntity,
				).tableName;
				const column = kind === 'slot' ? 'slotRevision' : 'revision';
				const predicate = kind === 'empty-source-attempt' ? '0' : '"controllerId" = ?';
				const parameters = kind === 'empty-source-attempt' ? [] : [controller];
				const intent = await comfort.readIntentInManager(database.manager, row);
				const rollback = new Error('Original protected write test rollback');
				try {
					expect(intent.isCurrent()).toBe(true);
					await expect(
						database.transaction(async (manager) => {
							await manager.query(`UPDATE "${table}" SET "${column}" = "${column}" WHERE ${predicate}`, parameters);
							expect(intent.isCurrent()).toBe(false);
							throw rollback;
						}),
					).rejects.toBe(rollback);
					expect(await protectedRows()).toEqual(before);
					expect(intent.isCurrent()).toBe(false);
				} finally {
					intent.close();
				}
			},
		);

		it.each(['configuration', 'slot'])(
			'closes the original intent before a real adjacent-column duplicate %s INSERT is rejected',
			async (kind) => {
				const controller = await owner(),
					sensor = await ambient(),
					heat = await actuator();
				await configs.configure(controller, dto(sensor, heat));
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
				const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: controller });
				const table = database.getMetadata(
					kind === 'configuration' ? VirtualThermostatConfigEntity : ClimateAutomationSlotEntity,
				).tableName;
				const before = await protectedRows();
				const intent = await comfort.readIntentInManager(database.manager, row);
				let insertAttempts = 0;
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (!event.query.startsWith(`INSERT INTO "${table}"`)) return;
						expect(event.query.startsWith(`INSERT INTO "${table}"(`)).toBe(true);
						insertAttempts++;
					},
				};
				database.subscribers.push(observer);
				try {
					expect(intent.isCurrent()).toBe(true);
					const insert =
						kind === 'configuration'
							? database.manager.createQueryBuilder().insert().into(VirtualThermostatConfigEntity).values(row).execute()
							: database.manager.createQueryBuilder().insert().into(ClimateAutomationSlotEntity).values(slot).execute();
					await expect(insert).rejects.toThrow(`UNIQUE constraint failed: ${table}.controllerId`);
					expect(insertAttempts).toBe(1);
					expect(intent.isCurrent()).toBe(false);
					expect(await protectedRows()).toEqual(before);
					expect(intent.isCurrent()).toBe(false);
				} finally {
					intent.close();
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
				}
			},
		);

		it.each(['unknown-table-lookalike', 'adjacent-UPDATE', 'adjacent-DELETE', 'compound-INSERT'])(
			'keeps %s attempts outside original intent membership even when no protected row changes',
			async (kind) => {
				const controller = await owner(),
					sensor = await ambient(),
					heat = await actuator();
				await configs.configure(controller, dto(sensor, heat));
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
				const table = database.getMetadata(VirtualThermostatCommandEntity).tableName;
				const unknown = `${table}_unregistered_probe`;
				expect(database.entityMetadatas.some((metadata) => metadata.tableName === unknown)).toBe(false);
				const before = await protectedRows();
				const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId: controller });
				expect(journal).toEqual([]);
				const query =
					kind === 'unknown-table-lookalike'
						? `INSERT INTO "${unknown}"("id") VALUES (?)`
						: kind === 'adjacent-UPDATE'
							? `UPDATE "${table}"("id") VALUES (?)`
							: kind === 'adjacent-DELETE'
								? `DELETE FROM "${table}"("id")`
								: `INSERT INTO "${table}"("id") SELECT "id" FROM "${table}" WHERE 0; SELECT 1`;
				const parameters = kind === 'unknown-table-lookalike' || kind === 'adjacent-UPDATE' ? [uuid()] : [];
				const intent = await comfort.readIntentInManager(database.manager, row);
				try {
					expect(intent.isCurrent()).toBe(true);
					const attempt = database.query(query, parameters);
					if (kind === 'compound-INSERT') await attempt;
					else await expect(attempt).rejects.toThrow();
					expect(intent.isCurrent()).toBe(false);
					expect(await protectedRows()).toEqual(before);
					expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId: controller })).toEqual(
						journal,
					);
					expect(intent.isCurrent()).toBe(false);
				} finally {
					intent.close();
				}
			},
		);
	});
	// END original native intent INSERT delimiter regression drafts

	// BEGIN R21 additive actual core capture and original-clock drafts (UNRUN)
	describe('R21 exact private capture ownership on the real closed settle root', () => {
		const prepareCapture = async () => {
			const controller = await owner(),
				sensor = await ambient(),
				heat = await actuator();
			const input = dto(sensor, heat);
			await protectMembers(input);
			await configs.configure(controller, input);
			let row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			await comfort.configure(
				controller,
				{ expected_revision: row.revision, expected_graph_revision: await graph.revision() },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: controller });
			await comfort.override(
				controller,
				{ expected_revision: row.revision, expected_graph_revision: await graph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
				'R21-ordinary-owner',
			);
			const original: OriginalFunctions<
				Pick<ClimateAutomationWriterService, 'registerRuntimeSettlementConsumer' | 'captureRuntimeSettlement'>
			> = writer;
			const register = original.registerRuntimeSettlementConsumer,
				capture = original.captureRuntimeSettlement;
			let consumer: ClimateAutomationRuntimeConsumer | undefined;
			const checkpoints: ClimateAutomationRuntimeCheckpoint[] = [];
			const transfers: { before: readonly object[]; after: readonly object[] }[] = [];
			const registration = jest.spyOn(writer, 'registerRuntimeSettlementConsumer').mockImplementation((binding) => {
				const token = register.call(writer, binding);
				consumer = token;
				return token;
			});
			const consumption = jest.spyOn(writer, 'captureRuntimeSettlement').mockImplementation((intent, outcome) => {
				const before = [...database.subscribers];
				const token = capture.call(writer, intent, outcome);
				if (token) {
					checkpoints.push(token);
					transfers.push({ before, after: [...database.subscribers] });
				}
				return token;
			});
			// A real runtime owns the consumer. An empty real platform registry provides NO physical admission.
			// These cases prove core capture/clock/lifecycle, not installed qualification or successful native OFF.
			const transport = new VirtualThermostatTransportService(new PlatformRegistryService(), values);
			const runtime = new VirtualThermostatRuntimeService(
				database,
				structure,
				claims,
				new VirtualThermostatInputsService(database, values),
				transport,
				values,
				pipeline.get(PropertyProducerRegistryService),
				events,
				graph,
				comfort,
				new NestConfigService({ FB_CLI: 'off' }),
			);
			const close = (): void => {
				runtime.onModuleDestroy();
				transport.onModuleDestroy();
				consumption.mockRestore();
				registration.mockRestore();
			};
			return { controller, runtime, checkpoints, transfers, consumer: () => consumer, close };
		};
		it('public settle and GET never transfer new observer resources when their fixed outcomes are discarded', async () => {
			const f = await prepareCapture();
			try {
				const before = database.subscribers.length;
				await comfort.settle(f.controller);
				await comfort.get(f.controller);
				await comfort.settle(f.controller);
				expect(f.checkpoints).toEqual([]);
				expect(f.consumer()).toBeUndefined();
				expect(database.subscribers).toHaveLength(before);
				expect(JSON.stringify(await comfort.get(f.controller))).not.toMatch(/checkpoint|consumer|captureIntent/);
			} finally {
				f.close();
			}
		});
		// BEGIN R25 detached actual GET and negative private-envelope drafts (UNRUN)
		it('GET freezes only detached response descendants and preserves the original loaded row and intent checks', async () => {
			const original: OriginalFunctions<Pick<VirtualThermostatComfortService, 'readIntentInManager'>> = comfort;
			const read = original.readIntentInManager;
			const originalWriter: OriginalFunctions<
				Pick<ClimateAutomationWriterService, 'isExistingIntentCurrent' | 'closeExistingIntent'>
			> = writer;
			const check = originalWriter.isExistingIntentCurrent,
				close = originalWriter.closeExistingIntent;
			let observing = false;
			const rows: VirtualThermostatConfigEntity[] = [];
			const descriptors: { object: object; fields: PropertyDescriptorMap }[] = [];
			const checks: boolean[] = [];
			let closes = 0;
			let projection:
				| Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>>['projection']
				| undefined;
			const recordTree = (value: unknown): void => {
				if (!value || typeof value !== 'object') return;
				const fields = Object.getOwnPropertyDescriptors(value);
				descriptors.push({ object: value, fields });
				for (const field of Object.values(fields)) if (Object.hasOwn(field, 'value')) recordTree(field.value);
			};
			const reading = jest.spyOn(comfort, 'readIntentInManager').mockImplementation((...args) => {
				const pending = read.call(comfort, ...args);
				if (observing) {
					rows.push(args[1]);
					recordTree(args[1].comfort);
					void pending.then(
						(view) => {
							projection = view.projection;
						},
						() => {
							/* Original Promise retains rejection. */
						},
					);
				}
				return pending;
			});
			const checking = jest.spyOn(writer, 'isExistingIntentCurrent').mockImplementation((...args) => {
				const result = check.call(writer, ...args);
				if (observing) checks.push(result);
				return result;
			});
			const closing = jest.spyOn(writer, 'closeExistingIntent').mockImplementation((...args) => {
				if (observing) closes++;
				return close.call(writer, ...args);
			});
			registerOriginal();
			const f = await prepareCapture();
			try {
				observing = true;
				const result = await comfort.get(f.controller);
				observing = false;
				expect(rows).toHaveLength(1);
				expect(checks).toEqual([true]); // SAME original final GET invocation, never a second guard probe.
				expect(closes).toBe(1);
				expect(projection).toBeDefined();
				const row = rows[0];
				expect(result).toEqual({
					controller: f.controller,
					revision: row.revision,
					graph_revision: await graph.revision(),
					configuration: row.comfort,
					effective: effectiveThermostatComfort(row.policy, row.comfort, projection),
					clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
				});
				expect(Object.keys(result).sort()).toEqual([
					'clock_policy',
					'configuration',
					'controller',
					'effective',
					'graph_revision',
					'revision',
				]);
				expect(result.configuration).not.toBe(row.comfort);
				expect(result.configuration?.presets).not.toBe(row.comfort?.presets);
				expect(result.configuration?.temporary_override?.resolved_setpoints).not.toBe(
					row.comfort?.temporary_override?.resolved_setpoints,
				);
				const checkFrozen = (value: unknown): void => {
					if (!value || typeof value !== 'object') return;
					expect(Object.isFrozen(value)).toBe(true);
					for (const field of Object.values(Object.getOwnPropertyDescriptors(value)))
						if (Object.hasOwn(field, 'value')) checkFrozen(field.value);
				};
				checkFrozen(result);
				expect(descriptors.length).toBeGreaterThan(2);
				for (const retained of descriptors)
					expect(Object.getOwnPropertyDescriptors(retained.object)).toEqual(retained.fields);
				expect(JSON.stringify(result)).not.toMatch(/checkpoint|consumer|captureIntent/);
			} finally {
				observing = false;
				f.close();
				closing.mockRestore();
				checking.mockRestore();
				reading.mockRestore();
			}
		});

		it('GET refuses its original intent after a real same-revision native write before the final guard', async () => {
			const original: OriginalFunctions<Pick<VirtualDependencyGraphService, 'revision'>> = graph;
			const revision = original.revision;
			let armed = false,
				intentRead = false,
				changed = 0;
			const originalComfort: OriginalFunctions<Pick<VirtualThermostatComfortService, 'readIntentInManager'>> = comfort;
			const readIntent = originalComfort.readIntentInManager;
			const intentReading = jest.spyOn(comfort, 'readIntentInManager').mockImplementation((...args) => {
				const result = readIntent.call(comfort, ...args);
				if (armed) intentRead = true;
				return result;
			});
			let controller = '';
			const reading = jest.spyOn(graph, 'revision').mockImplementation(async (...args) => {
				const result = await revision.call(graph, ...args);
				if (armed && intentRead) {
					armed = false;
					await database.query(
						'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" WHERE "controllerId" = ?',
						[controller],
					);
					changed++;
				}
				return result;
			});
			registerOriginal();
			const f = await prepareCapture();
			controller = f.controller;
			try {
				// Settle first so the armed graph read belongs to GET's post-intent read, not its preceding root.
				await comfort.settle(controller);
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				armed = true;
				await expect(comfort.get(controller)).rejects.toThrow('Original thermostat intent changed.');
				expect(changed).toBe(1);
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: controller,
				});
				expect(after.revision).toBe(before.revision);
				expect(f.checkpoints).toEqual([]);
			} finally {
				armed = false;
				f.close();
				reading.mockRestore();
				intentReading.mockRestore();
			}
		});

		it.each(['controller', 'provider', 'kind', 'accessor', 'inherited'])(
			'private %s envelope burns its genuine capture without getters, provider hold, environment or SQL',
			async (invalid) => {
				const original: OriginalFunctions<
					Pick<VirtualThermostatConfigService, 'holdExistingAtEntry' | 'captureExistingEnvironment'>
				> = configs;
				const hold = original.holdExistingAtEntry,
					environment = original.captureExistingEnvironment;
				const holds = jest
					.spyOn(configs, 'holdExistingAtEntry')
					.mockImplementation((...args) => hold.call(configs, ...args));
				const captures = jest
					.spyOn(configs, 'captureExistingEnvironment')
					.mockImplementation((...args) => environment.call(configs, ...args));
				registerOriginal();
				const f = await prepareCapture();
				try {
					await f.runtime.onApplicationBootstrap();
					const consumer = f.consumer();
					if (!consumer) throw new Error('Actual runtime consumer missing');
					const token = writer.armRuntimeSettlementCapture(consumer, f.controller);
					let getters = 0,
						queries = 0;
					const request: {
						providerKey: string;
						controllerId: string;
						kind: 'settle-override:v1' | 'configure-existing:v1';
						input: unknown;
					} = {
						providerKey: 'virtual-thermostat:v1',
						controllerId: f.controller,
						kind: 'settle-override:v1',
						input: {},
					};
					Object.defineProperty(request, 'input', {
						get: () => {
							getters++;
							throw new Error('Invalid private input getter executed');
						},
					});
					if (invalid === 'controller') request.controllerId = uuid();
					if (invalid === 'provider') request.providerKey = 'wrong-provider';
					if (invalid === 'kind') request.kind = 'configure-existing:v1';
					if (invalid === 'accessor')
						Object.defineProperty(request, 'controllerId', {
							get: () => {
								getters++;
								return f.controller;
							},
						});
					if (invalid === 'inherited') {
						Reflect.deleteProperty(request, 'controllerId');
						Object.setPrototypeOf(request, { controllerId: f.controller });
					}
					const observer = {
						beforeQuery: (): void => {
							queries++;
						},
					};
					database.subscribers.push(observer);
					holds.mockClear();
					captures.mockClear();
					try {
						await expect(writer.commitExistingControllerForRuntime(request, token)).rejects.toThrow();
						expect(getters).toBe(0);
						expect(queries).toBe(0);
						expect(holds).not.toHaveBeenCalled();
						expect(captures).not.toHaveBeenCalled();
						await expect(
							writer.commitExistingControllerForRuntime(
								{
									providerKey: 'virtual-thermostat:v1',
									controllerId: f.controller,
									kind: 'settle-override:v1',
									input: {},
								},
								token,
							),
						).rejects.toThrow();
						expect(queries).toBe(0);
						expect(holds).not.toHaveBeenCalled();
						expect(captures).not.toHaveBeenCalled();
					} finally {
						writer.closeRuntimeSettlementCapture(token);
						database.subscribers.splice(database.subscribers.indexOf(observer), 1);
					}
				} finally {
					f.close();
					captures.mockRestore();
					holds.mockRestore();
				}
			},
		);
		// BEGIN R27 original unknown negative rejection drafts (UNRUN)
		it.each<{ label: string; cause: unknown }>([
			{ label: 'Error', cause: new Error('Original descriptor failure') },
			{ label: 'string', cause: 'Original descriptor string' },
			{ label: 'undefined', cause: undefined },
			{ label: 'null', cause: null },
		])(
			'private descriptor failure $label returns a genuine Promise with the exact original rejection and burns only its capture',
			async ({ cause }) => {
				const original: OriginalFunctions<
					Pick<VirtualThermostatConfigService, 'holdExistingAtEntry' | 'captureExistingEnvironment'>
				> = configs;
				const hold = original.holdExistingAtEntry,
					environment = original.captureExistingEnvironment;
				const holds = jest
					.spyOn(configs, 'holdExistingAtEntry')
					.mockImplementation((...args) => hold.call(configs, ...args));
				const captures = jest
					.spyOn(configs, 'captureExistingEnvironment')
					.mockImplementation((...args) => environment.call(configs, ...args));
				registerOriginal();
				const f = await prepareCapture();
				try {
					await f.runtime.onApplicationBootstrap();
					const consumer = f.consumer();
					if (!consumer) throw new Error('Actual runtime consumer missing');
					expect(f.checkpoints).toHaveLength(1);
					expect(f.transfers).toHaveLength(1);
					const token = writer.armRuntimeSettlementCapture(consumer, f.controller);
					let inputGetters = 0,
						requestGets = 0,
						queries = 0;
					const descriptors: PropertyKey[] = [];
					const target: Parameters<ClimateAutomationWriterService['commitExistingControllerForRuntime']>[0] = {
						providerKey: 'virtual-thermostat:v1',
						controllerId: f.controller,
						kind: 'settle-override:v1',
						input: {},
					};
					Object.defineProperty(target, 'input', {
						get: () => {
							inputGetters++;
							throw new Error('Private input getter must not execute');
						},
					});
					const request = new Proxy(target, {
						getOwnPropertyDescriptor: (_target, key) => {
							descriptors.push(key);
							throw cause;
						},
						get: (receiver, key, proxy) => {
							requestGets++;
							const reflection: Readonly<{
								get: (target: object, key: PropertyKey, receiver: unknown) => unknown;
							}> = Reflect;
							return reflection.get(receiver, key, proxy);
						},
					});
					const observer = {
						beforeQuery: (): void => {
							queries++;
						},
					};
					database.subscribers.push(observer);
					holds.mockClear();
					captures.mockClear();
					try {
						let pending: ReturnType<ClimateAutomationWriterService['commitExistingControllerForRuntime']> | undefined;
						expect(() => {
							pending = writer.commitExistingControllerForRuntime(request, token);
						}).not.toThrow();
						expect(pending).toBeInstanceOf(Promise);
						if (pending === undefined) throw new Error('Original rejection Promise missing');
						await expect(pending).rejects.toBe(cause);
						const rejection: { reason: unknown }[] = [];
						await pending.then(
							() => {
								throw new Error('Private descriptor failure unexpectedly resolved');
							},
							(reason: unknown) => {
								rejection.push({ reason });
							},
						);
						expect(rejection).toHaveLength(1);
						expect(Object.hasOwn(rejection[0], 'reason')).toBe(true);
						expect(rejection[0].reason).toBe(cause); // undefined/null are present original reasons, never a falsy sentinel
						expect(descriptors).toEqual(['providerKey']);
						expect(requestGets).toBe(0);
						expect(inputGetters).toBe(0);
						expect(queries).toBe(0);
						expect(holds).not.toHaveBeenCalled();
						expect(captures).not.toHaveBeenCalled();
						await expect(
							writer.commitExistingControllerForRuntime(
								{
									providerKey: 'virtual-thermostat:v1',
									controllerId: f.controller,
									kind: 'settle-override:v1',
									input: {},
								},
								token,
							),
						).rejects.toThrow();
						expect(queries).toBe(0);
						expect(holds).not.toHaveBeenCalled();
						expect(captures).not.toHaveBeenCalled();
						expect(f.consumer()).toBe(consumer);
						expect(f.checkpoints).toHaveLength(1);
						expect(f.transfers).toHaveLength(1); // no new positive checkpoint or successor consumer
					} finally {
						writer.closeRuntimeSettlementCapture(token);
						const index = database.subscribers.indexOf(observer);
						if (index >= 0) database.subscribers.splice(index, 1);
					}
				} finally {
					f.close();
					captures.mockRestore();
					holds.mockRestore();
				}
			},
		);
		// END R27 original unknown negative rejection drafts
		// END R25 detached actual GET and negative private-envelope drafts

		it('real runtime root consumes one armed outcome and destroy closes its new read resources synchronously', async () => {
			const f = await prepareCapture();
			try {
				await f.runtime.onApplicationBootstrap();
				expect(f.consumer()).toBeDefined();
				expect(f.checkpoints).toHaveLength(1);
				const checkpoint = f.checkpoints[0];
				expect(f.transfers).toHaveLength(1);
				expect(f.transfers[0].after).toEqual(f.transfers[0].before); // same admitted observer through the mode switch, no remove/re-add
				expect(writer.assessRuntimeSettlement(checkpoint)).toEqual({ kind: 'reuse' });
				f.runtime.onModuleDestroy();
				expect(writer.assessRuntimeSettlement(checkpoint)).toEqual({ kind: 'closed' });
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: f.controller }),
				).toBeDefined();
			} finally {
				f.close();
			}
		});
		it('accepts a genuine same-token watermark cell, then sticky-vetoes original ON across rollback and rebound', async () => {
			let wall = Date.now();
			const clock = jest.spyOn(Date, 'now').mockImplementation(() => wall);
			const f = await prepareCapture();
			let intent: Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>> | undefined;
			try {
				await f.runtime.onApplicationBootstrap();
				expect(f.checkpoints).toHaveLength(1);
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: f.controller,
				});
				intent = await comfort.readIntentInManager(database.manager, row);
				wall += 100;
				expect(intent.isOverrideCurrent()).toBe(true);
				expect(writer.assessRuntimeSettlement(f.checkpoints[0])).toEqual({ kind: 'reuse' });
				wall -= 1000;
				expect(writer.assessRuntimeSettlement(f.checkpoints[0]).kind).toBe('settle');
				wall += 1001;
				expect(intent.isOverrideCurrent()).toBe(false);
				expect(writer.assessRuntimeSettlement(f.checkpoints[0]).kind).toBe('settle');
			} finally {
				intent?.close();
				f.close();
				clock.mockRestore();
			}
		});
		it('a same-revision native write and restore closes the old checkpoint rather than adopting equal rows', async () => {
			const f = await prepareCapture();
			try {
				await f.runtime.onApplicationBootstrap();
				expect(f.checkpoints).toHaveLength(1);
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: f.controller,
				});
				await database.query(
					'UPDATE "devices_virtual_thermostat_configs" SET "requestedMode" = "requestedMode" WHERE "controllerId" = ?',
					[f.controller],
				);
				expect(writer.assessRuntimeSettlement(f.checkpoints[0]).kind).not.toBe('reuse');
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: f.controller }),
				).toEqual(before);
				const consumer = f.consumer();
				if (!consumer) throw new Error('Actual runtime consumer missing');
				const next = await comfort.settleForRuntime(f.controller, consumer);
				expect(writer.assessRuntimeSettlement(f.checkpoints[0]).kind).toBe('closed');
				if (next) {
					expect(next).not.toBe(f.checkpoints[0]);
					comfort.closeRuntimeSettlement(next);
				}
			} finally {
				f.close();
			}
		});
		it('wrong private capture refuses before native admission and cannot consume a different operation', async () => {
			const f = await prepareCapture();
			try {
				await f.runtime.onApplicationBootstrap();
				const consumer = f.consumer();
				if (!consumer) throw new Error('Actual runtime consumer missing');
				const capture = writer.armRuntimeSettlementCapture(consumer, f.controller);
				let queries = 0;
				const observer = {
					beforeQuery: (): void => {
						queries++;
					},
				};
				database.subscribers.push(observer);
				try {
					await expect(
						writer.commitExistingControllerForRuntime(
							{ providerKey: 'virtual-thermostat:v1', controllerId: uuid(), kind: 'settle-override:v1', input: {} },
							capture,
						),
					).rejects.toThrow();
					expect(queries).toBe(0);
					await expect(
						writer.commitExistingControllerForRuntime(
							{
								providerKey: 'virtual-thermostat:v1',
								controllerId: f.controller,
								kind: 'settle-override:v1',
								input: {},
							},
							capture,
						),
					).rejects.toThrow();
					expect(queries).toBe(0);
				} finally {
					writer.closeRuntimeSettlementCapture(capture);
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
			} finally {
				f.close();
			}
		});
		it('destroy retires exact prepared ownership while a real B5 completion Promise remains held', async () => {
			let entered: () => void = () => {
					throw new Error('Gate not initialized');
				},
				resume: () => void = () => {
					throw new Error('Gate not initialized');
				};
			const held = new Promise<void>((resolve) => {
					entered = resolve;
				}),
				release = new Promise<void>((resolve) => {
					resume = resolve;
				});
			const original: OriginalFunctions<Pick<VirtualThermostatConfigService, 'completeExistingAcknowledged'>> = configs;
			const complete = original.completeExistingAcknowledged;
			let armed = false;
			const completion = jest.spyOn(configs, 'completeExistingAcknowledged').mockImplementation(async (...args) => {
				const wire = await complete.call(configs, ...args);
				if (armed) {
					armed = false;
					entered();
					await release;
				}
				return wire;
			});
			registerOriginal(); // legitimate original provider capture happens AFTER the exact callthrough is installed
			const f = await prepareCapture();
			armed = true;
			const starting = f.runtime.onApplicationBootstrap();
			try {
				await held;
				const before = database.subscribers.length;
				f.runtime.onModuleDestroy();
				expect(database.subscribers.length).toBeLessThan(before);
				resume();
				await starting;
				expect(f.checkpoints).toEqual([]);
			} finally {
				f.runtime.onModuleDestroy();
				resume();
				await starting;
				f.close();
				completion.mockRestore();
			}
		});
		it('rootless inactive runtime settlement closes its one-shot arm without a public outcome fallback', async () => {
			const f = await prepareCapture();
			try {
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: f.controller,
				});
				const override = row.comfort?.temporary_override;
				if (!override) throw new Error('Actual override missing');
				await comfort.cancel(
					f.controller,
					{ expected_revision: row.revision, expected_graph_revision: await graph.revision() },
					override.id,
				);
				await f.runtime.onApplicationBootstrap();
				expect(f.consumer()).toBeDefined();
				expect(f.checkpoints).toEqual([]);
				expect(f.transfers).toEqual([]);
			} finally {
				f.close();
			}
		});
		it('old runtime A cleanup cannot close the genuine fresh B consumer and checkpoint', async () => {
			const f = await prepareCapture();
			const transport = new VirtualThermostatTransportService(new PlatformRegistryService(), values);
			const next = new VirtualThermostatRuntimeService(
				database,
				structure,
				claims,
				new VirtualThermostatInputsService(database, values),
				transport,
				values,
				pipeline.get(PropertyProducerRegistryService),
				events,
				graph,
				comfort,
				new NestConfigService({ FB_CLI: 'off' }),
			);
			try {
				await f.runtime.onApplicationBootstrap();
				expect(f.checkpoints).toHaveLength(1);
				const old = f.checkpoints[0];
				f.runtime.onModuleDestroy();
				await next.onApplicationBootstrap();
				expect(f.checkpoints).toHaveLength(2);
				const current = f.checkpoints[1];
				expect(current).not.toBe(old);
				f.runtime.onModuleDestroy();
				comfort.closeRuntimeSettlement(old);
				expect(writer.assessRuntimeSettlement(old)).toEqual({ kind: 'closed' });
				expect(writer.assessRuntimeSettlement(current)).toEqual({ kind: 'reuse' });
			} finally {
				next.onModuleDestroy();
				transport.onModuleDestroy();
				f.close();
			}
		});

		// BEGIN R21 continuation additive original-outcome and GAP drafts (UNRUN)
		it.each<Readonly<{ kind: string; primary: unknown }>>([
			{ kind: 'Error', primary: new Error('original native ACK P') },
			{ kind: 'string', primary: 'original native ACK P' },
			{ kind: 'undefined', primary: undefined },
			{ kind: 'null', primary: null },
		])('preserves native bootstrap $kind P when exact original consumer cleanup also throws Q', async ({ primary }) => {
			const f = await prepareCapture(),
				secondary = new Error('private read cleanup Q');
			const original: OriginalFunctions<Pick<VirtualThermostatComfortService, 'closeRuntimeSettlementConsumer'>> =
				comfort;
			const close = original.closeRuntimeSettlementConsumer;
			// Installed before genuine runtime registration captures its ORIGINAL function and receiver.
			const cleanup = jest.spyOn(comfort, 'closeRuntimeSettlementConsumer').mockImplementation((consumer) => {
				close.call(comfort, consumer);
				throw secondary;
			});
			let fired = false;
			const observer = {
				afterTransactionCommit: (): void => {
					if (!fired) {
						fired = true;
						throw primary;
					}
				},
			};
			database.subscribers.push(observer);
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
				controllerId: f.controller,
			});
			try {
				await expect(f.runtime.onApplicationBootstrap()).rejects.toBe(primary);
				expect(fired).toBe(true);
				expect(cleanup).toHaveBeenCalledTimes(1);
				expect(f.checkpoints).toEqual([]);
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: f.controller }),
				).toEqual(before);
				expect(() => f.runtime.onModuleDestroy()).not.toThrow();
			} finally {
				f.runtime.onModuleDestroy();
				cleanup.mockRestore();
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				f.close();
			}
		});
		it.each(['native-write', 'method-loss'] satisfies readonly ('native-write' | 'method-loss')[])(
			'a real B5-to-caller %s refuses private capture without recapturing its observer',
			async (kind) => {
				let entered: () => void = () => {
						throw new Error('Gate not initialized');
					},
					release: () => void = () => {
						throw new Error('Gate not initialized');
					};
				const held = new Promise<void>((resolve) => {
						entered = resolve;
					}),
					resume = new Promise<void>((resolve) => {
						release = resolve;
					});
				const original: OriginalFunctions<
					Pick<VirtualThermostatConfigService, 'completeExistingAcknowledged' | 'captureExistingEnvironment'>
				> = configs;
				const complete = original.completeExistingAcknowledged,
					environment = original.captureExistingEnvironment;
				let armed = false;
				const completion = jest.spyOn(configs, 'completeExistingAcknowledged').mockImplementation(async (...args) => {
					const fixed = await complete.call(configs, ...args);
					if (armed) {
						armed = false;
						entered();
						await resume;
					}
					return fixed;
				});
				registerOriginal();
				const f = await prepareCapture();
				armed = true;
				const starting = f.runtime.onApplicationBootstrap();
				let substituted:
					| jest.SpyInstance<
							ReturnType<VirtualThermostatConfigService['captureExistingEnvironment']>,
							Parameters<VirtualThermostatConfigService['captureExistingEnvironment']>
					  >
					| undefined;
				try {
					await held;
					if (kind === 'native-write')
						await database.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "requestedMode" = "requestedMode" WHERE "controllerId" = ?',
							[f.controller],
						);
					else
						substituted = jest
							.spyOn(configs, 'captureExistingEnvironment')
							.mockImplementation((...args) => environment.call(configs, ...args));
					release();
					await starting;
					expect(f.checkpoints).toEqual([]);
					expect(f.transfers).toEqual([]);
					if (substituted) expect(substituted).not.toHaveBeenCalled();
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: f.controller }))
							.comfort?.temporary_override,
					).toBeDefined();
				} finally {
					f.runtime.onModuleDestroy();
					release();
					await starting;
					substituted?.mockRestore();
					f.close();
					completion.mockRestore();
				}
			},
		);
		// END R21 continuation additive original-outcome and GAP drafts

		// BEGIN R22 PREINPUT and immutable GAP native drafts (UNRUN)
		it.each([
			{
				label: 'known rollback before the held first read preserves B original checkpoint and old A cannot close B',
				failure: 'rollback',
			},
			{
				label: 'committed A watermark with failed completion leaves B uncertain without a renewed checkpoint or budget',
				failure: 'completion',
			},
		])('$label', async ({ failure }) => {
			let entered: () => void = () => {
					throw new Error('Uninitialized gate');
				},
				release: () => void = () => {
					throw new Error('Uninitialized gate');
				};
			const held = new Promise<void>((resolve) => {
					entered = resolve;
				}),
				resume = new Promise<void>((resolve) => {
					release = resolve;
				});
			const primary = new Error('Explicit original A ' + failure + ' premise');
			const original: OriginalFunctions<
				Pick<
					VirtualThermostatConfigService,
					| 'captureExistingEnvironment'
					| 'completeExistingAcknowledged'
					| 'normalizeExistingInManager'
					| 'applyExistingInManager'
				>
			> = configs;
			const capture = original.captureExistingEnvironment,
				complete = original.completeExistingAcknowledged,
				normalize = original.normalizeExistingInManager,
				apply = original.applyExistingInManager;
			const originalWriter: OriginalFunctions<
				Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime' | 'existingOverrideLeaseForPlan'>
			> = writer;
			const commit = originalWriter.commitExistingControllerForRuntime,
				lease = originalWriter.existingOverrideLeaseForPlan;
			let armed = false,
				observeRoots = false,
				gateTaken = false,
				faultReached = 0;
			let continuity: ReturnType<VirtualThermostatConfigService['captureExistingEnvironment']>['settlementContinuity'];
			let faultRunner: import('typeorm').QueryRunner | undefined;
			let rollbacks = 0,
				commits = 0;
			const writes: { runner: import('typeorm').QueryRunner; query: string }[] = [];
			const errors: { cause: unknown }[] = [];
			const leases: NonNullable<ReturnType<ClimateAutomationWriterService['existingOverrideLeaseForPlan']>>[] = [];
			let normalizedA: Awaited<ReturnType<VirtualThermostatConfigService['normalizeExistingInManager']>> | undefined;
			let appliedA: Parameters<VirtualThermostatConfigService['applyExistingInManager']> | undefined;
			let appliedReturned = false;
			const environment = jest.spyOn(configs, 'captureExistingEnvironment').mockImplementation((...args) => {
				const result = capture.call(configs, ...args);
				if (armed) continuity = result.settlementContinuity;
				return result;
			});
			const completion = jest.spyOn(configs, 'completeExistingAcknowledged').mockImplementation((...args) => {
				if (
					observeRoots &&
					failure === 'completion' &&
					faultReached === 0 &&
					appliedA !== undefined &&
					args[1].descriptor === appliedA[3].descriptor
				) {
					faultReached++;
					return Promise.reject(primary); // genuine post-ACK callback; only A is faulted
				}
				return complete.call(configs, ...args);
			});
			const normalization = jest.spyOn(configs, 'normalizeExistingInManager').mockImplementation((...args) => {
				const pending = normalize.call(configs, ...args);
				if (observeRoots && !normalizedA)
					void pending.then(
						(result) => {
							normalizedA ??= result;
						},
						() => {
							/* SAME original rejection remains on pending. */
						},
					);
				return pending;
			});
			const application = jest.spyOn(configs, 'applyExistingInManager').mockImplementation((...args) => {
				const pending = apply.call(configs, ...args);
				if (observeRoots && !appliedA) {
					appliedA = args;
					void pending.then(
						() => {
							appliedReturned = true;
						},
						() => {
							/* SAME original rejection remains on pending. */
						},
					);
				}
				return pending;
			});
			const committing = jest.spyOn(writer, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
				const pending = commit.call(writer, ...args);
				if (observeRoots)
					void pending.then(undefined, (cause: unknown) => {
						errors.push({ cause });
					});
				return pending; // EXACT original Promise, not the rejection-side observation Promise
			});
			const leasing = jest.spyOn(writer, 'existingOverrideLeaseForPlan').mockImplementation((...args) => {
				const result = lease.call(writer, ...args);
				if (result) leases.push(result);
				return result;
			});
			registerOriginal();
			const f = await prepareCapture();
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
				controllerId: f.controller,
			});
			const beforeSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
				controllerId: f.controller,
			});
			const originalLease = leases[leases.length - 1];
			expect(originalLease).toBeDefined();
			armed = true;
			observeRoots = true;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
					if (/^(?:INSERT|UPDATE|DELETE)\b/.test(event.query))
						writes.push({ runner: event.queryRunner, query: event.query });
					if (armed && continuity && !gateTaken && event.query.startsWith('SELECT')) {
						gateTaken = true;
						faultRunner = event.queryRunner;
						entered();
						return resume.then(() => {
							if (failure === 'rollback') {
								faultReached++;
								throw primary;
							}
						});
					}
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					if (event.queryRunner === faultRunner) rollbacks++;
				},
				afterTransactionCommit: (event: import('typeorm').TransactionCommitEvent): void => {
					if (event.queryRunner === faultRunner) commits++;
				},
			};
			database.subscribers.push(observer);
			const starting = f.runtime.onApplicationBootstrap();
			const transport = new VirtualThermostatTransportService(new PlatformRegistryService(), values);
			const next = new VirtualThermostatRuntimeService(
				database,
				structure,
				claims,
				new VirtualThermostatInputsService(database, values),
				transport,
				values,
				pipeline.get(PropertyProducerRegistryService),
				events,
				graph,
				comfort,
				new NestConfigService({ FB_CLI: 'off' }),
			);
			let nextStarting: Promise<void> | undefined;
			try {
				expect(await Promise.race([held.then(() => 'held'), starting.then(() => 'early')])).toBe('held');
				const originalContinuity = continuity;
				if (!originalContinuity) throw new Error('Original PREINPUT continuity missing');
				expect(originalContinuity.isCurrent()).toBe(true);
				expect(f.checkpoints).toEqual([]);
				f.runtime.onModuleDestroy();
				expect(originalContinuity.isCurrent()).toBe(false); // BEFORE original held native SELECT resumes
				armed = false;
				nextStarting = next.onApplicationBootstrap();
				release();
				await starting;
				await nextStarting;
				expect(faultReached).toBe(1);
				expect(errors).toHaveLength(1);
				const error = errors[0].cause;
				expect(error).toBeInstanceOf(ClimateAutomationWriteError);
				if (!(error instanceof ClimateAutomationWriteError))
					throw new Error('Actual original native receipt error missing');
				expect(error.cause).toBe(primary);
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: f.controller,
				});
				expect(
					await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: f.controller }),
				).toEqual(beforeSlot);
				expect(after.comfort?.temporary_override).toMatchObject({
					id: before.comfort?.temporary_override?.id,
					created_at: before.comfort?.temporary_override?.created_at,
					expires_at: before.comfort?.temporary_override?.expires_at,
					original_duration_ms: before.comfort?.temporary_override?.original_duration_ms,
				});
				if (failure === 'rollback') {
					expect(after.revision).toBe(before.revision);
					expect(error.commitOutcome).toBe('rolled_back');
					expect(rollbacks).toBe(1);
					expect(commits).toBe(0);
					expect(writes.filter((entry) => entry.runner === faultRunner)).toEqual([
						{
							runner: faultRunner,
							query: 'UPDATE "devices_module_climate_automation_slots" SET "slotRevision" = "slotRevision" WHERE 0',
						},
					]); // Mandatory no-op reservation ONLY; no protected/business A DML before rollback.
					expect(f.checkpoints).toHaveLength(1);
					const current = f.checkpoints[0];
					f.runtime.onModuleDestroy();
					expect(originalContinuity.isCurrent()).toBe(false);
					expect(writer.assessRuntimeSettlement(current)).toEqual({ kind: 'reuse' });
					const currentLease = leases[leases.length - 1];
					expect(currentLease.deadline).toBe(originalLease.deadline);
					expect(currentLease.id).toBe(originalLease.id);
				} else {
					expect(after.revision).toBe(before.revision + 1); // B's actual active->uncertain transition, never a renewed lifetime
					expect(error.commitOutcome).toBe('committed');
					expect(commits).toBe(1);
					expect(rollbacks).toBe(0);
					expect(appliedReturned).toBe(true);
					expect(normalizedA?.watermarkOnly).toBe(true);
					expect(normalizedA?.next).not.toEqual(normalizedA?.before);
					if (!appliedA) throw new Error('Actual original A application missing');
					expect(appliedA[3].expected.rows.configurations).not.toEqual(appliedA[2].rows.configurations);
					expect(after.comfort?.temporary_override?.status).toBe('clock_uncertain');
					expect(f.checkpoints).toEqual([]);
					expect(f.transfers).toEqual([]);
					const conservative = leases[leases.length - 1];
					expect(conservative.status).toBe('clock_uncertain');
					expect(conservative.deadline).toBe(originalLease.deadline);
					expect(conservative.id).toBe(originalLease.id);
					expect(
						(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId: f.controller })).filter(
							(command) => command.action === 'on',
						),
					).toEqual([]);
					f.runtime.onModuleDestroy();
					expect(originalContinuity.isCurrent()).toBe(false);
				}
			} finally {
				f.runtime.onModuleDestroy();
				next.onModuleDestroy();
				release();
				await starting;
				if (nextStarting !== undefined) await nextStarting;
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				transport.onModuleDestroy();
				f.close();
				observeRoots = false;
				leasing.mockRestore();
				committing.mockRestore();
				application.mockRestore();
				normalization.mockRestore();
				completion.mockRestore();
				environment.mockRestore();
			}
		});
		it('the original new GAP callback is immutable and a TIME-neutral graph write still refuses held capture', async () => {
			let entered: () => void = () => {
					throw new Error('Uninitialized gate');
				},
				release: () => void = () => {
					throw new Error('Uninitialized gate');
				};
			const held = new Promise<void>((resolve) => {
					entered = resolve;
				}),
				resume = new Promise<void>((resolve) => {
					release = resolve;
				});
			const original: OriginalFunctions<Pick<VirtualThermostatConfigService, 'completeExistingAcknowledged'>> = configs;
			const complete = original.completeExistingAcknowledged;
			let armed = false;
			const completion = jest.spyOn(configs, 'completeExistingAcknowledged').mockImplementation(async (...args) => {
				const fixed = await complete.call(configs, ...args);
				if (armed) {
					armed = false;
					entered();
					await resume;
				}
				return fixed;
			});
			registerOriginal();
			const f = await prepareCapture(),
				before = [...database.subscribers];
			armed = true;
			const starting = f.runtime.onApplicationBootstrap();
			try {
				await held;
				const introduced = database.subscribers.filter(
					(item) =>
						!before.includes(item) &&
						Object.isFrozen(item) &&
						Object.getOwnPropertyDescriptor(item, 'beforeQuery')?.value !== undefined,
				);
				expect(introduced).toHaveLength(1);
				const observer = introduced[0];
				const descriptor = Object.getOwnPropertyDescriptor(observer, 'beforeQuery');
				expect(descriptor?.writable).toBe(false);
				expect(descriptor?.configurable).toBe(false);
				let replacementCalls = 0;
				expect(
					Reflect.set(observer, 'beforeQuery', () => {
						replacementCalls++;
					}),
				).toBe(false);
				expect(Object.getOwnPropertyDescriptor(observer, 'beforeQuery')).toEqual(descriptor);
				await database.query('UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1');
				release();
				await starting;
				expect(replacementCalls).toBe(0);
				expect(f.checkpoints).toEqual([]);
				expect(f.transfers).toEqual([]);
			} finally {
				f.runtime.onModuleDestroy();
				release();
				await starting;
				f.close();
				completion.mockRestore();
			}
		});
		// END R22 PREINPUT and immutable GAP native drafts
	});
	// END R21 additive actual core capture and original-clock drafts
});
