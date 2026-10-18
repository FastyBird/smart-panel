/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { createProtectionProbe } from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource, hasCurrentSqliteConnectionLease } from '../../../common/database/sqlite-data-source';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { AddVirtualThermostatClaims1000000000031 } from '../../../migrations/1000000000031-AddVirtualThermostatClaims';
import { AddVirtualThermostatRuntime1000000000032 } from '../../../migrations/1000000000032-AddVirtualThermostatRuntime';
import { AddVirtualThermostatRecoveries1000000000034 } from '../../../migrations/1000000000034-AddVirtualThermostatRecoveries';
import { AddVirtualThermostatComfort1000000000039 } from '../../../migrations/1000000000039-AddVirtualThermostatComfort';
import { AddThermostatBranchGroups1000000000040 } from '../../../migrations/1000000000040-AddThermostatBranchGroups';
import { AddThermostatMemberProtection1000000000041 } from '../../../migrations/1000000000041-AddThermostatMemberProtection';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import { ConfigService as ModuleConfigService } from '../../../modules/config/services/config.service';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { ClimateAutomationWriteError } from '../../../modules/devices/contracts/climate-automation.contract';
import { ClimateAutomationSlotEntity } from '../../../modules/devices/entities/climate-automation.entity';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { OpenApiResponseInterceptor } from '../../../modules/api/interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from '../../../modules/api/interceptors/transform-response.interceptor';
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
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { SceneActionEntity, SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { SceneExecutorService } from '../../../modules/scenes/services/scene-executor.service';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { nativeVoltmeterVoltageIdentity } from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
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

import { resolveThermostatProtectionSource, validateThermostatProtectionRows } from './thermostat-protection-source.utils';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	ThermostatCommandAuthority,
	ThermostatInstalledQualification,
	VirtualThermostatClaimsService,
} from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import { VirtualTransformResolver } from './virtual-transform-resolver';

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
	const registerOriginal = (configurations = configs,actualWriter = writer,actualRegistry = ownership,actualGraph = graph,actualComfort = comfort) => {
		if (actualRegistry === ownership) automation?.onModuleDestroy();
		const next = new VirtualThermostatAutomationService(actualWriter,actualRegistry,actualGraph,new NestConfigService({ FB_CLI: 'off' }),undefined,configurations,actualComfort);
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
		second = await new SqliteDataSource(options).initialize();
		await database.query('PRAGMA busy_timeout = 5000');
		await second.query('PRAGMA busy_timeout = 5000');
		registry = new PropertyCommandAdmissionRegistryService();
		events = new EventEmitter2();
		structure = new DeviceStructureLockService();
		ownership = new ClimateAutomationRegistryService();
		writer = new ClimateAutomationWriterService(database,structure,ownership,new NestConfigService({ FB_CLI: 'off' }));
		graph = new VirtualDependencyGraphService(database,new NestConfigService({ FB_CLI: 'off' }),writer);
		claims = new VirtualThermostatClaimsService(database, structure, graph, registry, events);
		pipeline = await Test.createTestingModule({ providers: [PropertyValueService,PropertyValueLockService,
			PropertyValueSourceRegistryService,PropertyProducerRegistryService,StorageService,
			{ provide: DataSource,useValue: database },{ provide: EventEmitter2,useValue: events },
			{ provide: NestConfigService,useValue: new NestConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
			{ provide: ModuleConfigService,useValue: { getModuleConfig: () => Object.assign(new StorageConfigModel(),{ primaryStorage: 'existing-config-fixture' }) } },
		] }).compile();
		const storage = pipeline.get(StorageService);
		const plugin: StoragePlugin = { name: 'existing-config-fixture',initialize: () => Promise.resolve(),destroy: () => Promise.resolve(),
			isAvailable: () => true,writePoints: () => Promise.resolve(),query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('No raw fixture history')),registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),getMeasurements: () => Promise.resolve([]) };
		backend = plugin;
		storage.registerPlugin(plugin.name,plugin);
		values = pipeline.get(PropertyValueService);
		configs = new VirtualThermostatConfigService(database,structure,graph,claims,events,values,undefined,writer);
		comfort = new VirtualThermostatComfortService(database,structure,graph,claims,events,writer);
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
		const secondStructure = new DeviceStructureLockService(),secondRegistry = new ClimateAutomationRegistryService(),
			secondWriter = new ClimateAutomationWriterService(second,secondStructure,secondRegistry,new NestConfigService({ FB_CLI: 'off' })),
			secondGraph = new VirtualDependencyGraphService(second,new NestConfigService({ FB_CLI: 'off' }),secondWriter);
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
			values,undefined,secondWriter,
		);
		const secondComfort = new VirtualThermostatComfortService(second,secondStructure,secondGraph,secondClaims,events,secondWriter);
		const secondAutomation = registerOriginal(secondConfigs,secondWriter,secondRegistry,secondGraph,secondComfort);
		const outcomes = await Promise.allSettled([
			configs.configure(controllerA, dto(sensor, relay)),
			secondConfigs.configure(controllerB, dto(sensor, relay)),
		]);
		secondAutomation.onModuleDestroy(); secondComfort.onModuleDestroy(); secondClaims.onModuleDestroy(); secondRegistry.onModuleDestroy();
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
		const originalMutationMethods: Readonly<{ writeMutationWithState: PropertyValueService['writeMutationWithState'] }> = values;
		const originalMutation = originalMutationMethods.writeMutationWithState;
		const mutation = jest.spyOn(values,'writeMutationWithState').mockImplementation((...args) => originalMutation.call(values,...args));
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
			const originalPublisherMethods: Readonly<{ publishExistingAcknowledged: VirtualThermostatConfigService['publishExistingAcknowledged'] }> = configs;
			const originalPublisher = originalPublisherMethods.publishExistingAcknowledged;
			jest.spyOn(configs,'publishExistingAcknowledged').mockImplementationOnce((...args) => {
				publicationPhases.push(Object.freeze({ acknowledged: writer.isExistingPlanAcknowledged(args[1].descriptor),
					structural: structure.hasCurrentStructuralLease(),connection: hasCurrentSqliteConnectionLease(database) }));
				failRefresh = true;
				return originalPublisher.call(configs,...args);
			});
			registerOriginal();
		} else if (outcome === 'commit') {
			const originalPublisherMethods: Readonly<{ publishExistingAcknowledged: VirtualThermostatConfigService['publishExistingAcknowledged'] }> = configs;
			const originalPublisher = originalPublisherMethods.publishExistingAcknowledged;
			jest.spyOn(configs,'publishExistingAcknowledged').mockImplementationOnce((...args) => {
				publicationPhases.push(Object.freeze({ acknowledged: writer.isExistingPlanAcknowledged(args[1].descriptor),
					structural: structure.hasCurrentStructuralLease(),connection: hasCurrentSqliteConnectionLease(database) }));
				return originalPublisher.call(configs,...args);
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
			expect(publicationPhases).toEqual(outcome === 'commit' ? [{ acknowledged: true,structural: false,connection: false }] : []);
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
				new VirtualTransformResolver(operators),writer,
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
		it.each([false, true])('matches the original loader for actual persisted converted=%s lineage without I/O in the checker', async (converted) => {
			const relay = await actuator();
			const probe = await createProtectionProbe(database, relay, converted);
			const readProperty = (id: string) => database.manager
				.createQueryBuilder(ChannelPropertyEntity, 'property')
				.leftJoinAndSelect('property.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.where('property.id = :id', { id })
				.callListeners(false)
				.getOneOrFail();
			const property = await readProperty(probe.sourceId);
			const leaf = converted ? await readProperty(probe.physicalId) : property;
			const transform = await database.manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: property.id });
			const transformSource = await database.manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId: property.id });
			const metadata = await database.manager.findOneByOrFail(ShellySampleSourceEntity, { propertyId: leaf.id, active: true });
			const physicalIdentity = 'shelly-ng:' + probe.device.canonicalMac.toUpperCase() + ':switch:0:output';
			const ordinary = await resolveThermostatProtectionSource(database.manager, property.id, physicalIdentity);
			const rows = { property, leaf, transform, transformSource, metadata };
			let queries = 0;
			const observer = { beforeQuery: () => { queries++; } };
			const emitted = jest.spyOn(events, 'emit');
			database.subscribers.push(observer);
			try {
				const checked = validateThermostatProtectionRows(rows, physicalIdentity);
				expect(checked).toEqual(ordinary);
				expect(checked.property).toBe(property);
				expect(checked.leaf).toBe(leaf);
				expect(checked.metadata).toBe(metadata);
				expect(() => validateThermostatProtectionRows({ ...rows, metadata: { ...metadata, propertyId: uuid() } }, physicalIdentity))
					.toThrow(DevicesValidationException);
				expect(() => validateThermostatProtectionRows({ ...rows, metadata: { ...metadata, active: false } }, physicalIdentity))
					.toThrow(DevicesValidationException);
				expect(() => validateThermostatProtectionRows(rows, 'shelly-ng:A8032ABEFFFF:switch:0:output'))
					.toThrow(DevicesValidationException);
				expect(queries).toBe(0);
				expect(emitted).not.toHaveBeenCalled();
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				emitted.mockRestore();
			}
		});
	});

	// BEGIN closed existing-controller route regressions (SOURCE ONLY; every case UNRUN)
	describe('actual reserved existing-controller route family',() => {
		const whole = async (source = database) => {
			const result: Record<string,unknown[]> = {};
			for (const table of ['devices_virtual_thermostat_configs','devices_virtual_thermostat_sources',
				'devices_virtual_thermostat_actuator_claims','devices_virtual_thermostat_settings',
				'devices_virtual_thermostat_member_protection','devices_virtual_thermostat_cooling_dependencies',
				'devices_virtual_thermostat_recoveries','devices_virtual_thermostat_command_journal',
				'devices_virtual_thermostat_runtime','devices_virtual_thermostat_branch_runtime',
				'devices_virtual_thermostat_installations','devices_virtual_thermostat_installation_audit',
				'devices_module_devices','devices_module_channels','devices_module_channels_properties','devices_shelly_ng_sample_sources',
				'devices_virtual_dew_point_configs','devices_virtual_dew_point_sources','devices_virtual_transform_configs','devices_virtual_transform_sources',
				'devices_virtual_aggregate_configs','devices_virtual_aggregate_inputs','devices_virtual_light_group_configs','devices_virtual_light_group_members','devices_virtual_light_group_bindings',
				'devices_module_climate_automation_slots','devices_module_climate_automation_sources','devices_virtual_graph_revision'])
				result[table] = await source.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`);
			return result;
		};
		const barrier = () => {
			let open: () => void = () => { throw new Error('Barrier not initialized'); };
			const promise = new Promise<void>((resolve) => { open = resolve; });
			return { promise,open: () => open() };
		};
		it('bootstraps only genuinely absent existing configuration and slot, then exact repetition is zero business churn',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const input = dto(sensor,heat);
			const beforeGraph = await graph.revision();
			const first = await configs.configure(controller,input);
			const original = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller });
			expect(first.revision).toBe(1); expect(first.graph_revision).toBe(beforeGraph + 1);
			expect(original).toMatchObject({ providerKey: 'virtual-thermostat:v1',manualHold: true,state: 'EMPTY',slotRevision: 1,manualCounter: 1 });
			const before = await whole();
			const notified = jest.fn(); events.on(THERMOSTAT_CONFIG_CHANGED,notified);
			const secondResult = await configs.configure(controller,{ ...input,expectedRevision: first.revision });
			expect(secondResult.revision).toBe(first.revision); expect(secondResult.graph_revision).toBe(first.graph_revision);
			expect(await whole()).toEqual(before); expect(notified).not.toHaveBeenCalled();
			expect(secondResult.actuators[0].id).toBe(first.actuators[0].id);
			expect(secondResult.actuators[0].qualification_generation).toBe(first.actuators[0].qualification_generation);
		});
		it('allows true no-op at retained maximum counters but rejects an actual controller increment before any row changes',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			await configs.configure(controller,input);
			await database.query('UPDATE devices_virtual_thermostat_configs SET revision = ? WHERE controllerId = ?',[Number.MAX_SAFE_INTEGER,controller]);
			await database.query('UPDATE devices_module_climate_automation_slots SET slotRevision = ?, manualCounter = ? WHERE controllerId = ?',
				[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,controller]);
			const before = await whole();
			expect((await configs.configure(controller,{ ...input,expectedRevision: Number.MAX_SAFE_INTEGER })).revision).toBe(Number.MAX_SAFE_INTEGER);
			expect(await whole()).toEqual(before);
			await expect(configs.configure(controller,{ ...input,expectedRevision: Number.MAX_SAFE_INTEGER,requestedMode: 'heat' })).rejects.toThrow();
			expect(await whole()).toEqual(before);
		});
		it('refuses stale identical payload and existing-config absent-slot without GET adoption or replacement',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			await configs.configure(controller,input);
			const before = await whole();
			await expect(configs.configure(controller,input)).rejects.toThrow('revision');
			expect(await whole()).toEqual(before);
			await database.manager.delete(ClimateAutomationSlotEntity,{ controllerId: controller });
			const missing = await whole();
			await configs.get(controller);
			await expect(configs.configure(controller,{ ...input,expectedRevision: 1 })).rejects.toThrow();
			expect(await whole()).toEqual(missing);
		});
		it('performs same-value numeric takeover using the real setting route while preserving nullable comfort',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const settingId = await setting(controller,ChannelCategory.HEATER,PropertyCategory.TEMPERATURE),input = dto(sensor,heat);
			input.settings = [{ propertyId: settingId,setting: 'heating_setpoint' }];
			await configs.configure(controller,input);
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
			expect(before.comfort).toBeNull();
			expect(await configs.command([await target(settingId,20)])).toBe(true);
			const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
			expect(after.comfort).toBeNull(); expect(after.revision).toBe(before.revision);
			await comfort.configure(controller,{ expected_revision: after.revision,expected_graph_revision: await graph.revision() },{
				heating_range: { minimum: 10,maximum: 30 },cooling_range: null,automation_enabled: true,
				presets: [{ preset: 'eco',setpoints: { heating_setpoint: 17,cooling_setpoint: null } }] });
			expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller })).manualHold).toBe(false);
			expect(await configs.command([await target(settingId,20)])).toBe(true);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller });
			expect(slot.manualHold).toBe(true);
			expect((await comfort.get(controller)).effective).toMatchObject({ source: 'manual',heating_setpoint: 20 });
		});
		it.each([{ preset: null,clear: false },{ preset: null,clear: true },{ preset: 'eco',clear: false },{ preset: 'eco',clear: true }])(
			'preserves independent OFF, requested mode and private hold for preset=$preset clear=$clear',async ({ preset,clear }) => {
				const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
				await configs.configure(controller,input);
				await comfort.configure(controller,{ expected_revision: 1,expected_graph_revision: await graph.revision() },{
					heating_range: { minimum: 10,maximum: 30 },cooling_range: null,
					presets: [{ preset: 'eco',setpoints: { heating_setpoint: 17,cooling_setpoint: null } }] });
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				const exactPreset = preset === 'eco' ? 'eco' : null;
				const result = await comfort.select(controller,{ expected_revision: before.revision,expected_graph_revision: await graph.revision() },exactPreset,clear);
				expect(result.configuration.selected_preset).toBe(preset);
				expect(result.configuration.user_off).toBe(!clear);
				expect((await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).requestedMode).toBe('off');
				expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller })).manualHold).toBe(preset === null);
			});
		it('keeps idempotent opt-in exact and derives one RESET without adopting or replaying a historical source',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			await configs.configure(controller,dto(sensor,heat));
			const definition = { heating_range: { minimum: 10,maximum: 30 },cooling_range: null,automation_enabled: true,presets: [] };
			const first = await comfort.configure(controller,{ expected_revision: 1,expected_graph_revision: await graph.revision() },definition);
			const before = await whole();
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller });
			expect(slot.manualHold).toBe(false); expect(slot.manualCounter).toBe(2);
			await comfort.configure(controller,{ expected_revision: first.revision,expected_graph_revision: first.graph_revision },definition);
			expect(await whole()).toEqual(before);
			expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller })).manualGeneration).toBe(slot.manualGeneration);
		});
		it('uses actual original ACK and release before a mirror, then refuses later A effects after a real peer changes its parent',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const settingId = await setting(controller,ChannelCategory.HEATER,PropertyCategory.TEMPERATURE),input = dto(sensor,heat);
			input.settings = [{ propertyId: settingId,setting: 'heating_setpoint' }];
			const entered = barrier(),resume = barrier(),original = backend.writePoints;
			const writes = jest.spyOn(backend,'writePoints').mockImplementationOnce(async (...args) => {
				await original.call(backend,...args); entered.open(); await resume.promise;
			});
			const properties = jest.fn(); events.on(EventType.CHANNEL_PROPERTY_UPDATED,properties);
			const result = configs.configure(controller,input); void result.catch(() => undefined);
			try {
				await entered.promise;
				expect((await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).revision).toBe(1);
				await second.query('UPDATE devices_module_devices SET name = ? WHERE id = ?',['peer B committed',controller]);
				resume.open();
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(writes).toHaveBeenCalledTimes(1); expect(properties).not.toHaveBeenCalled();
				expect((await second.manager.findOneByOrFail(DeviceEntity,{ id: controller })).name).toBe('peer B committed');
				expect((await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).revision).toBe(1);
			} finally { resume.open(); await result.catch(() => undefined); writes.mockRestore(); }
		});
		it('refuses a fixed A response when an independent same-revision configuration mutation commits before B3',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			const entered = barrier(),resume = barrier(); let held = false;
			const producers = pipeline.get(PropertyProducerRegistryService);
			expect(producers.readCreationObservationCounts()).toEqual({ active: 0,observedIds: 0 });
			// No settings/mirror slots in this input: the first active finite observation is the native B2 sample capture.
			const observer = { beforeTransactionStart: async () => {
				if (held || producers.readCreationObservationCounts().active === 0) return;
				held = true; entered.open(); await resume.promise;
			} };
			database.subscribers.push(observer);
			const result = configs.configure(controller,input); void result.catch(() => undefined);
			try {
				await entered.promise;
				await second.query('UPDATE devices_virtual_thermostat_configs SET locked = 1 WHERE controllerId = ?',[controller]);
				resume.open();
				await expect(result).rejects.toBeInstanceOf(ClimateAutomationWriteError);
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect((await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).locked).toBe(true);
			} finally { resume.open(); await result.catch(() => undefined); database.subscribers.splice(database.subscribers.indexOf(observer),1); }
		});
		it('preserves a native after-ACK primary and performs no mirrors or response capture on that failed return',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			const primary = new Error('native after-ACK sentinel'); let once = false;
			const observer = { afterTransactionCommit: () => { if (!once) { once = true; throw primary; } } };
			database.subscribers.push(observer);
			const original = values.captureDiagnosticSamples;
			const capture = jest.spyOn(values,'captureDiagnosticSamples').mockImplementation((...args) => original.call(values,...args)); registerOriginal();
			const write = jest.spyOn(backend,'writePoints');
			try {
				await expect(configs.configure(controller,input)).rejects.toMatchObject({ commitOutcome: 'committed',cause: primary });
				expect((await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).revision).toBe(1);
				expect(capture).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
			} finally { capture.mockRestore(); write.mockRestore(); database.subscribers.splice(database.subscribers.indexOf(observer),1); }
		});
		it('restores a removed setting to read-only while retaining the native catalog and advancing only the actual structural delta',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			const propertyId = await setting(controller,ChannelCategory.HEATER,PropertyCategory.TEMPERATURE);
			input.settings = [{ propertyId,setting: 'heating_setpoint' }];
			const first = await configs.configure(controller,input);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity,{ controllerId: controller });
			const result = await configs.configure(controller,{ ...input,expectedRevision: first.revision,settings: [] });
			expect(result.revision).toBe(first.revision + 1); expect(result.graph_revision).toBe(first.graph_revision + 1);
			expect((await database.manager.findOneByOrFail(VirtualChannelPropertyEntity,{ id: propertyId })).permissions).toEqual([PermissionType.READ_ONLY]);
			expect(await database.manager.countBy(VirtualThermostatSettingEntity,{ propertyId })).toBe(0);
			expect(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity,{ id: claim.id })).toEqual(claim);
			const retained = await whole();
			await configs.configure(controller,{ ...input,expectedRevision: result.revision,settings: [] });
			expect(await whole()).toEqual(retained);
		});
		it('persists only an override watermark without intent churn, then durably inhibits a backwards clock without graph churn',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const first = await configs.configure(controller,dto(sensor,heat));
			const definition = await comfort.configure(controller,{ expected_revision: first.revision,expected_graph_revision: first.graph_revision },{
				heating_range: { minimum: 10,maximum: 30 },cooling_range: null,presets: [{ preset: 'eco',setpoints: { heating_setpoint: 17,cooling_setpoint: null } }] });
			jest.useFakeTimers({ doNotFake: ['nextTick','setImmediate'] });
			try {
				const start = Date.now();
				const created = await comfort.override(controller,{ expected_revision: definition.revision,expected_graph_revision: definition.graph_revision },
					{ preset: 'eco',setpoints: null,expires_at: new Date(start + 30_000).toISOString() },'clock-test-actor');
				const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller });
				const eventsBefore = jest.fn(); events.on(THERMOSTAT_CONFIG_CHANGED,eventsBefore);
				jest.setSystemTime(start + 2000);
				await comfort.settle(controller);
				const watermark = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				expect(watermark.revision).toBe(created.revision); expect(await graph.revision()).toBe(created.graph_revision);
				expect(watermark.comfort?.temporary_override).toMatchObject({ id: created.configuration.temporary_override.id,
					status: 'active',wall_watermark_ms: start + 2000,expires_at: new Date(start + 30_000).toISOString() });
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller })).toEqual(slot);
				expect(eventsBefore).not.toHaveBeenCalled();
				jest.setSystemTime(start + 1000);
				await comfort.settle(controller);
				const uncertain = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				expect(uncertain.revision).toBe(created.revision + 1); expect(await graph.revision()).toBe(created.graph_revision);
				expect(uncertain.comfort?.temporary_override).toMatchObject({ id: created.configuration.temporary_override.id,status: 'clock_uncertain' });
				expect(comfort.isCurrent(uncertain)).toBe(false); expect(eventsBefore).toHaveBeenCalledTimes(1);
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity,{ controllerId: controller })).toEqual(slot);
			} finally { jest.useRealTimers(); }
		});
		it('preserves every retained Recovery column on a true no-op and refuses invalid UUID history before any mutation',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			const configured = await configs.configure(controller,input),claim = configured.actuators[0];
			const retained = database.manager.create(VirtualThermostatRecoveryEntity,{ id: uuid(),controllerId: controller,claimId: claim.id,
				physicalIdentity: claim.physical_identity,previousPropertyIdentity: 'ordinary retained historical identity',restoredPropertyId: heat,
				actorId: 'ordinary historical actor',reason: 'ordinary retained historical reason',disconnectionAcknowledged: true,
				configurationRevision: Number.MAX_SAFE_INTEGER,claimRevision: Number.MAX_SAFE_INTEGER,createdAt: new Date('2026-01-01T00:00:00.000Z') });
			await database.manager.insert(VirtualThermostatRecoveryEntity,retained);
			const before = await whole();
			await configs.configure(controller,{ ...input,expectedRevision: configured.revision }); expect(await whole()).toEqual(before);
			await database.query('UPDATE devices_virtual_thermostat_recoveries SET restoredPropertyId = ? WHERE id = ?',['not-a-uuid',retained.id]);
			const malformed = await whole();
			await expect(configs.configure(controller,{ ...input,expectedRevision: configured.revision,locked: true })).rejects.toThrow();
			expect(await whole()).toEqual(malformed);
		});

		it('refuses a substituted original STI getter across B3 without invoking the replacement or hydrating successor facts',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat);
			const entered = barrier(),resume = barrier(); let held = false,replacementCalls = 0;
			const producers = pipeline.get(PropertyProducerRegistryService);
			expect(producers.readCreationObservationCounts()).toEqual({ active: 0,observedIds: 0 });
			const descriptor = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype,'type');
			if (!descriptor?.get) throw new Error('Actual virtual device type getter required');
			const read: Readonly<{ call: (receiver: VirtualDeviceEntity) => unknown }> = descriptor.get;
			const observer = { beforeTransactionStart: async () => {
				if (held || producers.readCreationObservationCounts().active === 0) return;
				held = true; entered.open(); await resume.promise;
			} };
			database.subscribers.push(observer);
			const result = configs.configure(controller,input); void result.catch(() => undefined);
			try {
				await entered.promise;
				Object.defineProperty(VirtualDeviceEntity.prototype,'type',{ ...descriptor,get(this: VirtualDeviceEntity) {
					replacementCalls++; return read.call(this);
				} });
				resume.open();
				await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				expect(replacementCalls).toBe(0);
				expect((await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).revision).toBe(1);
			} finally {
				Object.defineProperty(VirtualDeviceEntity.prototype,'type',descriptor); resume.open(); await result.catch(() => undefined);
				database.subscribers.splice(database.subscribers.indexOf(observer),1);
			}
		});
		it('finishes the actual graph plan in NORMALIZE before APPLY and rolls back when its original generation is revoked while held',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator(),input = dto(sensor,heat),before = await whole();
			const entered = barrier(),resume = barrier(),originalPlan = graph.validateReservedReplacement;
			const plan = jest.spyOn(graph,'validateReservedReplacement').mockImplementationOnce(async (...args) => {
				await originalPlan.call(graph,...args); entered.open(); await resume.promise;
			}); registerOriginal();
			const result = configs.configure(controller,input); void result.catch(() => undefined);
			try {
				await entered.promise; expect(await whole(second)).toEqual(before);
				graph.invalidateValidation(); resume.open();
				await expect(result).rejects.toThrow(); expect(await whole()).toEqual(before);
			} finally { resume.open(); await result.catch(() => undefined); plan.mockRestore(); registerOriginal(); }
			await graph.refreshValidation(false);
			expect((await configs.configure(controller,input)).revision).toBe(1);
		});

		// BEGIN original clock-owner correction drafts (UNRUN)
		const activeClock = async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const first = await configs.configure(controller,dto(sensor,heat));
			const definition = await comfort.configure(controller,{ expected_revision: first.revision,expected_graph_revision: first.graph_revision },{
				heating_range: { minimum: 10,maximum: 30 },cooling_range: null,presets: [{ preset: 'eco',setpoints: { heating_setpoint: 17,cooling_setpoint: null } }] });
			const created = await comfort.override(controller,{ expected_revision: definition.revision,expected_graph_revision: definition.graph_revision },
				{ preset: 'eco',setpoints: null,expires_at: new Date(Date.now() + 30_000).toISOString() },'original-clock-owner');
			return { controller,created };
		};
		it.each(['expires_at','original_duration_ms','wall_watermark_ms'] satisfies readonly ('expires_at' | 'original_duration_ms' | 'wall_watermark_ms')[])(
			'rejects a committed independent peer same-ID/revision %s rewrite without giving it a new budget',async (field) => {
				const { controller,created } = await activeClock();
				const before = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				if (!before.comfort?.temporary_override) throw new Error('Actual active override required');
				const original = before.comfort.temporary_override;
				if (typeof original.original_duration_ms !== 'number' || typeof original.wall_watermark_ms !== 'number') throw new Error('Actual materialized lifetime required');
				const replacement = { ...original,[field]: field === 'expires_at' ? new Date(Date.parse(original.expires_at) + 1000).toISOString() :
					field === 'original_duration_ms' ? original.original_duration_ms + 1000 : original.wall_watermark_ms + 1 };
				await second.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = ? WHERE "controllerId" = ?',
					[JSON.stringify({ ...before.comfort,temporary_override: replacement }),controller]);
				const peer = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				expect(peer.revision).toBe(created.revision); expect(peer.comfort.temporary_override.id).toBe(original.id);
				const token = await comfort.readIntentInManager(database.manager,peer);
				try { expect(token.isOverrideCurrent()).toBe(false); } finally { token.close(); }
				expect(await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller })).toEqual(peer);
				await comfort.settle(controller);
				const refused = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				expect(refused.comfort.temporary_override.id).toBe(original.id); expect(refused.comfort.temporary_override.status).toBe('clock_uncertain');
			});
		it('refuses a real peer rewrite at B3 and leaves no successful A clock candidate',async () => {
			const { controller } = await activeClock(),before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
			const entered = barrier(),resume = barrier(),originalProbe = writer.probeExistingPlanResponse; let probes = 0;
			jest.spyOn(writer,'probeExistingPlanResponse').mockImplementation(async (descriptor) => {
				if (++probes === 2) { entered.open(); await resume.promise; }
				return originalProbe.call(writer,descriptor);
			}); registerOriginal();
			const result = comfort.select(controller,{ expected_revision: before.revision,expected_graph_revision: await graph.revision() },'eco',false); void result.catch(() => undefined);
			try {
				await entered.promise;
				const a = await second.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
				if (!a.comfort?.temporary_override || typeof a.comfort.temporary_override.wall_watermark_ms !== 'number') throw new Error('Actual committed override required');
				const changed = { ...a.comfort,temporary_override: { ...a.comfort.temporary_override,wall_watermark_ms: a.comfort.temporary_override.wall_watermark_ms + 1 } };
				await second.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = ? WHERE "controllerId" = ?',[JSON.stringify(changed),controller]);
				resume.open(); await expect(result).rejects.toMatchObject({ commitOutcome: 'committed' });
				const b = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller }),intent = await comfort.readIntentInManager(database.manager,b);
				try { expect(intent.isOverrideCurrent()).toBe(false); } finally { intent.close(); }
				expect(b.comfort).toEqual(changed);
			} finally { resume.open(); await result.catch(() => undefined); }
		});
		it('keeps observed same-instance restore sticky and an old owner close cannot remove a clean B owner',async () => {
			const captures: NonNullable<ReturnType<ClimateAutomationWriterService['existingOverrideLeaseForPlan']>>[] = [];
			const original = writer.existingOverrideLeaseForPlan;
			jest.spyOn(writer,'existingOverrideLeaseForPlan').mockImplementation((descriptor) => { const value = original.call(writer,descriptor); if (value && captures.length === 0) captures.push(value); return value; }); registerOriginal();
			const { controller,created } = await activeClock(),a = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
			const captured = captures[0]; if (!captured) throw new Error('Actual original owner token required');
			await database.query('UPDATE "devices_virtual_thermostat_configs" SET "comfort" = "comfort" WHERE "controllerId" = ?',[controller]);
			const old = await comfort.readIntentInManager(database.manager,a);
			try { expect(old.isOverrideCurrent()).toBe(false); } finally { old.close(); }
			await comfort.cancel(controller,{ expected_revision: a.revision,expected_graph_revision: await graph.revision() },created.configuration.temporary_override.id);
			const latest = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller });
			const b = await comfort.override(controller,{ expected_revision: latest.revision,expected_graph_revision: await graph.revision() },
				{ preset: 'eco',setpoints: null,expires_at: new Date(Date.now() + 20_000).toISOString() },'clean-B-owner');
			writer.closeExistingOverrideLease(captured.token);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity,{ controllerId: controller }),intent = await comfort.readIntentInManager(database.manager,row);
			try { expect(intent.isOverrideCurrent()).toBe(true); } finally { intent.close(); }
			expect(row.comfort.temporary_override.id).toBe(b.configuration.temporary_override.id);
		});
		it('replaces membership generation after a real file-peer claims write and original refresh, never reviving A captures',async () => {
			const controller = await owner(),sensor = await ambient(),heat = await actuator();
			const configured = await configs.configure(controller,dto(sensor,heat));
			await claims.refresh(); const original = claims.capture(),claim = configured.actuators[0],leaf = await target(heat,false);
			const authority = claims.mintAuthority(claim.id,'off');
			expect(original.isCurrent()).toBe(true); expect(original.isCurrent(leaf)).toBe(true); expect(claims.isAuthorized(authority,leaf)).toBe(true);
			await second.query('UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = "revision" + 1 WHERE "id" = ?',[claim.id]);
			await claims.refresh(); expect(original.isCurrent()).toBe(false); expect(original.isCurrent(leaf)).toBe(false);
			expect(claims.isAuthorized(authority,leaf)).toBe(false); expect(claims.capture().isCurrent()).toBe(true);
			expect(claims.isAuthorized(claims.mintAuthority(claim.id,'off'),leaf)).toBe(true);
			expect((await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity,{ id: claim.id })).revision).toBe(claim.revision + 1);
		});
		// END original clock-owner correction drafts

	});
	// END closed existing-controller route regressions

});
