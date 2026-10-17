import { createHash, randomUUID } from 'node:crypto';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationControllerIntentRequest,
	ClimateAutomationManualCapability,
	ClimateAutomationParticipant,
	ClimateAutomationParticipantConflict,
	ClimateAutomationParticipantImage,
	ClimateAutomationParticipantTurn,
	ClimateAutomationProvider,
	climateAutomationCanonical,
	climateAutomationJson,
	climateAutomationReduceManualIntent,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import {
	ThermostatActuatorRole,
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { DEW_POINT_FORMULA, DewPointRole, dewPointInputDomain } from './virtual-dew-point.utils';
import { VirtualNumericTransformConfig, VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	THERMOSTAT_AUTOMATION_COLUMNS,
	ThermostatAutomationRows,
	VirtualThermostatAutomationService,
	classifyThermostatAutomationImages,
	planThermostatAutomationGraph,
	thermostatAutomationImage,
	thermostatAutomationMutationIssues,
} from './virtual-thermostat-automation.service';
import { ThermostatComfortConfiguration } from './virtual-thermostat-comfort.utils';
import { thermostatPropertyContract } from './virtual-thermostat-contract.utils';

const ids = {
	controller: 'd0000000-0000-4000-8000-000000000001',
	channel: 'd0000000-0000-4000-8000-000000000002',
	output: 'd0000000-0000-4000-8000-000000000003',
	setting: 'd0000000-0000-4000-8000-000000000004',
	foreign: 'd0000000-0000-4000-8000-000000000005',
	foreignChannel: 'd0000000-0000-4000-8000-000000000006',
	temperature: 'd0000000-0000-4000-8000-000000000007',
	humidity: 'd0000000-0000-4000-8000-000000000008',
	surface: 'd0000000-0000-4000-8000-000000000009',
	dew: 'd0000000-0000-4000-8000-00000000000a',
	actuator: 'd0000000-0000-4000-8000-00000000000b',
	claim: 'd0000000-0000-4000-8000-00000000000c',
	heatClaim: 'd0000000-0000-4000-8000-00000000000d',
	missing: 'd0000000-0000-4000-8000-00000000000e',
};
const instant = new Date('2026-01-02T03:04:05.000Z');
const barrier = () => {
	let resolve: () => void = () => {
		throw new Error('Uninitialized TEST barrier');
	};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
};
function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
function rec(value: unknown): Record<string, unknown> {
	if (!isObject(value)) throw new Error('Expected TEST object');
	return value;
}
function array(value: unknown): unknown[] {
	if (!Array.isArray(value)) throw new Error('Expected TEST array');
	return value;
}
function mutable(value: unknown): Record<string, unknown> {
	const parsed: unknown = JSON.parse(climateAutomationCanonical(value));
	return rec(parsed);
}
interface ReceiverCall<R, A extends unknown[], V> {
	readonly call: (receiver: R, ...args: A) => V;
}
const catalog = (image: Record<string, unknown>) => rec(rec(image.configuration).catalog);

/** Actual tables only. No installed qualification, sample, transport session or successful apply. */
describe('dormant C0 concrete persisted projection (actual writer/registry/SQLite/graph)', () => {
	let database: SqliteDataSource, registry: ClimateAutomationRegistryService, writer: ClimateAutomationWriterService;
	let graph: VirtualDependencyGraphService, service: VirtualThermostatAutomationService;
	let owner: { dispose: () => void }, participant: ClimateAutomationParticipant, provider: ClimateAutomationProvider;
	let lastImage: ClimateAutomationParticipantImage | undefined, lastTurn: ClimateAutomationParticipantTurn | undefined;
	let holdRead: (() => Promise<void>) | undefined;
	let factsReads: number;
	const statements: string[] = [];
	const unavailable = (): Promise<never> =>
		Promise.reject(new Error('C0 TEST capability deliberately has no normalization, apply or selection authority'));

	/** Independent SECOND callback: new same-manager SQL every time; no turn, ambient manager or cached image. */
	const freshRows = async (manager: EntityManager, controllerId: string): Promise<ThermostatAutomationRows> => {
		const read = <T extends ObjectLiteral>(entity: EntityTarget<T>): Promise<T[]> =>
			manager.createQueryBuilder(entity, 'fresh').callListeners(false).getMany();
		return {
			devices: await read(DeviceEntity),
			channels: await manager
				.createQueryBuilder(ChannelEntity, 'fresh')
				.leftJoinAndSelect('fresh.device', 'device')
				.callListeners(false)
				.getMany(),
			properties: await manager
				.createQueryBuilder(ChannelPropertyEntity, 'fresh')
				.leftJoinAndSelect('fresh.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.callListeners(false)
				.getMany(),
			tables: {
				configurations: await manager
					.createQueryBuilder(VirtualThermostatConfigEntity, 'fresh')
					.where('fresh.controllerId = :controllerId', { controllerId })
					.callListeners(false)
					.getMany(),
				sources: await read(VirtualThermostatSourceEntity),
				actuators: await read(VirtualThermostatActuatorClaimEntity),
				settings: await read(VirtualThermostatSettingEntity),
				protections: await read(ThermostatMemberProtectionEntity),
				cooling: await read(ThermostatCoolingDependencyEntity),
				dewConfigurations: await read(VirtualDewPointConfigEntity),
				dewSources: await read(VirtualDewPointSourceEntity),
				transformConfigurations: await read(VirtualTransformConfigEntity),
				transformSources: await read(VirtualTransformSourceEntity),
				aggregateConfigurations: await read(VirtualAggregateConfigEntity),
				aggregateInputs: await read(VirtualAggregateInputEntity),
				groupConfigurations: await read(VirtualLightGroupConfigEntity),
				groupMembers: await read(VirtualLightGroupMemberEntity),
				groupBindings: await read(VirtualLightGroupBindingEntity),
			},
		};
	};
	const image = async (): Promise<ClimateAutomationParticipantImage> => {
		lastImage = undefined;
		expect(
			(
				await writer.runReserved((manager, scope) =>
					writer.readParticipant(manager, scope, { providerKey: 'c0-test:v1', controllerId: ids.controller }),
				)
			).outcome,
		).toBe('unchanged');
		if (!lastImage) throw new Error('Actual guarded reader did not return a TEST image');
		return lastImage;
	};
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		registry = new ClimateAutomationRegistryService();
		writer = new ClimateAutomationWriterService(
			database,
			new DeviceStructureLockService(),
			registry,
			new ConfigService({ FB_CLI: 'off' }),
		);
		graph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), writer);
		service = new VirtualThermostatAutomationService(writer, registry, graph);
		lastImage = undefined;
		lastTurn = undefined;
		holdRead = undefined;
		factsReads = 0;
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		await database.manager.insert(VirtualDeviceEntity, {
			id: ids.controller,
			name: 'TEST controller',
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
			enabled: true,
		});
		await database.manager.insert(VirtualDeviceEntity, {
			id: ids.foreign,
			name: 'TEST reference catalog, never hardware',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: ids.channel,
			device: { id: ids.controller },
			identifier: 'test-owned',
			name: 'Owned',
			category: ChannelCategory.GENERIC,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: ids.foreignChannel,
			device: { id: ids.foreign },
			identifier: 'test-reference',
			name: 'Reference',
			category: ChannelCategory.GENERIC,
		});
		for (const propertyId of [
			ids.output,
			ids.setting,
			ids.temperature,
			ids.humidity,
			ids.surface,
			ids.dew,
			ids.actuator,
		]) {
			await database.manager.insert(VirtualChannelPropertyEntity, {
				id: propertyId,
				channel: { id: propertyId === ids.output || propertyId === ids.setting ? ids.channel : ids.foreignChannel },
				identifier: propertyId,
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				valueOrigin: VirtualValueOrigin.LOCAL,
			});
		}
		await database.manager.update(
			VirtualChannelPropertyEntity,
			{ id: ids.output },
			{ valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: ids.temperature },
		);
		const methods: {
			readonly readInManager: (
				...args: Parameters<VirtualThermostatAutomationService['readInManager']>
			) => ReturnType<VirtualThermostatAutomationService['readInManager']>;
			readonly planInManager: (
				...args: Parameters<VirtualThermostatAutomationService['planInManager']>
			) => ReturnType<VirtualThermostatAutomationService['planInManager']>;
		} = service;
		const originalRead: ReceiverCall<
			VirtualThermostatAutomationService,
			Parameters<VirtualThermostatAutomationService['readInManager']>,
			ReturnType<VirtualThermostatAutomationService['readInManager']>
		> = methods.readInManager;
		const originalPlan: ReceiverCall<
			VirtualThermostatAutomationService,
			Parameters<VirtualThermostatAutomationService['planInManager']>,
			ReturnType<VirtualThermostatAutomationService['planInManager']>
		> = methods.planInManager;
		participant = {
			version: 1,
			graph,
			readInManager: async (manager, turn, controllerId) => {
				lastTurn = turn;
				const current = await originalRead.call(service, manager, turn, controllerId);
				if (current) lastImage = current;
				if (holdRead) await holdRead();
				return current;
			},
			normalizeInManager: unavailable,
			planGraphReplacementInManager: (manager, turn, before, next) =>
				new Promise<ReturnType<VirtualThermostatAutomationService['planInManager']>>((resolve) =>
					resolve(originalPlan.call(service, manager, turn, before, next)),
				),
			applyInManager: unavailable,
		};
		provider = {
			participantV1: participant,
			readControllerInManager: async (manager, controllerId) => {
				factsReads++;
				const independent = thermostatAutomationImage(await freshRows(manager, controllerId));
				return independent
					? {
							controllerRevision: independent.controllerRevision,
							graphRevision: await graph.revision(manager),
							evidence: climateAutomationJson(independent),
							legacyBaseline: independent.legacyBaseline,
						}
					: null;
			},
			validateSelectionInManager: unavailable,
			// Actual trusted absence creation for TEST setup only; NOT C0 apply or an existing-config ensure.
			createControllerInManager: async (manager, controllerId) => {
				await manager.insert(VirtualThermostatConfigEntity, {
					controllerId,
					ownerDeviceId: controllerId,
					requestedMode: 'off',
					controlStrategy: 'guarded_branches',
					locked: false,
					comfort: null,
					policy: {
						heatingSetpoint: 20,
						coolingSetpoint: 24,
						coldTolerance: 0.5,
						hotTolerance: 0.5,
						neutralMargin: 1,
						minimumOffMs: 1000,
						changeoverMs: 1000,
						floor: null,
					},
					contactOpeningMs: 0,
					contactClosingMs: 0,
					heuristic: null,
					configuredAt: instant,
					releaseRequestedAt: null,
				});
			},
		};
		const registration = registry.registerProviderOwned('c0-test:v1', provider);
		if (!registration) throw new Error('Missing TEST original owner');
		owner = registration;
		await writer.runReserved(async (manager, scope) =>
			writer.initializeSlot(manager, scope, {
				providerKey: 'c0-test:v1',
				controllerId: ids.controller,
				expected: await writer.readSlot(manager, scope, ids.controller),
				configuration: {},
			}),
		);
		await database.manager.insert(VirtualThermostatSourceEntity, {
			controllerId: ids.controller,
			role: 'ambient',
			sourcePropertyId: ids.temperature,
			sourcePropertyIdentity: ids.temperature,
			physicalIdentity: null,
			contractFingerprint: 'TEST ambient contract',
			maximumAgeSeconds: 60,
			openValue: null,
			closedValue: null,
		});
		await database.manager.insert(VirtualThermostatSourceEntity, {
			controllerId: ids.controller,
			role: 'contact',
			sourcePropertyId: null,
			sourcePropertyIdentity: ids.missing,
			physicalIdentity: 'TEST retained missing',
			contractFingerprint: 'TEST missing contract',
			maximumAgeSeconds: 30,
			openValue: true,
			closedValue: false,
		});
		const claimRows: readonly { claimId: string; role: ThermostatActuatorRole }[] = [
			{ claimId: ids.claim, role: 'cooling' },
			{ claimId: ids.heatClaim, role: 'heating' },
		];
		for (const { claimId, role } of claimRows)
			await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
				id: claimId,
				controllerId: ids.controller,
				role,
				physicalIdentity: 'TEST synthetic ' + claimId,
				providerProfile: 'shelly-ng.guarded-switch',
				providerProfileVersion: 1,
				sourcePropertyId: ids.actuator,
				sourcePropertyIdentity: ids.actuator,
				sourceDeviceId: ids.foreign,
				sourceDeviceIdentity: ids.foreign,
				contractFingerprint: 'TEST claim metadata, not qualification',
				revision: 1,
				qualificationGeneration: null,
				state: 'reserved',
				leaseSeconds: 10,
				reason: null,
				releaseRequestedAt: null,
				releasedAt: null,
				releaseEvidence: null,
			});
		await database.manager.insert(ThermostatMemberProtectionEntity, {
			claimId: ids.heatClaim,
			schemaVersion: 1,
			kind: 'local_floor',
			revision: 1,
			sourcePropertyId: ids.surface,
			sourcePropertyIdentity: ids.surface,
			physicalPropertyIdentity: ids.surface,
			contractFingerprint: 'TEST floor',
			maximumAgeSeconds: 30,
		});
		await database.manager.insert(ThermostatCoolingDependencyEntity, {
			claimId: ids.claim,
			schemaVersion: 1,
			revision: 1,
			dewPointPropertyId: ids.dew,
			dewPointIdentity: ids.dew,
			dewPointFingerprint: 'TEST dew configuration',
			surfacePropertyId: ids.surface,
			surfaceIdentity: ids.surface,
			physicalSurfaceIdentity: ids.surface,
			surfaceFingerprint: 'TEST surface',
			purpose: 'cooled_surface',
			maximumAgeSeconds: 30,
		});
		await database.manager.insert(VirtualDewPointConfigEntity, {
			outputPropertyId: ids.dew,
			schemaVersion: 1,
			formulaVersion: DEW_POINT_FORMULA,
			maximumAgeSeconds: 60,
			maximumSkewSeconds: 5,
			revision: 1,
			configuredAt: instant,
		});
		const dewRoles: readonly DewPointRole[] = ['dry_bulb', 'relative_humidity'];
		for (const role of dewRoles)
			await database.manager.insert(VirtualDewPointSourceEntity, {
				outputPropertyId: ids.dew,
				role,
				sourcePropertyId: role === 'dry_bulb' ? ids.temperature : ids.humidity,
				sourcePropertyIdentity: role === 'dry_bulb' ? ids.temperature : ids.humidity,
				quantity: role === 'dry_bulb' ? 'temperature' : 'relative_humidity',
				unit: role === 'dry_bulb' ? '°C' : '%',
				domain: dewPointInputDomain(role),
				contractFingerprint: 'TEST dew source',
			});
		await database.manager.insert(VirtualThermostatSettingEntity, {
			propertyId: ids.setting,
			controllerId: ids.controller,
			setting: 'heating_setpoint',
			contractFingerprint: 'TEST setting',
		});
		statements.length = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				statements.push(event.query);
			},
		});
	}, 30_000);
	afterEach(async () => {
		registry.onModuleDestroy();
		jest.restoreAllMocks();
		await database.destroy();
	});

	it('has zero constructor I/O and real read turns produce no writes/events/revisions/sidecar ensure', async () => {
		const query = jest.spyOn(database.manager, 'query');
		new VirtualThermostatAutomationService(writer, registry, graph);
		expect(query).not.toHaveBeenCalled();
		const slots = await database.manager.find(ClimateAutomationSlotEntity),
			sources = await database.manager.find(ClimateAutomationSourceEntity);
		const current = await image();
		expect(current.controllerRevision).toBe(1);
		expect(await graph.revision()).toBe(0);
		expect(await database.manager.find(ClimateAutomationSlotEntity)).toEqual(slots);
		expect(await database.manager.find(ClimateAutomationSourceEntity)).toEqual(sources);
		expect(statements.filter((sql) => /^\s*(INSERT|DELETE|UPDATE)/i.test(sql) && !sql.includes('WHERE 0'))).toEqual([]);
		expect(factsReads).toBeGreaterThan(1);
		expect(Object.isFrozen(current)).toBe(true);
	});
	it('preserves the actual ORM column sets and values rather than only the projection whitelist', async () => {
		const current = await image(),
			config = rec(current.configuration),
			comfort = rec(current.comfort),
			raw = await freshRows(database.manager, ids.controller);
		const configRow = raw.tables.configurations[0];
		if (!configRow) throw new Error('Missing persisted TEST config');
		const reconstructed: Record<string, unknown> = {
			...rec(config.config),
			revision: current.controllerRevision,
			requestedMode: comfort.requestedMode,
			locked: comfort.locked,
			comfort: comfort.configuration,
			policy: { ...rec(config.policySafety), ...rec(comfort.requestedSetpoints) },
		};
		expect(Object.keys(reconstructed).sort()).toEqual(
			database
				.getMetadata(VirtualThermostatConfigEntity)
				.columns.map((column) => column.propertyName)
				.sort(),
		);
		for (const column of database.getMetadata(VirtualThermostatConfigEntity).columns) {
			const expected: unknown = Reflect.get(configRow, column.propertyName);
			expect(reconstructed[column.propertyName]).toEqual(expected instanceof Date ? expected.toISOString() : expected);
		}
		for (const mapping of [
			{ entity: VirtualThermostatSourceEntity, key: 'sources' },
			{ entity: VirtualThermostatActuatorClaimEntity, key: 'actuators' },
			{ entity: VirtualThermostatSettingEntity, key: 'settings' },
			{ entity: ThermostatMemberProtectionEntity, key: 'protections' },
			{ entity: ThermostatCoolingDependencyEntity, key: 'coolingDependencies' },
		])
			for (const projected of array(config[mapping.key]))
				expect(Object.keys(rec(projected)).sort()).toEqual(
					database
						.getMetadata(mapping.entity)
						.columns.map((column) => column.propertyName)
						.sort(),
				);
	});
	it('adds no CLI constructor/registration I/O and leaves the actual writer CLI boundary intact', async () => {
		statements.length = 0;
		const cliWriter = new ClimateAutomationWriterService(
			database,
			new DeviceStructureLockService(),
			registry,
			new ConfigService({ FB_CLI: 'on' }),
		);
		new VirtualThermostatAutomationService(cliWriter, registry, graph);
		await expect(
			cliWriter.runReserved((manager, scope) =>
				cliWriter.readParticipant(manager, scope, { providerKey: 'c0-test:v1', controllerId: ids.controller }),
			),
		).rejects.toMatchObject({ commitOutcome: 'not_started' });
		expect(statements).toEqual([]);
	});
	it('fences every thermostat column plus complete cooling/dew/surface and foreign nullable references', async () => {
		const current = mutable(await image()),
			config = rec(current.configuration),
			cat = catalog(current);
		const cooling = rec(array(config.coolingDependencies)[0]),
			protection = rec(array(config.protections)[0]);
		expect(Object.keys(cooling).sort()).toEqual([...THERMOSTAT_AUTOMATION_COLUMNS.cooling].sort());
		expect(Object.keys(protection).sort()).toEqual([...THERMOSTAT_AUTOMATION_COLUMNS.protections].sort());
		const bindings = array(config.sources).map(rec);
		expect(bindings).toContainEqual(
			expect.objectContaining({ sourcePropertyId: null, sourcePropertyIdentity: ids.missing }),
		);
		expect(cat.missingPropertyIds).toContain(ids.missing);
		expect(cat.ownedOutputIds).toEqual([ids.output, ids.setting]);
		expect(
			array(cat.properties)
				.map(rec)
				.map((row) => row.id),
		).toEqual(expect.arrayContaining([ids.surface, ids.dew, ids.temperature, ids.humidity, ids.actuator]));
		expect(array(rec(cat.producerFacts).dewSources)).toHaveLength(2);
		expect(array(rec(cat.producerFacts).dewConfigurations)).toHaveLength(1);
		expect(planThermostatAutomationGraph(current, current).beforeEdges).toEqual([
			{ outputPropertyId: ids.output, sourcePropertyId: ids.temperature },
		]);
	});
	it('uses independent fresh same-manager provider rows rather than cached first images', async () => {
		const first = await image();
		const previousReads = factsReads;
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ displayFloorClaimId: ids.heatClaim, revision: 2 },
		);
		const second = await image();
		expect(factsReads).toBeGreaterThan(previousReads);
		expect(second.controllerRevision).toBe(2);
		expect(second.configuration).not.toEqual(first.configuration);
	});
	it('retains optional baseline absence versus explicit null and source identity without public/private adoption', async () => {
		const comfort = {
			heating_range: { minimum: 10, maximum: 30 },
			cooling_range: { minimum: 20, maximum: 35 },
			presets: [],
			selected_preset: null,
			user_off: true,
			automation_enabled: false,
			temporary_override: null,
		};
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { comfort });
		const absent = await image();
		expect(Object.hasOwn(rec(rec(absent.comfort).configuration), 'automation_baseline')).toBe(false);
		expect(absent.legacyBaseline).toBeNull();
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ comfort: { ...comfort, automation_baseline: null } },
		);
		const explicit = await image();
		expect(rec(rec(explicit.comfort).configuration).automation_baseline).toBeNull();
		expect(explicit.comfort).not.toEqual(absent.comfort);
		expect(
			(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: ids.controller })).state,
		).toBe('EMPTY');
		const rows = await freshRows(database.manager, ids.controller);
		expect(thermostatAutomationImage({ ...rows, tables: { ...rows.tables, configurations: [] } })).toBeNull();
		const persisted = rows.tables.configurations[0];
		if (!persisted) throw new Error('Missing TEST config');
		const optionalUndefined = thermostatAutomationImage({
			...rows,
			tables: {
				...rows.tables,
				configurations: [{ ...persisted, comfort: { ...comfort, automation_baseline: undefined } }],
			},
		});
		if (!optionalUndefined) throw new Error('Missing optional TEST projection');
		expect(Object.hasOwn(rec(rec(optionalUndefined.comfort).configuration), 'automation_baseline')).toBe(false);
	});
	it('preserves unknown persisted JSON exactly but reports unsupported mutation without dropping it', async () => {
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: ids.controller });
		const policy = { ...row.policy, futureSafety: { nullable: null, limit: 7 } };
		await database.query('UPDATE devices_virtual_thermostat_configs SET policy=? WHERE controllerId=?', [
			JSON.stringify(policy),
			ids.controller,
		]);
		const current = await image();
		expect(rec(rec(current.configuration).policySafety).futureSafety).toEqual({ nullable: null, limit: 7 });
		expect(thermostatAutomationMutationIssues(current)).toContain('unknown_policy');
		expect(() => planThermostatAutomationGraph(current, current)).toThrow();
	});
	it.each(['counter', 'date', 'nonfinite'])(
		'fails malformed persisted %s without manufacturing defaults',
		async (kind) => {
			const rows = await freshRows(database.manager, ids.controller),
				original = rows.tables.configurations[0];
			if (!original) throw new Error('Missing TEST config');
			const changed = {
				...original,
				...(kind === 'counter'
					? { revision: 1.5 }
					: kind === 'date'
						? { configuredAt: new Date(NaN) }
						: { policy: { bad: Infinity } }),
			};
			expect(() =>
				thermostatAutomationImage({ ...rows, tables: { ...rows.tables, configurations: [changed] } }),
			).toThrow();
		},
	);
	it('keeps safe maximum revision in exact read fence but refuses increment-dependent planning', async () => {
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		const current = await image();
		expect(current.controllerRevision).toBe(Number.MAX_SAFE_INTEGER);
		expect(thermostatAutomationMutationIssues(current)).toContain('increment_overflow');
		expect(() => planThermostatAutomationGraph(current, current)).toThrow();
	});
	it('retains absent/null/orphaned owner distinctions without GET ensure or legacy adoption', async () => {
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ ownerDeviceId: null },
		);
		const current = await image();
		expect(rec(rec(current.configuration).config).ownerDeviceId).toBeNull();
		expect(rec(current.comfort).configuration).toBeNull();
		expect(thermostatAutomationMutationIssues(current)).toContain('controller_owner');
		await writer.runReserved(async (manager, scope) => {
			expect(await writer.readSlot(manager, scope, ids.missing)).toBeDefined();
			return writer.readSlot(manager, scope, ids.missing);
		});
		expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: ids.missing })).toBeNull();
	});
	it.each(['forged', 'detached', 'foreign-manager'])(
		'refuses %s before participant SQL or input getter traversal',
		async (kind) => {
			await image();
			if (!lastTurn) throw new Error('Missing observed real turn');
			const savedTurn = lastTurn;
			statements.length = 0;
			if (kind === 'foreign-manager') {
				let calls = 0;
				jest.spyOn(participant, 'readInManager').mockImplementation((manager, turn, controllerId) => {
					void manager;
					calls++;
					const start = statements.length;
					const refused = service.readInManager(database.manager, turn, controllerId);
					expect(statements.slice(start)).toEqual([]);
					return refused;
				});
				await expect(
					writer.runReserved((manager, scope) =>
						writer.readParticipant(manager, scope, { providerKey: 'c0-test:v1', controllerId: ids.controller }),
					),
				).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
				expect(calls).toBe(1); // The core's preceding private-slot SELECT is allowed; participant performs ZERO SQL.
			} else {
				const getter = jest.fn(() => ids.controller);
				const methods: {
					readonly readInManager: (
						...args: Parameters<VirtualThermostatAutomationService['readInManager']>
					) => ReturnType<VirtualThermostatAutomationService['readInManager']>;
				} = service;
				const negative: unknown = Reflect.apply(methods.readInManager, service, [
					database.manager,
					kind === 'forged' ? { toJSON: () => ({}) } : savedTurn,
					{
						get id() {
							return getter();
						},
					},
				]);
				await expect(negative).rejects.toThrow();
				expect(getter).not.toHaveBeenCalled();
				expect(statements).toEqual([]);
			}
		},
	);
	it.each(['registration', 'method'])(
		'does not rescue an original %s replaced during a held real read',
		async (kind) => {
			const entered = barrier(),
				release = barrier();
			let first = true;
			holdRead = async () => {
				if (first) {
					first = false;
					entered.resolve();
					await release.promise;
				}
			};
			const operation = writer.runReserved((manager, scope) =>
				writer.readParticipant(manager, scope, { providerKey: 'c0-test:v1', controllerId: ids.controller }),
			);
			await entered.promise;
			if (kind === 'registration') {
				owner.dispose();
				const replacement = registry.registerProviderOwned('c0-test:v1', provider);
				if (!replacement) throw new Error('Missing new TEST original owner');
				owner = replacement;
			} else jest.spyOn(participant, 'readInManager');
			release.resolve();
			expect(await operation).toMatchObject({ outcome: 'conflict', reason: 'unavailable' });
		},
	);
	it('keeps classification descriptive and distinguishes exact stale fences, presentation, comfort and structure', async () => {
		const original = await image(),
			presented = mutable(original),
			manual = mutable(original),
			structural = mutable(original),
			stale = mutable(original);
		rec(rec(presented.configuration).config).displayFloorClaimId = ids.heatClaim;
		rec(manual.comfort).requestedMode = 'heat';
		rec(rec(structural.configuration).policySafety).coldTolerance = 0.75;
		stale.controllerRevision = 2;
		expect(classifyThermostatAutomationImages(original, original)).toMatchObject({
			exactFenceEqual: true,
			semanticEqual: true,
			requiresC1: true,
		});
		expect(classifyThermostatAutomationImages(original, presented)).toMatchObject({
			presentationChanged: true,
			structuralChanged: false,
		});
		expect(classifyThermostatAutomationImages(original, manual)).toMatchObject({
			comfortChanged: true,
			structuralChanged: false,
		});
		expect(classifyThermostatAutomationImages(original, structural).structuralChanged).toBe(true);
		expect(classifyThermostatAutomationImages(original, stale)).toMatchObject({
			exactFenceEqual: false,
			semanticEqual: true,
		});
	});
	it('preserves duplicate producer edge multiplicity and unrelated referenced edges', async () => {
		await database.manager.insert(VirtualAggregateConfigEntity, {
			outputPropertyId: ids.output,
			schemaVersion: 1,
			operator: VirtualAggregateOperator.MEAN,
			minimumValidInputs: 1,
			maximumAgeSeconds: 60,
		});
		await database.manager.insert(VirtualAggregateInputEntity, {
			outputPropertyId: ids.output,
			sourcePropertyId: ids.temperature,
			sourcePropertyIdentity: ids.temperature,
			quantity: 'TEST temperature',
			unit: '°C',
		});
		const current = await image(),
			plan = planThermostatAutomationGraph(current, current);
		expect(plan.beforeEdges).toHaveLength(2);
		expect(plan.beforeEdges[0]).toEqual(plan.beforeEdges[1]);
		expect(plan.replacementEdges).toEqual(plan.beforeEdges);
		expect(plan.ownedOutputIds).not.toContain(ids.dew);
		expect((await graph.edges(database.manager)).filter((edge) => edge.outputPropertyId === ids.dew)).toHaveLength(2);
	});
	it('derives a valid empty owned edge replacement from two fresh persisted images without exercising apply', async () => {
		const before = await image();
		await database.manager.update(
			VirtualChannelPropertyEntity,
			{ id: ids.output },
			{ valueOrigin: VirtualValueOrigin.LOCAL, sourcePropertyId: null },
		);
		const after = await image(),
			plan = planThermostatAutomationGraph(before, after);
		expect(plan.ownedOutputIds).toEqual([ids.output, ids.setting]);
		expect(plan.beforeEdges).toHaveLength(1);
		expect(plan.replacementEdges).toEqual([]);
		expect(await graph.revision()).toBe(0);
	});
	it('fences an actual unrepresented owned derived producer but refuses to plan its silent removal', async () => {
		await database.manager.update(
			VirtualChannelPropertyEntity,
			{ id: ids.output },
			{ valueOrigin: VirtualValueOrigin.DERIVED, sourcePropertyId: null },
		);
		const current = await image();
		expect(thermostatAutomationMutationIssues(current)).toContain('unrepresented_producer');
		expect(() => planThermostatAutomationGraph(current, current)).toThrow();
	});
	it.each(['edges', 'ownership', 'unknown-producer'])(
		'rejects %s tampering instead of silently deleting foreign producer rows',
		async (kind) => {
			const current = await image(),
				next = mutable(current),
				cat = catalog(next);
			if (kind === 'edges') cat.edges = [];
			if (kind === 'ownership') array(cat.ownedOutputIds).push(ids.dew);
			if (kind === 'unknown-producer') rec(cat.producerFacts).futureProducer = [{ outputPropertyId: ids.output }];
			expect(() => planThermostatAutomationGraph(current, next)).toThrow();
		},
	);
	it('owns pure input/result bytes without freezing callers or turning a plan into apply permission', async () => {
		const current = await image(),
			raw = mutable(current);
		let reads = 0;
		const wrapped = {
			...raw,
			get comfort() {
				reads++;
				return raw.comfort;
			},
		};
		const plan = planThermostatAutomationGraph(wrapped, current);
		expect(reads).toBe(1);
		expect(Object.isFrozen(plan.replacementEdges)).toBe(true);
		array(catalog(raw).edges).splice(0);
		expect(plan.beforeEdges).toHaveLength(1);
		expect(Object.isFrozen(raw)).toBe(false);
		await expect(
			participant.normalizeInManager(database.manager, { toJSON: () => ({}) }, 'replace-comfort:v1', {}, current),
		).rejects.toThrow(/deliberately/);
		await expect(
			participant.applyInManager(database.manager, { toJSON: () => ({}) }, current, current),
		).rejects.toThrow(/deliberately/);
	});

	it.each(['owned', 'referenced'])(
		'preserves persisted %s transform parameters.revision as structural input',
		async (kind) => {
			const outputPropertyId = kind === 'owned' ? ids.output : ids.temperature;
			await database.manager.update(
				VirtualChannelPropertyEntity,
				{ id: outputPropertyId },
				{ valueOrigin: VirtualValueOrigin.DERIVED, sourcePropertyId: null },
			);
			const policy: VirtualNumericTransformConfig = {
				operator: VirtualNumericTransformOperator.EXTENSION,
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 1,
				inputRange: { minimum: -40, maximum: 100 },
				outputRange: { minimum: -50, maximum: 110 },
				parameters: { revision: 1 },
			};
			// Persisted numeric extension contract only; no operator execution, registration or availability claim.
			await database.manager.insert(VirtualTransformConfigEntity, {
				outputPropertyId,
				schemaVersion: 1,
				policy,
				maximumAgeSeconds: 60,
				revision: 1,
				configuredAt: instant,
				quantity: 'temperature',
				unit: '°C',
			});
			await database.manager.insert(VirtualTransformSourceEntity, {
				outputPropertyId,
				sourcePropertyId: ids.humidity,
				sourcePropertyIdentity: ids.humidity,
				quantity: 'temperature',
				unit: '°C',
			});
			const before = await image();
			await database.query('UPDATE devices_virtual_transform_configs SET policy=? WHERE outputPropertyId=?', [
				JSON.stringify({ ...policy, parameters: { revision: 2 } }),
				outputPropertyId,
			]);
			const after = await image();
			expect(classifyThermostatAutomationImages(before, after)).toMatchObject({
				exactFenceEqual: false,
				structuralChanged: true,
				semanticEqual: false,
			});
			expect(thermostatAutomationMutationIssues(before)).toEqual([]);
			expect(thermostatAutomationMutationIssues(after)).toEqual([]);
			const facts = rec(rec(after.configuration).catalog).producerFacts;
			const transform = array(rec(facts).transformConfigurations)
				.map(rec)
				.find((row) => row.outputPropertyId === outputPropertyId);
			if (!transform) throw new Error('Missing fresh persisted transform');
			expect(transform.revision).toBe(1);
			expect(rec(rec(transform.policy).parameters).revision).toBe(2);
		},
	);
	it('fences only the top-level generated transform revision without structural churn', async () => {
		await database.manager.insert(VirtualTransformConfigEntity, {
			outputPropertyId: ids.temperature,
			schemaVersion: 1,
			policy: {
				operator: VirtualNumericTransformOperator.EXTENSION,
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 1,
				inputRange: { minimum: -40, maximum: 100 },
				outputRange: { minimum: -50, maximum: 110 },
				parameters: { revision: 1 },
			},
			maximumAgeSeconds: 60,
			revision: 1,
			configuredAt: instant,
			quantity: 'temperature',
			unit: '°C',
		});
		await database.manager.insert(VirtualTransformSourceEntity, {
			outputPropertyId: ids.temperature,
			sourcePropertyId: ids.humidity,
			sourcePropertyIdentity: ids.humidity,
			quantity: 'temperature',
			unit: '°C',
		});
		const before = await image();
		await database.manager.update(VirtualTransformConfigEntity, { outputPropertyId: ids.temperature }, { revision: 2 });
		const after = await image();
		expect(classifyThermostatAutomationImages(before, after)).toMatchObject({
			exactFenceEqual: false,
			structuralChanged: false,
			semanticEqual: true,
		});
	});
	it.each(['openValue', 'closedValue'])(
		'fences malformed persisted %s but refuses mutation planning',
		async (column) => {
			await database.query(
				'UPDATE devices_virtual_thermostat_sources SET "' + column + '"=? WHERE controllerId=? AND role=?',
				[JSON.stringify({ future: 1 }), ids.controller, 'contact'],
			);
			const current = await image(),
				source = array(rec(current.configuration).sources)
					.map(rec)
					.find((row) => row.role === 'contact');
			if (!source) throw new Error('Missing fresh persisted contact source');
			expect(source[column]).toEqual({ future: 1 });
			expect(thermostatAutomationMutationIssues(current)).toContain('source_scalar_domain');
			expect(() => planThermostatAutomationGraph(current, current)).toThrow();
		},
	);
	it.each([null, 'open', 2.5, true, false])(
		'retains valid persisted source scalar %s as plan-eligible representation',
		async (scalar) => {
			await database.query(
				'UPDATE devices_virtual_thermostat_sources SET openValue=?, closedValue=? WHERE controllerId=? AND role=?',
				[JSON.stringify(scalar), JSON.stringify(scalar), ids.controller, 'contact'],
			);
			const current = await image(),
				source = array(rec(current.configuration).sources)
					.map(rec)
					.find((row) => row.role === 'contact');
			if (!source) throw new Error('Missing fresh persisted contact source');
			expect(source.openValue).toEqual(scalar);
			expect(source.closedValue).toEqual(scalar);
			expect(thermostatAutomationMutationIssues(current)).not.toContain('source_scalar_domain');
			expect(() => planThermostatAutomationGraph(current, current)).not.toThrow();
		},
	);

	it('keeps persisted extension parameters.revision MAX as finite data rather than an incremented counter', async () => {
		await database.manager.insert(VirtualTransformConfigEntity, {
			outputPropertyId: ids.temperature,
			schemaVersion: 1,
			policy: {
				operator: VirtualNumericTransformOperator.EXTENSION,
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 1,
				inputRange: { minimum: -40, maximum: 100 },
				outputRange: { minimum: -50, maximum: 110 },
				parameters: { revision: Number.MAX_SAFE_INTEGER },
			},
			maximumAgeSeconds: 60,
			revision: 1,
			configuredAt: instant,
			quantity: 'temperature',
			unit: '°C',
		});
		await database.manager.insert(VirtualTransformSourceEntity, {
			outputPropertyId: ids.temperature,
			sourcePropertyId: ids.humidity,
			sourcePropertyIdentity: ids.humidity,
			quantity: 'temperature',
			unit: '°C',
		});
		const current = await image(),
			rows = array(rec(rec(rec(current.configuration).catalog).producerFacts).transformConfigurations).map(rec);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revision).toBe(1);
		expect(rec(rec(rows[0]?.policy).parameters).revision).toBe(Number.MAX_SAFE_INTEGER);
		expect(thermostatAutomationMutationIssues(current)).not.toContain('increment_overflow');
		expect(() => planThermostatAutomationGraph(current, current)).not.toThrow();
	});
	it('refuses increment-dependent planning for an actual persisted transform ROW revision MAX', async () => {
		await database.manager.insert(VirtualTransformConfigEntity, {
			outputPropertyId: ids.temperature,
			schemaVersion: 1,
			policy: {
				operator: VirtualNumericTransformOperator.EXTENSION,
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 1,
				inputRange: { minimum: -40, maximum: 100 },
				outputRange: { minimum: -50, maximum: 110 },
				parameters: { revision: 1 },
			},
			maximumAgeSeconds: 60,
			revision: Number.MAX_SAFE_INTEGER,
			configuredAt: instant,
			quantity: 'temperature',
			unit: '°C',
		});
		await database.manager.insert(VirtualTransformSourceEntity, {
			outputPropertyId: ids.temperature,
			sourcePropertyId: ids.humidity,
			sourcePropertyIdentity: ids.humidity,
			quantity: 'temperature',
			unit: '°C',
		});
		const current = await image(),
			rows = array(rec(rec(rec(current.configuration).catalog).producerFacts).transformConfigurations).map(rec);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revision).toBe(Number.MAX_SAFE_INTEGER);
		expect(thermostatAutomationMutationIssues(current)).toContain('increment_overflow');
		expect(() => planThermostatAutomationGraph(current, current)).toThrow();
	});
});

