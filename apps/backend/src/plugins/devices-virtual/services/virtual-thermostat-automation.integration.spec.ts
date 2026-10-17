import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationParticipant,
	ClimateAutomationParticipantImage,
	ClimateAutomationParticipantTurn,
	ClimateAutomationProvider,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
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
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
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
		service = new VirtualThermostatAutomationService(writer);
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
	});
	afterEach(async () => {
		registry.onModuleDestroy();
		jest.restoreAllMocks();
		await database.destroy();
	});

	it('has zero constructor I/O and real read turns produce no writes/events/revisions/sidecar ensure', async () => {
		const query = jest.spyOn(database.manager, 'query');
		new VirtualThermostatAutomationService(writer);
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
		new VirtualThermostatAutomationService(cliWriter);
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
