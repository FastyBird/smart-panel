import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { IndexVirtualThermostatCommands1000000000035 } from '../../../migrations/1000000000035-IndexVirtualThermostatCommands';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualAggregateOperator } from '../entities/virtual-producer.entity';
import {
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import {
	ThermostatActuationAdapter,
	ThermostatReleaseOrderingEvidence,
	VirtualThermostatTransportService,
} from './virtual-thermostat-transport.service';

jest.setTimeout(30_000);

describe('virtual thermostat durable runtime', () => {
	let directory: string;
	let database: SqliteDataSource;
	let runtime: VirtualThermostatRuntimeService;
	let controllerId: string;
	let sensorId: string;
	let relayId: string;
	let makeRuntime: (
		graph?: VirtualDependencyGraphService,
		aggregate?: VirtualAggregateRuntimeService,
	) => VirtualThermostatRuntimeService;
	let events: EventEmitter2;
	let producers: PropertyProducerRegistryService;
	let values: PropertyValueService;
	let graphValidated: boolean;
	let graphGeneration: number;
	let publicationGate: Promise<void> | null;
	const samples = new Map<string, QualifiedPropertySample>();
	const sends: boolean[] = [];
	const sentTargets: { propertyId: string; on: boolean }[] = [];
	let onGate: Promise<void> | null;
	let offGate: Promise<void> | null;
	let beforeProof: (() => Promise<void>) | null;
	const reconciledCommandIds: string[][] = [];
	let afterOnGate: Promise<void> | null;
	let allowLateOn: boolean;
	let proofAllowed: (propertyId: string) => boolean;
	let proofCalls: number;
	let installedQualifications: Map<string, ThermostatInstalledQualification>;
	let providerCurrent: boolean;
	let proofMutation: (proof: ThermostatReleaseOrderingEvidence) => ThermostatReleaseOrderingEvidence;
	const sample = (id: string, value: number | boolean): void => {
		const at = new Date();
		samples.set(id, {
			propertyId: id,
			value,
			sampledAt: at,
			receivedAt: at,
			provenance: 'live',
			quality: 'good',
			reasons: [],
		});
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-thermostat-runtime-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'runtime.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		samples.clear();
		sends.length = 0;
		sentTargets.length = 0;
		onGate = null;
		offGate = null;
		beforeProof = null;
		reconciledCommandIds.length = 0;
		afterOnGate = null;
		allowLateOn = false;
		proofAllowed = () => true;
		proofMutation = (proof) => proof;
		proofCalls = 0;
		installedQualifications = new Map();
		providerCurrent = true;
		graphValidated = true;
		graphGeneration = 0;
		publicationGate = null;
		events = new EventEmitter2();
		controllerId = uuid();
		sensorId = uuid();
		relayId = uuid();
		const sensorDeviceId = uuid(),
			sensorChannelId = uuid(),
			relayDeviceId = uuid(),
			relayChannelId = uuid();
		await database.manager.insert(VirtualDeviceEntity, {
			id: controllerId,
			name: 'Thermostat',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(DeviceEntity, {
			id: sensorDeviceId,
			name: 'Ambient',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: sensorChannelId,
			device: sensorDeviceId,
			name: 'Temperature',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: sensorId,
			channel: sensorChannelId,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
		} as never);
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: relayDeviceId,
			name: '1PM',
			identifier: 'shellyplus1pm-a8032abe5084',
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: 'A8032ABE5084',
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: relayChannelId,
			device: relayDeviceId,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: relayId,
			channel: relayChannelId,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const sensor = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: sensorId },
			relations: ['channel', 'channel.device'],
		});
		const relay = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const sensorChannel = sensor.channel as ChannelEntity,
			relayChannel = relay.channel as ChannelEntity;
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
			heuristic: null,
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
			releaseRequestedAt: null,
		});
		await database.manager.insert(VirtualThermostatSourceEntity, {
			id: uuid(),
			controllerId,
			role: 'ambient',
			sourcePropertyId: sensorId,
			sourcePropertyIdentity: sensorId,
			physicalIdentity: `property:${sensorId}`,
			contractFingerprint: thermostatPropertyContract(sensor, sensorChannel, sensorChannel.device as DeviceEntity),
			maximumAgeSeconds: 300,
			openValue: null,
			closedValue: null,
		});
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
			id: uuid(),
			controllerId,
			role: 'heating',
			physicalIdentity: thermostatActuatorIdentity(relay, relayChannel, relayChannel.device as DeviceEntity),
			sourcePropertyId: relayId,
			sourcePropertyIdentity: relayId,
			sourceDeviceId: relayDeviceId,
			sourceDeviceIdentity: relayDeviceId,
			contractFingerprint: thermostatPropertyContract(relay, relayChannel, relayChannel.device as DeviceEntity),
			revision: 1,
			state: 'reserved',
			leaseSeconds: 30,
			reason: null,
			releaseRequestedAt: null,
			releasedAt: null,
			releaseEvidence: null,
		});
		sample(sensorId, 21);
		sample(relayId, false);
		producers = new PropertyProducerRegistryService(events);
		values = {
			readQualifiedSample: jest.fn((property: ChannelPropertyEntity) => samples.get(property.id) ?? null),
			publishDerived: jest.fn(
				async (...[property, lease, value, publication]: Parameters<PropertyValueService['publishDerived']>) => {
					const epoch = producers.version(lease);
					if (publicationGate !== null) await publicationGate;
					const changed = producers.commit(
						lease,
						Object.assign(new PropertyValueState(), { value }),
						publication,
						epoch,
					);
					return { changed, state: producers.read(property.id) };
				},
			),
		} as unknown as PropertyValueService;
		const claims = {
			capture: () => ({ isCurrent: () => true }),
			registerRuntimeAdmission: () => () => undefined,
			invalidate: jest.fn(),
			refresh: jest.fn().mockResolvedValue(undefined),
			qualification: (claim: VirtualThermostatActuatorClaimEntity) => {
				if (!installedQualifications.has(claim.physicalIdentity))
					installedQualifications.set(
						claim.physicalIdentity,
						Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
					);
				return installedQualifications.get(claim.physicalIdentity);
			},
			mintAuthority: () => ({}),
			isAuthorized: () => true,
		} as unknown as VirtualThermostatClaimsService;
		const adapter: ThermostatActuationAdapter = {
			canReconcile: () => true,
			send: async (target, _claim, _qualification, isAdmitted) => {
				if (target.property.id === relayId && target.value === true && onGate !== null) await onGate;
				if (target.value === false && offGate !== null) await offGate;
				if (!isAdmitted() && !(target.value === true && allowLateOn))
					return { outcome: 'refused' as const, reasons: ['revoked'] };
				const wasOn = samples.get(target.property.id)?.value === true;
				sends.push(target.value as boolean);
				sentTargets.push({ propertyId: target.property.id, on: target.value as boolean });
				sample(target.property.id, target.value as boolean);
				if (target.property.id === relayId && target.value === true && afterOnGate !== null) await afterOnGate;
				return {
					outcome: 'accepted' as const,
					wasOn,
					outputConfirmed: false as const,
					pendingOnDrained: false as const,
				};
			},
			reconcile: async (target, ids, _off, isCurrent, scope) => {
				proofCalls++;
				reconciledCommandIds.push([...ids]);
				await beforeProof?.();
				const observedAt = new Date();
				if (isCurrent() && proofAllowed(target.property.id)) sample(target.property.id, false);
				return isCurrent() && proofAllowed(target.property.id)
					? proofMutation({
							proofId: uuid(),
							scope,
							observedAt,
							isCurrent,
							sourceIsCurrent: () => providerCurrent,
							physicalIdentity: thermostatActuatorIdentity(target.property, target.channel, target.device) ?? '',
							connectionIdentity: 'ordered-fake-connection',
							coveredCommandIds: ids,
							externalWriterBarrier: true,
							offSample: samples.get(target.property.id),
						})
					: null;
			},
		};
		const transport = { get: () => adapter } as unknown as VirtualThermostatTransportService;
		const graph = {
			isValidated: () => graphValidated,
			capturePublishGuard: () => {
				const generation = graphGeneration;
				return () => graphValidated && generation === graphGeneration;
			},
		} as unknown as VirtualDependencyGraphService;
		makeRuntime = (runtimeGraph = graph, aggregate) =>
			new VirtualThermostatRuntimeService(
				database,
				new DeviceStructureLockService(),
				claims,
				new VirtualThermostatInputsService(database, values, aggregate),
				transport,
				values,
				producers,
				events,
				runtimeGraph,
			);
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		runtime?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const waitForOnJournal = async (): Promise<VirtualThermostatCommandEntity> => {
		for (let attempt = 0; attempt < 6; attempt++) {
			await runtime.inspect(controllerId);
			const command = (await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).find(
				(row) => row.action === 'on',
			);
			if (command?.status === 'dispatching') return command;
		}
		throw new Error('ON did not reach the durable dispatch journal');
	};
	const createTemperatureOutput = async (): Promise<string> => {
		const channelId = uuid(),
			propertyId = uuid();
		await database.manager.insert(VirtualChannelEntity, {
			id: channelId,
			device: controllerId,
			name: 'Current temperature',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: propertyId,
			channel: channelId,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
			valueOrigin: VirtualValueOrigin.LOCAL,
		} as never);
		return propertyId;
	};

	const settle = async (): Promise<void> => {
		for (let attempt = 0; attempt < 5; attempt++) {
			await runtime.flush();
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		}
		await runtime.flush();
	};

	it('loads bounded settled-history witnesses and retains all unresolved identities for lazy drainage', async () => {
		await settle();
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		claim.revision = 2;
		await database.manager.save(claim);
		const retiredClaim = database.manager.create(VirtualThermostatActuatorClaimEntity, {
			...claim,
			id: uuid(),
			state: 'released',
		});
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, retiredClaim);
		const otherClaim = database.manager.create(VirtualThermostatActuatorClaimEntity, {
			...claim,
			id: uuid(),
			role: 'cooling',
			state: 'suspended',
			physicalIdentity: `retired-target:${uuid()}`,
			sourcePropertyId: null,
		});
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, otherClaim);
		const preparedAt = new Date(Date.now() - 60_000);
		const command = (id: string, status: VirtualThermostatCommandEntity['status']) =>
			database.manager.create(VirtualThermostatCommandEntity, {
				id,
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 1,
				action: 'on',
				status,
				preparedAt,
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
		const settled = Array.from({ length: 5000 }, (_, index) => command(uuid(), index % 2 ? 'confirmed' : 'cancelled'));
		for (let offset = 0; offset < settled.length; offset += 50)
			await database.manager.insert(VirtualThermostatCommandEntity, settled.slice(offset, offset + 50));
		const latest = command('ffffffff-ffff-ffff-ffff-ffffffffffff', 'confirmed');
		latest.preparedAt = new Date();
		const tied = command('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'confirmed');
		tied.preparedAt = latest.preparedAt;
		const cancelled = command(uuid(), 'cancelled');
		cancelled.preparedAt = new Date(Date.now() + 1000);
		const pending = ['prepared', 'dispatching', 'accepted', 'unknown'].map((status) =>
			command(uuid(), status as VirtualThermostatCommandEntity['status']),
		);
		pending[1].action = 'off';
		pending[2].claimRevision = 1; // Older revisions still require drainage.
		pending[3].claimId = retiredClaim.id;
		const otherLatest = command(uuid(), 'confirmed');
		otherLatest.claimId = otherClaim.id;
		await database.manager.insert(VirtualThermostatCommandEntity, [latest, tied, cancelled, otherLatest, ...pending]);
		const loader = runtime as unknown as {
			loadDecisionCommands(
				controllerId: string,
				claims: VirtualThermostatActuatorClaimEntity[],
			): Promise<VirtualThermostatCommandEntity[]>;
			loadUnresolvedCommands(controllerId: string, claimId: string): Promise<VirtualThermostatCommandEntity[]>;
		};
		const loaded = await loader.loadDecisionCommands(controllerId, [claim, otherClaim]);
		expect(loaded).toHaveLength(4);
		expect(loaded.map((row) => row.id)).toEqual(
			expect.arrayContaining([latest.id, otherLatest.id, pending[1].id, pending[2].id]),
		);
		expect((await loader.loadUnresolvedCommands(controllerId, claim.id)).map((row) => row.id).sort()).toEqual(
			pending
				.slice(0, 3)
				.map((row) => row.id)
				.sort(),
		);
		expect((await loader.loadUnresolvedCommands(controllerId, retiredClaim.id)).map((row) => row.id)).toEqual([
			pending[3].id,
		]);
		proofAllowed = () => false;
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === claim.id)).toMatchObject({
			pending_on: true,
			release_pending: true,
			release_proven: false,
		});

		const runner = database.createQueryRunner();
		const migration = new IndexVirtualThermostatCommands1000000000035();
		try {
			await migration.down(runner);
			await migration.up(runner);
			const unresolvedPlan = (await runner.query(
				`EXPLAIN QUERY PLAN SELECT * FROM "devices_virtual_thermostat_command_journal"
				 WHERE "controllerId" = ? AND "status" NOT IN ('confirmed', 'cancelled')`,
				[controllerId],
			)) as { detail: string }[];
			const latestPlan = (await runner.query(
				`EXPLAIN QUERY PLAN SELECT * FROM "devices_virtual_thermostat_command_journal"
				 WHERE "controllerId" = ? AND "claimId" = ? AND "action" = 'on' AND "status" <> 'cancelled'
				 ORDER BY "preparedAt" DESC, "decisionRevision" DESC, "id" DESC LIMIT 1`,
				[controllerId, claim.id],
			)) as { detail: string }[];
			expect(unresolvedPlan.map((row) => row.detail).join(' ')).toContain('IDX_virtual_thermostat_commands_unresolved');
			expect(latestPlan.map((row) => row.detail).join(' ')).toContain('IDX_virtual_thermostat_commands_latest_on');
			expect(latestPlan.map((row) => row.detail).join(' ')).not.toContain('TEMP B-TREE');
		} finally {
			await runner.release();
		}
	});

	it('bounds continuous accepted ON history and drains every identity only on qualified OFF', async () => {
		await settle();
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const at = Date.now();
		const command = (status: VirtualThermostatCommandEntity['status']) =>
			database.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 1,
				action: 'on',
				status,
				preparedAt: new Date(at - 1000),
				dispatchedAt: new Date(at - 900),
				settledAt: null,
				proofId: null,
				fault: null,
			});
		const accepted = Array.from({ length: 5000 }, () => command('accepted'));
		for (let offset = 0; offset < accepted.length; offset += 50)
			await database.manager.insert(VirtualThermostatCommandEntity, accepted.slice(offset, offset + 50));
		const internals = runtime as unknown as {
			loadDecisionCommands(
				controllerId: string,
				claims: VirtualThermostatActuatorClaimEntity[],
			): Promise<VirtualThermostatCommandEntity[]>;
			loadUnresolvedCommands(controllerId: string, claimId: string): Promise<VirtualThermostatCommandEntity[]>;
		};
		const fullLoad = jest.spyOn(internals, 'loadUnresolvedCommands');
		await database.manager.update(
			VirtualThermostatCommandEntity,
			{ id: accepted[4999].id },
			{ preparedAt: new Date() },
		);
		sample(sensorId, 18);
		sample(relayId, true);
		await runtime.inspect(controllerId);
		expect(fullLoad).not.toHaveBeenCalled();
		expect((await internals.loadDecisionCommands(controllerId, [claim])).length).toBeLessThanOrEqual(3);
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'accepted' })).toBe(
			5000,
		);

		for (const [predicate, suffix, index] of [
			["action = 'on'", '', 'pending_branch'],
			["action = 'off'", '', 'pending_branch'],
			["action = 'on' AND status = 'unknown'", '', 'pending_branch'],
			["action = 'on' AND dispatchedAt IS NOT NULL", 'ORDER BY dispatchedAt DESC, id DESC', 'pending_dispatch'],
			["fault IS NOT NULL AND fault <> ''", '', 'pending_fault'],
		]) {
			const plan = (await database.query(
				`EXPLAIN QUERY PLAN SELECT * FROM devices_virtual_thermostat_command_journal
				WHERE controllerId = ? AND claimId = ? AND status NOT IN ('confirmed', 'cancelled') AND ${predicate}
				${suffix} LIMIT 1`,
				[controllerId, claim.id],
			)) as unknown as { detail: string }[];
			const detail = plan.map((row) => row.detail).join(' ');
			expect(detail).toContain(`IDX_virtual_thermostat_commands_${index}`);
			expect(detail).not.toContain('TEMP B-TREE');
		}

		const unknown = command('unknown');
		unknown.preparedAt = new Date(at - 2000);
		unknown.fault = 'older_on_execution_unknown';
		const pendingOff = command('unknown');
		pendingOff.action = 'off';
		const newest = command('accepted');
		newest.preparedAt = new Date(Date.now() + 1);
		newest.dispatchedAt = null;
		const lastDispatched = command('accepted');
		lastDispatched.dispatchedAt = new Date(Date.now() + 60_000);
		await database.manager.insert(VirtualThermostatCommandEntity, [unknown, pendingOff, newest, lastDispatched]);
		const witnesses = await internals.loadDecisionCommands(controllerId, [claim]);
		expect(witnesses.length).toBeLessThanOrEqual(6);
		expect(witnesses.map((row) => row.id)).toEqual(
			expect.arrayContaining([unknown.id, pendingOff.id, newest.id, lastDispatched.id]),
		);
		let releaseOff: () => void;
		offGate = new Promise<void>((resolve) => (releaseOff = resolve));
		await runtime.inspect(controllerId);
		expect(fullLoad).not.toHaveBeenCalled();
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('heating_unresolved_on');
		expect(runtime.readDiagnostics(controllerId)?.branches[0]).toMatchObject({
			activity: 'unknown',
			pending_on: true,
			release_pending: true,
			release_proven: false,
			fault: 'older_on_execution_unknown',
		});
		await runtime.inspect(controllerId); // In-flight OFF must not depend on which OFF witness SQL selects.
		expect(
			await database.manager.countBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'off',
				status: 'dispatching',
			}),
		).toBe(1);
		sample(sensorId, 21);
		releaseOff();
		offGate = null;
		await settle();
		expect(fullLoad).toHaveBeenCalled();
		const drained = new Set(reconciledCommandIds.flat());
		expect(accepted.every((row) => drained.has(row.id))).toBe(true);
		expect([unknown, pendingOff, newest, lastDispatched].every((row) => drained.has(row.id))).toBe(true);
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'accepted' })).toBe(
			0,
		);
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId })).toBeGreaterThanOrEqual(
			5005,
		);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
	});

	it('rejects drainage proof that omits a command added while proof I/O is pending', async () => {
		await settle();
		jest.spyOn(runtime, 'request').mockImplementation(() => undefined);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const row = (id: string) =>
			database.manager.create(VirtualThermostatCommandEntity, {
				id,
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 1,
				action: 'on',
				status: 'accepted',
				preparedAt: new Date(),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
		const first = row(uuid()),
			unseen = row(uuid());
		await database.manager.insert(VirtualThermostatCommandEntity, first);
		const internals = runtime as unknown as {
			load(controllerId: string): Promise<unknown>;
			reconcile(context: unknown, claim: VirtualThermostatActuatorClaimEntity): Promise<void>;
		};
		const context = await internals.load(controllerId);
		beforeProof = async () => {
			await database.manager.insert(VirtualThermostatCommandEntity, unseen);
		};
		await internals.reconcile(context, claim);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'accepted',
		);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: unseen.id })).status).toBe(
			'accepted',
		);
		beforeProof = null;
		await internals.reconcile(context, claim);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'confirmed',
		);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: unseen.id })).status).toBe(
			'confirmed',
		);
	});

	it('uses the retained latest ON timestamp for the lease renewal boundary', async () => {
		await settle();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		let now = Date.now();
		const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
		try {
			await database.manager.insert(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 1,
				action: 'on',
				status: 'confirmed',
				preparedAt: new Date(now - claim.leaseSeconds * 500 + 1),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
			sample(sensorId, 18);
			sample(relayId, true);
			await runtime.inspect(controllerId);
			await settle();
			expect(sends.filter(Boolean)).toHaveLength(0);
			now++;
			await runtime.inspect(controllerId);
			await settle();
			expect(sends.filter(Boolean)).toHaveLength(1);
		} finally {
			clock.mockRestore();
		}
	});

	it('cancels ON on an accepted sample between preparation and dispatch then sends ON from a fresh evaluation', async () => {
		await settle();
		const internals = runtime as unknown as {
			dispatch(...args: unknown[]): Promise<void>;
		};
		const dispatch = internals.dispatch.bind(runtime) as (...args: unknown[]) => Promise<void>;
		let cancelledId: string | null = null;
		jest.spyOn(internals, 'dispatch').mockImplementation(async (...args: unknown[]) => {
			const prepared = args[3] as VirtualThermostatCommandEntity;
			if (prepared.action === 'on' && cancelledId === null) {
				cancelledId = prepared.id;
				sample(sensorId, 18);
				events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: sensorId });
			}
			await dispatch(...args);
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		expect(cancelledId).not.toBeNull();
		const cancelled = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: cancelledId });
		expect(cancelled.status).toBe('cancelled');
		expect(cancelled.dispatchedAt).toBeNull();
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		expect(journal.some((row) => row.id !== cancelledId && row.action === 'on' && row.status === 'accepted')).toBe(
			true,
		);
		expect(sends.filter(Boolean)).toHaveLength(1);
	});

	it('ignores a newer cancelled ON after restart while retaining the earlier confirmed ON', async () => {
		await settle();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		await database.manager.insert(
			VirtualThermostatCommandEntity,
			['confirmed', 'cancelled'].map((status, index) => ({
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: index + 1,
				action: 'on' as const,
				status: status as VirtualThermostatCommandEntity['status'],
				preparedAt: new Date(Date.now() - 2000 + index * 1000),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			})),
		);
		runtime.onModuleDestroy();
		sample(sensorId, 18);
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await runtime.inspect(controllerId);
		await settle();
		expect(sends.filter(Boolean)).toHaveLength(1);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].activity).toBe('on');
	});

	it('closes local output and diagnostic authority until a fresh evaluation after graph validation retry', async () => {
		const outputId = await createTemperatureOutput();
		await runtime.inspect(controllerId);
		expect(producers.read(outputId)?.value).toBe(21);
		graphValidated = false;
		graphGeneration++;
		expect(producers.read(outputId)?.producer.reasons).toEqual(['graph_validation_pending']);
		expect(runtime.readDiagnostics(controllerId)?.current_temperature).toBeNull();
		graphValidated = true;
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
		await runtime.inspect(controllerId);
		expect(producers.read(outputId)?.value).toBe(21);
		expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('ready');
	});

	it('rejects a pending output publication captured before a failed graph validation and retry', async () => {
		const originalRequest = runtime.request.bind(runtime) as VirtualThermostatRuntimeService['request'];
		const request = jest.spyOn(runtime, 'request').mockImplementation(() => undefined);
		await runtime.flush();
		const outputId = await createTemperatureOutput();
		request.mockImplementationOnce(originalRequest);
		let release: () => void;
		publicationGate = new Promise<void>((resolve) => (release = resolve));
		const inspection = runtime.inspect(controllerId);
		while (!producers.owns(outputId)) await new Promise<void>((resolve) => setImmediate(resolve));
		graphValidated = false;
		graphGeneration++;
		graphValidated = true;
		release();
		await inspection;
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
		publicationGate = null;
		request.mockRestore();
		await runtime.inspect(controllerId);
		expect(producers.read(outputId)?.producer.quality).toBe('good');
	});

	it('refuses thermostat energizing while graph validation is unavailable', async () => {
		graphValidated = false;
		graphGeneration++;
		sample(sensorId, 18);
		await runtime.inspect(controllerId);
		await runtime.inspect(controllerId);
		expect(sentTargets.some((target) => target.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toEqual(['graph_validation_pending']);
	});

	const finishRestartReconciliation = async (): Promise<void> => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			await runtime.flush();
		}
	};

	it('requires new drainage when installed qualification changes under the same claim identity and revision', async () => {
		await finishRestartReconciliation();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
		installedQualifications.set(
			claim.physicalIdentity,
			Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
		);
		proofAllowed = () => false;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(sentTargets.some((send) => send.on)).toBe(false);
		proofAllowed = () => true;
		await finishRestartReconciliation();
		expect(sentTargets.some((send) => send.on)).toBe(true);
	});
	it('revokes a queued ON after qualification replacement and retains its reservation', async () => {
		let resume: () => void;
		onGate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		installedQualifications.set(
			claim.physicalIdentity,
			Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
		);
		proofAllowed = () => false;
		resume();
		await finishRestartReconciliation();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
		).toBe(1);
	});
	it('revokes the stored release barrier when its stable provider connection lease changes', async () => {
		await finishRestartReconciliation();
		providerCurrent = false;
		proofAllowed = () => false;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(sentTargets.some((send) => send.on)).toBe(false);
	});

	it('accepts a newly admitted provider OFF sample instead of reusing pre-reconciliation timestamps', async () => {
		runtime.onModuleDestroy();
		const old = samples.get(relayId);
		const at = new Date(Date.now() - 5000);
		samples.set(relayId, { ...old, sampledAt: at, receivedAt: at });
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
		expect(samples.get(relayId).receivedAt.getTime()).toBeGreaterThan(at.getTime());
	});
	it.each(['source', 'qualification', 'off_sample', 'config_revision', 'claim_revision'])(
		'rechecks %s evidence at the exclusive journal settlement boundary',
		async (mode) => {
			runtime.onModuleDestroy();
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const command = database.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 1,
				action: 'on',
				status: 'accepted',
				preparedAt: new Date(),
			});
			await database.manager.insert(VirtualThermostatCommandEntity, command);
			runtime = makeRuntime();
			const structure = (runtime as unknown as { structure: DeviceStructureLockService }).structure;
			const exclusive = structure.runExclusive.bind(structure) as DeviceStructureLockService['runExclusive'];
			let proofReady = false;
			proofMutation = (proof) => {
				proofReady = true;
				return proof;
			};
			jest.spyOn(structure, 'runExclusive').mockImplementation(async (operation) => {
				if (proofReady) {
					proofReady = false;
					proofAllowed = () => false;
					if (mode === 'source') providerCurrent = false;
					else if (mode === 'qualification')
						installedQualifications.set(claim.physicalIdentity, {
							...installedQualifications.get(claim.physicalIdentity),
						});
					else if (mode === 'off_sample') sample(relayId, true);
					else if (mode === 'config_revision')
						await database.manager.increment(VirtualThermostatConfigEntity, { controllerId }, 'revision', 1);
					else await database.manager.increment(VirtualThermostatActuatorClaimEntity, { id: claim.id }, 'revision', 1);
				}
				return exclusive(operation);
			});
			await runtime.onApplicationBootstrap();
			await finishRestartReconciliation();
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'accepted',
			);
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
			expect(sentTargets.some((send) => send.on)).toBe(false);
		},
	);
	it.each(['cached', 'retained', 'claim', 'config', 'contract', 'source', 'observation', 'unaccepted'])(
		'rejects %s provider proof and retains the actuator reservation',
		async (mode) => {
			runtime.onModuleDestroy();
			proofCalls = 0;
			proofMutation = (proof) => {
				if (mode === 'cached' || mode === 'retained')
					return {
						...proof,
						offSample: { ...proof.offSample, provenance: mode },
					} as unknown as ThermostatReleaseOrderingEvidence;
				if (mode === 'claim')
					return { ...proof, scope: { ...proof.scope, claimRevision: proof.scope.claimRevision + 1 } };
				if (mode === 'config')
					return { ...proof, scope: { ...proof.scope, controllerRevision: proof.scope.controllerRevision + 1 } };
				if (mode === 'contract') return { ...proof, scope: { ...proof.scope, contractFingerprint: 'wrong' } };
				if (mode === 'source') return { ...proof, isCurrent: () => false };
				if (mode === 'observation') return { ...proof, observedAt: new Date(0) };
				return {
					...proof,
					offSample: { ...proof.offSample, receivedAt: new Date(proof.offSample.receivedAt.getTime() - 1) },
				};
			};
			runtime = makeRuntime();
			await runtime.onApplicationBootstrap();
			await finishRestartReconciliation();
			expect(proofCalls).toBeGreaterThan(0);
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
			expect(
				await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
			).toBe(1);
			expect(sentTargets.some((send) => send.on)).toBe(false);
		},
	);

	it('restarts a prepared ON before transport as unresolved and refuses energizing without drainage proof', async () => {
		onGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		const pending = await waitForOnJournal();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		runtime.onModuleDestroy();
		proofAllowed = () => false;
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		const restored = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: pending.id });
		expect(restored.status).toBe('unknown');
		expect(runtime.readDiagnostics(controllerId)?.branches[0].pending_on).toBe(true);
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
		).toBe(1);
	});

	it('restarts after physical ON acceptance but before journal settlement without treating OFF as drainage', async () => {
		afterOnGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		const pending = await waitForOnJournal();
		expect(samples.get(relayId)?.value).toBe(true);
		runtime.onModuleDestroy();
		proofAllowed = () => false;
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		const restored = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: pending.id });
		expect(restored.status).toBe('unknown');
		expect(runtime.readDiagnostics(controllerId)?.branches[0].pending_on).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
	});

	it('revokes a queued ON when its ambient source disappears during transport authentication', async () => {
		let resumeOn: () => void = () => undefined;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		samples.delete(sensorId);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
	});

	it('blocks an opposed cooling branch across restart until the pending heating ON is drained', async () => {
		runtime.onModuleDestroy();
		const coolingDeviceId = uuid(),
			coolingChannelId = uuid(),
			coolingPropertyId = uuid();
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: coolingDeviceId,
			name: 'Cooling relay',
			identifier: 'shellyplus1pm-a8032abe5099',
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: 'A8032ABE5099',
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: coolingChannelId,
			device: coolingDeviceId,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: coolingPropertyId,
			channel: coolingChannelId,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: coolingPropertyId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
			id: uuid(),
			controllerId,
			role: 'cooling',
			physicalIdentity: thermostatActuatorIdentity(property, channel, channel.device as DeviceEntity),
			sourcePropertyId: coolingPropertyId,
			sourcePropertyIdentity: coolingPropertyId,
			sourceDeviceId: coolingDeviceId,
			sourceDeviceIdentity: coolingDeviceId,
			contractFingerprint: thermostatPropertyContract(property, channel, channel.device as DeviceEntity),
			revision: 1,
			state: 'reserved',
			leaseSeconds: 30,
			reason: null,
			releaseRequestedAt: null,
			releasedAt: null,
			releaseEvidence: null,
		});
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.coolingSetpoint = 24;
		config.requestedMode = 'auto';
		config.revision++;
		await database.manager.save(config);
		sample(coolingPropertyId, false);
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();

		afterOnGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		expect(samples.get(relayId)?.value).toBe(true);
		runtime.onModuleDestroy();
		proofAllowed = (id) => id !== relayId;
		sample(sensorId, 27);
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await runtime.inspect(controllerId);
		expect(
			runtime.readDiagnostics(controllerId)?.branches.find((branch) => branch.role === 'heating')?.pending_on,
		).toBe(true);
		expect(sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)).toBe(false);

		proofAllowed = () => true;
		for (let attempt = 0; attempt < 5; attempt++) {
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)) break;
		}
		expect(sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)).toBe(true);
	});

	it('retains a disabled controller claim and its pending ON until qualified release evidence exists', async () => {
		sample(sensorId, 18);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.flush();
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		}
		expect(samples.get(relayId)?.value).toBe(true);
		const claims = (runtime as unknown as { claims: VirtualThermostatClaimsService }).claims;
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		proofAllowed = () => false;
		await database.manager.update(DeviceEntity, { id: controllerId }, { enabled: false });
		runtime.request(controllerId);
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		expect(claim.state).toBe('releasing');
		expect(config.requestedMode).toBe('off');
		expect(samples.get(relayId)?.value).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(
			await database.manager.countBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'on',
				status: 'accepted',
			}),
		).toBe(1);
	});

	it('revokes ON admission on reconnect until a new ordered release proof is established', async () => {
		sample(sensorId, 18);
		runtime.request(controllerId);
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		}
		expect(sentTargets.filter((send) => send.on)).toHaveLength(1);
		proofAllowed = () => false;
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, { device: { id: controllerId } });
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(sentTargets.filter((send) => send.on)).toHaveLength(1);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('release_ordering_unreconciled');
		proofAllowed = () => true;
		for (let attempt = 0; attempt < 5; attempt++) {
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (sentTargets.filter((send) => send.on).length > 1) break;
		}
		expect(sentTargets.filter((send) => send.on)).toHaveLength(2);
	});

	it('persists release and ON before transport, then releases at the comfort boundary', async () => {
		sample(sensorId, 18);
		runtime.request(controllerId);
		const settle = async () => {
			const operations = () => [...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()];
			for (let attempt = 0; attempt < 5; attempt++) {
				await runtime.flush();
				await Promise.all(operations());
			}
			await runtime.flush();
		};
		await runtime.inspect(controllerId);
		await settle();
		const energized = runtime.readDiagnostics(controllerId);
		expect(energized?.readiness).toBe('ready');
		expect(energized?.branches[0].activity).toBe('on');
		expect(sends).toEqual([false, true]);
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		expect(journal.map((command) => command.action)).toEqual(['off', 'on']);
		expect(journal[0].status).toBe('confirmed');
		expect(journal[1].status).toBe('accepted');

		sample(sensorId, 21);
		runtime.request(controllerId);
		await settle();
		const released = runtime.readDiagnostics(controllerId);
		expect(released?.branches[0].activity).toBe('off');
		expect(released?.branches[0].release_proven).toBe(true);
		expect(sends).toEqual([false, true, false]);
		expect(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).every(
				(command) => command.status === 'confirmed',
			),
		).toBe(true);
	});

	it('retains pending ON and withholds release proof when a delayed ON arrives after OFF', async () => {
		let resumeOn: () => void = () => undefined;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		allowLateOn = true;
		sample(sensorId, 18);
		runtime.request(controllerId);
		let beforeRelease: VirtualThermostatCommandEntity[] = [];
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.inspect(controllerId);
			beforeRelease = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			if (beforeRelease.some((command) => command.action === 'on')) break;
		}
		expect(beforeRelease.some((command) => command.action === 'on' && command.status === 'dispatching')).toBe(true);

		sample(sensorId, 21);
		runtime.request(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		const late = runtime.readDiagnostics(controllerId);
		expect(samples.get(relayId)?.value).toBe(true);
		expect(late?.branches[0].pending_on).toBe(true);
		expect(late?.branches[0].release_proven).toBe(false);
	});

	it('keeps idle SQLite claim retries closed through a recovery fence and revokes earlier admission', async () => {
		runtime.onModuleDestroy();
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const claims = new VirtualThermostatClaimsService(
			database,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(database),
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
			new ConfigService({ FB_CLI: 'off' }),
		);
		try {
			await claims.onApplicationBootstrap();
			const beforeRecovery = claims.capture();
			expect(beforeRecovery.isCurrent()).toBe(true);
			const release = claims.holdRecoveryFence();
			const find = jest
				.spyOn(database.manager, 'find')
				.mockRejectedValueOnce(new Error('temporary SQLite read failure'));
			await expect(claims.refresh()).rejects.toThrow('temporary SQLite read failure');
			expect(claims.capture().isCurrent()).toBe(false);
			expect(jest.getTimerCount()).toBe(1);
			await jest.advanceTimersByTimeAsync(1000);
			expect(find.mock.calls.length).toBeGreaterThanOrEqual(2);
			// Wait for a registry read to settle; the timer alone does not prove SQLite read completion.
			await claims.refresh();
			expect(jest.getTimerCount()).toBe(0);
			const whileHeld = claims.capture();
			expect(whileHeld.isCurrent()).toBe(false);
			expect(whileHeld.isRequestCurrent?.()).toBe(true);
			expect(beforeRecovery.isCurrent()).toBe(false);
			release();
			expect(claims.capture().isCurrent()).toBe(false);
			await claims.refresh();
			expect(claims.capture().isCurrent()).toBe(true);
			expect(whileHeld.isCurrent()).toBe(false);
			expect(beforeRecovery.isCurrent()).toBe(false);
		} finally {
			claims.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('composes three physical temperatures, aggregate quorum, floor release, stale inhibition and strict recovery', async () => {
		runtime.onModuleDestroy();
		const graph = new VirtualDependencyGraphService(database);
		const state = new VirtualProducerStateService(database, producers, graph, events);
		const configs = new VirtualProducerConfigService(database, new DeviceStructureLockService(), graph, events, state);
		const realValues = new PropertyValueService(
			{
				isConnected: () => true,
				writePoints: jest.fn().mockResolvedValue(undefined),
				enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
				flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
				query: jest.fn().mockResolvedValue([]),
			} as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		const aggregate = new VirtualAggregateRuntimeService(
			database,
			producers,
			realValues,
			{
				readLatest: () => Promise.resolve({ status: ConnectionState.CONNECTED }),
			} as unknown as DeviceConnectionStateService,
			graph,
			events,
		);
		const createMeasurement = async (virtual = false) => {
			const deviceId = uuid(),
				channelId = uuid(),
				id = uuid();
			await database.manager.insert(virtual ? VirtualDeviceEntity : DeviceEntity, {
				id: deviceId,
				name: 'Acceptance temperature',
				category: DeviceCategory.SENSOR,
				enabled: true,
				...(virtual ? { mode: VirtualDeviceMode.SENSOR_AGGREGATE } : {}),
			} as never);
			await database.manager.insert(virtual ? VirtualChannelEntity : ChannelEntity, {
				id: channelId,
				device: deviceId,
				name: 'Temperature',
				category: ChannelCategory.TEMPERATURE,
			} as never);
			await database.manager.insert(virtual ? VirtualChannelPropertyEntity : ChannelPropertyEntity, {
				id,
				channel: channelId,
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
				...(virtual ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
			} as never);
			return database.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id },
				relations: ['channel', 'channel.device'],
			});
		};
		try {
			const sources = await Promise.all([createMeasurement(), createMeasurement(), createMeasurement()]);
			const output = await createMeasurement(true);
			const floor = await createMeasurement();
			await configs.configureAggregate(
				output.id,
				Object.assign(new ConfigureVirtualAggregateDto(), {
					expectedRevision: 0,
					operator: VirtualAggregateOperator.MEAN,
					minimumValidInputs: 3,
					maximumAgeSeconds: 10,
					inputs: sources.map((source) => ({ sourcePropertyId: source.id })),
				}),
			);
			const channel = output.channel as ChannelEntity;
			await database.manager.update(
				VirtualThermostatSourceEntity,
				{ controllerId, role: 'ambient' },
				{
					sourcePropertyId: output.id,
					sourcePropertyIdentity: output.id,
					physicalIdentity: `property:${output.id}`,
					contractFingerprint: thermostatPropertyContract(output, channel, channel.device as DeviceEntity),
				},
			);
			const floorChannel = floor.channel as ChannelEntity;
			await database.manager.insert(VirtualThermostatSourceEntity, {
				id: uuid(),
				controllerId,
				role: 'floor',
				sourcePropertyId: floor.id,
				sourcePropertyIdentity: floor.id,
				physicalIdentity: `property:${floor.id}`,
				contractFingerprint: thermostatPropertyContract(floor, floorChannel, floorChannel.device as DeviceEntity),
				maximumAgeSeconds: 10,
				openValue: null,
				closedValue: null,
			});
			const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			config.policy.floor = { limit: 28, recoveryHysteresis: 1 };
			config.revision++;
			await database.manager.save(config);
			await state.onModuleInit();
			await graph.onApplicationBootstrap();
			await aggregate.onApplicationBootstrap();
			const readQualifiedSample = realValues.readQualifiedSample.bind(
				realValues,
			) as PropertyValueService['readQualifiedSample'];
			jest
				.spyOn(realValues, 'readQualifiedSample')
				.mockImplementation((property, maximumAgeMs, now) =>
					property.id === relayId ? (samples.get(relayId) ?? null) : readQualifiedSample(property, maximumAgeMs, now),
				);
			values = realValues;
			runtime = makeRuntime(graph, aggregate);
			await runtime.onApplicationBootstrap();
			const report = async (property: ChannelPropertyEntity, value: number | null) => {
				await realValues.writeSampleWithState(property, value, {
					sampledAt: new Date(Date.now()),
					receivedAt: new Date(Date.now()),
					provenance: 'live',
				});
				await aggregate.flush();
			};
			const settle = async () => {
				runtime.request(controllerId);
				await runtime.inspect(controllerId);
				await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
				await runtime.flush();
			};
			await report(floor, 26);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(producers.read(output.id).value).toBe(18);
			expect(runtime.readDiagnostics(controllerId)?.current_temperature).toBe(18);
			expect(samples.get(relayId)?.value).toBe(true);
			await report(sources[1], null);
			await settle();
			expect(producers.read(output.id).producer.quality).toBe('unavailable');
			expect(samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
			await report(sources[1], 18);
			await settle();
			expect(samples.get(relayId)?.value).toBe(true);
			await report(floor, 28);
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
			await report(floor, 27);
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);
			await report(floor, 26.9);
			await settle();
			expect(samples.get(relayId)?.value).toBe(true);
			jest.useFakeTimers({
				doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
			});
			jest.setSystemTime(Date.now() + 11_000);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('floor_unavailable');
			await report(floor, 26);
			await settle();
			expect(samples.get(relayId)?.value).toBe(true);
		} finally {
			jest.useRealTimers();
			jest.restoreAllMocks();
			runtime.onModuleDestroy();
			aggregate.onModuleDestroy();
			state.onModuleDestroy();
		}
	});

	it('latches a floor-limit release and resumes only below the strict recovery threshold', async () => {
		const floorDeviceId = uuid(),
			floorChannelId = uuid(),
			floorPropertyId = uuid();
		await database.manager.insert(DeviceEntity, {
			id: floorDeviceId,
			name: 'Floor probe',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: floorChannelId,
			device: floorDeviceId,
			name: 'Floor temperature',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: floorPropertyId,
			channel: floorChannelId,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
		} as never);
		const floor = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: floorPropertyId },
			relations: ['channel', 'channel.device'],
		});
		const floorChannel = floor.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatSourceEntity, {
			id: uuid(),
			controllerId,
			role: 'floor',
			sourcePropertyId: floorPropertyId,
			sourcePropertyIdentity: floorPropertyId,
			physicalIdentity: `property:${floorPropertyId}`,
			contractFingerprint: thermostatPropertyContract(floor, floorChannel, floorChannel.device as DeviceEntity),
			maximumAgeSeconds: 300,
			openValue: null,
			closedValue: null,
		});
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.floor = { limit: 28, recoveryHysteresis: 1 };
		config.revision++;
		await database.manager.save(config);
		sample(sensorId, 18);
		sample(floorPropertyId, 28);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(sends).not.toContain(true);

		sample(floorPropertyId, 27);
		runtime.request(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(sends).not.toContain(true);

		sample(floorPropertyId, 26.9);
		runtime.request(controllerId);
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(false);
		expect(sends).toContain(true);
	});

	it('revokes a queued ON when the floor reaches its boundary during transport authentication', async () => {
		const floorDeviceId = uuid(),
			floorChannelId = uuid(),
			floorPropertyId = uuid();
		await database.manager.insert(DeviceEntity, {
			id: floorDeviceId,
			name: 'Floor probe',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: floorChannelId,
			device: floorDeviceId,
			name: 'Floor',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: floorPropertyId,
			channel: floorChannelId,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
		} as never);
		const floor = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: floorPropertyId },
			relations: ['channel', 'channel.device'],
		});
		const floorChannel = floor.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatSourceEntity, {
			id: uuid(),
			controllerId,
			role: 'floor',
			sourcePropertyId: floorPropertyId,
			sourcePropertyIdentity: floorPropertyId,
			physicalIdentity: `property:${floorPropertyId}`,
			contractFingerprint: thermostatPropertyContract(floor, floorChannel, floorChannel.device as DeviceEntity),
			maximumAgeSeconds: 300,
			openValue: null,
			closedValue: null,
		});
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.floor = { limit: 28, recoveryHysteresis: 1 };
		config.revision++;
		await database.manager.save(config);
		let resumeOn: () => void = () => undefined;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		sample(floorPropertyId, 27);
		runtime.request(controllerId);
		await waitForOnJournal();
		sample(floorPropertyId, 28);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('floor_overheat');
	});

	it('keeps a contact unknown until debounced closed and releases immediately on opening', async () => {
		const contactDeviceId = uuid(),
			contactChannelId = uuid(),
			contactPropertyId = uuid();
		await database.manager.insert(DeviceEntity, {
			id: contactDeviceId,
			name: 'Window',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: contactChannelId,
			device: contactDeviceId,
			name: 'Contact',
			identifier: 'contact',
			category: ChannelCategory.CONTACT,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: contactPropertyId,
			channel: contactChannelId,
			identifier: 'detected',
			category: PropertyCategory.DETECTED,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: contactPropertyId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatSourceEntity, {
			id: uuid(),
			controllerId,
			role: 'contact',
			sourcePropertyId: contactPropertyId,
			sourcePropertyIdentity: contactPropertyId,
			physicalIdentity: `property:${contactPropertyId}`,
			contractFingerprint: thermostatPropertyContract(property, channel, channel.device as DeviceEntity),
			maximumAgeSeconds: 300,
			openValue: false,
			closedValue: true,
		});
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.contactClosingMs = 100;
		config.revision++;
		await database.manager.save(config);
		sample(sensorId, 18);
		sample(contactPropertyId, true);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
		expect(sends).not.toContain(true);
		await new Promise((resolve) => setTimeout(resolve, 110));
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		expect(sends).toContain(true);
		config.contactClosingMs = 250;
		config.revision++;
		await database.manager.save(config);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		expect(samples.get(relayId)?.value).toBe(false);
		sample(contactPropertyId, false);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('window_open');
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		expect(samples.get(relayId)?.value).toBe(false);
		samples.delete(contactPropertyId);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
		config.requestedMode = 'off';
		config.policy.heatingSetpoint = 22;
		config.revision++;
		await database.manager.save(config);
		sample(contactPropertyId, true);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		await new Promise((resolve) => setTimeout(resolve, 260));
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.requested_mode).toBe('off');
		expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
		expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('window_open');
		expect(samples.get(relayId)?.value).toBe(false);
	});

	it('retains a heuristic hold but rebaselines trend evidence across quality and user configuration changes', async () => {
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.heuristic = {
			sampleWindowMs: 10_000,
			minimumSamples: 3,
			minimumSpanMs: 1,
			maximumSampleAgeMs: 10_000,
			slopeThresholdCPerMinute: 0.1,
			confirmationMs: 1,
			recoveryMs: 60_000,
			maximumPauseMs: 60_000,
			cooldownMs: 60_000,
		};
		config.revision++;
		await database.manager.save(config);
		for (const temperature of [20, 19, 18, 17]) {
			sample(sensorId, temperature);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await new Promise((resolve) => setTimeout(resolve, 3));
		}
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('suspected_window_open');
		const held = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
		expect(held.heuristicHold?.pausedUntil).toBeGreaterThan(Date.now());
		const degraded = samples.get(sensorId);
		if (!degraded) throw new Error('Missing ambient sample');
		samples.set(sensorId, { ...degraded, quality: 'degraded' });
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		const trendAfterQuality = (runtime as unknown as { trends: Map<string, { frames: unknown[] }> }).trends.get(
			controllerId,
		);
		expect(trendAfterQuality?.frames).toHaveLength(1);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('suspected_window_open');
		config.requestedMode = 'off';
		config.policy.heatingSetpoint = 22;
		config.revision++;
		await database.manager.save(config);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.requested_mode).toBe('off');
		expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toEqual(
			expect.arrayContaining(['user_off', 'suspected_window_open']),
		);
		const trendAfterConfig = (runtime as unknown as { trends: Map<string, { frames: unknown[] }> }).trends.get(
			controllerId,
		);
		expect(trendAfterConfig?.frames).toHaveLength(0);
		runtime.onModuleDestroy();
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		expect(runtime.readDiagnostics(controllerId)?.reasons).toEqual(
			expect.arrayContaining(['user_off', 'suspected_window_open']),
		);
		jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('suspected_window_open');
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('user_off');
		expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
		expect(samples.get(relayId)?.value).toBe(false);
	});
});