/** Independent fresh same-manager provider proof, separate from the guarded participant read. */
const manualFreshRows = async (manager: EntityManager, controllerId: string): Promise<ThermostatAutomationRows> => {
	const read = <T extends ObjectLiteral>(entity: EntityTarget<T>): Promise<T[]> =>
		manager.createQueryBuilder(entity, 'fresh').callListeners(false).getMany();
	return {
		devices: await read(DeviceEntity),
		channels: await manager
			.createQueryBuilder(ChannelEntity, 'fresh')
			.leftJoinAndSelect('fresh.device', 'device')
			.callListeners(false)
			.getMany(),
		properties: await manager
			.createQueryBuilder(ChannelPropertyEntity, 'fresh')
			.leftJoinAndSelect('fresh.channel', 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.callListeners(false)
			.getMany(),
		tables: {
			configurations: await manager
				.createQueryBuilder(VirtualThermostatConfigEntity, 'fresh')
				.where('fresh.controllerId = :controllerId', { controllerId })
				.callListeners(false)
				.getMany(),
			sources: await read(VirtualThermostatSourceEntity),
			actuators: await read(VirtualThermostatActuatorClaimEntity),
			settings: await read(VirtualThermostatSettingEntity),
			protections: await read(ThermostatMemberProtectionEntity),
			cooling: await read(ThermostatCoolingDependencyEntity),
			dewConfigurations: await read(VirtualDewPointConfigEntity),
			dewSources: await read(VirtualDewPointSourceEntity),
			transformConfigurations: await read(VirtualTransformConfigEntity),
			transformSources: await read(VirtualTransformSourceEntity),
			aggregateConfigurations: await read(VirtualAggregateConfigEntity),
			aggregateInputs: await read(VirtualAggregateInputEntity),
			groupConfigurations: await read(VirtualLightGroupConfigEntity),
			groupMembers: await read(VirtualLightGroupMemberEntity),
			groupBindings: await read(VirtualLightGroupBindingEntity),
		},
	};
};

/** TEST registration only. Real SQLite/writer/graph/C0 codec/materializer, no production registration or devices. */
describe('dormant C1a atomic manual controller intents (actual same-manager CAS)', () => {
	let database: SqliteDataSource, registry: ClimateAutomationRegistryService, writer: ClimateAutomationWriterService;
	let graph: VirtualDependencyGraphService,
		service: VirtualThermostatAutomationService,
		lock: DeviceStructureLockService;
	let owner: { dispose: () => void }, participant: ClimateAutomationParticipant, provider: ClimateAutomationProvider;
	let manual: ClimateAutomationManualCapability;
	let duringValidation: ((manager: EntityManager, turn: ClimateAutomationParticipantTurn) => Promise<void>) | undefined;
	let afterApply: ((manager: EntityManager) => Promise<void>) | undefined;
	let validations: number, applies: number, historyReads: number;
	const providerKey = 'c1a-test:v1';
	const matchers: { readonly any: (constructor: typeof String) => unknown } = expect;
	const properties = {
		heating_setpoint: 'e0000000-0000-4000-8000-000000000001',
		cooling_setpoint: 'e0000000-0000-4000-8000-000000000002',
		heating_enabled: 'e0000000-0000-4000-8000-000000000003',
		cooling_enabled: 'e0000000-0000-4000-8000-000000000004',
		locked: 'e0000000-0000-4000-8000-000000000005',
	};
	const comfort = (): ThermostatComfortConfiguration => ({
		heating_range: { minimum: 5, maximum: 30 },
		cooling_range: { minimum: 10, maximum: 35 },
		presets: [
			{ preset: 'comfort', setpoints: { heating_setpoint: 20, cooling_setpoint: 24 } },
			{ preset: 'eco', setpoints: { heating_setpoint: 18, cooling_setpoint: 26 } },
			{ preset: 'away', setpoints: { heating_setpoint: 16, cooling_setpoint: 28 } },
		],
		selected_preset: null,
		user_off: false,
		automation_enabled: false,
		automation_baseline: null,
		temporary_override: null,
	});
	const unavailable = (): Promise<never> => Promise.reject(new Error('Not a C1a closed command'));
	const config = () =>
		database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: ids.controller });
	const slot = () => database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: ids.controller });
	const whole = async () => ({
		config: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId',
		),
		slots: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId',
		),
		sources: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_module_climate_automation_sources ORDER BY generationId',
		),
		settings: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_virtual_thermostat_settings ORDER BY propertyId',
		),
		recovery: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_virtual_thermostat_recoveries ORDER BY id',
		),
		graph: await database.manager.query<unknown[]>('SELECT * FROM devices_virtual_graph_revision ORDER BY id'),
	});
	const settings = (updates: readonly { propertyId: string; value: number | boolean }[], exactRevision?: number) =>
		writer.commitControllerIntentV1({
			providerKey,
			controllerId: ids.controller,
			fence:
				exactRevision === undefined
					? { kind: 'current-at-admitted-setting-submission' }
					: { kind: 'exact', controllerRevision: exactRevision, graphRevision: 0 },
			intent: { kind: 'manual-settings:v1', updates },
		});
	const select = async (preset: 'comfort' | 'eco' | 'away' | null, clearUserOff = false) =>
		writer.commitControllerIntentV1({
			providerKey,
			controllerId: ids.controller,
			fence: { kind: 'exact', controllerRevision: (await config()).revision, graphRevision: 0 },
			intent: { kind: 'manual-preset:v1', preset, clearUserOff },
		});
	const recovery = (id = randomUUID()) => ({
		id,
		controllerId: ids.controller,
		claimId: ids.claim,
		physicalIdentity: 'stored physical identity',
		previousPropertyIdentity: 'retained previous identity',
		restoredPropertyId: properties.heating_enabled,
		actorId: 'operator account text',
		reason: 'private recovery reason',
		disconnectionAcknowledged: true,
		configurationRevision: Number.MAX_SAFE_INTEGER,
		claimRevision: Number.MAX_SAFE_INTEGER,
		createdAt: instant,
	});
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		registry = new ClimateAutomationRegistryService();
		lock = new DeviceStructureLockService();
		writer = new ClimateAutomationWriterService(database, lock, registry, new ConfigService({ FB_CLI: 'off' }));
		graph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), writer);
		service = new VirtualThermostatAutomationService(writer, registry, graph);
		validations = 0;
		applies = 0;
		historyReads = 0;
		duringValidation = undefined;
		afterApply = undefined;
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		await database.manager.insert(VirtualDeviceEntity, {
			id: ids.controller,
			name: 'TEST C1a',
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
			enabled: true,
		});
		const channels = { heating: randomUUID(), cooling: randomUUID(), thermostat: randomUUID() };
		for (const { id, category } of [
			{ id: channels.heating, category: ChannelCategory.HEATER },
			{ id: channels.cooling, category: ChannelCategory.COOLER },
			{ id: channels.thermostat, category: ChannelCategory.THERMOSTAT },
		]) {
			await database.manager.insert(VirtualChannelEntity, {
				id,
				device: { id: ids.controller },
				identifier: id,
				name: 'TEST setting',
				category,
			});
		}
		const bindings: { propertyId: string; setting: ThermostatSetting; contractFingerprint: string }[] = [];
		const settingNames: readonly ThermostatSetting[] = [
			'heating_setpoint',
			'cooling_setpoint',
			'heating_enabled',
			'cooling_enabled',
			'locked',
		];
		for (const setting of settingNames) {
			const numeric = setting === 'heating_setpoint' || setting === 'cooling_setpoint';
			const channelId =
				setting === 'locked'
					? channels.thermostat
					: setting === 'heating_setpoint' || setting === 'heating_enabled'
						? channels.heating
						: channels.cooling;
			await database.manager.insert(VirtualChannelPropertyEntity, {
				id: properties[setting],
				channel: { id: channelId },
				identifier: setting,
				category:
					setting === 'locked' ? PropertyCategory.LOCKED : numeric ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
				dataType: numeric ? DataTypeType.FLOAT : DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				unit: numeric ? '°C' : null,
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
			});
			const property = await database.manager
				.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
				.leftJoinAndSelect('property.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.where('property.id = :id', { id: properties[setting] })
				.getOneOrFail();
			if (
				!property.channel ||
				typeof property.channel === 'string' ||
				!property.channel.device ||
				typeof property.channel.device === 'string'
			)
				throw new Error('TEST concrete property relation missing');
			bindings.push({
				propertyId: property.id,
				setting,
				contractFingerprint: thermostatPropertyContract(property, property.channel, property.channel.device),
			});
		}
		// Original receiver/function pairs, not fake currentness or a successful replacement stub.
		const methods: {
			readonly readInManager: (
				...args: Parameters<VirtualThermostatAutomationService['readInManager']>
			) => ReturnType<VirtualThermostatAutomationService['readInManager']>;
			readonly validateManualIntentInManager: (
				...args: Parameters<VirtualThermostatAutomationService['validateManualIntentInManager']>
			) => ReturnType<VirtualThermostatAutomationService['validateManualIntentInManager']>;
			readonly readRetainedHistoryInManager: (
				...args: Parameters<VirtualThermostatAutomationService['readRetainedHistoryInManager']>
			) => ReturnType<VirtualThermostatAutomationService['readRetainedHistoryInManager']>;
			readonly applyManualIntentInManager: (
				...args: Parameters<VirtualThermostatAutomationService['applyManualIntentInManager']>
			) => ReturnType<VirtualThermostatAutomationService['applyManualIntentInManager']>;
		} = service;
		const read: ReceiverCall<
				VirtualThermostatAutomationService,
				Parameters<VirtualThermostatAutomationService['readInManager']>,
				ReturnType<VirtualThermostatAutomationService['readInManager']>
			> = methods.readInManager,
			validate: ReceiverCall<
				VirtualThermostatAutomationService,
				Parameters<VirtualThermostatAutomationService['validateManualIntentInManager']>,
				ReturnType<VirtualThermostatAutomationService['validateManualIntentInManager']>
			> = methods.validateManualIntentInManager,
			history: ReceiverCall<
				VirtualThermostatAutomationService,
				Parameters<VirtualThermostatAutomationService['readRetainedHistoryInManager']>,
				ReturnType<VirtualThermostatAutomationService['readRetainedHistoryInManager']>
			> = methods.readRetainedHistoryInManager,
			apply: ReceiverCall<
				VirtualThermostatAutomationService,
				Parameters<VirtualThermostatAutomationService['applyManualIntentInManager']>,
				ReturnType<VirtualThermostatAutomationService['applyManualIntentInManager']>
			> = methods.applyManualIntentInManager;
		manual = {
			version: 1,
			codec: 'virtual-thermostat-c0:v1',
			validateInManager: async (manager, turn, intent, before, next) => {
				validations++;
				await validate.call(service, manager, turn, intent, before, next);
				if (duringValidation) await duringValidation(manager, turn);
			},
			readRetainedHistoryInManager: async (manager, turn, controllerId) => {
				historyReads++;
				return history.call(service, manager, turn, controllerId);
			},
		};
		participant = {
			version: 1,
			graph,
			readInManager: (manager, turn, controllerId) => read.call(service, manager, turn, controllerId),
			normalizeInManager: unavailable,
			planGraphReplacementInManager: unavailable,
			applyInManager: async (manager, turn, before, next) => {
				applies++;
				await apply.call(service, manager, turn, before, next);
				if (afterApply) await afterApply(manager);
			},
			manualIntentV1: manual,
		};
		provider = {
			participantV1: participant,
			readControllerInManager: async (manager, controllerId) => {
				const image = thermostatAutomationImage(await manualFreshRows(manager, controllerId));
				return image
					? {
							controllerRevision: image.controllerRevision,
							graphRevision: await graph.revision(manager),
							evidence: climateAutomationJson(image),
							legacyBaseline: image.legacyBaseline,
						}
					: null;
			},
			validateSelectionInManager: unavailable,
			createControllerInManager: async (manager, controllerId) => {
				await manager.insert(VirtualThermostatConfigEntity, {
					controllerId,
					ownerDeviceId: controllerId,
					requestedMode: 'off',
					controlStrategy: 'guarded_branches',
					locked: false,
					comfort: comfort(),
					policy: {
						heatingSetpoint: 20,
						coolingSetpoint: 24,
						coldTolerance: 0.5,
						hotTolerance: 0.5,
						neutralMargin: 1,
						minimumOffMs: 1000,
						changeoverMs: 1000,
						floor: null,
					},
					heuristic: null,
					contactOpeningMs: 0,
					contactClosingMs: 0,
					configuredAt: instant,
					releaseRequestedAt: null,
				});
				for (const binding of bindings)
					await manager.insert(VirtualThermostatSettingEntity, { ...binding, controllerId });
			},
		};
		const registration = registry.registerProviderOwned(providerKey, provider);
		if (!registration) throw new Error('TEST registration missing');
		owner = registration;
		expect(
			(
				await writer.runReserved(async (manager, scope) =>
					writer.initializeSlot(manager, scope, {
						providerKey,
						controllerId: ids.controller,
						expected: await writer.readSlot(manager, scope, ids.controller),
						configuration: {},
					}),
				)
			).outcome,
		).toBe('applied');
	}, 30_000);
	afterEach(async () => {
		owner?.dispose();
		registry?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
	});

	it('updates a null comfort mixed setting batch without fabricating comfort, baseline or graph revision', async () => {
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { comfort: null });
		const beforeSlot = await slot();
		expect(
			(
				await settings([
					{ propertyId: properties.heating_setpoint, value: 21 },
					{ propertyId: properties.heating_enabled, value: true },
					{ propertyId: properties.locked, value: true },
				])
			).outcome,
		).toBe('applied');
		const current = await config();
		expect(current).toMatchObject({
			revision: 2,
			requestedMode: 'heat',
			locked: true,
			comfort: null,
			policy: { heatingSetpoint: 21 },
		});
		expect(await slot()).toMatchObject({
			manualHold: true,
			manualCounter: 2,
			slotRevision: 2,
			state: 'EMPTY',
			controllerIncarnation: beforeSlot.controllerIncarnation,
		});
		expect(await graph.revision()).toBe(0);
		const unchanged = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict'); // Locked numeric remains forbidden.
		expect(await whole()).toEqual(unchanged);
	});
	it('allows exact null-comfort settings noop but refuses null-comfort manual preset', async () => {
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { comfort: null });
		const before = await whole();
		expect((await settings([{ propertyId: properties.locked, value: false }])).outcome).toBe('unchanged');
		expect((await select(null)).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
		expect(applies).toBe(0);
	});
	it.each([
		{ preset: null, clearUserOff: false },
		{ preset: null, clearUserOff: true },
		{ preset: 'eco', clearUserOff: false },
		{ preset: 'eco', clearUserOff: true },
	] satisfies readonly { preset: 'eco' | null; clearUserOff: boolean }[])(
		'preserves requested OFF/override/baseline for preset=$preset clearUserOff=$clearUserOff',
		async ({ preset, clearUserOff }: { preset: 'eco' | null; clearUserOff: boolean }) => {
			const initial = comfort();
			initial.selected_preset = 'comfort';
			initial.user_off = true;
			initial.automation_baseline = {
				preset: 'away',
				setpoints: null,
				actor_id: 'descriptive automation actor',
				revision: 3,
			};
			initial.temporary_override = {
				id: randomUUID(),
				source: 'user',
				actor_id: 'user',
				revision: 2,
				created_at: instant.toISOString(),
				expires_at: '2026-01-02T04:04:05.000Z',
				preset: null,
				setpoints: { heating_setpoint: 19, cooling_setpoint: 25 },
				resolved_setpoints: { heating_setpoint: 19, cooling_setpoint: 25 },
				status: 'clock_uncertain',
				terminated_at: null,
			};
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: ids.controller },
				{ comfort: initial },
			);
			await database.manager.update(
				ClimateAutomationSlotEntity,
				{ controllerId: ids.controller },
				{ manualHold: true },
			);
			const original = await slot();
			expect((await select(preset, clearUserOff)).outcome).toBe('applied');
			expect(await config()).toMatchObject({
				revision: 2,
				requestedMode: 'off',
				comfort: { ...initial, selected_preset: preset, user_off: !clearUserOff },
			});
			expect(await slot()).toMatchObject({
				manualHold: preset === null,
				manualCounter: 2,
				slotRevision: 2,
				controllerIncarnation: original.controllerIncarnation,
			});
		},
	);
	it('distinguishes disabled owner preset permission from numeric refusal and locked-only unlock', async () => {
		await database.manager.update(VirtualDeviceEntity, { id: ids.controller }, { enabled: false });
		expect((await select('eco')).outcome).toBe('applied');
		const disabled = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(disabled);
		await database.manager.update(VirtualDeviceEntity, { id: ids.controller }, { enabled: true });
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { locked: true });
		expect(
			(
				await settings([
					{ propertyId: properties.locked, value: false },
					{ propertyId: properties.heating_setpoint, value: 21 },
				])
			).outcome,
		).toBe('conflict');
		const original = await slot();
		expect((await settings([{ propertyId: properties.locked, value: false }])).outcome).toBe('applied');
		expect(await slot()).toEqual(original);
	});
	it('treats an echoed numeric value as one manual takeover then a true zero-churn noop', async () => {
		const initial = comfort();
		initial.selected_preset = 'eco';
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ comfort: initial },
		);
		const before = await slot();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 20 }])).outcome).toBe('applied');
		expect(await config()).toMatchObject({
			revision: 2,
			requestedMode: 'off',
			comfort: { selected_preset: null, user_off: false },
		});
		expect(await slot()).toMatchObject({ manualHold: true, slotRevision: 2, manualCounter: 2 });
		expect((await slot()).manualGeneration).not.toBe(before.manualGeneration);
		const once = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 20 }])).outcome).toBe('unchanged');
		expect(await whole()).toEqual(once);
		expect(applies).toBe(1);
	});
	it.each([
		{ propertyId: properties.heating_setpoint, value: 31 },
		{ propertyId: properties.heating_setpoint, value: 23 },
		{ propertyId: properties.heating_enabled, value: 2 },
		{ propertyId: ids.foreign, value: 20 },
	])('refuses range/deadband/type/unbound setting $propertyId=$value without writes', async (update) => {
		const before = await whole();
		expect((await settings([update])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
		expect(applies).toBe(0);
	});
	it('conflicts stale exact revisions before equal-payload normalization', async () => {
		await settings([{ propertyId: properties.heating_setpoint, value: 21 }]);
		validations = 0;
		const before = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }], 1)).outcome).toBe('conflict');
		expect(validations).toBe(0);
		expect(await whole()).toEqual(before);
	});
	it('allows full no-op at MAX counters but refuses only counters an actual change increments', async () => {
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		await database.manager.update(
			ClimateAutomationSlotEntity,
			{ controllerId: ids.controller },
			{ manualCounter: Number.MAX_SAFE_INTEGER, slotRevision: Number.MAX_SAFE_INTEGER, manualHold: true },
		);
		const before = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 20 }])).outcome).toBe('unchanged');
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
		expect(applies).toBe(0);
	});
	it('retains all recovery columns/MAX facts privately on a real successful CAS and noop', async () => {
		const row = recovery();
		await database.manager.insert(VirtualThermostatRecoveryEntity, row);
		const before = (await whole()).recovery;
		const result = await settings([{ propertyId: properties.heating_setpoint, value: 21 }]);
		expect(result.outcome).toBe('applied');
		expect((await whole()).recovery).toEqual(before);
		const serialized = JSON.stringify(result);
		for (const secret of [row.actorId, row.reason, row.physicalIdentity, row.id])
			expect(serialized).not.toContain(secret);
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('unchanged');
		expect((await whole()).recovery).toEqual(before);
		expect(historyReads).toBeGreaterThan(3);
	});
	it.each(['append', 'change', 'delete'] satisfies readonly ('append' | 'change' | 'delete')[])(
		'rolls back forbidden recovery %s during candidate validation',
		async (kind) => {
			const row = recovery();
			await database.manager.insert(VirtualThermostatRecoveryEntity, row);
			const before = await whole();
			duringValidation = async (manager) => {
				if (kind === 'append') await manager.insert(VirtualThermostatRecoveryEntity, recovery());
				else if (kind === 'change')
					await manager.update(VirtualThermostatRecoveryEntity, { id: row.id }, { reason: 'forbidden changed' });
				else await manager.delete(VirtualThermostatRecoveryEntity, { id: row.id });
			};
			expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
			expect(await whole()).toEqual(before);
		},
	);
	it('also refuses selected otherwise-noop recovery membership drift at finalization', async () => {
		const before = await whole();
		duringValidation = async (manager) => {
			await manager.insert(VirtualThermostatRecoveryEntity, recovery());
		};
		expect((await settings([{ propertyId: properties.locked, value: false }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
		expect(applies).toBe(0);
	});
	it.each(['registration', 'history-method', 'validation-method', 'apply-method'] satisfies readonly (
		| 'registration'
		| 'history-method'
		| 'validation-method'
		| 'apply-method'
	)[])('cannot borrow replacement %s after original admission', async (kind) => {
		const before = await whole();
		duringValidation = () =>
			new Promise<void>((resolve) => {
				if (kind === 'registration') {
					owner.dispose();
					const replacement = registry.registerProviderOwned(providerKey, provider);
					if (!replacement) throw new Error('TEST replacement missing');
					owner = replacement;
				} else if (kind === 'history-method') Object.assign(manual, { readRetainedHistoryInManager: unavailable });
				else if (kind === 'validation-method') Object.assign(manual, { validateInManager: unavailable });
				else Object.assign(participant, { applyInManager: unavailable });
				resolve();
			});
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
	});
	it('rolls back a wrong child postimage despite a correct affected-one controller CAS', async () => {
		const before = await whole();
		afterApply = async (manager) => {
			await manager.update(
				VirtualThermostatSettingEntity,
				{ propertyId: properties.heating_setpoint },
				{ contractFingerprint: 'wrong child' },
			);
		};
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
	});
	it('refuses stale full controller facts before apply after a forbidden validation write', async () => {
		const before = await whole();
		duringValidation = async (manager) => {
			await manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { contactOpeningMs: 1 });
		};
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(applies).toBe(0);
		expect(await whole()).toEqual(before);
	});
	it('owns queued request fields before a held readonly validator can observe caller mutation', async () => {
		const entered = barrier(),
			release = barrier();
		duringValidation = async () => {
			entered.resolve();
			await release.promise;
		};
		const request: ClimateAutomationControllerIntentRequest = {
			providerKey,
			controllerId: ids.controller,
			fence: { kind: 'current-at-admitted-setting-submission' },
			intent: { kind: 'manual-settings:v1', updates: [{ propertyId: properties.heating_setpoint, value: 21 }] },
		};
		const pending = writer.commitControllerIntentV1(request);
		await entered.promise;
		Object.assign(request, {
			providerKey: 'foreign:v1',
			intent: { kind: 'manual-settings:v1', updates: [{ propertyId: properties.heating_setpoint, value: 29 }] },
		});
		release.resolve();
		expect((await pending).outcome).toBe('applied');
		expect((await config()).policy.heatingSetpoint).toBe(21);
	});
	it('retains COMMITTED truth for late ACK subscriber rejection and does not retry or publish a success receipt', async () => {
		const cause = new Error('C1a after committed');
		database.subscribers.push({ afterTransactionCommit: () => Promise.reject(cause) });
		await expect(settings([{ propertyId: properties.heating_setpoint, value: 21 }])).rejects.toMatchObject({
			commitOutcome: 'committed',
			cause,
		});
		expect(applies).toBe(1);
		expect((await config()).revision).toBe(2);
		expect((await slot()).manualCounter).toBe(2);
	});
	it('detects actual controller affected-zero CAS without accepting a successful apply', async () => {
		await database.manager.query(
			'CREATE TRIGGER c1a_ignore_controller BEFORE UPDATE ON devices_virtual_thermostat_configs BEGIN SELECT RAISE(IGNORE); END',
		);
		const before = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(applies).toBe(1);
		expect(await whole()).toEqual(before);
	});
	it.each(['PROVISIONAL', 'LIVE', 'RETIRED'] satisfies readonly ('PROVISIONAL' | 'LIVE' | 'RETIRED')[])(
		'preserves original source A/current head B and exact %s identity during a manual overlay',
		async (state) => {
			// Dormant TEST ledger rows only, never an installed slot or transport/physical qualification.
			const ownerId = randomUUID(),
				generationA = randomUUID(),
				generationB = randomUUID();
			const evidence = climateAutomationCanonical({ test: 'retained source facts' });
			const source = {
				ownerId,
				producerKey: 'absent-activity:v1',
				subjectId: ids.controller,
				revision: 1,
				evidence,
				evidenceDigest: createHash('sha256').update(evidence).digest('hex'),
			};
			await database.manager.insert(ClimateAutomationSourceEntity, [
				{ ...source, generationId: generationA, generationIndex: 1, isCurrent: false, state: 'REVOKED' },
				{ ...source, generationId: generationB, generationIndex: 2, isCurrent: true, state: 'PENDING' },
			]);
			await database.manager.update(
				ClimateAutomationSlotEntity,
				{ controllerId: ids.controller },
				{
					state,
					ownerId,
					generationId: generationA,
					baselineId: randomUUID(),
					candidateId: randomUUID(),
					bundleId: randomUUID(),
					selection: '{"preset":"eco"}',
					installEvidence: '{"test":"not installed"}',
				},
			);
			const original = await slot(),
				sources = (await whole()).sources;
			expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('applied');
			expect(await slot()).toMatchObject({
				...original,
				state: state === 'PROVISIONAL' ? 'RETIRED' : state,
				manualHold: true,
				manualCounter: 2,
				slotRevision: 2,
				manualGeneration: matchers.any(String),
			});
			expect((await slot()).manualGeneration).not.toBe(original.manualGeneration);
			expect((await whole()).sources).toEqual(sources);
			expect(registry.captureProducer('absent-activity:v1')).toBeNull();
		},
	);
	it('requires exact C1a history capability but keeps the original C0/B read protocol compatible', async () => {
		Object.assign(participant, { manualIntentV1: undefined });
		const before = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(
			(
				await writer.runReserved((manager, scope) =>
					writer.readParticipant(manager, scope, { providerKey, controllerId: ids.controller }),
				)
			).outcome,
		).toBe('unchanged');
		expect(await whole()).toEqual(before);
		expect(historyReads).toBe(0);
	});
	it('retains original manual/history methods while a request waits for the actual structural lock', async () => {
		const entered = barrier(),
			release = barrier(),
			original = await config();
		const blocker = lock.runExclusive(async () => {
			entered.resolve();
			await release.promise;
		});
		await entered.promise;
		const pending = settings([{ propertyId: properties.heating_setpoint, value: 21 }]);
		Object.assign(manual, { readRetainedHistoryInManager: unavailable });
		release.resolve();
		await blocker;
		expect((await pending).outcome).toBe('conflict');
		expect(await config()).toEqual(original);
		expect(applies).toBe(0);
	});
	it('closes original manual guard at native COMMIT without borrowing a replacement reader', async () => {
		const before = await whole();
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query === 'COMMIT') Object.assign(manual, { readRetainedHistoryInManager: unavailable });
			},
		});
		await expect(settings([{ propertyId: properties.heating_setpoint, value: 21 }])).rejects.toMatchObject({
			commitOutcome: 'refused',
		});
		expect(await whole()).toEqual(before);
		expect(applies).toBe(1);
	});
	it('does not turn a submitted lost native ACK into a success receipt or automatic replay', async () => {
		const runner = database.createQueryRunner();
		const connection: unknown = await runner.connect();
		if (!isManualNativeConnection(connection)) throw new Error('Missing actual TEST native driver');
		const original = connection.all;
		const spy = jest.spyOn(connection, 'all').mockImplementation(function (
			this: ManualNativeConnection,
			query,
			parameters,
			callback,
		) {
			return original.call(this, query, parameters, function (this: unknown, error, rows) {
				callback.call(this, query === 'COMMIT' && !error ? new Error('C1a lost native ACK') : error, rows);
			});
		});
		try {
			await expect(settings([{ propertyId: properties.heating_setpoint, value: 21 }])).rejects.toMatchObject({
				commitOutcome: 'unknown',
			});
			expect(applies).toBe(1);
		} finally {
			spy.mockRestore();
			await runner.release();
		}
	});

	it('does not reject immutable child/retained counters at MAX when only actual controller/manual counters increment', async () => {
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
			id: ids.claim,
			controllerId: ids.controller,
			role: 'heating',
			physicalIdentity: 'TEST absent historical hardware',
			providerProfile: 'shelly-ng.guarded-switch',
			providerProfileVersion: 1,
			sourcePropertyId: null,
			sourcePropertyIdentity: ids.actuator,
			sourceDeviceId: null,
			sourceDeviceIdentity: ids.foreign,
			contractFingerprint: 'TEST retained contract',
			revision: Number.MAX_SAFE_INTEGER,
			qualificationGeneration: null,
			state: 'missing',
			leaseSeconds: 10,
			reason: null,
			releaseRequestedAt: null,
			releasedAt: null,
			releaseEvidence: { revision: Number.MAX_SAFE_INTEGER },
		});
		const original = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: ids.claim });
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('applied');
		expect(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: ids.claim })).toEqual(
			original,
		);
		expect((await config()).revision).toBe(2);
	});
	it.each(['slotRevision', 'manualCounter'] satisfies readonly ('slotRevision' | 'manualCounter')[])(
		'refuses actual %s overflow before controller apply or private generation allocation',
		async (counter) => {
			await database.manager.update(
				ClimateAutomationSlotEntity,
				{ controllerId: ids.controller },
				{ [counter]: Number.MAX_SAFE_INTEGER },
			);
			const original = await whole();
			expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
			expect(await whole()).toEqual(original);
			expect(applies).toBe(0);
		},
	);
	it('rejects unknown persisted JSON without persisting a lossy codec', async () => {
		const original = comfort();
		await database.manager.query('UPDATE devices_virtual_thermostat_configs SET comfort=? WHERE controllerId=?', [
			JSON.stringify({ ...original, unknown_extension: { revision: 1 } }),
			ids.controller,
		]);
		const before = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(before);
		expect(applies).toBe(0);
	});

	it('refuses malformed actual recovery counters before apply without treating MAX as overflow', async () => {
		const row = recovery();
		await database.manager.insert(VirtualThermostatRecoveryEntity, { ...row, configurationRevision: 0 });
		const original = await whole();
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('conflict');
		expect(await whole()).toEqual(original);
		expect(applies).toBe(0);
	});
	it('rejects a detached or forged history turn before its first actual query', async () => {
		const queries = jest.spyOn(database.manager, 'createQueryBuilder');
		await expect(
			service.readRetainedHistoryInManager(
				database.manager,
				Object.freeze({ toJSON: () => Object.freeze({}) }),
				ids.controller,
			),
		).rejects.toBeInstanceOf(Error);
		expect(queries).not.toHaveBeenCalled();
	});

	it('validates all five actual setting bindings as one merged heat/cool/lock intent', async () => {
		expect(
			(
				await settings([
					{ propertyId: properties.heating_setpoint, value: 21 },
					{ propertyId: properties.cooling_setpoint, value: 25 },
					{ propertyId: properties.heating_enabled, value: true },
					{ propertyId: properties.cooling_enabled, value: true },
					{ propertyId: properties.locked, value: false },
				])
			).outcome,
		).toBe('applied');
		expect(await config()).toMatchObject({
			revision: 2,
			requestedMode: 'auto',
			locked: false,
			policy: { heatingSetpoint: 21, coolingSetpoint: 25 },
			comfort: { user_off: false, selected_preset: null },
		});
		expect(await slot()).toMatchObject({ manualHold: true, manualCounter: 2, slotRevision: 2 });
		expect(applies).toBe(1);
	});
	it('retains legacy classification/digest and independent hold when null preset is explicitly selected', async () => {
		const initial = comfort();
		initial.selected_preset = 'comfort';
		initial.automation_baseline = { preset: 'away', setpoints: null, actor_id: 'unowned legacy actor', revision: 1 };
		await database.manager.update(
			VirtualThermostatConfigEntity,
			{ controllerId: ids.controller },
			{ comfort: initial },
		);
		const digest = createHash('sha256').update(climateAutomationCanonical(initial.automation_baseline)).digest('hex');
		await database.manager.update(
			ClimateAutomationSlotEntity,
			{ controllerId: ids.controller },
			{ state: 'LEGACY', legacyDigest: digest, manualHold: true },
		);
		expect((await select(null)).outcome).toBe('applied');
		expect(await slot()).toMatchObject({
			state: 'LEGACY',
			legacyDigest: digest,
			manualHold: true,
			ownerId: null,
			baselineId: null,
			generationId: null,
		});
		expect((await config()).comfort?.automation_baseline).toEqual(initial.automation_baseline);
	});

	it.each([
		{ field: 'id', value: 'not-a-uuid' },
		{ field: 'claimId', value: '' },
		{ field: 'restoredPropertyId', value: 'invalid' },
	])(
		'refuses malformed persisted recovery $field at READ_BEFORE without changing any row',
		async ({ field, value }) => {
			const row = { ...recovery(), [field]: value };
			await database.manager.insert(VirtualThermostatRecoveryEntity, row);
			expect(await database.manager.findOneByOrFail(VirtualThermostatRecoveryEntity, { id: row.id })).toMatchObject({
				[field]: value,
			});
			const original = await whole();
			expect(await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).toEqual({
				outcome: 'conflict',
				reason: 'invalid',
			});
			expect(historyReads).toBe(1);
			expect(validations).toBe(0);
			expect(applies).toBe(0);
			expect(await whole()).toEqual(original);
		},
	);
	it('preserves ordinary historical text with valid recovery UUID identities and MAX counters', async () => {
		const row = {
			...recovery(),
			actorId: 'operator account, not a UUID',
			physicalIdentity: 'retained physical: identity',
			reason: 'ordinary historical reason',
			previousPropertyIdentity: 'previous historical property text',
		};
		await database.manager.insert(VirtualThermostatRecoveryEntity, row);
		const original = (await whole()).recovery;
		expect((await settings([{ propertyId: properties.heating_setpoint, value: 21 }])).outcome).toBe('applied');
		expect(await database.manager.findOneByOrFail(VirtualThermostatRecoveryEntity, { id: row.id })).toEqual(row);
		expect((await whole()).recovery).toEqual(original);
		expect(applies).toBe(1);
	});
	/** Pure codec data validation only: no forged ORM/turn, provider validation or DB authority claim. */
	it.each([
		{ label: 'coerced-array', role: ['heating_enabled'] },
		{ label: 'number', role: 7 },
		{ label: 'null', role: null },
		{ label: 'object', role: { role: 'heating_enabled' } },
	])(
		'pure codec refuses nonstring owned setting role $label while accepting the original legitimate role',
		async ({ role }: { role: unknown }) => {
			const image = thermostatAutomationImage(await manualFreshRows(database.manager, ids.controller));
			if (!image) throw new Error('TEST original persisted image missing');
			const intent = {
				kind: 'manual-settings:v1',
				updates: [{ propertyId: properties.heating_enabled, value: true }],
			} satisfies Parameters<typeof climateAutomationReduceManualIntent>[1];
			expect(climateAutomationReduceManualIntent(image, intent).document.comfort).toMatchObject({
				requestedMode: 'heat',
			});
			const configuration = rec(image.configuration);
			const malformed: ClimateAutomationParticipantImage = {
				...image,
				configuration: climateAutomationJson({
					...configuration,
					settings: array(configuration.settings).map((binding) => {
						const row = rec(binding);
						return row.propertyId === properties.heating_enabled ? { ...row, setting: role } : row;
					}),
				}),
			};
			expect(() => climateAutomationReduceManualIntent(malformed, intent)).toThrow(
				ClimateAutomationParticipantConflict,
			);
		},
	);
});

interface ManualNativeConnection {
	all: (
		this: ManualNativeConnection,
		query: string,
		parameters: unknown[],
		callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
	) => unknown;
}
function isManualNativeConnection(value: unknown): value is ManualNativeConnection {
	return value !== null && typeof value === 'object' && typeof Reflect.get(value, 'all') === 'function';
}

/** Real registered manual-only provider. TEST creator seeds EMPTY; not authoring or installed authority. */
describe('C1b R0 real provider registration and manual-only persistence', () => {
	const key = 'virtual-thermostat:v1';
	const properties = {
		heating_setpoint: 'f0000000-0000-4000-8000-000000000001',
		cooling_setpoint: 'f0000000-0000-4000-8000-000000000002',
		heating_enabled: 'f0000000-0000-4000-8000-000000000003',
		cooling_enabled: 'f0000000-0000-4000-8000-000000000004',
		locked: 'f0000000-0000-4000-8000-000000000005',
	};
	let database: SqliteDataSource, registry: ClimateAutomationRegistryService, writer: ClimateAutomationWriterService;
	let graph: VirtualDependencyGraphService, service: VirtualThermostatAutomationService;
	let instances: VirtualThermostatAutomationService[];
	const comfort = (): ThermostatComfortConfiguration => ({
		heating_range: { minimum: 5, maximum: 30 },
		cooling_range: { minimum: 10, maximum: 35 },
		presets: [
			{ preset: 'comfort', setpoints: { heating_setpoint: 20, cooling_setpoint: 24 } },
			{ preset: 'eco', setpoints: { heating_setpoint: 18, cooling_setpoint: 26 } },
			{ preset: 'away', setpoints: { heating_setpoint: 16, cooling_setpoint: 28 } },
		],
		selected_preset: null,
		user_off: false,
		automation_enabled: false,
		automation_baseline: null,
		temporary_override: null,
	});
	const config = () =>
		database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: ids.controller });
	const slot = () => database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: ids.controller });
	const whole = async () => ({
		config: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId',
		),
		slots: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId',
		),
		sources: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_module_climate_automation_sources ORDER BY generationId',
		),
		graph: await database.manager.query<unknown[]>('SELECT * FROM devices_virtual_graph_revision ORDER BY id'),
		settings: await database.manager.query<unknown[]>(
			'SELECT * FROM devices_virtual_thermostat_settings ORDER BY propertyId',
		),
	});
	const settings = (value = 21, exactRevision?: number) =>
		writer.commitControllerIntentV1({
			providerKey: key,
			controllerId: ids.controller,
			fence:
				exactRevision === undefined
					? { kind: 'current-at-admitted-setting-submission' }
					: { kind: 'exact', controllerRevision: exactRevision, graphRevision: 0 },
			intent: { kind: 'manual-settings:v1', updates: [{ propertyId: properties.heating_setpoint, value }] },
		});
	const select = async (preset: 'comfort' | 'eco' | 'away' | null, clearUserOff = false) =>
		writer.commitControllerIntentV1({
			providerKey: key,
			controllerId: ids.controller,
			fence: { kind: 'exact', controllerRevision: (await config()).revision, graphRevision: 0 },
			intent: { kind: 'manual-preset:v1', preset, clearUserOff },
		});
	const currentProvider = () => {
		const capture = registry.captureProvider(key);
		if (!capture) throw new Error('Missing real R0 registration');
		return capture;
	};
	const freshInstance = () => {
		const next = new VirtualThermostatAutomationService(writer, registry, graph, new ConfigService({ FB_CLI: 'off' }));
		instances.push(next);
		return next;
	};
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		registry = new ClimateAutomationRegistryService();
		writer = new ClimateAutomationWriterService(
			database,
			new DeviceStructureLockService(),
			registry,
			new ConfigService({ FB_CLI: 'off' }),
		);
		graph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), writer);
		instances = [];
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		await database.manager.insert(VirtualDeviceEntity, {
			id: ids.controller,
			name: 'TEST R0 controller',
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
			enabled: true,
		});
		const channels = { heating: randomUUID(), cooling: randomUUID(), thermostat: randomUUID() };
		for (const row of [
			{ id: channels.heating, category: ChannelCategory.HEATER },
			{ id: channels.cooling, category: ChannelCategory.COOLER },
			{ id: channels.thermostat, category: ChannelCategory.THERMOSTAT },
		])
			await database.manager.insert(VirtualChannelEntity, {
				...row,
				device: { id: ids.controller },
				identifier: row.id,
				name: 'TEST setting',
			});
		const bindings: { propertyId: string; setting: ThermostatSetting; contractFingerprint: string }[] = [];
		const names: readonly ThermostatSetting[] = [
			'heating_setpoint',
			'cooling_setpoint',
			'heating_enabled',
			'cooling_enabled',
			'locked',
		];
		for (const setting of names) {
			const numeric = setting === 'heating_setpoint' || setting === 'cooling_setpoint';
			const channelId =
				setting === 'locked'
					? channels.thermostat
					: setting === 'heating_setpoint' || setting === 'heating_enabled'
						? channels.heating
						: channels.cooling;
			await database.manager.insert(VirtualChannelPropertyEntity, {
				id: properties[setting],
				channel: { id: channelId },
				identifier: setting,
				category:
					setting === 'locked' ? PropertyCategory.LOCKED : numeric ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
				dataType: numeric ? DataTypeType.FLOAT : DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				unit: numeric ? '°C' : null,
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
			});
			const property = await database.manager
				.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
				.leftJoinAndSelect('property.channel', 'channel')
				.leftJoinAndSelect('channel.device', 'device')
				.where('property.id = :id', { id: properties[setting] })
				.getOneOrFail();
			if (
				!property.channel ||
				typeof property.channel === 'string' ||
				!property.channel.device ||
				typeof property.channel.device === 'string'
			)
				throw new Error('Missing actual TEST R0 property owner');
			bindings.push({
				propertyId: property.id,
				setting,
				contractFingerprint: thermostatPropertyContract(property, property.channel, property.channel.device),
			});
		}
		// Only TEST absence creation. Production create capability remains unavailable.
		const unavailable = (): never => {
			throw new ClimateAutomationParticipantConflict('unavailable');
		};
		const creator: ClimateAutomationProvider = {
			readControllerInManager: async (manager, controllerId) => {
				const image = thermostatAutomationImage(await manualFreshRows(manager, controllerId));
				return image
					? {
							controllerRevision: image.controllerRevision,
							graphRevision: await graph.revision(manager),
							evidence: climateAutomationJson(image),
							legacyBaseline: image.legacyBaseline,
						}
					: null;
			},
			validateSelectionInManager: unavailable,
			createControllerInManager: async (manager, controllerId) => {
				await manager.insert(VirtualThermostatConfigEntity, {
					controllerId,
					ownerDeviceId: controllerId,
					requestedMode: 'off',
					controlStrategy: 'guarded_branches',
					locked: false,
					comfort: comfort(),
					policy: {
						heatingSetpoint: 20,
						coolingSetpoint: 24,
						coldTolerance: 0.5,
						hotTolerance: 0.5,
						neutralMargin: 1,
						minimumOffMs: 1000,
						changeoverMs: 1000,
						floor: null,
					},
					contactOpeningMs: 0,
					contactClosingMs: 0,
					heuristic: null,
					configuredAt: instant,
					releaseRequestedAt: null,
				});
				for (const binding of bindings)
					await manager.insert(VirtualThermostatSettingEntity, { ...binding, controllerId });
			},
		};
		const owner = registry.registerProviderOwned(key, creator);
		if (!owner) throw new Error('Missing TEST creator registration');
		try {
			expect(
				(
					await writer.runReserved(async (manager, scope) =>
						writer.initializeSlot(manager, scope, {
							providerKey: key,
							controllerId: ids.controller,
							expected: await writer.readSlot(manager, scope, ids.controller),
							configuration: {},
						}),
					)
				).outcome,
			).toBe('applied');
		} finally {
			owner.dispose();
		}
		service = freshInstance();
		service.onModuleInit();
	}, 30_000);
	afterEach(async () => {
		for (const instance of instances) instance.onModuleDestroy();
		registry.onModuleDestroy();
		jest.restoreAllMocks();
		if (database.isInitialized) await database.destroy();
	});

	it('keeps published originals when an unused service method alias is replaced', async () => {
		// The published closure invokes the captured real method, not this later passthrough alias.
		const alias = jest.spyOn(service, 'readInManager');
		expect((await settings()).outcome).toBe('applied');
		expect(alias).not.toHaveBeenCalled();
		expect((await config()).policy.heatingSetpoint).toBe(21);
	});
	it('refuses an absent private slot without GET ensure or controller adoption', async () => {
		await database.manager.delete(ClimateAutomationSlotEntity, { controllerId: ids.controller });
		const before = await whole();
		expect(await settings()).toEqual({ outcome: 'conflict', reason: 'uninitialized' });
		expect(await whole()).toEqual(before);
	});
	it('uses the production registered provider for settings and preset with real CAS and no graph revision', async () => {
		const registered = currentProvider().implementation;
		expect(registered.participantV1?.graph).toBe(graph);
		expect(Object.isFrozen(registered)).toBe(true);
		expect(Object.isFrozen(registered.participantV1)).toBe(true);
		expect(Object.isFrozen(registered.participantV1?.manualIntentV1)).toBe(true);
		expect((await settings()).outcome).toBe('applied');
		expect((await config()).policy.heatingSetpoint).toBe(21);
		expect((await slot()).manualHold).toBe(true);
		expect((await select('eco')).outcome).toBe('applied');
		expect((await config()).comfort?.selected_preset).toBe('eco');
		expect((await slot()).manualHold).toBe(false);
		expect(await graph.revision()).toBe(0);
	});
	it('preserves null comfort through the actual registered settings command and rejects preset', async () => {
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { comfort: null });
		expect((await settings()).outcome).toBe('applied');
		expect((await config()).comfort).toBeNull();
		expect((await slot()).manualHold).toBe(true);
		expect((await select('eco')).outcome).toBe('conflict');
	});
	const presetCases: readonly { preset: 'eco' | null; clear: boolean }[] = [
		{ preset: null, clear: false },
		{ preset: null, clear: true },
		{ preset: 'eco', clear: false },
		{ preset: 'eco', clear: true },
	];
	it.each(presetCases)(
		'keeps requested OFF for registered preset=$preset clearOFF=$clear',
		async ({ preset, clear }) => {
			await settings();
			const row = await config();
			if (!row.comfort) throw new Error('Missing TEST comfort');
			await database.manager.update(
				VirtualThermostatConfigEntity,
				{ controllerId: ids.controller },
				{ comfort: { ...row.comfort, selected_preset: 'comfort', user_off: true } },
			);
			expect((await select(preset, clear)).outcome).toBe('applied');
			const current = await config();
			expect(current.requestedMode).toBe('off');
			expect(current.comfort?.user_off).toBe(!clear);
			expect(current.comfort?.selected_preset).toBe(preset);
			expect((await slot()).manualHold).toBe(preset === null);
		},
	);
	it('keeps an exact full intent noop free of all row and graph churn', async () => {
		await settings();
		const before = await whole();
		const statements: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				statements.push(event.query);
			},
		});
		expect((await settings(21, (await config()).revision)).outcome).toBe('unchanged');
		expect(await whole()).toEqual(before);
		expect(
			statements.filter((query) => /^\s*(INSERT|UPDATE|DELETE)/i.test(query) && !query.includes('WHERE 0')),
		).toEqual([]);
	});
	it('distinguishes stale exact fences from current-at-admitted settings', async () => {
		expect(await settings(21, 2)).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect((await settings(21)).outcome).toBe('applied');
		expect(await settings(22, 1)).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect((await settings(22)).outcome).toBe('applied');
	});
	it('performs fresh provider queries and refuses mismatch with the guarded first image', async () => {
		const before = await whole();
		let reads = 0,
			changed = false;
		database.subscribers.push({
			beforeQuery: async (event) => {
				if (
					/^SELECT/i.test(event.query) &&
					event.query.includes('"devices_virtual_thermostat_configs"') &&
					++reads === 2
				) {
					changed = true;
					await event.queryRunner.manager.update(
						VirtualThermostatConfigEntity,
						{ controllerId: ids.controller },
						{ locked: true },
					);
				}
			},
		});
		expect((await settings()).outcome).toBe('conflict');
		expect(changed).toBe(true);
		expect(await whole()).toEqual(before);
	});
	it('independently rereads actual provider facts instead of borrowing a previous image', async () => {
		const provider = currentProvider().implementation;
		let first: unknown, second: unknown;
		await writer.runReserved(async (manager) => {
			first = await provider.readControllerInManager(manager, ids.controller);
			return [];
		});
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: ids.controller }, { locked: true });
		await writer.runReserved(async (manager) => {
			second = await provider.readControllerInManager(manager, ids.controller);
			return [];
		});
		expect(second).not.toEqual(first);
	});
	it('refuses an absent or invalid singleton without graph fallback or ensure', async () => {
		const provider = currentProvider().implementation;
		await database.manager.delete(VirtualGraphRevisionEntity, { id: 1 });
		expect(
			(
				await writer.runReserved(async (manager) => {
					await provider.readControllerInManager(manager, ids.controller);
					return [];
				})
			).outcome,
		).toBe('conflict');
		expect(await database.manager.count(VirtualGraphRevisionEntity)).toBe(0);
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: -1 });
		expect((await settings()).outcome).toBe('conflict');
		expect((await database.manager.findOneByOrFail(VirtualGraphRevisionEntity, { id: 1 })).revision).toBe(-1);
	});
	it('does not query or ensure slots on registration, repeated init, or missing-controller reads', async () => {
		const before = await whole();
		service.onModuleDestroy();
		const statements: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				statements.push(event.query);
			},
		});
		service = freshInstance();
		service.onModuleInit();
		const capture = currentProvider();
		service.onModuleInit();
		expect(statements).toEqual([]);
		expect(currentProvider().implementation).toBe(capture.implementation);
		await writer.runReserved(async (manager) => {
			expect(await capture.implementation.readControllerInManager(manager, ids.missing)).toBeNull();
			return [];
		});
		expect(await whole()).toEqual(before);
	});
	it('visibly refuses a foreign duplicate and its cleanup cannot dispose the incumbent', async () => {
		const incumbent = currentProvider(),
			duplicate = freshInstance();
		expect(() => duplicate.onModuleInit()).toThrow('registration unavailable');
		duplicate.onModuleDestroy();
		expect(incumbent.isCurrent()).toBe(true);
		expect(currentProvider().implementation).toBe(incumbent.implementation);
		expect((await settings()).outcome).toBe('applied');
	});
	it('keeps destroyed A permanently closed and stale repeated cleanup cannot remove fresh B', async () => {
		const original = currentProvider();
		const sharedDestroy = jest.spyOn(registry, 'onModuleDestroy');
		service.onModuleDestroy();
		expect(original.isCurrent()).toBe(false);
		expect(sharedDestroy).not.toHaveBeenCalled();
		expect(() => service.onModuleInit()).toThrow('destroyed');
		const next = freshInstance();
		next.onModuleInit();
		const replacement = currentProvider();
		service.onModuleDestroy();
		next.onModuleInit();
		expect(original.isCurrent()).toBe(false);
		expect(replacement.isCurrent()).toBe(true);
		expect((await settings()).outcome).toBe('applied');
	});
	it('refuses original A at the native guard after unload while new B stays usable', async () => {
		const before = await whole(),
			original = currentProvider(),
			entered = barrier(),
			release = barrier();
		let first = true;
		database.subscribers.push({
			beforeQuery: async (event) => {
				if (event.query === 'COMMIT' && first) {
					first = false;
					entered.resolve();
					await release.promise;
				}
			},
		});
		const pending = settings().then(
			(result) => ({ result }),
			(error: unknown) => ({ error }),
		);
		let replacement: ReturnType<typeof currentProvider> | undefined;
		try {
			await entered.promise;
			service.onModuleDestroy();
			const next = freshInstance();
			next.onModuleInit();
			replacement = currentProvider();
			expect(original.isCurrent()).toBe(false);
			expect(replacement.isCurrent()).toBe(true);
		} finally {
			release.resolve();
		}
		expect(await pending).toMatchObject({ error: { commitOutcome: 'refused' } });
		expect(await whole()).toEqual(before);
		service.onModuleDestroy();
		expect(replacement?.isCurrent()).toBe(true);
		expect((await settings()).outcome).toBe('applied');
		expect(original.isCurrent()).toBe(false);
	});
	it('refuses unsupported published capabilities synchronously without SQL or positive defaults', () =>
		new Promise<void>((resolve) => {
			const provider = currentProvider().implementation,
				participant = provider.participantV1;
			if (!participant) throw new Error('Missing production participant');
			const statements: string[] = [];
			database.subscribers.push({
				beforeQuery: (event) => {
					statements.push(event.query);
				},
			});
			// Missing arguments are intentional negative input, not a manufactured successful turn.
			expect(() => {
				Reflect.apply(provider.createControllerInManager, provider, []);
			}).toThrow(ClimateAutomationParticipantConflict);
			expect(() => {
				Reflect.apply(provider.validateSelectionInManager, provider, []);
			}).toThrow(ClimateAutomationParticipantConflict);
			expect(() => {
				Reflect.apply(participant.normalizeInManager, participant, []);
			}).toThrow(ClimateAutomationParticipantConflict);
			expect(() => {
				Reflect.apply(participant.planGraphReplacementInManager, participant, []);
			}).toThrow(ClimateAutomationParticipantConflict);
			expect(statements).toEqual([]);
			resolve(undefined);
		}));
	it('resolves the real service with actual writer registry graph in a partial Nest lifecycle', async () => {
		service.onModuleDestroy();
		const module = await Test.createTestingModule({
			providers: [
				VirtualThermostatAutomationService,
				{ provide: ClimateAutomationWriterService, useValue: writer },
				{ provide: ClimateAutomationRegistryService, useValue: registry },
				{ provide: VirtualDependencyGraphService, useValue: graph },
				{ provide: ConfigService, useValue: new ConfigService({ FB_CLI: 'off' }) },
			],
		}).compile();
		try {
			await module.init();
			const resolved = module.get(VirtualThermostatAutomationService);
			instances.push(resolved);
			expect(resolved).toBeInstanceOf(VirtualThermostatAutomationService);
			expect(currentProvider().implementation.participantV1?.graph).toBe(graph);
			expect((await settings()).outcome).toBe('applied');
		} finally {
			await module.close();
		}
		expect(registry.captureProvider(key)).toBeNull();
		// Actual graph bootstrap may query here. This is NOT a full DevicesVirtualPlugin bootstrap claim.
	});
	it('keeps real CLI constructor and partial Nest initialization empty-DB zero I/O', async () => {
		const empty = new SqliteDataSource({ type: 'sqlite', database: ':memory:', synchronize: false, entities: [] });
		const emptyRegistry = new ClimateAutomationRegistryService(),
			cli = new ConfigService({ FB_CLI: 'on' });
		const cliWriter = new ClimateAutomationWriterService(empty, new DeviceStructureLockService(), emptyRegistry, cli);
		const cliGraph = new VirtualDependencyGraphService(empty, cli, cliWriter);
		const query = jest.spyOn(empty, 'query'),
			managerQuery = jest.spyOn(empty.manager, 'query');
		const module = await Test.createTestingModule({
			providers: [
				VirtualThermostatAutomationService,
				{ provide: ClimateAutomationWriterService, useValue: cliWriter },
				{ provide: ClimateAutomationRegistryService, useValue: emptyRegistry },
				{ provide: VirtualDependencyGraphService, useValue: cliGraph },
				{ provide: ConfigService, useValue: cli },
			],
		}).compile();
		try {
			await module.init();
			expect(empty.isInitialized).toBe(false);
			expect(emptyRegistry.captureProvider(key)).toBeNull();
			expect(query).not.toHaveBeenCalled();
			expect(managerQuery).not.toHaveBeenCalled();
		} finally {
			await module.close();
		}
	});
	it('keeps a core-only registry unregistered when the optional plugin is absent', () => {
		const coreOnly = new ClimateAutomationRegistryService();
		expect(coreOnly.captureProvider(key)).toBeNull();
		coreOnly.onModuleDestroy();
	});
});
