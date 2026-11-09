import { AsyncLocalStorage, createHook } from 'node:async_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { AfterQueryEvent, EntityManager, InsertEvent, TransactionCommitEvent } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createProtectionProbe, memberInstallationSetup } from '../../../../test/support/thermostat-protection-fixture';
import {
	disposeRealThermostatGuardFixtures,
	realThermostatGuardFixture,
	useThermostatPacketClock,
} from '../../../../test/support/thermostat-real-guard-fixture';
import { SqliteDataSource, observeSqliteOuterOutcome } from '../../../common/database/sqlite-data-source';
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
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { DEVICES_SHELLY_NG_TYPE } from '../../devices-shelly-ng/devices-shelly-ng.constants';
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
import { ThermostatInstallationEntity } from '../entities/thermostat-installation.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualAggregateOperator } from '../entities/virtual-producer.entity';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { thermostatInstallationArtifact } from './thermostat-installation-artifact';
import { ThermostatInstallationBindingsService } from './thermostat-installation-bindings.service';
import { ThermostatInstallationLoaderService } from './thermostat-installation-loader.service';
import { ThermostatInstallationService } from './thermostat-installation.service';
import { resolveInstallationSetup } from './thermostat-installation.service';
import { THERMOSTAT_ATTESTATION_KINDS } from './thermostat-installation.types';
import { ThermostatMemberProtectionService } from './thermostat-member-protection.service';
import { resolveThermostatProtectionSource } from './thermostat-protection-source.utils';
import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { ThermostatOwnedDecision, ThermostatRuntimeJournal } from './virtual-thermostat-runtime-ownership';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import {
	ThermostatActuationAdapter,
	ThermostatReleaseOrderingEvidence,
	VirtualThermostatTransportService,
} from './virtual-thermostat-transport.service';

jest.setTimeout(30_000);

describe('virtual thermostat durable runtime', () => {
	let queuedLeafWitness: { variant: string; phase: string; completed: boolean } | undefined;
	const reportQueuedLeafWitness = (): void => {
		const current = queuedLeafWitness;
		queuedLeafWitness = undefined;
		if (!current || current.completed) return;
		try {
			console.error('[queued-leaf-incomplete]', {
				variant: current.variant,
				phase: current.phase,
				completion: 'not-reached',
				settlement: 'UNKNOWN',
			});
		} catch {
			// A diagnostic must not replace the original test or teardown error.
		}
	};
	let directory: string;
	let database: SqliteDataSource;
	let runtime: VirtualThermostatRuntimeService;
	const issuedRuntimes: VirtualThermostatRuntimeService[] = [];
	const issuedClaims: VirtualThermostatClaimsService[] = [];
	const issuedProviders: (() => void)[] = [];
	const issuedGates: (() => void)[] = [];
	const ownedGate = (initialize: (resolve: () => void) => void): Promise<void> =>
		new Promise<void>((resolve) => {
			issuedGates.push(resolve);
			initialize(resolve);
		});
	let transport: VirtualThermostatTransportService;
	let disposeAdapter: () => void;
	let comfort: VirtualThermostatComfortService;
	let configs: VirtualThermostatConfigService;
	let onSent: ((propertyId: string) => void) | null;
	let onQueued: (() => void) | null;
	let controllerId: string;
	let sensorId: string;
	let relayId: string;
	let makeRuntime: (
		graph?: VirtualDependencyGraphService,
		aggregate?: VirtualAggregateRuntimeService,
		transport?: VirtualThermostatTransportService,
	) => VirtualThermostatRuntimeService;
	let events: EventEmitter2;
	let producers: PropertyProducerRegistryService;
	let values: PropertyValueService;
	let graphValidated: boolean;
	let graphGeneration: number;
	let publicationGate: Promise<void> | null;
	const samples = new Map<string, QualifiedPropertySample>();
	const unavailableMembers = new Set<string>();
	const sends: boolean[] = [];
	const sentTargets: { propertyId: string; on: boolean }[] = [];
	const actuationAttempts: boolean[] = [];
	let onOutcome: 'accepted' | 'refused' | 'unknown';
	let offOutcome: 'accepted' | 'refused' | 'unknown';
	let onGate: Promise<void> | null;
	let offGate: Promise<void> | null;
	let beforeProof: (() => Promise<void>) | null;
	const reconciledCommandIds: string[][] = [];
	let afterOnGate: Promise<void> | null;
	let allowLateOn: boolean;
	let acceptedWithoutFeedback: string | null;
	let proofAllowed: (propertyId: string) => boolean;
	let proofCalls: number;
	let installedQualifications: Map<string, ThermostatInstalledQualification>;
	let providerCurrent: boolean;
	let proofMutation: (proof: ThermostatReleaseOrderingEvidence) => ThermostatReleaseOrderingEvidence;
	const protectionProbes = new Set<string>();
	let packetTick: (() => void) | null;
	let parallelWitness: { change: string; stage: string } | undefined;
	let releaseParallelOriginal: (() => void) | undefined;
	const sample = (id: string, value: number | boolean): void => {
		packetTick?.();
		const at = new Date();
		if (id === sensorId) for (const probe of protectionProbes) sample(probe, 20);
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
		protectionProbes.clear();
		packetTick = null;
		parallelWitness = undefined;
		releaseParallelOriginal = undefined;
		unavailableMembers.clear();
		sends.length = 0;
		sentTargets.length = 0;
		actuationAttempts.length = 0;
		onOutcome = 'accepted';
		offOutcome = 'accepted';
		onGate = null;
		onSent = null;
		onQueued = null;
		offGate = null;
		beforeProof = null;
		reconciledCommandIds.length = 0;
		afterOnGate = null;
		allowLateOn = false;
		acceptedWithoutFeedback = null;
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
			write: jest.fn((property: ChannelPropertyEntity, value: number | boolean) => {
				sample(property.id, value);
				return Promise.resolve();
			}),
			readLatest: jest.fn((property: ChannelPropertyEntity) =>
				Promise.resolve(Object.assign(new PropertyValueState(), { value: samples.get(property.id)?.value })),
			),
			captureSampleSourceGuard: () => () => providerCurrent,
			readQualifiedSample: jest.fn((property: ChannelPropertyEntity) =>
				unavailableMembers.has(property.id) ? null : (samples.get(property.id) ?? null),
			),
			readQualifiedSampleSnapshot: jest.fn((property: ChannelPropertyEntity, maxAgeMs: number, now: Date) => {
				const sample = samples.get(property.id);
				return !providerCurrent ||
					unavailableMembers.has(property.id) ||
					!sample ||
					now.getTime() - sample.sampledAt.getTime() > maxAgeMs
					? null
					: sample;
			}),
			readSampleFreshness: jest.fn((property: ChannelPropertyEntity) => {
				const sample = samples.get(property.id);
				return {
					status: sample ? 'fresh' : 'unavailable',
					quality: sample?.quality ?? 'unavailable',
					sampled_at: sample?.sampledAt.toISOString() ?? null,
					age_seconds: sample ? 0 : null,
					expires_at: null,
					reasons: [],
				};
			}),
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
			isQualifiedReleaseWrite: () => false,
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
			contractVersion: 1,
			providerProfile: { id: 'shelly-ng.guarded-switch', version: 1 },
			canReconcile: () => true,
			send: async (target, _claim, _qualification, isAdmitted) => {
				actuationAttempts.push(target.value === true);
				if (target.property.id === relayId && target.value === true && onGate !== null) {
					onQueued?.();
					await onGate;
				}
				if (target.value === false && offGate !== null) await offGate;
				if (!isAdmitted() && !(target.value === true && allowLateOn))
					return { outcome: 'refused' as const, reasons: ['revoked'] };
				const outcome = target.value === true ? onOutcome : offOutcome;
				if (outcome === 'refused') return { outcome, reasons: ['known_no_send'] };
				const wasOn = samples.get(target.property.id)?.value === true;
				sends.push(target.value as boolean);
				sentTargets.push({ propertyId: target.property.id, on: target.value as boolean });
				if (target.value !== true || target.property.id !== acceptedWithoutFeedback)
					sample(target.property.id, target.value as boolean);
				if (target.value === true) onSent?.(target.property.id);
				if (target.property.id === relayId && target.value === true && afterOnGate !== null) await afterOnGate;
				if (outcome === 'unknown') return { outcome, outputConfirmed: false, pendingOnDrained: false };
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
		transport = new VirtualThermostatTransportService(new PlatformRegistryService(), values);
		disposeAdapter = transport.register(DEVICES_SHELLY_NG_TYPE, adapter);
		const nativeGraph = new VirtualDependencyGraphService(database);
		const graph = {
			edges: (manager: EntityManager) => nativeGraph.edges(manager),
			isValidated: () => graphValidated,
			capturePublishGuard: () => {
				const generation = graphGeneration;
				return () => graphValidated && generation === graphGeneration;
			},
		} as unknown as VirtualDependencyGraphService;
		configs = new VirtualThermostatConfigService(
			database,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(database),
			claims,
			events,
			values,
		);
		comfort = new VirtualThermostatComfortService(
			database,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(database),
			claims,
			events,
		);
		makeRuntime = (runtimeGraph = graph, aggregate, runtimeTransport = transport) => {
			const created = new VirtualThermostatRuntimeService(
				database,
				new DeviceStructureLockService(),
				claims,
				new VirtualThermostatInputsService(database, values, aggregate),
				runtimeTransport,
				values,
				producers,
				events,
				runtimeGraph,
				comfort,
				new ConfigService(),
			);
			issuedRuntimes.push(created);
			return created;
		};
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
	});
	afterEach(async () => {
		reportQueuedLeafWitness();
		if (parallelWitness && parallelWitness.stage !== 'complete') {
			const commands = [
				...(
					runtime as unknown as { inFlightCommands: Map<string, VirtualThermostatCommandEntity> }
				).inFlightCommands.values(),
			];
			console.error('parallel-native-phase', {
				...parallelWitness,
				commands: commands.map(({ id, action, status, fault }) => ({ id, action, status, fault })),
				diagnostic: runtime.readDiagnostics(controllerId),
			});
		}
		// Restart scenarios retain older runtime objects and deliberately held transports. Stop every
		// original before releasing fixture gates, then join their actual work before closing SQLite.
		const originals = issuedRuntimes.splice(0);
		for (const original of originals) original.onModuleDestroy();
		releaseParallelOriginal?.();
		for (const release of issuedGates.splice(0)) release();
		await Promise.allSettled(originals.map((original) => original.flush()));
		await Promise.allSettled(
			originals.flatMap((original) => [
				...(original as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values(),
			]),
		);
		await disposeRealThermostatGuardFixtures();
		for (const dispose of issuedProviders.splice(0)) dispose();
		for (const original of issuedClaims.splice(0)) {
			const pending = original['refreshInFlight'];
			original.onModuleDestroy();
			if (pending !== undefined) await pending;
		}
		jest.restoreAllMocks();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const waitForOnJournal = async (): Promise<VirtualThermostatCommandEntity> => {
		for (let attempt = 0; attempt < 6; attempt++) {
			await runtime.inspect(controllerId);
			const command = (await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).find(
				// A sibling may already be accepted; wait for the leaf still queued at dispatch.
				(row) => row.action === 'on' && row.status === 'dispatching',
			);
			if (command) return command;
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

	const comfortFence = async () => {
		const current = await comfort.get(controllerId);
		return { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
	};
	const configureComfort = async () =>
		comfort.configure(controllerId, await comfortFence(), {
			heating_range: { minimum: 10, maximum: 30 },
			cooling_range: null,
			presets: [{ preset: 'comfort', setpoints: { heating_setpoint: 24, cooling_setpoint: null } }],
		});

	describe('read-only member observation diagnostics', () => {
		it('uses the original physical boolean sample and withdraws it at expiry without evaluation or renewed evidence', async () => {
			await settle();
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			const physical = samples.get(relayId),
				original = physical.sampledAt.toISOString(),
				sent = sends.length;
			const liveRead = jest.spyOn(values, 'readQualifiedSample');
			const liveReads = liveRead.mock.calls.length;
			jest.useFakeTimers();
			jest.setSystemTime(physical.sampledAt.getTime() + 29_999);
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: true,
				activity: 'off',
				activity_sampled_at: original,
				activity_expires_at: new Date(physical.sampledAt.getTime() + 30_000).toISOString(),
			});
			jest.setSystemTime(physical.sampledAt.getTime() + 30_000);
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: true,
				activity: 'unknown',
				activity_sampled_at: null,
				activity_expires_at: null,
			});
			expect(samples.get(relayId)).toBe(physical);
			expect(sends).toHaveLength(sent);
			expect(liveRead).toHaveBeenCalledTimes(liveReads);
			jest.useRealTimers();
		});
		it('withdraws qualification and activity when target source lease or graph scope is revoked', async () => {
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches[0].qualification_ready).toBe(true);
			providerCurrent = false;
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: null,
				activity: 'unknown',
				activity_sampled_at: null,
				activity_expires_at: null,
			});
			providerCurrent = true;
			graphValidated = false;
			graphGeneration++;
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: null,
				activity: 'unknown',
				activity_sampled_at: null,
				activity_expires_at: null,
			});
		});
		it('withdraws cached qualification when its captured registry scope is revoked', async () => {
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches[0].qualification_ready).toBe(true);
			const context = (
				runtime as unknown as { contexts: Map<string, { admission: { isCurrent(): boolean } }> }
			).contexts.get(controllerId);
			context.admission = { isCurrent: () => false };
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: null,
				activity: 'unknown',
				activity_sampled_at: null,
				activity_expires_at: null,
			});
		});
		it.each(['quality', 'type', 'identity', 'missing', 'cached', 'future'] as const)(
			'never promotes %s physical feedback to current activity',
			async (fault) => {
				await settle();
				const physical = samples.get(relayId);
				if (fault === 'quality') samples.set(relayId, { ...physical, quality: 'degraded' });
				if (fault === 'type') samples.set(relayId, { ...physical, value: 'false' });
				if (fault === 'identity') samples.set(relayId, { ...physical, propertyId: sensorId });
				if (fault === 'missing') samples.delete(relayId);
				if (fault === 'cached')
					samples.set(relayId, { ...physical, provenance: 'cached' } as unknown as QualifiedPropertySample);
				if (fault === 'future')
					samples.set(relayId, {
						...physical,
						sampledAt: new Date(Date.now() + 1000),
						receivedAt: new Date(Date.now() + 1000),
					});
				expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
					activity: 'unknown',
					activity_sampled_at: null,
					activity_expires_at: null,
				});
			},
		);
		it.each(['context', 'in_flight'] as const)(
			'withholds older OFF feedback after newer %s ON dispatch until actual newer physical feedback',
			async (storage) => {
				await settle();
				const physical = samples.get(relayId);
				const contexts = (
					runtime as unknown as { contexts: Map<string, { commands: VirtualThermostatCommandEntity[] }> }
				).contexts;
				const command = Object.assign(new VirtualThermostatCommandEntity(), {
					id: uuid(),
					claimId: (await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId })).id,
					action: 'on',
					status: 'accepted',
					dispatchedAt: new Date(physical.receivedAt.getTime() + 1),
				});
				if (storage === 'context') contexts.get(controllerId).commands.push(command);
				else
					(
						runtime as unknown as { inFlightCommands: Map<string, VirtualThermostatCommandEntity> }
					).inFlightCommands.set(command.id, command);
				expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
					activity: 'unknown',
					activity_sampled_at: null,
					activity_expires_at: null,
				});
				const at = new Date(Math.max(Date.now(), command.dispatchedAt.getTime()));
				samples.set(relayId, { ...physical, value: true, sampledAt: at, receivedAt: at });
				jest.useFakeTimers();
				jest.setSystemTime(at);
				expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
					activity: 'on',
					activity_sampled_at: at.toISOString(),
					activity_expires_at: new Date(at.getTime() + 30_000).toISOString(),
				});
				jest.useRealTimers();
			},
		);
	});

	it('reconciles and refreshes runtime after a committed comfort mutation whose leading listener threw', async () => {
		await settle();
		await configureComfort();
		const throwing = () => {
			throw new Error('post-commit listener');
		};
		events.prependListener('devices-virtual.thermostat.config.changed', throwing);
		const result = await comfort.select(controllerId, await comfortFence(), 'comfort', false);
		expect(result.configuration.selected_preset).toBe('comfort');
		const committedRevision = result.revision;
		events.off('devices-virtual.thermostat.config.changed', throwing);
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId)).toMatchObject({
			configuration_revision: committedRevision,
			effective_comfort: { source: 'preset', heating_setpoint: 24 },
		});
		expect((await comfort.get(controllerId)).revision).toBe(committedRevision);
		expect(sends).toContain(true);
	});

	it('inhibits a lower-demand override on observable rollback instead of resuming a higher baseline', async () => {
		await settle();
		packetTick = useThermostatPacketClock();
		await configureComfort();
		await settle();
		const wall = Date.now();
		jest.setSystemTime(wall);
		await comfort.override(
			controllerId,
			await comfortFence(),
			{
				preset: null,
				setpoints: { heating_setpoint: 17, cooling_setpoint: null },
				expires_at: new Date(wall + 60_000).toISOString(),
			},
			'operator',
		);
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(sends).not.toContain(true);
		jest.setSystemTime(wall - 1);
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId)).toMatchObject({
			effective_comfort: { source: 'override', heating_setpoint: 17 },
		});
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('comfort_clock_uncertain');
		expect(sends).not.toContain(true);
	});

	it('uses effective preset demand without changing requested settings or bypassing a final ambient guard', async () => {
		await settle();
		await configureComfort();
		let releaseOn: () => void;
		onGate = ownedGate((resolve) => {
			releaseOn = resolve;
		});
		await comfort.select(controllerId, await comfortFence(), 'comfort', false);
		await waitForOnJournal();
		expect(runtime.readDiagnostics(controllerId)).toMatchObject({
			requested_mode: 'heat',
			heating_setpoint: 20,
			effective_comfort: { source: 'preset', preset: 'comfort', heating_setpoint: 24 },
		});
		samples.delete(sensorId);
		releaseOn();
		await settle();
		expect(sends).not.toContain(true);
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('ambient_unavailable');
	});

	it('rejects queued ON at exact override expiry even before a poll recomputes the baseline', async () => {
		await settle();
		await configureComfort();
		let releaseOn: () => void;
		onGate = ownedGate((resolve) => {
			releaseOn = resolve;
		});
		const now = Date.now();
		jest.spyOn(Date, 'now').mockReturnValue(now);
		// Keep preparation inside the monotonic budget; this case isolates the wall-clock expiry boundary.
		jest.spyOn(performance, 'now').mockReturnValue(performance.now());
		await comfort.override(
			controllerId,
			await comfortFence(),
			{
				preset: 'comfort',
				setpoints: null,
				expires_at: new Date(now + 1000).toISOString(),
			},
			'operator',
		);
		await waitForOnJournal();
		jest.spyOn(Date, 'now').mockReturnValue(now + 1000);
		releaseOn();
		await settle();
		expect(sends).not.toContain(true);
		expect((await comfort.get(controllerId)).configuration.temporary_override.status).toBe('expired');
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).effective_comfort).toMatchObject({
			source: 'manual',
			heating_setpoint: 20,
		});
	});

	it('fences a queued preset ON when a newer user OFF revision commits', async () => {
		await settle();
		await configureComfort();
		let releaseOn: () => void;
		onGate = ownedGate((resolve) => {
			releaseOn = resolve;
		});
		await comfort.select(controllerId, await comfortFence(), 'comfort', false);
		await waitForOnJournal();
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.requestedMode = 'off';
		config.comfort.user_off = true;
		config.revision++;
		await database.manager.save(config);
		events.emit('devices-virtual.thermostat.config.changed', controllerId);
		releaseOn();
		await settle();
		expect(sends).not.toContain(true);
		expect(runtime.readDiagnostics(controllerId)).toMatchObject({
			requested_mode: 'off',
			effective_comfort: { source: 'user_off' },
		});
	});

	it('publishes detached binding freshness with the same HTTP and event stamp', async () => {
		const snapshots: {
			epoch: string;
			sequence: number;
			runtime: ReturnType<VirtualThermostatRuntimeService['readDiagnostics']>;
		}[] = [];
		events.on('DevicesVirtualPlugin.Thermostat.RuntimeChanged', (payload: (typeof snapshots)[number]) =>
			snapshots.push(payload),
		);
		void runtime.request(controllerId);
		await settle();
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(snapshots.at(-1)).toMatchObject({
			epoch: diagnostics.epoch,
			sequence: diagnostics.sequence,
			runtime: diagnostics,
		});
		expect(diagnostics.epoch).toEqual(expect.any(String));
		expect(diagnostics.sequence).toBeGreaterThan(0);
		expect(diagnostics.configuration_revision).toBeGreaterThan(0);
		expect(diagnostics.decision_revision).toBeGreaterThan(0);
		expect(diagnostics.inputs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: 'ambient',
					source_property: sensorId,
					maximum_age_seconds: expect.any(Number) as number,
				}),
			]),
		);
		if (diagnostics.inputs.length) diagnostics.inputs[0].reasons.push('caller_mutation');
		expect(runtime.readDiagnostics(controllerId).inputs.flatMap((input) => input.reasons)).not.toContain(
			'caller_mutation',
		);
	});

	it('cancels a known-unsent native decision retirement without poisoning mandatory-member recovery', async () => {
		await addMandatoryMember();
		await afterMemberDrain();
		for (const probe of protectionProbes) sample(probe, 20);
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		const internal = runtime as unknown as { epochs: Map<string, number> };
		let retired = false;
		const subscriber = {
			afterQuery: (event: AfterQueryEvent<unknown>) => {
				if (
					retired ||
					!event.query.startsWith('UPDATE') ||
					!event.query.includes('devices_virtual_thermostat_command_journal') ||
					!event.parameters?.includes('dispatching')
				)
					return;
				retired = true;
				internal.epochs.set(controllerId, (internal.epochs.get(controllerId) ?? 0) + 1);
			},
		};
		database.subscribers.push(subscriber);
		try {
			sample(sensorId, 18);
			await runtime.requestInstalled(controllerId);
			expect(retired).toBe(true);
			const cancelled = await database.manager.findBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'on',
				status: 'cancelled',
			});
			expect(cancelled.length).toBeGreaterThan(0);
			expect(cancelled.every((row) => row.fault === null)).toBe(true);
			expect(
				(await database.manager.find(VirtualThermostatBranchRuntimeEntity)).every((row) => row.fault === null),
			).toBe(true);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
		await settle();
		expectAllMembersOn();
	});

	it.each(['configuration', 'claim_generation', 'source', 'property'] as const)(
		'rolls back native ON admission when an original %s binding changes during command insertion',
		async (changed) => {
			await settle();
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			const rows = async () => ({
				configuration: await database.manager.query<unknown[]>(
					'SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId',
				),
				claims: await database.manager.query<unknown[]>(
					'SELECT * FROM devices_virtual_thermostat_actuator_claims ORDER BY id',
				),
				sources: await database.manager.query<unknown[]>(
					'SELECT * FROM devices_virtual_thermostat_sources ORDER BY id',
				),
				properties: await database.manager.query<unknown[]>(
					'SELECT * FROM devices_module_channels_properties ORDER BY id',
				),
				commands: await database.manager.query<unknown[]>(
					'SELECT * FROM devices_virtual_thermostat_command_journal ORDER BY id',
				),
			});
			const before = await rows();
			let commandId: string | undefined;
			const subscriber = {
				afterInsert: async (event: InsertEvent<VirtualThermostatCommandEntity>) => {
					if (!(event.entity instanceof VirtualThermostatCommandEntity) || event.entity.action !== 'on') return;
					commandId = event.entity.id;
					if (changed === 'configuration')
						await event.manager.update(VirtualThermostatConfigEntity, { controllerId }, { locked: true });
					if (changed === 'claim_generation')
						await event.manager.update(
							VirtualThermostatActuatorClaimEntity,
							{ id: event.entity.claimId },
							{ qualificationGeneration: 'foreign-generation' },
						);
					if (changed === 'source')
						await event.manager.update(
							VirtualThermostatSourceEntity,
							{ controllerId, role: 'ambient' },
							{ maximumAgeSeconds: 100001 },
						);
					if (changed === 'property')
						await event.manager.update(ChannelPropertyEntity, { id: sensorId }, { identifier: 'foreign-source' });
				},
			};
			database.subscribers.push(subscriber);
			try {
				sample(sensorId, 18);
				await runtime.request(controllerId);
				expect(commandId).toEqual(expect.any(String));
				expect(await rows()).toEqual(before);
				expect(sends).not.toContain(true);
				expect(runtime.readDiagnostics(controllerId).reasons).toContain('runtime_error');
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
			}
		},
	);

	it('rolls back the original prepared command when its native postimage is changed by an admitted child', async () => {
		await settle();
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		let commandId: string | undefined;
		const subscriber = {
			afterInsert: async (event: InsertEvent<VirtualThermostatCommandEntity>) => {
				if (!(event.entity instanceof VirtualThermostatCommandEntity) || event.entity.action !== 'on') return;
				commandId = event.entity.id;
				await event.manager.update(
					VirtualThermostatCommandEntity,
					{ id: commandId },
					{ fault: 'foreign child postimage' },
				);
			},
		};
		database.subscribers.push(subscriber);
		try {
			sample(sensorId, 18);
			await runtime.request(controllerId);
			expect(commandId).toEqual(expect.any(String));
			expect(await database.manager.findOneBy(VirtualThermostatCommandEntity, { id: commandId })).toBeNull();
			expect(sends).not.toContain(true);
			expect(runtime.readDiagnostics(controllerId).reasons).toContain('runtime_error');
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
	});

	it.each(['deleted', 'changed'] as const)(
		'never rebirths or overwrites a %s original command after held transport',
		async (change) => {
			await settle();
			let releaseOn: () => void;
			onGate = ownedGate((resolve) => {
				releaseOn = resolve;
			});
			try {
				sample(sensorId, 18);
				const command = await waitForOnJournal();
				const operation = (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.get(command.id);
				expect(operation).toBeDefined();
				// Stop future polling; this does not cancel or replace the original transport completion.
				runtime.onModuleDestroy();
				if (change === 'deleted') await database.manager.delete(VirtualThermostatCommandEntity, { id: command.id });
				else
					await database.manager.update(
						VirtualThermostatCommandEntity,
						{ id: command.id },
						{ fault: 'foreign historical bytes: \u0000é' },
					);
				const before = await database.manager.query<unknown[]>(
					'SELECT * FROM devices_virtual_thermostat_command_journal WHERE id = ?',
					[command.id],
				);
				const rejected = expect(operation).rejects.toThrow('Original thermostat command journal image required');
				releaseOn();
				await rejected;
				expect(
					await database.manager.query<unknown[]>(
						'SELECT * FROM devices_virtual_thermostat_command_journal WHERE id = ?',
						[command.id],
					),
				).toEqual(before);
				expect(sends).not.toContain(true);
			} finally {
				releaseOn?.();
			}
		},
	);

	it.each(['data', 'getter'] as const)(
		'invokes original public send after native journal hold despite call %s',
		async (mutation) => {
			await settle();
			const dispatch = jest.spyOn(transport, 'get');
			let entered: () => void;
			const admitted = new Promise<void>((resolve) => (entered = resolve));
			let release: () => void;
			const held = ownedGate((resolve) => (release = resolve));
			let commandId: string | undefined;
			let original: ThermostatActuationAdapter | undefined;
			let descriptor: PropertyDescriptor | undefined;
			let originalSend: ThermostatActuationAdapter['send'] | undefined;
			let operation: Promise<void> | undefined;
			const replacement = jest.fn().mockResolvedValue({ outcome: 'refused', reasons: ['replacement'] });
			const getter = jest.fn(() => replacement);
			const subscriber = {
				afterInsert: async (event: InsertEvent<VirtualThermostatCommandEntity>) => {
					if (!(event.entity instanceof VirtualThermostatCommandEntity) || event.entity.action !== 'on' || commandId)
						return;
					commandId = event.entity.id;
					original = dispatch.mock.results.at(-1)?.value as ThermostatActuationAdapter;
					entered();
					await held;
				},
			};
			database.subscribers.push(subscriber);
			try {
				sample(sensorId, 18);
				operation = runtime.request(controllerId);
				await admitted;
				expect(original).toBeDefined();
				originalSend = Object.getOwnPropertyDescriptor(original, 'send').value as ThermostatActuationAdapter['send'];
				descriptor = Object.getOwnPropertyDescriptor(originalSend, 'call');
				Object.defineProperty(originalSend, 'call', {
					configurable: true,
					...(mutation === 'data' ? { value: replacement } : { get: getter }),
				});
				expect(Object.getOwnPropertyDescriptor(original, 'send').value).toBe(originalSend);
				release();
				await operation;
				await settle();
				expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: commandId })).toMatchObject(
					{
						action: 'on',
						status: 'accepted',
					},
				);
				expect(sends).toContain(true);
				expect(replacement).not.toHaveBeenCalled();
				expect(getter).not.toHaveBeenCalled();
			} finally {
				release();
				await operation?.catch(() => undefined);
				if (originalSend) {
					if (descriptor) Object.defineProperty(originalSend, 'call', descriptor);
					else Reflect.deleteProperty(originalSend, 'call');
				}
				database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
			}
		},
	);

	it.each(['adapter', 'qualification'] as const)(
		'cancels the original ON when its %s changes during native journal insertion',
		async (replacement) => {
			await settle();
			let originalCommand: string | undefined;
			const subscriber = {
				afterInsert: (event: InsertEvent<VirtualThermostatCommandEntity>) => {
					if (
						!(event.entity instanceof VirtualThermostatCommandEntity) ||
						event.entity.action !== 'on' ||
						originalCommand
					)
						return;
					originalCommand = event.entity.id;
					if (replacement === 'adapter') disposeAdapter();
					else installedQualifications.clear();
				},
			};
			database.subscribers.push(subscriber);
			try {
				sample(sensorId, 18);
				await runtime.request(controllerId);
				await settle();
				expect(originalCommand).toEqual(expect.any(String));
				expect(
					await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: originalCommand }),
				).toMatchObject({
					action: 'on',
					status: 'cancelled',
					dispatchedAt: null,
				});
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
			}
		},
	);

	it('ends an expired OFF operation without a self-sustaining immediate retry loop', async () => {
		await settle();
		const prior = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'off' });
		const priorAttempts = [...actuationAttempts];
		const capture = transport.capture.bind(transport) as VirtualThermostatTransportService['capture'];
		jest.spyOn(transport, 'capture').mockImplementation((target, claim, qualification) => {
			const original = transport.get(target, claim);
			const captured = capture(target, claim, qualification);
			disposeAdapter();
			disposeAdapter = transport.register(DEVICES_SHELLY_NG_TYPE, original);
			return captured;
		});
		sample(relayId, true);
		await runtime.request(controllerId);
		await settle();
		const commands = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'off' });
		expect(commands).toHaveLength(prior.length + 1);
		expect(commands.filter((command) => prior.some((old) => old.id === command.id))).toEqual(prior);
		expect(commands.filter((command) => !prior.some((old) => old.id === command.id))).toEqual([
			expect.objectContaining({ status: 'cancelled', dispatchedAt: null }),
		]);
		expect(actuationAttempts).toEqual(priorAttempts);
	});

	it('installation request joins its original command outcome while an unrelated later decision remains held', async () => {
		await settle();
		let releaseOn: () => void, enteredOn: () => void;
		onGate = ownedGate((resolve) => (releaseOn = resolve));
		const queued = new Promise<void>((resolve) => (enteredOn = resolve));
		onQueued = enteredOn;
		sample(sensorId, 18);
		const original = runtime.requestInstalled(controllerId);
		let completed = false;
		void original.then(() => (completed = true));
		await queued;
		await runtime.flush();
		expect(completed).toBe(false);
		const command = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
			controllerId,
			action: 'on',
			status: 'dispatching',
		});
		const internal = runtime as unknown as { evaluate(id: string): Promise<void> };
		const evaluate = internal.evaluate.bind(internal) as (id: string) => Promise<void>;
		let releaseLater: () => void, enteredLater: () => void;
		const held = ownedGate((resolve) => (releaseLater = resolve));
		const started = new Promise<void>((resolve) => (enteredLater = resolve));
		jest.spyOn(internal, 'evaluate').mockImplementationOnce(async (id) => {
			enteredLater();
			await held;
			await evaluate(id);
		});
		const later = runtime.request(controllerId, false);
		let laterCompleted = false;
		void later.then(() => (laterCompleted = true));
		try {
			await started;
			releaseOn();
			await original;
			expect(completed).toBe(true);
			expect(laterCompleted).toBe(false);
			expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).toMatchObject({
				status: 'accepted',
				settledAt: expect.any(Date) as Date,
			});
			expect(sends).toContain(true);
		} finally {
			releaseOn();
			releaseLater();
			await later;
			await settle();
		}
	});

	it('joins the original queued ON and native outcome without joining a later decision', async () => {
		await settle();
		let releaseOn: () => void;
		let enteredOn: () => void;
		onGate = ownedGate((resolve) => (releaseOn = resolve));
		const queued = new Promise<void>((resolve) => (enteredOn = resolve));
		onQueued = enteredOn;
		sample(sensorId, 18);
		const decision = runtime.request(controllerId);
		await queued;
		await decision;
		const command = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
			controllerId,
			action: 'on',
			status: 'dispatching',
		});
		const original = runtime.capturePredecessors(controllerId);
		let joined = false;
		void original.then(() => (joined = true));
		const internal = runtime as unknown as { evaluate(id: string): Promise<void> };
		const evaluate = internal.evaluate.bind(internal) as (id: string) => Promise<void>;
		let releaseLater: () => void;
		let enteredLater: () => void;
		const held = new Promise<void>((resolve) => (releaseLater = resolve));
		const started = new Promise<void>((resolve) => (enteredLater = resolve));
		jest.spyOn(internal, 'evaluate').mockImplementationOnce(async (id) => {
			enteredLater();
			await held;
			await evaluate(id);
		});
		const later = runtime.request(controllerId, false);
		let laterSettled = false;
		void later.then(() => (laterSettled = true));
		try {
			await started;
			expect(joined).toBe(false);
			releaseOn();
			await original;
			expect(laterSettled).toBe(false);
			expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).toMatchObject({
				status: 'cancelled',
				fault: 'revoked',
				settledAt: expect.any(Date) as Date,
			});
			expect(sends).not.toContain(true);
		} finally {
			releaseOn();
			releaseLater();
			await original;
			await later;
		}
	});

	it('returns the exact decision completion without joining a later request', async () => {
		await settle();
		const internal = runtime as unknown as { evaluate(id: string): Promise<void> };
		const evaluate = internal.evaluate.bind(internal) as (id: string) => Promise<void>;
		let release: () => void;
		let entered: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		const started = new Promise<void>((resolve) => (entered = resolve));
		jest
			.spyOn(internal, 'evaluate')
			.mockImplementationOnce(evaluate)
			.mockImplementationOnce(async (id) => {
				entered();
				await held;
				await evaluate(id);
			});
		const original = runtime.request(controllerId, false);
		const later = runtime.request(controllerId, false);
		let laterSettled = false;
		void later.then(() => (laterSettled = true));
		try {
			await started;
			await original;
			expect(laterSettled).toBe(false);
		} finally {
			release();
			await later;
		}
	});

	it('cancels known-unsent ON without a command loop and retries on the poll and a fresh sample', async () => {
		await settle();
		runtime.onModuleDestroy();
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate'] });
		try {
			runtime = makeRuntime();
			await runtime.onApplicationBootstrap();
			await settle();
			onOutcome = 'refused';
			sample(sensorId, 18);
			void runtime.request(controllerId);
			await settle();
			const onCommands = () => database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(await onCommands()).toEqual([expect.objectContaining({ status: 'cancelled', fault: 'known_no_send' })]);
			expect(sends).not.toContain(true);
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('heating_unresolved_on');
			await settle();
			expect(await onCommands()).toHaveLength(1);
			jest.advanceTimersByTime(999);
			await settle();
			expect(await onCommands()).toHaveLength(1);
			jest.advanceTimersByTime(1);
			await settle();
			expect(await onCommands()).toHaveLength(2);
			expect((await onCommands()).every((command) => command.status === 'cancelled')).toBe(true);
			expect(actuationAttempts.filter(Boolean)).toHaveLength(2);
			onOutcome = 'accepted';
			sample(sensorId, 18);
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: sensorId });
			await settle();
			expect(await onCommands()).toHaveLength(3);
			expect((await onCommands()).filter((command) => command.status === 'accepted')).toHaveLength(1);
			expect(sends.filter(Boolean)).toEqual([true]);
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('heating_unresolved_on');
			expect(runtime.readDiagnostics(controllerId)?.branches[0].activity).toBe('on');
		} finally {
			runtime.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('retains a potentially sent ON as unknown and immediately attempts mandatory OFF', async () => {
		await settle();
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		onOutcome = 'unknown';
		proofAllowed = () => false;
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' })).toEqual([
			expect.objectContaining({ status: 'unknown', fault: 'command_execution_unknown' }),
		]);
		expect(sends).toEqual([false, true, false]);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('heating_unresolved_on');
		expect(runtime.readDiagnostics(controllerId)?.branches[0]).toMatchObject({
			pending_on: true,
			release_proven: false,
		});
	});

	it('retains a refused OFF and its releasing claim until qualified release proof exists', async () => {
		await settle();
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(samples.get(relayId)?.value).toBe(true);
		offOutcome = 'refused';
		proofAllowed = () => false;
		await database.manager.update(VirtualThermostatActuatorClaimEntity, { controllerId }, { state: 'releasing' });
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId }, { requestedMode: 'off' });
		void runtime.request(controllerId);
		await settle();
		expect(
			await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'off', status: 'unknown' }),
		).toEqual([expect.objectContaining({ fault: 'known_no_send' })]);
		expect((await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId })).state).toBe(
			'releasing',
		);
		expect(samples.get(relayId)?.value).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.branches[0]).toMatchObject({
			release_pending: true,
			release_proven: false,
		});
		expect(actuationAttempts).toEqual([false, true, false]);
	});

	const inspectDecisionWitnesses = async (claimIds: string[]): Promise<VirtualThermostatCommandEntity[]> => {
		const originalRuntime = runtime;
		const originalController = controllerId;
		const known = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId: originalController });
		const target = originalRuntime as unknown as {
			loadDecisionCommands(
				id: string,
				claims: VirtualThermostatActuatorClaimEntity[],
			): Promise<VirtualThermostatCommandEntity[]>;
		};
		const original = target.loadDecisionCommands.bind(target) as typeof target.loadDecisionCommands;
		const observed: VirtualThermostatCommandEntity[][] = [];
		const observer = jest.spyOn(target, 'loadDecisionCommands').mockImplementation(async (...args) => {
			const rows = await original(...args);
			if (args[0] === originalController) observed.push(structuredClone(rows));
			return rows;
		});
		try {
			await originalRuntime.inspect(originalController);
		} finally {
			observer.mockRestore();
		}
		expect(observed.length).toBeGreaterThan(0);
		const actual = observed[0];
		expect(new Set(actual.map((row) => row.id)).size).toBe(actual.length);
		let bound = 0;
		for (const claimId of claimIds) {
			const candidates = known.filter((row) => row.claimId === claimId);
			const pending = candidates.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled');
			const latest = candidates
				.filter((row) => row.action === 'on' && row.status !== 'cancelled')
				.sort(
					(a, b) =>
						b.preparedAt.getTime() - a.preparedAt.getTime() ||
						b.decisionRevision - a.decisionRevision ||
						(a.id < b.id ? 1 : a.id === b.id ? 0 : -1),
				);
			const dispatched = pending
				.filter((row) => row.action === 'on' && row.dispatchedAt !== null)
				.sort(
					(a, b) => b.dispatchedAt.getTime() - a.dispatchedAt.getTime() || (a.id < b.id ? 1 : a.id === b.id ? 0 : -1),
				);
			const required = [
				latest.slice(0, 1),
				pending.filter((row) => row.action === 'on'),
				pending.filter((row) => row.action === 'off'),
				pending.filter((row) => row.action === 'on' && row.status === 'unknown'),
				dispatched.slice(0, 1),
				pending.filter((row) => row.fault !== null && row.fault !== ''),
			].filter((rows) => rows.length > 0);
			bound += required.length;
			for (const universe of required)
				expect(actual.some((row) => universe.some((candidate) => candidate.id === row.id))).toBe(true);
			for (const row of actual.filter((row) => row.claimId === claimId))
				expect(required.some((universe) => universe.some((candidate) => candidate.id === row.id))).toBe(true);
		}
		for (const row of actual) {
			expect(row.controllerId).toBe(originalController);
			expect(claimIds).toContain(row.claimId);
			expect(row).toEqual(known.find((candidate) => candidate.id === row.id));
		}
		expect(actual.length).toBeLessThanOrEqual(bound);
		return actual;
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
			loadUnresolvedCommands(controllerId: string, claimId: string): Promise<VirtualThermostatCommandEntity[]>;
		};
		proofAllowed = () => false;
		// Check the exact seeded unresolved set before public evaluation can issue its own remedial OFF.
		expect((await loader.loadUnresolvedCommands(controllerId, claim.id)).map((row) => row.id).sort()).toEqual(
			pending
				.slice(0, 3)
				.map((row) => row.id)
				.sort(),
		);
		expect((await loader.loadUnresolvedCommands(controllerId, retiredClaim.id)).map((row) => row.id)).toEqual([
			pending[3].id,
		]);
		const loaded = await inspectDecisionWitnesses([claim.id, otherClaim.id]);
		expect(loaded).toHaveLength(4);
		expect(loaded.map((row) => row.id)).toEqual(expect.arrayContaining([latest.id, otherLatest.id, pending[1].id]));
		expect((await loader.loadUnresolvedCommands(controllerId, claim.id)).map((row) => row.id)).toEqual(
			expect.arrayContaining(pending.slice(0, 3).map((row) => row.id)),
		);
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
		const firstWitnesses = await inspectDecisionWitnesses([claim.id]);
		expect(fullLoad).not.toHaveBeenCalled();
		expect(firstWitnesses.length).toBeLessThanOrEqual(3);
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
		let releaseOff: () => void;
		offGate = ownedGate((resolve) => (releaseOff = resolve));
		const witnesses = await inspectDecisionWitnesses([claim.id]);
		expect(witnesses.length).toBeLessThanOrEqual(6);
		expect(witnesses.map((row) => row.id)).toEqual(
			expect.arrayContaining([unknown.id, pendingOff.id, newest.id, lastDispatched.id]),
		);
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
		// Isolate each original installation decision from independent poll/feedback requests.
		jest.spyOn(runtime, 'request').mockResolvedValue(undefined);
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
		// The real decision first issues and joins remedial OFF; its acceptance alone cannot drain the ON.
		await runtime.requestInstalled(controllerId);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'accepted',
		);
		expect(
			await database.manager.countBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'off',
				status: 'accepted',
			}),
		).toBeGreaterThan(0);
		beforeProof = async () => {
			await database.manager.insert(VirtualThermostatCommandEntity, unseen);
		};
		await runtime.requestInstalled(controllerId);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'accepted',
		);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: unseen.id })).status).toBe(
			'accepted',
		);
		beforeProof = null;
		await runtime.requestInstalled(controllerId);
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
		void runtime.request(controllerId);
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
		publicationGate = ownedGate((resolve) => (release = resolve));
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
		void runtime.request(controllerId);
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(sentTargets.some((send) => send.on)).toBe(false);
		proofAllowed = () => true;
		await finishRestartReconciliation();
		expect(sentTargets.some((send) => send.on)).toBe(true);
	});
	it('revokes a queued ON after qualification replacement and retains its reservation', async () => {
		let resume: () => void;
		onGate = ownedGate((resolve) => {
			resume = resolve;
		});
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
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
	it.each([
		['journal', 'source'],
		['journal', 'qualification'],
		['journal', 'off_sample'],
		['branch', 'source'],
		['branch', 'qualification'],
		['branch', 'off_sample'],
	])('rolls back %s settlement if %s changes during its awaited write', async (stage, mode) => {
		await settle();
		runtime.onModuleDestroy();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const oldBranch = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, {
			claimId: claim.id,
		});
		const qualification = installedQualifications.get(claim.physicalIdentity);
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
		const createRunner = database.createQueryRunner.bind(database) as typeof database.createQueryRunner;
		const watched = new WeakSet<object>();
		let invalidated = false;
		let settlingProofId: string | null = null;
		proofMutation = (proof) => {
			settlingProofId = proof.proofId;
			return proof;
		};
		const hook = jest.spyOn(database, 'createQueryRunner').mockImplementation((...parameters) => {
			const runner = createRunner(...parameters);
			if (!watched.has(runner)) {
				watched.add(runner);
				const query = runner.query.bind(runner) as typeof runner.query;
				jest.spyOn(runner, 'query').mockImplementation(async (...args: Parameters<typeof runner.query>) => {
					const result: unknown = await query(...args);
					const table =
						stage === 'journal'
							? 'devices_virtual_thermostat_command_journal'
							: 'devices_virtual_thermostat_branch_runtime';
					if (
						!invalidated &&
						typeof args[0] === 'string' &&
						Array.isArray(args[1]) &&
						args[0].startsWith(`UPDATE "${table}"`) &&
						(stage === 'branch'
							? !!settlingProofId && args[1]?.includes(settlingProofId)
							: args[1]?.includes('confirmed'))
					) {
						invalidated = true;
						proofAllowed = () => false;
						if (mode === 'source') providerCurrent = false;
						else if (mode === 'qualification')
							installedQualifications.set(claim.physicalIdentity, { ...qualification });
						else sample(relayId, true);
					}
					return result;
				});
			}
			return runner;
		});
		try {
			runtime = makeRuntime();
			await runtime.onApplicationBootstrap();
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			await settle();
			expect(invalidated).toBe(true);
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'accepted',
			);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id }))
					.releaseProofId,
			).toBe(oldBranch.releaseProofId);
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
			expect((runtime as unknown as { reconciled: Map<string, unknown> }).reconciled.size).toBe(0);
		} finally {
			hook.mockRestore();
		}
		providerCurrent = true;
		installedQualifications.set(claim.physicalIdentity, qualification);
		sample(relayId, false);
		proofAllowed = () => true;
		void runtime.request(controllerId);
		await settle();
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
			'confirmed',
		);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
	});
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

	it.each(['none', 'changed_before', 'command_postimage', 'branch_postimage'] as const)(
		'settles the entire original pending command set or rolls back %s corruption',
		async (corruption) => {
			await settle();
			runtime.onModuleDestroy();
			await runtime.flush();
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const commands = [0, 1].map((index) =>
				database.manager.create(VirtualThermostatCommandEntity, {
					id: uuid(),
					controllerId,
					claimId: claim.id,
					claimRevision: claim.revision,
					configurationRevision: 1,
					decisionRevision: 800 + index,
					action: 'on',
					status: 'unknown',
					preparedAt: new Date('2026-01-02T03:04:05.123Z'),
					dispatchedAt: null,
					settledAt: null,
					proofId: null,
					fault: `original ${index}: \u0000é`,
				}),
			);
			await database.manager.insert(VirtualThermostatCommandEntity, commands);
			const journal = new ThermostatRuntimeJournal(database, new DeviceStructureLockService());
			await journal.capturePending(database.manager, commands, controllerId, claim.id);
			if (corruption === 'changed_before')
				await database.manager.update(
					VirtualThermostatCommandEntity,
					{ id: commands[0].id },
					{ fault: 'changed before proof' },
				);
			const rows = async () => ({
				commands: await database.manager.query<Record<string, unknown>[]>(
					'SELECT * FROM devices_virtual_thermostat_command_journal ORDER BY id',
				),
				branches: await database.manager.query<Record<string, unknown>[]>(
					'SELECT * FROM devices_virtual_thermostat_branch_runtime ORDER BY claimId',
				),
			});
			const before = await rows();
			if (corruption === 'command_postimage')
				await database.manager.query(`CREATE TEMP TRIGGER settlement_corruption AFTER UPDATE OF status
					ON devices_virtual_thermostat_command_journal WHEN NEW.status = 'confirmed'
					BEGIN UPDATE devices_virtual_thermostat_command_journal SET fault = 'foreign' WHERE id = NEW.id; END`);
			if (corruption === 'branch_postimage')
				await database.manager.query(`CREATE TEMP TRIGGER settlement_corruption AFTER UPDATE OF releaseProofId
					ON devices_virtual_thermostat_branch_runtime
					BEGIN UPDATE devices_virtual_thermostat_branch_runtime SET fault = 'foreign' WHERE claimId = NEW.claimId; END`);
			const settledAt = new Date('2026-02-03T04:05:06.789Z');
			try {
				const operation = journal.runNative(async (manager) => {
					if (!(await journal.confirmPending(manager, commands, controllerId, claim.id, 'original-proof', settledAt)))
						return false;
					const branch = await manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
					await journal.captureRuntimeRow(manager, branch);
					branch.releaseProofId = 'original-proof';
					await journal.writeRuntimeRows(manager, [branch]);
					return true;
				});
				if (corruption === 'none') {
					await expect(operation).resolves.toBe(true);
					expect(await rows()).toEqual({
						commands: before.commands.map((row) =>
							commands.some((command) => command.id === row.id)
								? { ...row, status: 'confirmed', proofId: 'original-proof', settledAt: '2026-02-03 04:05:06.789' }
								: row,
						),
						branches: before.branches.map((row) =>
							row.claimId === claim.id ? { ...row, releaseProofId: 'original-proof' } : row,
						),
					});
				} else {
					if (corruption === 'changed_before') await expect(operation).resolves.toBe(false);
					else await expect(operation).rejects.toThrow('Original thermostat command journal image required');
					expect(await rows()).toEqual(before);
				}
			} finally {
				await database.manager.query('DROP TRIGGER IF EXISTS settlement_corruption');
			}
		},
	);

	it.each([
		['state', 'deleted'],
		['state', 'changed'],
		['branch', 'deleted'],
		['branch', 'changed'],
	] as const)('never rebirths or overwrites a %s row %s after the original decision read', async (kind, change) => {
		await settle();
		runtime.onModuleDestroy();
		await runtime.flush();
		const state = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const branch = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
		const journal = new ThermostatRuntimeJournal(database, new DeviceStructureLockService());
		await journal.captureRuntimeRow(database.manager, state);
		await journal.captureRuntimeRow(database.manager, branch);
		state.decisionRevision++;
		branch.releaseAttempts++;
		if (kind === 'state') {
			if (change === 'deleted') await database.manager.delete(VirtualThermostatRuntimeEntity, { controllerId });
			else
				await database.manager.update(
					VirtualThermostatRuntimeEntity,
					{ controllerId },
					{ reasons: ['foreign \u0000é'] },
				);
		} else {
			if (change === 'deleted')
				await database.manager.delete(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
			else
				await database.manager.update(
					VirtualThermostatBranchRuntimeEntity,
					{ claimId: claim.id },
					{ fault: 'foreign \u0000é' },
				);
		}
		const rows = async () => ({
			state: await database.manager.query<unknown[]>(
				'SELECT * FROM devices_virtual_thermostat_runtime ORDER BY controllerId',
			),
			branches: await database.manager.query<unknown[]>(
				'SELECT * FROM devices_virtual_thermostat_branch_runtime ORDER BY claimId',
			),
			commands: await database.manager.query<unknown[]>(
				'SELECT * FROM devices_virtual_thermostat_command_journal ORDER BY id',
			),
		});
		const before = await rows();
		await expect(journal.persistRuntimeRows([state, branch])).rejects.toThrow(
			'Original thermostat command journal image required',
		);
		expect(await rows()).toEqual(before);
	});

	it.each(['none', 'command', 'branch', 'membership'] as const)(
		'restart retains exact original rows and atomically refuses %s postimage corruption',
		async (corruption) => {
			await settle();
			runtime.onModuleDestroy();
			await runtime.flush();
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const pending = database.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 731,
				action: 'on',
				status: 'prepared',
				preparedAt: new Date('2026-01-02T03:04:05.123Z'),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: 'original bytes: \u0000é',
			});
			await database.manager.insert(VirtualThermostatCommandEntity, pending);
			const rows = async () => ({
				commands: await database.manager.query<Record<string, unknown>[]>(
					'SELECT * FROM devices_virtual_thermostat_command_journal ORDER BY id',
				),
				branches: await database.manager.query<Record<string, unknown>[]>(
					'SELECT * FROM devices_virtual_thermostat_branch_runtime ORDER BY claimId',
				),
				claims: await database.manager.query<Record<string, unknown>[]>(
					'SELECT * FROM devices_virtual_thermostat_actuator_claims ORDER BY id',
				),
			});
			const before = await rows();
			const sendsBefore = [...sentTargets];
			const mutations = {
				command: `UPDATE devices_virtual_thermostat_command_journal SET proofId = 'foreign' WHERE id = NEW.id;`,
				branch: `UPDATE devices_virtual_thermostat_branch_runtime SET fault = 'foreign' WHERE claimId = NEW.claimId;`,
				membership: `DELETE FROM devices_virtual_thermostat_branch_runtime WHERE claimId = NEW.claimId;`,
			};
			if (corruption !== 'none')
				await database.manager.query(`CREATE TEMP TRIGGER restart_corruption AFTER UPDATE OF status
					ON devices_virtual_thermostat_command_journal WHEN NEW.status = 'unknown'
					BEGIN ${mutations[corruption]} END`);
			try {
				const operation = new ThermostatRuntimeJournal(database, new DeviceStructureLockService()).restart();
				if (corruption === 'none') {
					await operation;
					expect(await rows()).toEqual({
						commands: before.commands.map((row) =>
							row.status === 'prepared' || row.status === 'dispatching'
								? { ...row, status: 'unknown', fault: 'restart_requires_release_reconciliation' }
								: row,
						),
						branches: before.branches.map((row) => ({
							...row,
							activity: 'unknown',
							releaseAttempts: 0,
							nextReleaseAt: null,
						})),
						claims: before.claims,
					});
				} else {
					await expect(operation).rejects.toThrow('Original thermostat command journal image required');
					expect(await rows()).toEqual(before);
				}
				expect(sentTargets).toEqual(sendsBefore);
			} finally {
				await database.manager.query('DROP TRIGGER IF EXISTS restart_corruption');
			}
		},
	);

	it('restarts a prepared ON before transport as unresolved and refuses energizing without drainage proof', async () => {
		onGate = ownedGate(() => undefined);
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
		afterOnGate = ownedGate(() => undefined);
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await waitForOnJournal();
		samples.delete(sensorId);
		void runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
	});

	const addMandatoryMember = async (role: 'heating' | 'cooling' = 'heating', mac = 'A8032ABE5099'): Promise<string> => {
		const deviceId = uuid(),
			channelId = uuid(),
			propertyId = uuid();
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: deviceId,
			name: 'Cooling relay',
			identifier: 'shellyplus1pm-' + mac.toLowerCase(),
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: mac,
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: channelId,
			device: deviceId,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: propertyId,
			channel: channelId,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: propertyId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
			id: uuid(),
			controllerId,
			role,
			physicalIdentity: thermostatActuatorIdentity(property, channel, channel.device as DeviceEntity),
			sourcePropertyId: propertyId,
			sourcePropertyIdentity: propertyId,
			sourceDeviceId: deviceId,
			sourceDeviceIdentity: deviceId,
			contractFingerprint: thermostatPropertyContract(property, channel, channel.device as DeviceEntity),
			revision: 1,
			state: 'reserved',
			leaseSeconds: 30,
			reason: null,
			releaseRequestedAt: null,
			releasedAt: null,
			releaseEvidence: null,
		});
		sample(propertyId, false);
		if (role === 'heating') {
			const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			config.policy.floor = { limit: 30, recoveryHysteresis: 2 };
			await database.manager.save(config);
			const members = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
				controllerId,
				role: 'heating',
			});
			for (const member of members) {
				if (await database.manager.findOneBy(ThermostatMemberProtectionEntity, { claimId: member.id })) continue;
				const probe = await createProtectionProbe(database, member.sourcePropertyId);
				const source = await resolveThermostatProtectionSource(
					database.manager,
					probe.sourceId,
					member.physicalIdentity,
				);
				protectionProbes.add(probe.sourceId);
				await database.manager.insert(ThermostatMemberProtectionEntity, {
					claimId: member.id,
					schemaVersion: 1,
					kind: 'local_floor',
					revision: 1,
					sourcePropertyId: probe.sourceId,
					sourcePropertyIdentity: probe.sourceId,
					physicalPropertyIdentity: probe.physicalId,
					contractFingerprint: source.fingerprint,
					maximumAgeSeconds: 5,
				});
			}
			for (const member of members) {
				const binding = await new ThermostatInstallationBindingsService().resolve(database.manager, member.id);
				const setup = resolveInstallationSetup(memberInstallationSetup(), binding);
				const row = database.manager.create(ThermostatInstallationEntity, {
					claimId: member.id,
					revision: 1,
					controllerId,
					physicalIdentity: member.physicalIdentity,
					claimRevision: member.revision,
					configurationRevision: config.revision,
					bindingFingerprint: binding.fingerprint,
					setup,
					attestations: [],
					updatedBy: 'offline-fixture',
					updatedAt: new Date(),
					armedAt: null,
					revokedAt: null,
					lastMachineObservation: null,
				});
				const artifact = thermostatInstallationArtifact(row, binding);
				row.expectedScriptHash = artifact.sourceHash;
				row.artifactSource = artifact.source;
				await database.manager.save(row);
			}
			const protection = (runtime as unknown as { memberProtection: ThermostatMemberProtectionService })
				.memberProtection;
			protection.read(await protection.load(config, members), Date.now() - 1);
			for (const probe of protectionProbes) sample(probe, 20);
		}
		return propertyId;
	};

	const afterMemberDrain = async () => {
		for (let phase = 0; phase < 2; phase++) {
			void runtime.request(controllerId, false);
			await settle();
		}
		expect(
			runtime
				.readDiagnostics(controllerId)
				.branches.every((branch) => branch.release_proven && !branch.pending_on && branch.activity === 'off'),
		).toBe(true);
		// Recovery is a later receiver observation, not a same-millisecond retained value.
		await new Promise<void>((resolve) => setTimeout(resolve, 2));
	};
	const settleReal = async (fixture: Awaited<ReturnType<typeof realThermostatGuardFixture>>) => {
		for (let phase = 0; phase < 5; phase++) {
			await fixture.flushTelemetry();
			await settle();
		}
		// Consume the last settled all-leaf proof and publish its current diagnostics before new recovery reports.
		void runtime.request(controllerId, false);
		await fixture.flushTelemetry();
		await settle();
	};
	const expectAllMembersOn = () => {
		const diagnostic = runtime.readDiagnostics(controllerId);
		expect(diagnostic.branches.every((branch) => branch.activity === 'on') ? true : diagnostic).toBe(true);
	};
	const useRealGuard = async () => {
		runtime.onModuleDestroy();
		const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications);
		for (const [id, sample] of samples) await fixture.report(id, sample.value as number | boolean);
		values = fixture.values;
		runtime = makeRuntime(undefined, undefined, fixture.transport);
		await runtime.onApplicationBootstrap();
		return fixture;
	};
	const useNativeClaimsGuard = async (withSlot = false) => {
		await settle();
		runtime.onModuleDestroy();
		const structure = new DeviceStructureLockService();
		const registry = new ClimateAutomationRegistryService();
		const ledger = new ClimateAutomationLedgerService(database, structure, registry);
		const graph = new VirtualDependencyGraphService(database, undefined, ledger);
		const provider = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
		issuedProviders.push(() => {
			provider.onModuleDestroy();
			registry.onModuleDestroy();
		});
		provider.onModuleInit();
		await graph.onApplicationBootstrap();
		const claims = new VirtualThermostatClaimsService(
			database,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
			new ConfigService({ FB_CLI: 'off' }),
		);
		issuedClaims.push(claims);
		await claims.onApplicationBootstrap();
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		comfort = new VirtualThermostatComfortService(database, structure, graph, claims, events, provider);
		if (withSlot) {
			const current = await comfort.get(controllerId);
			await comfort.configure(
				controllerId,
				{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
				{
					automation_enabled: true,
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
		}
		const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications);
		for (const qualification of installedQualifications.values()) claims.recordQualification(qualification);
		for (const [id, sample] of samples) await fixture.report(id, sample.value as number | boolean);
		values = fixture.values;
		runtime = new VirtualThermostatRuntimeService(
			database,
			structure,
			claims,
			new VirtualThermostatInputsService(database, values),
			fixture.transport,
			values,
			producers,
			events,
			graph,
			comfort,
			new ConfigService({ FB_CLI: 'off' }),
		);
		issuedRuntimes.push(runtime);
		await runtime.onApplicationBootstrap();
		return { fixture, claims };
	};

	const useRegisteredNativeClaimsGuard = async () => {
		const native = await useNativeClaimsGuard(true);
		await settleReal(native.fixture);
		const previous = runtime,
			automation = comfort['automation'];
		if (automation === undefined) throw new Error('Original comfort automation provider missing');
		previous.onModuleDestroy();
		runtime = new VirtualThermostatRuntimeService(
			database,
			previous['structure'],
			native.claims,
			previous['inputs'],
			native.fixture.transport,
			native.fixture.values,
			producers,
			events,
			previous['graph'],
			comfort,
			new ConfigService({ FB_CLI: 'off' }),
			undefined,
			automation,
		);
		issuedRuntimes.push(runtime);
		await runtime.onApplicationBootstrap();
		await settleReal(native.fixture);
		return native;
	};

	it.each(['before-send', 'after-send'] as const)(
		'preserves the original managed SDK %s outcome while comfort selection holds its first native read',
		async (boundary) => {
			const { fixture, claims } = await useRegisteredNativeClaimsGuard();
			const owner = runtime,
				source = database,
				originalComfort = comfort,
				id = controllerId,
				output = relayId;
			clearInterval(owner['timer']);
			const expected = await comfortFence();
			let enterOn!: () => void,
				releaseOn!: () => void,
				observe!: () => void,
				enterRead!: () => void,
				releaseRead!: () => void;
			const onEntered = ownedGate((resolve) => (enterOn = resolve));
			const onResume = ownedGate((resolve) => (releaseOn = resolve));
			const observed = ownedGate((resolve) => (observe = resolve));
			const readEntered = ownedGate((resolve) => (enterRead = resolve));
			const readResume = ownedGate((resolve) => (releaseRead = resolve));
			const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
			const heldSends: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
			const get = fixture.transport.get.bind(fixture.transport) as VirtualThermostatTransportService['get'];
			const observer = jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
				const adapter = get(...args);
				if (!adapter) return null;
				const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
				return {
					...adapter,
					send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
						const original = send(...sendArgs);
						if (sendArgs[0].property.id === output && sendArgs[0].value === true) {
							heldSends.push(sendArgs);
							void original.then(
								(result) => {
									outcomes.push(result);
									observe();
								},
								() => observe(),
							);
						}
						return original;
					},
				};
			});
			const installedGet = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
			const key = boundary === 'before-send' ? 'beforeOn' : 'afterOn';
			const previousGate = fixture.controls[key];
			const gate = async (property: string) => {
				if (property !== output) return;
				enterOn();
				await onResume;
			};
			fixture.controls[key] = gate;
			const roots = new AsyncLocalStorage<object>();
			const root = Object.freeze({ owner, source, controllerId: id });
			let armed = true;
			const reader = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (
						!armed ||
						roots.getStore() !== root ||
						!event.query.startsWith('SELECT') ||
						!event.query.includes('devices_virtual_thermostat_configs') ||
						!event.parameters?.includes(id)
					)
						return;
					armed = false;
					enterRead();
					await readResume;
				},
			};
			let operation: Promise<void> | undefined;
			let mutation: ReturnType<VirtualThermostatComfortService['select']> | undefined;
			let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
			const attempt = (action: () => void): void => {
				try {
					action();
				} catch (cause) {
					cleanupFailure ??= { cause };
				}
			};
			try {
				await fixture.report(sensorId, 18);
				await onEntered;
				await owner.flush();
				expect(heldSends).toHaveLength(1);
				const selected = heldSends[0];
				const commandId = selected[4].commandId;
				const claim = selected[1];
				expect(claim).toMatchObject({ controllerId: id, sourcePropertyId: output, sourcePropertyIdentity: output });
				expect(selected[3]()).toBe(true);
				const before = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				const held = before.find((row) => row.id === commandId);
				expect(held).toMatchObject({
					id: commandId,
					controllerId: id,
					claimId: claim.id,
					claimRevision: claim.revision,
					configurationRevision: expected.expected_revision,
					action: 'on',
					status: 'dispatching',
					dispatchedAt: expect.any(Date) as Date,
					settledAt: null,
					fault: null,
				});
				const priorOn = before.filter((row) => row.action === 'on' && row.id !== commandId);
				for (const row of before.filter((row) => row.action === 'on'))
					expect(row).toMatchObject({
						controllerId: id,
						claimId: claim.id,
						claimRevision: claim.revision,
						configurationRevision: expected.expected_revision,
						action: 'on',
					});
				for (const row of priorOn)
					expect(row).toMatchObject({
						status: 'cancelled',
						dispatchedAt: null,
						settledAt: null,
						fault: null,
						proofId: null,
					});
				operation = owner['inFlight'].get(commandId);
				expect(operation).toBeDefined();
				if (operation === undefined) throw new Error('Original managed ON operation missing');
				const admission = claims.capture();
				expect(admission.isCurrent()).toBe(true);
				const fences = [...fixture.controls.fences];
				expect(fixture.controls.sends.filter((send) => send.property === output)).toHaveLength(
					boundary === 'before-send' ? 0 : 1,
				);
				source.subscribers.push(reader);
				mutation = roots.run(root, () => originalComfort.select(id, expected, 'eco', false));
				void mutation.catch(() => undefined);
				// Actual provider/runtime registration revokes this original command at entry, before the first SQL read.
				expect(selected[3]()).toBe(false);
				expect(admission.isCurrent()).toBe(true); // Current contract fences the controller, not unrelated claims globally.
				await readEntered;
				expect(owner['active']).toBe(true);
				releaseOn();
				await observed;
				expect(outcomes).toHaveLength(1);
				if (boundary === 'before-send') expect(outcomes[0]).toMatchObject({ outcome: 'refused' });
				else expect(outcomes[0]).toEqual({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
				expect(owner['active']).toBe(true); // Native refusal/uncertainty precedes lifecycle cleanup.
				expect(fixture.controls.sends.filter((send) => send.property === output)).toHaveLength(
					boundary === 'before-send' ? 0 : 1,
				);
				expect(fixture.controls.fences).toEqual(fences);
				owner.onModuleDestroy();
				releaseRead();
				const response = await mutation;
				await operation; // Join original journal completion only after its held native read releases.
				const after = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				expect(heldSends).toHaveLength(1);
				expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
				for (const row of before.filter((row) => row.id !== commandId))
					expect(after.find((entry) => entry.id === row.id)).toEqual(row);
				expect(after.find((row) => row.id === commandId)).toMatchObject({
					...held,
					status: boundary === 'before-send' ? 'cancelled' : 'unknown',
					settledAt: expect.any(Date) as Date,
					fault: expect.any(String) as string,
				});
				expect(response.effective.preset).toBe('eco');
				expect(fixture.controls.fences).toEqual(fences);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				primary = { cause };
			} finally {
				attempt(() => owner.onModuleDestroy());
				let stopping: ReturnType<typeof fixture.stopManaged> | undefined;
				attempt(() => {
					stopping = fixture.stopManaged();
				});
				attempt(releaseRead);
				attempt(releaseOn);
				const completions = await Promise.allSettled([
					...(stopping !== undefined ? [stopping] : []),
					...(mutation !== undefined ? [mutation] : []),
					...(operation !== undefined ? [operation] : []),
				]);
				for (const result of completions) if (result.status === 'rejected') cleanupFailure ??= { cause: result.reason };
				const index = source.subscribers.indexOf(reader);
				if (index >= 0) source.subscribers.splice(index, 1);
				attempt(() => {
					if (fixture.controls[key] !== gate) throw new Error('Foreign managed ON gate retained');
					fixture.controls[key] = previousGate;
				});
				attempt(() => {
					const actualGet = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
					if (
						!installedGet ||
						!actualGet ||
						actualGet.value !== installedGet.value ||
						actualGet.get !== installedGet.get ||
						actualGet.set !== installedGet.set ||
						actualGet.writable !== installedGet.writable ||
						actualGet.enumerable !== installedGet.enumerable ||
						actualGet.configurable !== installedGet.configurable
					)
						throw new Error('Foreign managed transport descriptor retained');
					observer.mockRestore();
				});
			}
			if (primary !== undefined) throw primary.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		},
	);

	it('reads native qualification diagnostics without installation or events and withdraws the original revoked admission', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		clearInterval(owner['timer']);
		const rows = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId });
		expect(rows.length).toBeGreaterThan(0);
		const context = owner['contexts'].get(controllerId);
		expect(context).toBeDefined();
		if (context === undefined) throw new Error('Original native diagnostic context missing');
		const admission = context.admission;
		expect(admission.isCurrent()).toBe(true);
		for (const row of rows) expect(claims.qualification(row, false)).not.toBeNull();
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		const sendsBefore = [...fixture.controls.sends];
		const capture = jest.spyOn(claims, 'capture');
		const install = jest.spyOn(claims, 'recordQualification');
		const refresh = jest.spyOn(claims, 'refresh');
		const request = jest.spyOn(owner, 'request');
		const installed = jest.spyOn(owner, 'requestInstalled');
		const emit = jest.spyOn(events, 'emit');
		const queries: string[] = [];
		const observer = {
			beforeQuery: (event: { query: string }) => {
				queries.push(event.query);
			},
		};
		database.subscribers.push(observer);
		try {
			for (const row of rows)
				expect(owner.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === row.id)).toMatchObject({
					qualification_ready: true,
				});
			expect(admission.isCurrent()).toBe(true);
			claims.revokeAllQualifications();
			expect(admission.isCurrent()).toBe(false);
			for (const row of rows)
				expect(owner.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === row.id)).toMatchObject({
					qualification_ready: null,
					activity: 'unknown',
					activity_sampled_at: null,
					activity_expires_at: null,
				});
			expect(owner['contexts'].get(controllerId)).toBe(context);
			expect(context.admission).toBe(admission);
			expect(capture).not.toHaveBeenCalled();
			expect(install).not.toHaveBeenCalled();
			expect(refresh).not.toHaveBeenCalled();
			expect(request).not.toHaveBeenCalled();
			expect(installed).not.toHaveBeenCalled();
			expect(emit).not.toHaveBeenCalled();
			expect(queries).toEqual([]);
			expect(fixture.controls.sends).toEqual(sendsBefore);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			for (const spy of [capture, install, refresh, request, installed, emit]) spy.mockRestore();
		}
		expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(journal);
	});

	it('keeps native missing qualification unavailable and the original admission closed through qualification absence ABA', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		clearInterval(owner['timer']);
		claims.revokeAllQualifications();
		await owner.requestInstalled(controllerId); // Capture a genuine new context while qualification is absent.
		const context = owner['contexts'].get(controllerId);
		expect(context).toBeDefined();
		if (context === undefined) throw new Error('Original absent-qualification context missing');
		const admission = context.admission;
		expect(admission.isCurrent()).toBe(true);
		const rows = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId });
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) expect(claims.qualification(row, false)).toBeNull();
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		const sendsBefore = [...fixture.controls.sends];
		const capture = jest.spyOn(claims, 'capture');
		const refresh = jest.spyOn(claims, 'refresh');
		const request = jest.spyOn(owner, 'request');
		const installed = jest.spyOn(owner, 'requestInstalled');
		const emit = jest.spyOn(events, 'emit');
		const queries: string[] = [];
		const observer = {
			beforeQuery: (event: { query: string }) => {
				queries.push(event.query);
			},
		};
		database.subscribers.push(observer);
		try {
			for (const row of rows)
				expect(
					owner.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === row.id)?.qualification_ready,
				).toBeNull();
			expect(admission.isCurrent()).toBe(true);
			for (const evidence of installedQualifications.values()) claims.recordQualification(evidence);
			for (const row of rows) expect(claims.qualification(row, false)).not.toBeNull();
			expect(admission.isCurrent()).toBe(false);
			for (const row of rows)
				expect(owner.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === row.id)).toMatchObject({
					qualification_ready: null,
					activity: 'unknown',
					activity_sampled_at: null,
					activity_expires_at: null,
				});
			claims.revokeAllQualifications();
			for (const row of rows) expect(claims.qualification(row, false)).toBeNull();
			expect(admission.isCurrent()).toBe(false);
			for (const row of rows)
				expect(owner.readDiagnostics(controllerId)?.branches.find((branch) => branch.claim === row.id)).toMatchObject({
					qualification_ready: null,
					activity: 'unknown',
					activity_sampled_at: null,
					activity_expires_at: null,
				});
			expect(owner['contexts'].get(controllerId)).toBe(context);
			expect(context.admission).toBe(admission);
			expect(capture).not.toHaveBeenCalled();
			expect(refresh).not.toHaveBeenCalled();
			expect(request).not.toHaveBeenCalled();
			expect(installed).not.toHaveBeenCalled();
			expect(emit).not.toHaveBeenCalled();
			expect(queries).toEqual([]);
			expect(fixture.controls.sends).toEqual(sendsBefore);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			for (const spy of [capture, refresh, request, installed, emit]) spy.mockRestore();
		}
		expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(journal);
	});

	const useLockedNativeClaimsGuard = async () => {
		await settle();
		runtime.onModuleDestroy();
		const temperatureOutput = await createTemperatureOutput();
		const native = await useNativeClaimsGuard();
		await settleReal(native.fixture);
		const previous = runtime;
		previous.onModuleDestroy();
		await native.fixture.dispose();
		const locks = new PropertyValueLockService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		expect(locks.isEnabled()).toBe(true);
		const fixture = await realThermostatGuardFixture(
			database,
			events,
			producers,
			installedQualifications,
			'managed',
			locks,
		);
		for (const qualification of installedQualifications.values()) native.claims.recordQualification(qualification);
		for (const [id, sample] of samples) await fixture.report(id, sample.value as number | boolean);
		values = fixture.values;
		runtime = new VirtualThermostatRuntimeService(
			database,
			previous['structure'],
			native.claims,
			new VirtualThermostatInputsService(database, values),
			fixture.transport,
			values,
			producers,
			events,
			previous['graph'],
			comfort,
			new ConfigService({ FB_CLI: 'off' }),
			undefined,
			comfort['automation'],
		);
		issuedRuntimes.push(runtime);
		await runtime.onApplicationBootstrap();
		await settleReal(fixture);
		expect(native.claims.capture().isCurrent()).toBe(true);
		return { fixture, claims: native.claims, locks, temperatureOutput };
	};

	const useInstalledLockedNativeClaimsGuard = async () => {
		await settle();
		runtime.onModuleDestroy();
		const temperatureOutput = await createTemperatureOutput();
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.floor = { limit: 30, recoveryHysteresis: 2 };
		config.comfort = {
			heating_range: { minimum: 15, maximum: 25 },
			cooling_range: null,
			presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
			selected_preset: null,
			user_off: false,
			automation_enabled: false,
			temporary_override: null,
		};
		await database.manager.save(config);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const probe = await createProtectionProbe(database, relayId);
		const source = await resolveThermostatProtectionSource(database.manager, probe.sourceId, claim.physicalIdentity);
		await database.manager.insert(ThermostatMemberProtectionEntity, {
			claimId: claim.id,
			schemaVersion: 1,
			kind: 'local_floor',
			revision: 1,
			sourcePropertyId: probe.sourceId,
			sourcePropertyIdentity: probe.sourceId,
			physicalPropertyIdentity: probe.physicalId,
			contractFingerprint: source.fingerprint,
			maximumAgeSeconds: 5,
		});
		protectionProbes.add(probe.sourceId);
		sample(probe.sourceId, 20);
		const structure = new DeviceStructureLockService();
		const registry = new ClimateAutomationRegistryService();
		const ledger = new ClimateAutomationLedgerService(database, structure, registry);
		const graph = new VirtualDependencyGraphService(database, undefined, ledger);
		const provider = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
		issuedProviders.push(() => {
			provider.onModuleDestroy();
			registry.onModuleDestroy();
		});
		provider.onModuleInit();
		await graph.onApplicationBootstrap();
		const claims = new VirtualThermostatClaimsService(
			database,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
			new ConfigService({ FB_CLI: 'off' }),
		);
		issuedClaims.push(claims);
		await claims.onApplicationBootstrap();
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		comfort = new VirtualThermostatComfortService(database, structure, graph, claims, events, provider);
		const bindings = new ThermostatInstallationBindingsService();
		const binding = await bindings.resolve(database.manager, claim.id);
		const authoredSetup = {
			...memberInstallationSetup(),
			endpointHostname: '127.0.0.2',
			deviceHardwareId: binding.target.device.identifier,
		};
		const setup = resolveInstallationSetup(authoredSetup, binding);
		// Test attestations model a staged offline installation; they certify no installed equipment.
		const attestations = THERMOSTAT_ATTESTATION_KINDS.filter((kind) => kind !== 'opposed_interlock').map((kind) => ({
			kind,
			equipment: 'offline synthetic fixture',
			procedure: 'software composition only',
			evidenceReference: 'fixture:' + kind,
			testedAt: '2026-01-01T00:00:00Z',
			...(kind === 'local_execution_bounds' ? { maximumObservedMs: 50 } : {}),
		}));
		const artifact = thermostatInstallationArtifact(
			database.manager.create(ThermostatInstallationEntity, {
				claimId: claim.id,
				revision: 1,
				controllerId,
				physicalIdentity: claim.physicalIdentity,
				claimRevision: claim.revision,
				configurationRevision: config.revision,
				bindingFingerprint: binding.fingerprint,
				setup,
				attestations,
			}),
			binding,
		);
		const locks = new PropertyValueLockService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		const fixture = await realThermostatGuardFixture(
			database,
			events,
			producers,
			installedQualifications,
			'managed',
			locks,
			new Map([[claim.id, artifact]]),
		);
		for (const [id, sample] of samples) await fixture.report(id, sample.value as number | boolean);
		values = fixture.values;
		runtime = new VirtualThermostatRuntimeService(
			database,
			structure,
			claims,
			new VirtualThermostatInputsService(database, values),
			fixture.transport,
			values,
			producers,
			events,
			graph,
			comfort,
			new ConfigService({ FB_CLI: 'off' }),
			undefined,
			provider,
		);
		issuedRuntimes.push(runtime);
		const profiles = new ThermostatInstallationService(database, structure, bindings, claims, runtime);
		await profiles.stage(claim.id, 0, authoredSetup, attestations, 'offline-fixture-operator');
		const staged = await database.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
		expect(staged.artifactSource).toBe(artifact.source);
		expect(staged.expectedScriptHash).toBe(artifact.sourceHash);
		const loader = new ThermostatInstallationLoaderService(
			database,
			bindings,
			profiles,
			claims,
			fixture.platforms,
			structure,
			runtime,
			events,
			new ConfigService({ FB_CLI: 'off' }),
		);
		try {
			await loader.verify(claim.id, 1, 'offline-fixture-operator');
			expect(
				(await database.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id }))
					.lastMachineObservation,
			).toMatchObject({ state: 'verified_metadata', reasons: [] });
			await loader.onApplicationBootstrap();
			clearInterval(loader['timer']);
			await runtime.onApplicationBootstrap();
			await settleReal(fixture);
			expect(claims.qualification(claim, false)).not.toBeNull();
			return { fixture, claims, temperatureOutput, loader, claim, artifact, floorSourceId: probe.sourceId };
		} catch (cause) {
			try {
				loader.onModuleDestroy();
				await loader['queue'];
			} catch (cleanup) {
				fixture.controls.errors.push(cleanup);
			}
			throw cause;
		}
	};

	it.each(['clean', 'qualification-loss'] as const)(
		'releases the actual native reservation only after runtime OFF/drain and the original qualified claim UPDATE: %s',
		async (mode) => {
			const { fixture, claims } = await useLockedNativeClaimsGuard();
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const owner = runtime,
				source = database,
				id = controllerId;
			clearInterval(owner['timer']);
			const actualConfigs = new VirtualThermostatConfigService(
				source,
				comfort['structure'],
				comfort['graph'],
				claims,
				events,
				fixture.values,
				undefined,
				comfort['automation'],
			);
			actualConfigs.onModuleInit();
			type NativeTransaction = { queries: string[]; outcome: string | null };
			type NativeQueryEvent = Omit<import('typeorm').BeforeQueryEvent<unknown>, 'parameters'> & {
				parameters?: readonly unknown[];
			};
			const transactions = new Map<import('typeorm').QueryRunner, NativeTransaction>();
			const qualifiedWrites: {
				query: string;
				parameters: readonly unknown[];
				transaction: NativeTransaction;
				drain: {
					activity: string;
					proofId: string | null;
					freshFence: boolean;
					inFlight: string[];
					unresolved: string[];
				};
			}[] = [];
			let fencesBefore = fixture.controls.fences.length;
			let acknowledgements = 0;
			const observer = {
				beforeQuery: (event: NativeQueryEvent) => {
					if (event.query === 'BEGIN TRANSACTION') transactions.set(event.queryRunner, { queries: [], outcome: null });
					const transaction = transactions.get(event.queryRunner);
					transaction?.queries.push(event.query);
					if (
						!event.query.startsWith('UPDATE "devices_virtual_thermostat_actuator_claims"') ||
						!event.query.includes('releaseEvidence') ||
						!event.parameters?.includes('released')
					)
						return;
					if (!transaction) throw new Error('Original release transaction was not observed');
					const context = owner['contexts'].get(id),
						branch = context?.branches.get(claim.id);
					if (!context || !branch) throw new Error('Original release runtime branch missing');
					qualifiedWrites.push({
						query: event.query,
						parameters: [...event.parameters],
						transaction,
						drain: {
							activity: branch.activity,
							proofId: branch.releaseProofId,
							freshFence: fixture.controls.fences.slice(fencesBefore).includes(claim.sourcePropertyId),
							inFlight: [...owner['inFlightCommands'].values()]
								.filter((command) => command.claimId === claim.id)
								.map((command) => command.id),
							unresolved: context.commands
								.filter(
									(command) => command.claimId === claim.id && !['confirmed', 'cancelled'].includes(command.status),
								)
								.map((command) => command.id),
						},
					});
					if (mode === 'qualification-loss') claims.revokeAllQualifications();
				},
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					if (event.success && (event.query === 'COMMIT' || event.query === 'ROLLBACK')) {
						const transaction = transactions.get(event.queryRunner);
						if (transaction) transaction.outcome = event.query;
					}
					if (
						event.success &&
						event.query.startsWith('UPDATE "devices_virtual_thermostat_actuator_claims"') &&
						event.query.includes('releaseEvidence') &&
						event.parameters?.includes('released')
					)
						acknowledgements++;
				},
			};
			let primary: { cause: unknown } | undefined;
			try {
				const before = await actualConfigs.get(id);
				const property = await source.manager.findOneOrFail(ShellyNgChannelPropertyEntity, {
					where: { id: relayId },
					relations: ['channel', 'channel.device'],
				});
				if (!(property.channel instanceof ChannelEntity) || !(property.channel.device instanceof DeviceEntity))
					throw new Error('Original release actuator parents were not hydrated');
				const ordinaryOn = { device: property.channel.device, channel: property.channel, property, value: true };
				await expect(async () => claims.assertAllowed(ordinaryOn)).rejects.toThrow('Actuator is reserved');
				const sendsBefore = fixture.controls.sends.length;
				fencesBefore = fixture.controls.fences.length;
				source.subscribers.push(observer);
				await actualConfigs.requestRelease(id, before.revision);
				const requested = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id });
				expect(requested.state).toBe('releasing');
				expect(requested.revision).toBe(claim.revision + 1);
				expect(requested.releaseEvidence).toBeNull();
				// Explicit offline qualification input is renewed after requestRelease revokes the previous scope.
				// This fixture certifies no physical installation or loader renewal.
				for (const evidence of installedQualifications.values()) claims.recordQualification(evidence);
				await settleReal(fixture);
				const released = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
					id: claim.id,
				});
				expect(qualifiedWrites).toHaveLength(1);
				const { proofId, ...drain } = qualifiedWrites[0].drain;
				expect(proofId).toBeTruthy();
				expect(drain).toEqual({
					activity: 'off',
					freshFence: true,
					inFlight: [],
					unresolved: [],
				});
				expect(acknowledgements).toBe(qualifiedWrites.length);
				expect(fixture.controls.fences.length).toBeGreaterThan(fencesBefore);
				expect(fixture.controls.sends.slice(sendsBefore).filter((send) => send.on)).toEqual([]);
				const transaction = qualifiedWrites[0].transaction;
				const updateIndex = transaction.queries.indexOf(qualifiedWrites[0].query);
				expect(
					transaction.queries
						.slice(0, updateIndex)
						.some((query) => query.startsWith('INSERT OR IGNORE INTO "devices_virtual_graph_revision"')),
				).toBe(true);
				expect(
					transaction.queries
						.slice(0, updateIndex)
						.some((query) => query.startsWith('UPDATE "devices_virtual_graph_revision"')),
				).toBe(true);
				expect(transaction.outcome).toBe(mode === 'clean' ? 'COMMIT' : 'ROLLBACK');
				if (mode === 'clean') {
					expect(released.state).toBe('released');
					expect(released.revision).toBe(requested.revision + 1);
					expect(released.releaseEvidence).toMatchObject({ outputConfirmedOff: true, pendingOnDrained: true });
					expect(released.releasedAt).not.toBeNull();
					await expect(claims.assertAllowed(ordinaryOn)).resolves.toBeUndefined();
				} else {
					expect(released).toEqual(requested);
					await expect(async () => claims.assertAllowed(ordinaryOn)).rejects.toThrow('Actuator is reserved');
				}
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				primary = { cause };
			} finally {
				owner.onModuleDestroy();
				actualConfigs.onModuleDestroy();
				const completions = await Promise.allSettled([owner.flush(), fixture.flushTelemetry()]);
				const index = source.subscribers.indexOf(observer);
				if (index >= 0) source.subscribers.splice(index, 1);
				if (!primary)
					for (const result of completions) if (result.status === 'rejected') primary ??= { cause: result.reason };
			}
			if (primary) throw primary.cause;
		},
	);

	it('keeps a native graph-counter advance claims-neutral and the original active override current without send authority', async () => {
		const { fixture, claims, loader, claim, floorSourceId } = await useInstalledLockedNativeClaimsGuard();
		const owner = runtime,
			source = database,
			id = controllerId;
		clearInterval(owner['timer']);
		const counterSql = 'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1';
		const writes: { query: string; parameters: readonly unknown[] }[] = [];
		let acknowledgements = 0;
		const observer = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) {
					const parameters: readonly unknown[] = event.parameters ?? [];
					writes.push({ query: event.query, parameters: [...parameters] });
				}
			},
			afterQuery: (event: AfterQueryEvent<unknown>) => {
				if (event.query === counterSql && event.success) acknowledgements++;
			},
		};
		let primary: { cause: unknown } | undefined;
		try {
			const before = await comfort.get(id);
			await comfort.override(
				id,
				{ expected_revision: before.revision, expected_graph_revision: before.graph_revision },
				{
					preset: 'eco',
					setpoints: null,
					expires_at: new Date(Date.now() + 30_000).toISOString(),
				},
				'counter-only-clock',
			);
			await loader['queue'];
			await settleReal(fixture);
			await fixture.report(floorSourceId, 20);
			await settleReal(fixture);
			await fixture.report(floorSourceId, 20);
			await settleReal(fixture);
			await claims.refresh();
			const active = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			const original = claims.capture();
			const context = owner['contexts'].get(id),
				epoch = owner['epochs'].get(id);
			const lease = comfort['leases'].get(id),
				savedLease = { ...lease };
			const qualification = claims.qualification(claim, false);
			const session = fixture.captureSession(relayId);
			const property = await source.manager.findOneOrFail(ShellyNgChannelPropertyEntity, {
				where: { id: relayId },
				relations: ['channel', 'channel.device'],
			});
			if (!(property.channel instanceof ChannelEntity) || !(property.channel.device instanceof DeviceEntity))
				throw new Error('Original physical actuator parents were not hydrated');
			const ordinaryOn = { device: property.channel.device, channel: property.channel, property, value: true };
			expect(owner.readDiagnostics(id)).toMatchObject({ comfort_demand: 'off', headline_reason: null });
			expect(context).toBeDefined();
			expect(lease).toBeDefined();
			expect(original.isCurrent()).toBe(true);
			expect(comfort.isCurrent(active)).toBe(true);
			expect(active.comfort.temporary_override).toMatchObject({ status: 'active', preset: 'eco' });
			expect(qualification).not.toBeNull();
			expect(session?.isCurrent()).toBe(true);
			await expect(async () => claims.assertAllowed(ordinaryOn)).rejects.toThrow('Actuator is reserved');
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			const tables = (
				await source.query<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			)
				.map(({ name }) => name)
				.filter((name) => name !== 'devices_virtual_graph_revision');
			const snapshot = async () => {
				const rows: Record<string, string[]> = {};
				for (const table of tables)
					rows[table] = (
						await source.query<Record<string, unknown>[]>(`SELECT * FROM "${table.replaceAll('"', '""')}"`)
					)
						.map((row) => JSON.stringify(row))
						.sort();
				return rows;
			};
			const schema = () => source.query<unknown[]>('SELECT name, type, sql FROM sqlite_master ORDER BY type, name');
			const image = await snapshot(),
				schemaBefore = await schema();
			const graphBefore = await source.query<{ id: number; revision: number }[]>(
				'SELECT * FROM devices_virtual_graph_revision ORDER BY id',
			);
			expect(graphBefore).toHaveLength(1);
			expect(graphBefore[0].id).toBe(1);
			const sends = [...fixture.controls.sends],
				fences = [...fixture.controls.fences];
			source.subscribers.push(observer);
			jest.setSystemTime(Date.now() + 1);
			await source.query(counterSql);
			expect(original.isCurrent()).toBe(true);
			expect(comfort.isCurrent(active)).toBe(true);
			expect(comfort['leases'].get(id)).toBe(lease);
			expect(comfort['leases'].get(id)).toMatchObject({
				id: savedLease.id,
				revision: savedLease.revision,
				deadline: savedLease.deadline,
				status: savedLease.status,
			});
			expect(comfort['leases'].get(id)?.watermark).toBeGreaterThanOrEqual(savedLease.watermark);
			expect(owner['contexts'].get(id)).toBe(context);
			expect(owner['epochs'].get(id)).toBe(epoch);
			expect(claims.qualification(claim, false)).toBe(qualification);
			expect(session?.isCurrent()).toBe(true);
			await expect(async () => claims.assertAllowed(ordinaryOn)).rejects.toThrow('Actuator is reserved');
			expect(await source.query('SELECT * FROM devices_virtual_graph_revision ORDER BY id')).toEqual([
				{ ...graphBefore[0], revision: graphBefore[0].revision + 1 },
			]);
			expect(await snapshot()).toEqual(image);
			expect(await schema()).toEqual(schemaBefore);
			expect(writes).toEqual([{ query: counterSql, parameters: [] }]);
			expect(acknowledgements).toBe(1);
			expect(fixture.controls.sends).toEqual(sends);
			expect(fixture.controls.fences).toEqual(fences);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			primary = { cause };
		} finally {
			owner.onModuleDestroy();
			loader.onModuleDestroy();
			const completions = await Promise.allSettled([owner.flush(), loader['queue'], fixture.flushTelemetry()]);
			const index = source.subscribers.indexOf(observer);
			if (index >= 0) source.subscribers.splice(index, 1);
			if (!primary)
				for (const result of completions) if (result.status === 'rejected') primary ??= { cause: result.reason };
		}
		if (primary) throw primary.cause;
	});

	it('keeps actual installed-loader bookkeeping and enabled derived locks claims-current through managed ON and a no-op decision', async () => {
		const { fixture, claims, temperatureOutput, loader, claim, artifact, floorSourceId } =
			await useInstalledLockedNativeClaimsGuard();
		const owner = runtime,
			source = database,
			id = controllerId,
			output = relayId;
		clearInterval(owner['timer']);
		const writes: Array<{ query: string; parameters: readonly unknown[] }> = [];
		const subscriber = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) {
					const parameters: readonly unknown[] = event.parameters ?? [];
					writes.push({ query: event.query, parameters: [...parameters] });
				}
			},
		};
		source.subscribers.push(subscriber);

		let onAdmission: ReturnType<VirtualThermostatClaimsService['capture']> | undefined;
		let entries = 0,
			onAdmissionWasCurrent = false;
		let onCommandId: string | undefined;
		const previousGate = fixture.controls.beforeOn;
		const gate = (property: string) => {
			if (property === output) {
				entries++;
				onAdmission = claims.capture();
				onAdmissionWasCurrent = onAdmission.isCurrent();
				onCommandId = [...owner['inFlightCommands'].values()].find((command) => command.action === 'on')?.id;
			}
			return Promise.resolve();
		};
		fixture.controls.beforeOn = gate;
		let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
		const attempt = (action: () => void) => {
			try {
				action();
			} catch (cause) {
				cleanupFailure ??= { cause };
			}
		};
		try {
			const initial = await comfort.get(id);
			await comfort.override(
				id,
				{ expected_revision: initial.revision, expected_graph_revision: initial.graph_revision },
				{
					preset: null,
					setpoints: { heating_setpoint: 23, cooling_setpoint: null },
					expires_at: new Date(Date.now() + 30_000).toISOString(),
				},
				'native-bookkeeping',
			);
			await loader['queue'];
			await fixture.report(floorSourceId, 20);
			await settleReal(fixture);
			// Recovery consumes only a new packet AFTER the original branch OFF/drain acknowledgement.
			await fixture.report(floorSourceId, 20);
			await settleReal(fixture);
			expect(fixture.values).toBe(values);
			expect(owner.readDiagnostics(id)).toMatchObject({ comfort_demand: 'heat', headline_reason: null });
			expect(entries).toBe(1);
			const installation = await source.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			expect(installation.armedAt).toBeInstanceOf(Date);
			expect(installation.expectedScriptHash).toBe(artifact.sourceHash);
			expect(installation.lastMachineObservation).toMatchObject({
				state: 'verified_metadata',
				physicalSafetyCertified: false,
				reasons: [],
				configurationRevision: owner.readDiagnostics(id).configuration_revision,
			});
			expect(onAdmission).toBeDefined();
			expect(onAdmissionWasCurrent).toBe(true);
			expect(onAdmission.isCurrent()).toBe(true);
			expect(fixture.controls.sends.filter((send) => send.property === output && send.on)).toHaveLength(1);
			const commands = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			const on = commands.filter((row) => row.action === 'on');
			expect(on).toHaveLength(1);
			expect(on[0].id).toBe(onCommandId);
			expect(on[0]).toMatchObject({ status: 'accepted', fault: null, settledAt: expect.any(Date) as Date });
			expect(
				writes.some(
					(entry) =>
						entry.query.startsWith('INSERT INTO "devices_virtual_thermostat_command_journal"') &&
						entry.parameters.includes(on[0].id),
				),
			).toBe(true);
			expect(writes.some((entry) => entry.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"'))).toBe(true);
			expect(writes.some((entry) => entry.query.startsWith('UPDATE "devices_virtual_thermostat_branch_runtime"'))).toBe(
				true,
			);
			const locks = writes.filter((entry) => entry.parameters.includes(temperatureOutput));
			expect(locks.some((entry) => entry.query.startsWith('INSERT INTO "devices_module_property_value_locks"'))).toBe(
				true,
			);
			expect(locks.some((entry) => entry.query.startsWith('DELETE FROM "devices_module_property_value_locks"'))).toBe(
				true,
			);
			const sends = [...fixture.controls.sends],
				fences = [...fixture.controls.fences];
			const beforeNoop = writes.length;
			await owner.request(id, false);
			await settleReal(fixture);
			expect(
				writes.slice(beforeNoop).some((entry) => entry.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"')),
			).toBe(true);
			expect(onAdmission.isCurrent()).toBe(true);
			expect(await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).toEqual(commands);
			expect(fixture.controls.sends).toEqual(sends);
			expect(fixture.controls.fences).toEqual(fences);
			expect(
				(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id }))
					.releaseEvidence,
			).toBeNull();
			expect(await source.query('SELECT * FROM "devices_module_property_value_locks"')).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			primary = { cause };
		} finally {
			const originals = [...owner['inFlight'].values()];
			attempt(() => owner.onModuleDestroy());
			attempt(() => loader.onModuleDestroy());
			const index = source.subscribers.indexOf(subscriber);
			if (index >= 0) source.subscribers.splice(index, 1);
			attempt(() => {
				if (fixture.controls.beforeOn !== gate) throw new Error('Foreign bookkeeping gate retained');
				fixture.controls.beforeOn = previousGate;
			});
			const completions = await Promise.allSettled([
				owner.flush(),
				fixture.flushTelemetry(),
				loader['queue'],
				...originals,
			]);
			for (const result of completions) if (result.status === 'rejected') cleanupFailure ??= { cause: result.reason };
		}
		if (primary !== undefined) throw primary.cause;
		if (cleanupFailure !== undefined) throw cleanupFailure.cause;
	});

	it.each(['identical-clock-callback', 'config-callback', 'same-value-config', 'rolled-back-config'] as const)(
		'keeps monotone clock evidence separate from foreign authority loss: %s',
		async (kind) => {
			const { fixture, claims, loader, claim, floorSourceId } = await useInstalledLockedNativeClaimsGuard();
			clearInterval(runtime['timer']);
			let fired = false;
			const observer = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (fired || !event.query.startsWith('INSERT INTO "devices_virtual_thermostat_override_clocks"')) return;
					fired = true;
					if (kind === 'identical-clock-callback')
						await event.manager.query(event.query, [...(event.parameters as readonly unknown[])]);
					if (kind === 'config-callback')
						await event.manager.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "comfort" = "comfort" WHERE "controllerId" = ?',
							[controllerId],
						);
				},
			};
			let primary: { cause: unknown } | undefined;
			try {
				const initial = await comfort.get(controllerId);
				await comfort.override(
					controllerId,
					{ expected_revision: initial.revision, expected_graph_revision: initial.graph_revision },
					{
						preset: null,
						setpoints: { heating_setpoint: 23, cooling_setpoint: null },
						expires_at: new Date(Date.now() + 30_000).toISOString(),
					},
					'clock-counter-control',
				);
				await loader['queue'];
				await settleReal(fixture);
				expect(claims.qualification(claim, false)).not.toBeNull();
				const capture = claims.capture();
				expect(capture.isCurrent()).toBe(true);
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const write = (manager: import('typeorm').EntityManager) =>
					manager.query(
						'UPDATE "devices_virtual_thermostat_configs" SET "comfort" = "comfort" WHERE "controllerId" = ?',
						[controllerId],
					);
				if (kind === 'same-value-config') await write(database.manager);
				if (kind === 'rolled-back-config') {
					const sentinel = new Error('original rolled-back configuration control');
					await expect(
						database.transaction(async (manager) => {
							await write(manager);
							throw sentinel;
						}),
					).rejects.toBe(sentinel);
				}
				database.subscribers.push(observer);
				await fixture.report(floorSourceId, 20);
				await comfort.settle(controllerId);
				await settleReal(fixture);
				expect(fired).toBe(true);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(config);
				if (kind === 'identical-clock-callback') {
					expect(capture.isCurrent()).toBe(true);
					expect(claims.qualification(claim, false)).not.toBeNull();
				} else {
					expect(capture.isCurrent()).toBe(false);
					expect(claims.qualification(claim, false)).toBeNull();
				}
			} catch (cause) {
				primary = { cause };
			} finally {
				runtime.onModuleDestroy();
				loader.onModuleDestroy();
				const completions = await Promise.allSettled([runtime.flush(), loader['queue'], fixture.flushTelemetry()]);
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				if (!primary)
					for (const result of completions) if (result.status === 'rejected') primary ??= { cause: result.reason };
			}
			if (primary) throw primary.cause;
		},
	);

	it('refuses the original held managed ON after an actual foreign claim revision write with unchanged physical source and journal', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime,
			source = database,
			id = controllerId,
			output = relayId;
		clearInterval(owner['timer']);
		let enter!: () => void, release!: () => void, observe!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const resume = ownedGate((resolve) => (release = resolve));
		const observed = ownedGate((resolve) => (observe = resolve));
		const previousGate = fixture.controls.beforeOn;
		const gate = async (property: string) => {
			if (property === output) {
				enter();
				await resume;
			}
		};
		fixture.controls.beforeOn = gate;
		const held: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
		const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const get = fixture.transport.get.bind(fixture.transport) as VirtualThermostatTransportService['get'];
		const observer = jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
			const adapter = get(...args);
			if (!adapter) return null;
			const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
			return {
				...adapter,
				send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
					const original = send(...sendArgs);
					if (sendArgs[0].property.id === output && sendArgs[0].value === true) {
						held.push(sendArgs);
						void original.then(
							(result) => {
								outcomes.push(result);
								observe();
							},
							() => observe(),
						);
					}
					return original;
				},
			};
		});
		const installedGet = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
		let operation: Promise<void> | undefined;
		let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
		const attempt = (action: () => void) => {
			try {
				action();
			} catch (cause) {
				cleanupFailure ??= { cause };
			}
		};
		try {
			await fixture.report(sensorId, 18);
			await entered;
			await owner.flush();
			expect(held).toHaveLength(1);
			const commandId = held[0][4].commandId;
			const admission = claims.capture();
			expect(admission.isCurrent()).toBe(true);
			expect(held[0][3]()).toBe(true);
			const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
			expect(claim.id).toBe(held[0][1].id);
			expect(claim.sourcePropertyId).toBe(output);
			const physical = await source.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: output },
				relations: ['channel', 'channel.device'],
			});
			const journal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			const command = journal.find((row) => row.id === commandId);
			expect(command).toMatchObject({
				action: 'on',
				status: 'dispatching',
				claimId: claim.id,
				claimRevision: claim.revision,
			});
			operation = owner['inFlight'].get(commandId);
			expect(operation).toBeDefined();
			if (operation === undefined) throw new Error('Original foreign-claim ON operation missing');
			await source.query(
				'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = ? WHERE "id" = ? AND "revision" = ?',
				[claim.revision + 1, claim.id, claim.revision],
			);
			expect(admission.isCurrent()).toBe(false);
			expect(held[0][3]()).toBe(false);
			expect(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).toEqual({
				...claim,
				revision: claim.revision + 1,
			});
			expect(
				await source.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: output },
					relations: ['channel', 'channel.device'],
				}),
			).toEqual(physical);
			expect(await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).toEqual(journal);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			release();
			await observed;
			expect(outcomes).toHaveLength(1);
			expect(outcomes[0]).toMatchObject({ outcome: 'refused' });
			expect(owner['active']).toBe(true);
			await operation;
			const after = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(after).toHaveLength(journal.length);
			for (const row of journal)
				expect(after.find((saved) => saved.id === row.id)).toEqual(
					row.id === commandId
						? {
								...row,
								status: 'cancelled',
								settledAt: expect.any(Date) as Date,
								fault: expect.any(String) as string,
							}
						: row,
				);
			expect(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).toEqual({
				...claim,
				revision: claim.revision + 1,
			});
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			primary = { cause };
		} finally {
			const originals = [...owner['inFlight'].values()];
			attempt(() => owner.onModuleDestroy());
			let stopping: ReturnType<typeof fixture.stopManaged> | undefined;
			attempt(() => {
				stopping = fixture.stopManaged();
			});
			attempt(release);
			const completions = await Promise.allSettled([
				owner.flush(),
				...originals,
				...(stopping !== undefined ? [stopping] : []),
				...(operation !== undefined ? [operation] : []),
			]);
			for (const result of completions) if (result.status === 'rejected') cleanupFailure ??= { cause: result.reason };
			attempt(() => {
				if (fixture.controls.beforeOn !== gate) throw new Error('Foreign claim-revision gate retained');
				fixture.controls.beforeOn = previousGate;
			});
			attempt(() => {
				const actual = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
				if (
					!installedGet ||
					!actual ||
					actual.value !== installedGet.value ||
					actual.get !== installedGet.get ||
					actual.set !== installedGet.set ||
					actual.writable !== installedGet.writable ||
					actual.enumerable !== installedGet.enumerable ||
					actual.configurable !== installedGet.configurable
				)
					throw new Error('Foreign claim-revision transport descriptor retained');
				observer.mockRestore();
			});
		}
		if (primary !== undefined) throw primary.cause;
		if (cleanupFailure !== undefined) throw cleanupFailure.cause;
	});

	it.each(['before-send', 'after-send'] as const)(
		'keeps enabled native publication locks neutral during managed ON %s and preserves genuine claims-loss outcome',
		async (boundary) => {
			const { fixture, claims, locks, temperatureOutput } = await useLockedNativeClaimsGuard();
			const owner = runtime,
				source = database,
				id = controllerId,
				output = relayId;
			clearInterval(owner['timer']);
			expect(locks.isEnabled()).toBe(true);
			const admission = claims.capture();
			expect(admission.isCurrent()).toBe(true);
			let enter!: () => void, release!: () => void, observe!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const resume = ownedGate((resolve) => (release = resolve));
			const observed = ownedGate((resolve) => (observe = resolve));
			const key = boundary === 'before-send' ? 'beforeOn' : 'afterOn';
			const previousGate = fixture.controls[key];
			const gate = async (property: string) => {
				if (property === output) {
					enter();
					await resume;
				}
			};
			fixture.controls[key] = gate;
			const lockQueries: Array<{ query: string; parameters: readonly unknown[] }> = [];
			const subscriber = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (/^(INSERT INTO|DELETE FROM) "devices_module_property_value_locks"/.test(event.query)) {
						const parameters: readonly unknown[] = event.parameters ?? [];
						lockQueries.push({ query: event.query, parameters: [...parameters] });
					}
				},
			};
			source.subscribers.push(subscriber);
			const held: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
			const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
			const get = fixture.transport.get.bind(fixture.transport) as VirtualThermostatTransportService['get'];
			const observer = jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
				const adapter = get(...args);
				if (!adapter) return null;
				const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
				return {
					...adapter,
					send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
						const original = send(...sendArgs);
						if (sendArgs[0].property.id === output && sendArgs[0].value === true) {
							held.push(sendArgs);
							void original.then(
								(result) => {
									outcomes.push(result);
									observe();
								},
								() => observe(),
							);
						}
						return original;
					},
				};
			});
			const installedGet = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
			let operation: Promise<void> | undefined;
			let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
			const attempt = (action: () => void) => {
				try {
					action();
				} catch (cause) {
					cleanupFailure ??= { cause };
				}
			};
			try {
				await fixture.report(sensorId, 18);
				await entered;
				await owner.flush();
				expect(held).toHaveLength(1);
				const commandId = held[0][4].commandId;
				expect(held[0][3]()).toBe(true);
				expect(admission.isCurrent()).toBe(true);
				const publicationLocks = lockQueries.filter((entry) => entry.parameters.includes(temperatureOutput));
				expect(publicationLocks.some((entry) => entry.query.startsWith('INSERT INTO'))).toBe(true);
				expect(publicationLocks.some((entry) => entry.query.startsWith('DELETE FROM'))).toBe(true);
				expect(
					await source.query('SELECT * FROM "devices_module_property_value_locks" WHERE "propertyId" = ?', [
						temperatureOutput,
					]),
				).toEqual([]);
				const before = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id, action: 'on' });
				expect(before).toHaveLength(1);
				expect(before[0]).toMatchObject({
					id: commandId,
					claimId: held[0][1].id,
					claimRevision: held[0][1].revision,
					status: 'dispatching',
				});
				operation = owner['inFlight'].get(commandId);
				expect(operation).toBeDefined();
				if (operation === undefined) throw new Error('Original enabled-lock ON operation missing');
				expect(fixture.controls.sends.filter((send) => send.property === output && send.on)).toHaveLength(
					boundary === 'before-send' ? 0 : 1,
				);
				claims.invalidate();
				expect(admission.isCurrent()).toBe(false);
				expect(held[0][3]()).toBe(false);
				release();
				await observed;
				expect(outcomes).toHaveLength(1);
				if (boundary === 'before-send') expect(outcomes[0]).toMatchObject({ outcome: 'refused' });
				else expect(outcomes[0]).toEqual({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
				expect(owner['active']).toBe(true);
				await operation;
				await fixture.flushTelemetry();
				const after = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id, action: 'on' });
				expect(after).toHaveLength(1);
				expect(after[0]).toMatchObject({
					...before[0],
					status: boundary === 'before-send' ? 'cancelled' : 'unknown',
					settledAt: expect.any(Date) as Date,
					fault: expect.any(String) as string,
				});
				expect(fixture.controls.sends.filter((send) => send.property === output && send.on)).toHaveLength(
					boundary === 'before-send' ? 0 : 1,
				);
				expect(
					(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id }))
						.releaseEvidence,
				).toBeNull();
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				primary = { cause };
			} finally {
				const originals = [...owner['inFlight'].values()];
				attempt(() => owner.onModuleDestroy());
				let stopping: ReturnType<typeof fixture.stopManaged> | undefined;
				attempt(() => {
					stopping = fixture.stopManaged();
				});
				attempt(release);
				const completions = await Promise.allSettled([
					owner.flush(),
					...originals,
					...(stopping !== undefined ? [stopping] : []),
					...(operation !== undefined ? [operation] : []),
				]);
				for (const result of completions) if (result.status === 'rejected') cleanupFailure ??= { cause: result.reason };
				const index = source.subscribers.indexOf(subscriber);
				if (index >= 0) source.subscribers.splice(index, 1);
				attempt(() => {
					if (fixture.controls[key] !== gate) throw new Error('Foreign enabled-lock gate retained');
					fixture.controls[key] = previousGate;
				});
				attempt(() => {
					const actual = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
					if (
						!installedGet ||
						!actual ||
						actual.value !== installedGet.value ||
						actual.get !== installedGet.get ||
						actual.set !== installedGet.set ||
						actual.writable !== installedGet.writable ||
						actual.enumerable !== installedGet.enumerable ||
						actual.configurable !== installedGet.configurable
					)
						throw new Error('Foreign enabled-lock transport descriptor retained');
					observer.mockRestore();
				});
			}
			if (primary !== undefined) throw primary.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
			expect(await source.query('SELECT * FROM "devices_module_property_value_locks"')).toEqual([]);
		},
	);

	it('preserves the original override budget through both native recovery writes and fresh claims admission', async () => {
		const { fixture, claims, loader, claim } = await useInstalledLockedNativeClaimsGuard();
		const owner = runtime,
			source = database,
			id = controllerId,
			structure = owner['structure'];
		await settleReal(fixture);
		owner.onModuleDestroy();
		const initialMono = performance.now();
		let mono = initialMono;
		const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
		const native: {
			kind: 'journal' | 'branch';
			parameters: readonly unknown[];
			transactionActive: boolean;
			originalLeaseCurrent: () => boolean;
			overrideCurrent: boolean;
			oldClaimsCurrent: boolean;
			sameLease: boolean;
			deadline: number | undefined;
		}[] = [];
		const journalSql = 'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = ?, "fault" = ? WHERE ';
		const branchSql =
			'UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = ?, "releaseAttempts" = 0, "nextReleaseAt" = ? WHERE ';
		let primary: { cause: unknown } | undefined;
		let observer: { afterQuery: (event: AfterQueryEvent<unknown>) => void } | undefined;
		try {
			const before = await comfort.get(id);
			await comfort.override(
				id,
				{ expected_revision: before.revision, expected_graph_revision: before.graph_revision },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'recovery-original-budget',
			);
			await loader['queue'];
			await comfort.settle(id);
			const active = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			const override = active.comfort?.temporary_override,
				lease = comfort['leases'].get(id);
			if (!override || override.status !== 'active' || !lease)
				throw new Error('Original active override budget missing');
			const deadline = lease.deadline,
				watermark = lease.watermark;
			const slot = await source.query<unknown[]>(
				'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
				[id],
			);
			const recovery = source.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId: id,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: active.revision,
				decisionRevision: 0,
				action: 'on',
				status: 'prepared',
				preparedAt: new Date(),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
			await source.manager.insert(VirtualThermostatCommandEntity, recovery);
			await claims.refresh();
			const original = claims.capture();
			expect(original.isCurrent()).toBe(true);
			expect(comfort.isCurrent(active)).toBe(true);
			observer = {
				afterQuery: (event) => {
					const kind = event.query.startsWith(journalSql)
						? 'journal'
						: event.query.startsWith(branchSql)
							? 'branch'
							: null;
					if (!kind || !event.success || event.parameters?.[0] !== 'unknown') return;
					const parameters: readonly unknown[] = event.parameters ?? [];
					native.push({
						kind,
						parameters: [...parameters],
						transactionActive: event.queryRunner.isTransactionActive,
						originalLeaseCurrent: AsyncLocalStorage.bind(() => structure.hasCurrentStructuralLease()),
						overrideCurrent: comfort.isCurrent(active),
						oldClaimsCurrent: original.isCurrent(),
						sameLease: comfort['leases'].get(id) === lease,
						deadline: comfort['leases'].get(id)?.deadline,
					});
				},
			};
			source.subscribers.push(observer);
			mono = initialMono + 500;
			await owner.onApplicationBootstrap();
			clearInterval(owner['timer']);
			await settleReal(fixture);
			expect(native.map((entry) => entry.kind)).toEqual(['journal', 'branch']);
			for (const entry of native) {
				expect(entry).toMatchObject({
					transactionActive: true,
					overrideCurrent: true,
					oldClaimsCurrent: false,
					sameLease: true,
					deadline,
				});
				expect(entry.originalLeaseCurrent()).toBe(false);
			}
			expect(native[0].parameters.slice(0, 2)).toEqual(['unknown', 'restart_requires_release_reconciliation']);
			expect(native[0].parameters).toContain(recovery.id);
			expect(native[1].parameters.slice(0, 2)).toEqual(['unknown', null]);
			expect(native[1].parameters).toContain(claim.id);
			expect(original.isCurrent()).toBe(false);
			expect(claims.capture().isCurrent()).toBe(true);
			expect(comfort['leases'].get(id)).toBe(lease);
			expect(lease.deadline).toBe(deadline);
			expect(lease.watermark).toBeGreaterThanOrEqual(watermark);
			const recovered = await source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: recovery.id });
			expect(['unknown', 'confirmed']).toContain(recovered.status);
			expect(recovered.fault).toBe('restart_requires_release_reconciliation');
			const after = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			expect(after).toEqual(active);
			expect(
				await source.query('SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?', [id]),
			).toEqual(slot);
			expect(comfort.isCurrent(after)).toBe(true);
			mono = initialMono + 30_100;
			expect(Date.now()).toBeLessThan(Date.parse(override.expires_at));
			expect(comfort.isCurrent(after)).toBe(false);
			expect(comfort.isCurrent(active)).toBe(false);
			expect(comfort.isCurrent(after)).toBe(false);
			expect(lease.deadline).toBe(deadline);
			expect(lease.status).toBe('expired');
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			primary = { cause };
		} finally {
			owner.onModuleDestroy();
			loader.onModuleDestroy();
			monotonic.mockRestore();
			const completions = await Promise.allSettled([owner.flush(), loader['queue'], fixture.flushTelemetry()]);
			if (observer) {
				const index = source.subscribers.indexOf(observer);
				if (index >= 0) source.subscribers.splice(index, 1);
			}
			if (!primary)
				for (const result of completions) if (result.status === 'rejected') primary ??= { cause: result.reason };
		}
		if (primary) throw primary.cause;
	});

	it('retires failed actual recovery before same-instance retry and keeps fresh B admission independent of stopped A', async () => {
		const { fixture, claims } = await useNativeClaimsGuard(true);
		await settleReal(fixture);
		const previous = runtime,
			source = database,
			structure = previous['structure'],
			id = controllerId;
		previous.onModuleDestroy();
		const beforeOverride = await comfort.get(id);
		await comfort.override(
			id,
			{ expected_revision: beforeOverride.revision, expected_graph_revision: beforeOverride.graph_revision },
			{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
			'failed-recovery-original-budget',
		);
		await comfort.settle(id);
		const activeOverride = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		const lease = comfort['leases'].get(id),
			savedLease = { ...lease };
		if (!lease || activeOverride.comfort?.temporary_override?.status !== 'active')
			throw new Error('Original active override budget missing before failed recovery');
		const expectOriginalLease = () => {
			expect(comfort['leases'].get(id)).toBe(lease);
			expect(lease).toMatchObject({
				id: savedLease.id,
				revision: savedLease.revision,
				deadline: savedLease.deadline,
				status: savedLease.status,
			});
			expect(lease.watermark).toBeGreaterThanOrEqual(savedLease.watermark);
			expect(comfort.isCurrent(activeOverride)).toBe(true);
		};
		const make = () => {
			const owner = new VirtualThermostatRuntimeService(
				source,
				structure,
				claims,
				previous['inputs'],
				fixture.transport,
				fixture.values,
				producers,
				events,
				previous['graph'],
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
			issuedRuntimes.push(owner);
			return owner;
		};
		const a = make();
		runtime = a;
		let b: VirtualThermostatRuntimeService | undefined;
		const before = {
			claims: await source.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId: id }),
			config: await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }),
			branches: await source.manager.find(VirtualThermostatBranchRuntimeEntity),
			journal: await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id }),
			listeners: events.eventNames().map((event) => [event, events.listenerCount(event)]),
		};
		const failure = new Error('original native recovery subscriber');
		let attempt = 1,
			fail = true;
		const recoveries: {
			attempt: number;
			runner: import('typeorm').QueryRunner;
			originalLeaseCurrent: () => boolean;
			acknowledged: boolean;
			outcome: string | null;
		}[] = [];
		const captures: { attempt: number; transactionActive: boolean; originalLeaseCurrent: boolean }[] = [];
		const originalPort: Readonly<{
			capture: {
				call: (receiver: VirtualThermostatClaimsService) => ReturnType<VirtualThermostatClaimsService['capture']>;
			};
		}> = claims;
		const originalCapture = originalPort.capture;
		const capture = jest.spyOn(claims, 'capture').mockImplementation(() => {
			const recovery = recoveries.at(-1);
			if (recovery)
				captures.push({
					attempt,
					transactionActive: recovery.runner.isTransactionActive,
					originalLeaseCurrent: recovery.originalLeaseCurrent(),
				});
			return originalCapture.call(claims);
		});
		const refresh = jest.spyOn(claims, 'refresh');
		const recoverySql =
			'UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = ?, "releaseAttempts" = 0, "nextReleaseAt" = ? WHERE ';
		const observer = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					!event.query.startsWith(recoverySql) ||
					event.parameters?.[0] !== 'unknown' ||
					event.parameters?.[1] !== null
				)
					return;
				recoveries.push({
					attempt,
					runner: event.queryRunner,
					originalLeaseCurrent: AsyncLocalStorage.bind(() => structure.hasCurrentStructuralLease()),
					acknowledged: false,
					outcome: null,
				});
				if (fail) {
					fail = false;
					throw failure;
				}
			},
			afterQuery: (event: AfterQueryEvent<unknown>) => {
				const recovery = recoveries.at(-1);
				if (!recovery || recovery.outcome || recovery.runner !== event.queryRunner || !event.success) return;
				if (event.query.startsWith(recoverySql)) recovery.acknowledged = true;
				if (event.query === 'COMMIT' || event.query === 'ROLLBACK') recovery.outcome = event.query;
			},
		};
		source.subscribers.push(observer);
		let primary: { cause: unknown } | undefined;
		try {
			await expect(a.onApplicationBootstrap()).rejects.toBe(failure);
			expectOriginalLease();
			expect(recoveries).toHaveLength(1);
			expect(recoveries[0]).toMatchObject({ attempt: 1, acknowledged: false, outcome: 'ROLLBACK' });
			expect(recoveries[0].originalLeaseCurrent()).toBe(false);
			expect(captures).toEqual([]);
			expect(a['active']).toBe(false);
			expect(a['lifecycle']).toBeUndefined();
			expect(a['bootstrap']).toBeUndefined();
			expect(a['timer']).toBeUndefined();
			expect(a['contexts'].size).toBe(0);
			expect(claims['runtimeAdmission']).toBeUndefined();
			expect(events.eventNames().map((event) => [event, events.listenerCount(event)])).toEqual(before.listeners);
			expect(await source.manager.find(VirtualThermostatBranchRuntimeEntity)).toEqual(before.branches);
			expect(await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).toEqual(before.journal);
			attempt = 2;
			await a.onApplicationBootstrap();
			clearInterval(a['timer']);
			await settleReal(fixture);
			expectOriginalLease();
			expect(claims.capture().isCurrent()).toBe(true);
			expect(recoveries.filter((entry) => entry.attempt === 2)).toHaveLength(1);
			expect(recoveries[1]).toMatchObject({ acknowledged: true, outcome: 'COMMIT' });
			expect(captures.filter((entry) => entry.attempt === 2).length).toBeGreaterThan(0);
			expect(captures.every((entry) => !entry.transactionActive && !entry.originalLeaseCurrent)).toBe(true);
			a.onModuleDestroy();
			b = make();
			runtime = b;
			attempt = 3;
			await b.onApplicationBootstrap();
			clearInterval(b['timer']);
			await settleReal(fixture);
			expect(recoveries.filter((entry) => entry.attempt === 3)).toHaveLength(1);
			expect(recoveries[2]).toMatchObject({ acknowledged: true, outcome: 'COMMIT' });
			const fresh = claims.capture(),
				context = b['contexts'].get(id),
				lifecycle = b['lifecycle'];
			expect(context).toBeDefined();
			expect(lifecycle).toBeDefined();
			expect(b['active']).toBe(true);
			expect(fresh.isCurrent()).toBe(true);
			a.onModuleDestroy();
			expect(fresh.isCurrent()).toBe(true);
			expect(b['contexts'].get(id)).toBe(context);
			expect(b['lifecycle']).toBe(lifecycle);
			expect(captures.every((entry) => !entry.transactionActive && !entry.originalLeaseCurrent)).toBe(true);
			// Diagnostic recovery is claims-neutral in the current contract and does not need a claims refresh.
			expect(refresh).not.toHaveBeenCalled();
			expect(await source.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId: id })).toEqual(
				before.claims,
			);
			expect(await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).toEqual(
				before.config,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			primary = { cause };
		} finally {
			a.onModuleDestroy();
			b?.onModuleDestroy();
			const completions = await Promise.allSettled([a.flush(), ...(b ? [b.flush()] : []), fixture.flushTelemetry()]);
			const index = source.subscribers.indexOf(observer);
			if (index >= 0) source.subscribers.splice(index, 1);
			capture.mockRestore();
			refresh.mockRestore();
			if (!primary)
				for (const result of completions) if (result.status === 'rejected') primary ??= { cause: result.reason };
		}
		if (primary) throw primary.cause;
	});

	it.each(['before-commit', 'after-ack'] as const)(
		'preserves the original native bootstrap %s failure, complete persisted image and retired first admission',
		async (stage) => {
			const { fixture, claims } = await useNativeClaimsGuard();
			await settleReal(fixture);
			const previous = runtime,
				source = database,
				id = controllerId;
			previous.onModuleDestroy();
			const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
			const config = await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			const command = source.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId: id,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: config.revision,
				decisionRevision: 1,
				action: 'on',
				status: 'prepared',
				preparedAt: new Date(),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
			await source.manager.insert(VirtualThermostatCommandEntity, command);
			const before = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			const runtimeState = await source.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId: id });
			const branches = await source.manager.findBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
			expect(branches.length).toBeGreaterThan(0);
			const sends = [...fixture.controls.sends],
				fences = [...fixture.controls.fences];
			const listeners = events.eventNames().map((event) => [event, events.listenerCount(event)]);
			const automation = comfort['automation'];
			if (automation === undefined) throw new Error('Original comfort automation provider missing');
			expect(automation['runtime']).toBeUndefined();
			const owner = new VirtualThermostatRuntimeService(
				source,
				previous['structure'],
				claims,
				previous['inputs'],
				fixture.transport,
				fixture.values,
				producers,
				events,
				previous['graph'],
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				automation,
			);
			issuedRuntimes.push(owner);
			runtime = owner;
			expect(owner['contexts'].size).toBe(0);
			const failure = new Error('original native bootstrap settlement');
			const runners = new Set<object>();
			const queries: string[] = [];
			let commitChecks = 0,
				acknowledgements = 0;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					queries.push(event.query);
					if (
						event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
						event.parameters?.includes(command.id)
					)
						runners.add(event.queryRunner);
				},
				beforeTransactionCommit: (event: TransactionCommitEvent) => {
					if (!runners.has(event.queryRunner)) return;
					expect(automation['runtime']).toBeDefined();
					commitChecks++;
					if (stage === 'before-commit') throw failure;
				},
				afterTransactionCommit: (event: TransactionCommitEvent) => {
					if (!runners.has(event.queryRunner)) return;
					acknowledgements++;
					if (stage === 'after-ack') throw failure;
				},
			};
			source.subscribers.push(observer);
			try {
				await expect(owner.onApplicationBootstrap()).rejects.toBe(failure);
				expect(runners.size).toBe(1);
				expect(commitChecks).toBe(1);
				expect(acknowledgements).toBe(stage === 'before-commit' ? 0 : 1);
				const after = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
				for (const row of before)
					expect(after.find((entry) => entry.id === row.id)).toEqual(
						row.id === command.id && stage === 'after-ack'
							? { ...row, status: 'unknown', fault: 'restart_requires_release_reconciliation' }
							: row,
					);
				expect(await source.manager.findBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id })).toEqual(
					stage === 'before-commit'
						? branches
						: branches.map((row) => ({ ...row, activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null })),
				);
				expect(await source.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId: id })).toEqual(
					runtimeState,
				);
				expect(await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).toEqual(
					config,
				);
				expect(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).toEqual(
					claim,
				);
				expect(owner['active']).toBe(false);
				expect(owner['lifecycle']).toBeUndefined();
				expect(owner['bootstrap']).toBeUndefined();
				expect(owner['timer']).toBeUndefined();
				expect(owner['contexts'].size).toBe(0);
				expect(owner['outputs'].size).toBe(0);
				expect(owner['inFlight'].size).toBe(0);
				expect(claims['runtimeAdmission']).toBeUndefined();
				expect(automation['runtime']).toBeUndefined();
				const queryCount = queries.length;
				await expect(owner.requestInstalled(id)).rejects.toThrow('Original thermostat runtime unavailable');
				expect(queries).toHaveLength(queryCount);
				expect(events.eventNames().map((event) => [event, events.listenerCount(event)])).toEqual(listeners);
				expect(fixture.controls.sends).toEqual(sends);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(fixture.controls.fences).toEqual(fences);
			} finally {
				owner.onModuleDestroy();
				const index = source.subscribers.indexOf(observer);
				if (index >= 0) source.subscribers.splice(index, 1);
			}
			expect(source.subscribers.includes(observer)).toBe(false);
		},
	);

	it.each(['success', 'failure'] as const)(
		'joins the original pending bootstrap %s completion and exact rejection identity',
		async (mode) => {
			const { fixture, claims } = await useNativeClaimsGuard();
			await settleReal(fixture);
			const owner = runtime;
			owner.onModuleDestroy();
			const listeners = events.eventNames().map((event) => [event, events.listenerCount(event)]);
			let enter!: () => void, release!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const held = ownedGate((resolve) => (release = resolve));
			const failure = new Error('original concurrent native recovery');
			let armed = true;
			let injectFailure = mode === 'failure';
			const subscriber = {
				beforeTransactionStart: async () => {
					if (!armed) return;
					armed = false;
					enter();
					await held;
				},
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (injectFailure && event.query.startsWith('UPDATE "devices_virtual_thermostat_branch_runtime"'))
						throw failure;
				},
			};
			database.subscribers.push(subscriber);
			const first = owner.onApplicationBootstrap();
			void first.catch(() => undefined);
			let second: Promise<void> | undefined;
			try {
				await Promise.race([
					entered,
					first.then(() => {
						throw new Error('Original bootstrap gate was not reached');
					}),
				]);
				second = owner.onApplicationBootstrap();
				void second.catch(() => undefined);
				let secondSettled = false;
				void second.then(
					() => {
						secondSettled = true;
					},
					() => {
						secondSettled = true;
					},
				);
				expect(second).toBe(first);
				await Promise.resolve();
				expect(secondSettled).toBe(false);
				release();
				if (mode === 'failure') {
					await expect(first).rejects.toBe(failure);
					await expect(second).rejects.toBe(failure);
					expect(owner['active']).toBe(false);
					expect(events.eventNames().map((event) => [event, events.listenerCount(event)])).toEqual(listeners);
					injectFailure = false;
					await owner.onApplicationBootstrap();
					await settleReal(fixture);
				} else {
					await first;
					await second;
				}
				expect(claims.capture().isCurrent()).toBe(true);
				expect(owner['timer']).toBeDefined();
			} finally {
				owner.onModuleDestroy();
				release();
				await Promise.allSettled(second === undefined ? [first] : [first, second]);
				database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
			}
		},
	);

	it('keeps a destroyed pending A bootstrap completion from clearing the fresh same-instance B attempt', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		owner.onModuleDestroy();
		let enterA!: () => void, releaseA!: () => void, enterB!: () => void, releaseB!: () => void;
		const enteredA = ownedGate((resolve) => (enterA = resolve));
		const heldA = ownedGate((resolve) => (releaseA = resolve));
		const enteredB = ownedGate((resolve) => (enterB = resolve));
		const heldB = ownedGate((resolve) => (releaseB = resolve));
		let entries = 0;
		const subscriber = {
			beforeTransactionStart: async () => {
				entries++;
				if (entries === 1) {
					enterA();
					await heldA;
				} else if (entries === 2) {
					enterB();
					await heldB;
				}
			},
		};
		database.subscribers.push(subscriber);
		const a = owner.onApplicationBootstrap();
		void a.catch(() => undefined);
		let b: Promise<void> | undefined;
		try {
			await Promise.race([
				enteredA,
				a.then(() => {
					throw new Error('Original A bootstrap gate was not reached');
				}),
			]);
			owner.onModuleDestroy();
			b = owner.onApplicationBootstrap();
			void b.catch(() => undefined);
			expect(b).not.toBe(a);
			expect(owner.onApplicationBootstrap()).toBe(b);
			releaseA();
			await Promise.race([
				enteredB,
				b.then(() => {
					throw new Error('Original B bootstrap gate was not reached');
				}),
			]);
			await expect(a).rejects.toThrow('Original runtime lifecycle ended');
			// A is genuinely finished while B remains inside its original native recovery.
			expect(owner.onApplicationBootstrap()).toBe(b);
			expect(owner['timer']).toBeUndefined();
			releaseB();
			await b;
			await settleReal(fixture);
			expect(claims.capture().isCurrent()).toBe(true);
			expect(owner.readDiagnostics(controllerId)?.configuration_revision).toBeGreaterThan(0);
			expect(owner['timer']).toBeDefined();
		} finally {
			owner.onModuleDestroy();
			releaseA();
			releaseB();
			await Promise.allSettled(b === undefined ? [a] : [a, b]);
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
	});

	it('stops A at an actual late native load read and admits fresh B only through its own structural ticket', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		let enter!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		let armed = true;
		let callbackFailure: { cause: unknown } | undefined;
		const subscriber = {
			afterQuery: (event: AfterQueryEvent<unknown>) => {
				if (
					!armed ||
					!event.query.startsWith('SELECT ') ||
					!event.query.includes('devices_virtual_thermostat_branch_runtime')
				)
					return;
				armed = false;
				try {
					owner.onModuleDestroy();
				} catch (cause) {
					callbackFailure = { cause };
				} finally {
					enter();
				}
			},
		};
		database.subscribers.push(subscriber);
		const a = owner.requestInstalled(controllerId);
		void a.catch(() => undefined);
		try {
			await Promise.race([
				entered,
				a.then(() => {
					throw new Error('Original native load read was not reached');
				}),
			]);
			if (callbackFailure !== undefined) throw callbackFailure.cause;
			expect(owner['structure'].hasCurrentStructuralLease()).toBe(false);
			await owner.onApplicationBootstrap();
			await a;
			await settleReal(fixture);
			expect(armed).toBe(false);
			expect(claims.capture().isCurrent()).toBe(true);
			const state = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
			expect(owner.readDiagnostics(controllerId)?.decision_revision).toBe(state.decisionRevision);
			await owner.requestInstalled(controllerId);
			expect(owner.readDiagnostics(controllerId)?.decision_revision).toBeGreaterThan(state.decisionRevision);
		} finally {
			owner.onModuleDestroy();
			await a;
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
	});

	it('drops a real completed A native load held after original shared release without closing B context or persisting A work', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime,
			structure = owner['structure'];
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const held = ownedGate((resolve) => (release = resolve));
		let armed = true,
			nativeLoaded = false;
		const observer = {
			afterQuery: (event: AfterQueryEvent<unknown>) => {
				if (
					armed &&
					event.query.startsWith('SELECT ') &&
					event.query.includes('devices_virtual_thermostat_branch_runtime')
				)
					nativeLoaded = true;
			},
		};
		database.subscribers.push(observer);
		const shared = structure.runShared.bind(structure) as DeviceStructureLockService['runShared'];
		const spy = jest.spyOn(structure, 'runShared').mockImplementation(async <T>(work: () => Promise<T>): Promise<T> => {
			const result = await shared(work);
			if (armed && nativeLoaded) {
				armed = false;
				// A real exclusive ticket proves that the old shared SQL owner has released.
				await structure.runExclusiveReleased(() => Promise.resolve());
				enter();
				await held;
			}
			return result;
		});
		const a = owner.requestInstalled(controllerId);
		void a.catch(() => undefined);
		let b: Promise<void> | undefined, retirement: Promise<void> | undefined;
		let retirementSettled = false;
		const writes: string[] = [];
		const watch = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) writes.push(event.query);
			},
		};
		try {
			await Promise.race([
				entered,
				a.then(() => {
					throw new Error('Original completed load gate was not reached');
				}),
			]);
			owner.onModuleDestroy();
			retirement = owner.flush();
			void retirement.then(() => {
				retirementSettled = true;
			});
			b = owner.onApplicationBootstrap();
			await b; // B must progress while the original, already-read A result remains held.
			await settleReal(fixture);
			clearInterval(owner['timer']);
			expect(retirementSettled).toBe(false);
			const context = owner['contexts'].get(controllerId);
			const diagnostic = owner.readDiagnostics(controllerId);
			const state = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
			const capture = claims.capture();
			expect(context).toBeDefined();
			expect(capture.isCurrent()).toBe(true);
			database.subscribers.push(watch);
			release();
			await a;
			await retirement;
			expect(retirementSettled).toBe(true);
			expect(writes).toEqual([]);
			expect(owner['contexts'].get(controllerId)).toBe(context);
			expect(owner.readDiagnostics(controllerId)).toEqual(diagnostic);
			expect(await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId })).toEqual(state);
			expect(capture.isCurrent()).toBe(true);
			await owner.requestInstalled(controllerId);
			expect(owner.readDiagnostics(controllerId)?.decision_revision).toBeGreaterThan(state.decisionRevision);
		} finally {
			owner.onModuleDestroy();
			release();
			await Promise.allSettled([a, b, retirement].filter((pending) => pending !== undefined));
			spy.mockRestore();
			for (const subscriber of [watch, observer]) {
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
			}
		}
	});

	it.each(['clone', 'foreign-write'] as const)(
		'refuses %s live-command retention at restart without changing native history',
		async (variant) => {
			await settle();
			runtime.onModuleDestroy();
			await runtime.flush();
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const branch = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, {
				claimId: claim.id,
			});
			const journal = new ThermostatRuntimeJournal(database, new DeviceStructureLockService());
			await journal.captureRuntimeRow(database.manager, branch);
			const command = database.manager.create(VirtualThermostatCommandEntity, {
				id: uuid(),
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: 1,
				decisionRevision: 900,
				action: 'on',
				status: 'prepared',
				preparedAt: new Date(),
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
			await journal.insert(command, branch);
			command.status = 'dispatching';
			command.dispatchedAt = new Date();
			await journal.write(command);
			if (variant === 'foreign-write')
				await database.manager.update(VirtualThermostatCommandEntity, command.id, { fault: 'foreign actual write' });
			const rows = async () => ({
				commands: await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId }),
				branches: await database.manager.findBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id }),
			});
			const before = await rows();
			const transaction = jest.spyOn(database, 'transaction');
			await expect(journal.restart([variant === 'clone' ? { ...command } : command])).rejects.toThrow(
				'Original thermostat command journal image required',
			);
			if (variant === 'clone') expect(transaction).not.toHaveBeenCalled();
			expect(await rows()).toEqual(before);
		},
	);

	it('persists a genuinely possibly-sent A outcome after same-instance B startup without borrowing B admission or scheduling A work', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const held = ownedGate((resolve) => (release = resolve));
		fixture.controls.afterOn = async (property) => {
			if (property === relayId) {
				enter();
				await held;
			}
		};
		let original: Promise<void> | undefined;
		try {
			await fixture.report(sensorId, 18);
			await entered;
			await owner.flush();
			const command = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'on',
				status: 'dispatching',
			});
			original = owner['inFlight'].get(command.id);
			expect(original).toBeDefined();
			expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(1);
			owner.onModuleDestroy();
			await owner.onApplicationBootstrap();
			clearInterval(owner['timer']);
			expect(claims.capture().isCurrent()).toBe(true);
			release();
			await original;
			await fixture.flushTelemetry();
			await settleReal(fixture);
			const late = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id });
			expect(late.status).toBe('unknown');
			expect(late.settledAt).not.toBeNull();
			expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(1);
			expect(
				(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId }))
					.releaseEvidence,
			).toBeNull();
		} finally {
			owner.onModuleDestroy();
			release();
			if (original !== undefined) await original;
			fixture.controls.afterOn = null;
			await fixture.flushTelemetry();
		}
	});

	it('retains genuine native-claims OFF settlement across three ordinary decision rotations', async () => {
		const { fixture } = await useNativeClaimsGuard();
		const before = database.subscribers.length;
		await settleReal(fixture);
		expect(fixture.controls.errors).toEqual([]);
		expect(fixture.controls.fences).toHaveLength(2);
		for (let rotation = 0; rotation < 3; rotation++) {
			await runtime.requestInstalled(controllerId);
			await fixture.flushTelemetry();
			expect(fixture.controls.fences).toHaveLength(2);
			expect(database.subscribers.length).toBeLessThanOrEqual(before + 2);
		}
		expect(runtime.readDiagnostics(controllerId).branches[0].release_proven).toBe(true);
		expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
		expect(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).some(
				(command) => command.action === 'off' && command.status === 'confirmed',
			),
		).toBe(true);
		runtime.onModuleDestroy();
		expect(database.subscribers).toHaveLength(before);
	});

	it.each(['config', 'slot'] as const)(
		'requires a fresh native-claims drain after a same-value protected %s write',
		async (target) => {
			const { fixture, claims } = await useNativeClaimsGuard(true);
			await settleReal(fixture);
			const fences = fixture.controls.fences.length;
			const previous = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, {
				claimId: (await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId })).id,
			});
			const property = await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: relayId });
			const previousSample = fixture.values.readQualifiedSample(property, 30_000);
			expect(previousSample?.value).toBe(false);
			const table =
				target === 'config' ? 'devices_virtual_thermostat_configs' : 'devices_module_climate_automation_slots';
			const column = target === 'config' ? 'revision' : 'slotRevision';
			await database.query(`UPDATE "${table}" SET "${column}" = "${column}" WHERE "controllerId" = ?`, [controllerId]);
			expect(await database.query('SELECT changes() AS affected')).toEqual([{ affected: 1 }]);
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			// Distinguish a withdrawn hardware qualification from incorrectly retained drain evidence.
			if (target === 'config') expect(claims.qualification(claim, false)).toBeNull();
			else expect(claims.qualification(claim, false)).not.toBeNull();
			await claims.refresh();
			await runtime.requestInstalled(controllerId);
			await settleReal(fixture);
			if (target === 'config') {
				// Raw SQL is not the validated no-op path. Refresh cannot recreate hardware qualification.
				expect(claims.qualification(claim, false)).toBeNull();
				expect(fixture.controls.fences).toHaveLength(fences);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(runtime.readDiagnostics(controllerId).branches[0].release_proven).toBe(false);
				for (const qualification of installedQualifications.values()) claims.recordQualification(qualification);
				await claims.refresh();
				expect(fixture.captureSession(relayId)?.isCurrent()).toBe(true);
				await runtime.requestInstalled(controllerId);
				await settleReal(fixture);
			}
			expect(fixture.controls.fences.length).toBeGreaterThan(fences);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(runtime.readDiagnostics(controllerId).branches[0].release_proven).toBe(true);
			const fresh = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
			expect(fresh.releaseProofId).not.toBe(previous.releaseProofId);
			// An unchanged OFF keeps its original minimum-off/changeover baseline, but receives fresh proof/sample evidence.
			expect(fresh.lastVerifiedOffAt).toEqual(previous.lastVerifiedOffAt);
			const freshSample = fixture.values.readQualifiedSample(property, 30_000);
			expect(freshSample?.value).toBe(false);
			expect(freshSample.receivedAt.getTime()).toBeGreaterThan(previousSample.receivedAt.getTime());
		},
	);

	it('requires fresh native-claims qualification after loss without reusing saved OFF evidence', async () => {
		const { fixture, claims } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const fences = fixture.controls.fences.length;
		claims.revokeAllQualifications();
		await runtime.requestInstalled(controllerId);
		expect(fixture.controls.fences).toHaveLength(fences);
		expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
		for (const qualification of installedQualifications.values()) claims.recordQualification(qualification);
		await claims.refresh();
		await runtime.requestInstalled(controllerId);
		await settleReal(fixture);
		expect(fixture.controls.fences.length).toBeGreaterThan(fences);
	});

	it('never lends an original held managed ON guard the native drain after an ordinary decision rotation', async () => {
		const { fixture } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const get = fixture.transport.get.bind(fixture.transport) as VirtualThermostatTransportService['get'];
		let originalGuard: (() => boolean) | undefined;
		jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
			const adapter = get(...args);
			if (!adapter) return null;
			const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
			return {
				...adapter,
				send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
					if (sendArgs[0].value === true && originalGuard === undefined) originalGuard = sendArgs[3];
					return send(...sendArgs);
				},
			};
		});
		let entered!: () => void;
		const entering = ownedGate((resolve) => {
			entered = resolve;
		});
		let release!: () => void;
		const held = ownedGate((resolve) => {
			release = resolve;
		});
		fixture.controls.beforeOn = () => {
			entered();
			return held;
		};
		try {
			await fixture.report(sensorId, 18);
			await entering;
			expect(originalGuard).toBeDefined();
			expect(originalGuard()).toBe(true);
			await runtime.request(controllerId, false);
			expect(originalGuard()).toBe(false);
		} finally {
			runtime.onModuleDestroy();
			release();
			fixture.controls.beforeOn = null;
			await fixture.flushTelemetry();
		}
	});

	it('publishes a fresh native decision from the actual original interval without requesting an ON', async () => {
		const { fixture } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		const before = owner['contexts'].get(controllerId);
		const sequence = owner.readDiagnostics(controllerId).sequence;
		expect(before.claims).toHaveLength(1);
		expect(before.claims[0].role).toBe('heating');
		expect(before.admission.isCurrent()).toBe(true);
		const request = owner.request.bind(owner) as VirtualThermostatRuntimeService['request'];
		let poll: Promise<void> | undefined;
		let entered!: () => void;
		const entering = ownedGate((resolve) => {
			entered = resolve;
		});
		const observer = jest.spyOn(owner, 'request').mockImplementation(function (
			this: VirtualThermostatRuntimeService,
			...args: Parameters<VirtualThermostatRuntimeService['request']>
		) {
			const original = request(...args);
			if (this === owner && args[0] === controllerId && args[1] === false && poll === undefined) {
				poll = original;
				entered();
			}
			return original;
		});
		try {
			// No inspect/request call or fake timer advance: only the original installed interval can enter.
			await entering;
			expect(poll).toBeDefined();
			await poll;
			expect(owner['contexts'].get(controllerId)).not.toBe(before);
			expect(owner.readDiagnostics(controllerId).sequence).toBeGreaterThan(sequence);
			expect(owner.readDiagnostics(controllerId).configuration_revision).toBeGreaterThan(0);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
		} finally {
			owner.onModuleDestroy();
			observer.mockRestore();
			if (poll !== undefined) await poll;
		}
	});

	it('an actual interval retires the original held native ON decision without renewing its guard', async () => {
		const { fixture } = await useNativeClaimsGuard();
		await settleReal(fixture);
		const owner = runtime;
		const get = fixture.transport.get.bind(fixture.transport) as VirtualThermostatTransportService['get'];
		let originalGuard: (() => boolean) | undefined;
		jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
			const adapter = get(...args);
			if (!adapter) return null;
			const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
			return {
				...adapter,
				send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
					if (sendArgs[0].value === true && originalGuard === undefined) originalGuard = sendArgs[3];
					return send(...sendArgs);
				},
			};
		});
		let enterOn!: () => void, enterPoll!: () => void, release!: () => void;
		const onEntered = ownedGate((resolve) => (enterOn = resolve));
		const pollEntered = ownedGate((resolve) => (enterPoll = resolve));
		const held = ownedGate((resolve) => (release = resolve));
		let armed = false;
		let admittedAtEntry: boolean | undefined;
		let priorContext: unknown;
		let priorSequence: number;
		fixture.controls.beforeOn = () => {
			admittedAtEntry = originalGuard?.();
			priorContext = owner['contexts'].get(controllerId);
			priorSequence = owner.readDiagnostics(controllerId).sequence;
			armed = true;
			enterOn();
			return held;
		};
		const request = owner.request.bind(owner) as VirtualThermostatRuntimeService['request'];
		let poll: Promise<void> | undefined;
		const observer = jest.spyOn(owner, 'request').mockImplementation(function (
			this: VirtualThermostatRuntimeService,
			...args: Parameters<VirtualThermostatRuntimeService['request']>
		) {
			const original = request(...args);
			if (armed && this === owner && args[0] === controllerId && args[1] === false && poll === undefined) {
				poll = original;
				enterPoll();
			}
			return original;
		});
		try {
			await fixture.report(sensorId, 18);
			await onEntered;
			expect(admittedAtEntry).toBe(true);
			// No inspect(), explicit request(false), fake timer advance or replacement interval.
			await pollEntered;
			expect(poll).toBeDefined();
			await poll;
			expect(owner['contexts'].get(controllerId)).not.toBe(priorContext);
			expect(owner.readDiagnostics(controllerId).sequence).toBeGreaterThan(priorSequence);
			expect(originalGuard()).toBe(false);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
		} finally {
			owner.onModuleDestroy();
			release();
			fixture.controls.beforeOn = null;
			observer.mockRestore();
			if (poll !== undefined) await poll;
			await fixture.flushTelemetry();
		}
	});

	it.each(['builtin', 'custom', 'on', 'missing-qualification', 'accessor-packet'] as const)(
		'refuses an unregistered %s completion packet before any original transport or sample callback',
		async (kind) => {
			const { fixture } = await useNativeClaimsGuard();
			await settleReal(fixture);
			const get = jest.spyOn(fixture.transport, 'get');
			const read = jest.spyOn(fixture.values, 'readQualifiedSample');
			const callback = jest.fn<Promise<void>, []>();
			let getters = 0;
			const packet =
				kind === 'accessor-packet'
					? Object.freeze({
							get commandId() {
								getters++;
								return 'forged';
							},
						})
					: Object.freeze({
							commandId: 'forged',
							action: kind === 'on' ? 'on' : 'off',
							provider: kind === 'custom' ? 'custom' : 'builtin',
							qualification: kind === 'missing-qualification' ? null : {},
						});
			const ownership = runtime['ownership'];
			const fences = [...fixture.controls.fences],
				sends = [...fixture.controls.sends];
			await expect(ownership.run(packet as unknown as ThermostatOwnedDecision, callback)).rejects.toThrow(
				'Original thermostat decision required',
			);
			expect(() => ownership.completion(packet as unknown as ThermostatOwnedDecision)).toThrow(
				'Original unstarted thermostat decision required',
			);
			expect(callback).not.toHaveBeenCalled();
			expect(getters).toBe(0);
			expect(get).not.toHaveBeenCalled();
			expect(read).not.toHaveBeenCalled();
			expect(fixture.controls.fences).toEqual(fences);
			expect(fixture.controls.sends).toEqual(sends);
		},
	);

	it.each(['closed', 'unmanaged'] as const)(
		'keeps actual %s delegate sessions closed without an original managed runtime admission',
		async (mode) => {
			await settle();
			runtime.onModuleDestroy();
			await runtime.flush();
			const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, mode);
			expect(fixture.captureSession(relayId)).toBeNull();
			expect(fixture.controls.fences).toEqual([]);
			expect(fixture.controls.sends).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		},
	);

	it('requires an actual stopped-to-managed start and permanently revokes its original session at stop entry', async () => {
		await settle();
		runtime.onModuleDestroy();
		await runtime.flush();
		const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, 'unmanaged');
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await fixture.startManaged()).toBe(false);
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await fixture.stopManaged()).toBe(true);
		expect(await fixture.startManaged()).toBe(true);
		await fixture.insert();
		const original = fixture.captureSession(relayId);
		expect(original).not.toBeNull();
		expect(original.isCurrent()).toBe(true);
		const stopping = fixture.stopManaged();
		expect(original.isCurrent()).toBe(false);
		await stopping;
		expect(await fixture.startManaged()).toBe(true);
		await fixture.insert();
		const fresh = fixture.captureSession(relayId);
		expect(fresh).not.toBeNull();
		expect(fresh.isCurrent()).toBe(true);
		expect(original.isCurrent()).toBe(false);
		expect(fixture.controls.fences).toEqual([]);
		expect(fixture.controls.sends).toEqual([]);
		expect(fixture.controls.errors).toEqual([]);
	});

	it('recovers startup, trip and restart through real guard-session OFF admission events including unchanged OFF', async () => {
		const sibling = await addMandatoryMember();
		const accepted = jest.fn<void, [{ propertyId: string; sample: QualifiedPropertySample }]>();
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, accepted);
		const fixture = await useRealGuard();
		await settleReal(fixture);
		expect(fixture.controls.errors).toEqual([]);
		expect(fixture.controls.fences.length).toBeGreaterThanOrEqual(2);
		expect(
			accepted.mock.calls.filter(([event]) => event.propertyId === relayId && event.sample.value === false).length,
		).toBeGreaterThanOrEqual(2);
		const settledFences = fixture.controls.fences.length;
		void runtime.request(controllerId);
		await settleReal(fixture);
		expect(fixture.controls.fences).toHaveLength(settledFences); // No self-sustaining unchanged-OFF loop.
		for (const probe of protectionProbes) await fixture.report(probe, 20);
		await fixture.report(sensorId, 18);
		await settleReal(fixture);
		expectAllMembersOn();
		const [probe] = [...protectionProbes];
		const beforeTrip = fixture.controls.fences.length;
		await fixture.report(probe, 30);
		await fixture.report(probe, 20);
		await settleReal(fixture);
		expect(fixture.controls.fences.length).toBeGreaterThan(beforeTrip);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.protection.latched)).toBe(true);
		for (const source of protectionProbes) await fixture.report(source, 20);
		await settleReal(fixture);
		expectAllMembersOn();
		const original = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		runtime.onModuleDestroy();
		// Restart cannot use historical clear latches or ordinary OFF feedback as drainage proof.
		await fixture.report(relayId, false);
		await fixture.report(sibling, false);
		runtime = makeRuntime(undefined, undefined, fixture.transport);
		await runtime.onApplicationBootstrap();
		await settleReal(fixture);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		for (const source of protectionProbes) await fixture.report(source, 20);
		await settleReal(fixture);
		expectAllMembersOn();
		const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
		fixture.reports.onModuleDestroy();
	});

	it('withholds real guard-session recovery without a fence feedback loop while graph validation is unavailable', async () => {
		await addMandatoryMember();
		const fixture = await useRealGuard();
		await settleReal(fixture);
		for (const source of protectionProbes) await fixture.report(source, 20);
		await settleReal(fixture);
		const before = fixture.controls.fences.length;
		graphGeneration++;
		graphValidated = false;
		void runtime.request(controllerId);
		await fixture.report([...protectionProbes][0], 30);
		await settleReal(fixture);
		expect(fixture.controls.fences).toHaveLength(before);
		expect(fixture.controls.sends).toHaveLength(0);
		expect(runtime.readDiagnostics(controllerId).readiness).toBe('unavailable');
		graphValidated = true;
		void runtime.request(controllerId);
		await settleReal(fixture);
		expect(fixture.controls.fences.length).toBeGreaterThan(before);
		expect(fixture.controls.sends).toHaveLength(0);
		for (const source of protectionProbes) await fixture.report(source, 20);
		await fixture.report(sensorId, 18);
		await settleReal(fixture);
		expectAllMembersOn();
		fixture.reports.onModuleDestroy();
	});

	it.each(['queued', 'late'] as const)(
		'retains real guard-session %s ON until all-leaf post-trip drain and new recovery',
		async (delivery) => {
			await addMandatoryMember();
			const fixture = await useRealGuard();
			await settleReal(fixture);
			let release!: () => void, entered!: () => void;
			const gate = ownedGate((resolve) => (release = resolve));
			const started = new Promise<void>((resolve) => (entered = resolve));
			fixture.controls[delivery === 'queued' ? 'beforeOn' : 'afterOn'] = async (property) => {
				if (property !== relayId) return;
				entered();
				await gate;
			};
			for (const source of protectionProbes) await fixture.report(source, 20);
			await fixture.report(sensorId, 18);
			await started;
			await runtime.flush();
			const original = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			const [probe] = [...protectionProbes];
			await fixture.report(probe, 30);
			await fixture.report(probe, 20);
			await runtime.flush();
			expect(
				(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' })).some(
					(row) => row.status === 'dispatching',
				),
			).toBe(true);
			release();
			await settle();
			await fixture.flushTelemetry();
			await settleReal(fixture);
			// Either member can report a late ON after earlier OFF, even when the other ON was refused.
			// Follow the actual
			// bounded retry deadline, preserving backoff and all journals until qualified drain.
			for (let retry = 0; retry < 6; retry++) {
				const branches = runtime.readDiagnostics(controllerId).branches;
				if (branches.every((branch) => branch.activity === 'off' && branch.release_proven && !branch.pending_on)) break;
				jest.setSystemTime(
					Math.max(
						Date.now(),
						...branches.map((branch) => (branch.next_release_at ? Date.parse(branch.next_release_at) : 0)),
					) + 1,
				);
				void runtime.request(controllerId, false);
				await settleReal(fixture);
			}
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.protection.latched)).toBe(true);
			if (delivery === 'queued') expect(fixture.controls.sends.some((send) => send.property === relayId)).toBe(false);
			else expect(fixture.controls.sends.some((send) => send.property === relayId)).toBe(true);
			const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
			for (const source of protectionProbes) await fixture.report(source, 20);
			await settleReal(fixture);
			expectAllMembersOn();
			fixture.reports.onModuleDestroy();
		},
	);

	it.each(['temperature', 'configuration', 'graph', 'claim'] as const)(
		'rejects stale scope after external %s mutation while real guard-session proof awaits',
		async (mutation) => {
			await addMandatoryMember();
			const fixture = await useRealGuard();
			await settleReal(fixture);
			for (const source of protectionProbes) await fixture.report(source, 20);
			await settleReal(fixture);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.ready)).toBe(true);
			let release!: () => void, entered!: () => void;
			const gate = ownedGate((resolve) => (release = resolve));
			const started = new Promise<void>((resolve) => (entered = resolve));
			let held = false;
			fixture.controls.beforeFence = async (property) => {
				if (property !== relayId || held) throw new Error('subsequent proof deliberately withheld');
				held = true;
				entered();
				await gate;
			};
			const [probe] = [...protectionProbes];
			await fixture.report(probe, 30);
			await started;
			if (mutation === 'temperature') {
				await fixture.report(probe, 31);
				await fixture.report(sensorId, 18);
			} else if (mutation === 'configuration') {
				await database.manager.increment(VirtualThermostatConfigEntity, { controllerId }, 'revision', 1);
				events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			} else if (mutation === 'claim') {
				await database.manager.increment(
					VirtualThermostatActuatorClaimEntity,
					{ sourcePropertyId: relayId },
					'revision',
					1,
				);
				events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			} else {
				graphGeneration++;
				graphValidated = false;
				void runtime.request(controllerId);
			}
			for (const source of protectionProbes) await fixture.report(source, 20);
			release();
			await settleReal(fixture);
			expect(fixture.controls.sends).toHaveLength(0);
			expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.protection.latched)).toBe(true);
			if (mutation === 'graph') expect(runtime.readDiagnostics(controllerId).readiness).toBe('unavailable');
			if (mutation === 'configuration' || mutation === 'claim')
				expect(
					runtime
						.readDiagnostics(controllerId)
						.branches.some((branch) => branch.protection.reasons.includes('member_floor_release_required')),
				).toBe(true);
			// Current-scope proof is still obtainable after the deliberate fault is repaired.
			fixture.controls.beforeFence = null;
			graphValidated = true;
			void runtime.request(controllerId);
			await settleReal(fixture);
			expect(fixture.controls.sends).toHaveLength(0); // Pre-proof safe reports never authorize recovery.
			for (const source of protectionProbes) await fixture.report(source, 20);
			await fixture.report(sensorId, 18);
			await settleReal(fixture);
			expectAllMembersOn();
			fixture.reports.onModuleDestroy();
		},
		60_000,
	);

	it('releases the whole demanded branch when any actual member floor trips and keeps individual evidence', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(
			sentTargets
				.filter((send) => send.on)
				.map((send) => send.propertyId)
				.sort(),
		).toEqual([relayId, sibling].sort());
		const [probe] = [...protectionProbes];
		sample(probe, 30);
		void runtime.request(controllerId);
		await settle();
		const diagnostic = runtime.readDiagnostics(controllerId);
		expect(diagnostic.branches.some((branch) => branch.protection?.latched)).toBe(true);
		expect(diagnostic.branches.every((branch) => branch.activity === 'off')).toBe(true);
		expect(diagnostic.reasons.some((reason) => reason.startsWith('member_floor_latched:'))).toBe(true);
		expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' })).toHaveLength(
			2,
		);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
		).toBe(2);
	});
	it('retains a synchronous input fault across rapid recovery inside hysteresis before evaluation', async () => {
		packetTick = useThermostatPacketClock();
		await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		const [probe] = [...protectionProbes];
		events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, { propertyId: probe });
		sample(probe, 29); // No above-cutoff report is needed to re-arm after the observation fault.
		await settle();
		expect(
			runtime.readDiagnostics(controllerId).branches.find((branch) => branch.protection.source_property === probe)
				.protection.latched,
		).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		await afterMemberDrain();
		sample(probe, 27.9);
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.ready)).toBe(true);
	});

	it.each(['trip', 'source-gap', 'reconfiguration'] as const)(
		'retains the whole-branch trip barrier across immediate recovery and %s with an energized sibling and queued ON',
		async (interruption) => {
			packetTick = useThermostatPacketClock();
			const sibling = await addMandatoryMember();
			void runtime.request(controllerId);
			await settle();
			let resumeOn!: () => void;
			onGate = ownedGate((resolve) => (resumeOn = resolve));
			sample(sensorId, 18);
			void runtime.request(controllerId);
			await waitForOnJournal();
			await runtime.flush();
			expect(sentTargets.some((send) => send.propertyId === sibling && send.on)).toBe(true);
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			const original = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(original).toHaveLength(2);
			const boundary = sentTargets.length;
			proofAllowed = (id) => id !== sibling;
			const [probe] = [...protectionProbes];
			// Both reports arrive synchronously before the queued evaluation gets any opportunity to run.
			sample(probe, 30);
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: probe });
			if (interruption === 'source-gap')
				events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, { propertyId: probe });
			if (interruption === 'reconfiguration') events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			sample(probe, 20);
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: probe });
			resumeOn();
			await settle();
			expect(sentTargets.slice(boundary)).toContainEqual({ propertyId: sibling, on: false });
			expect(sentTargets.slice(boundary).some((send) => send.on)).toBe(false);
			expect(
				runtime
					.readDiagnostics(controllerId)
					.reasons.some((reason) => reason.startsWith('member_floor_release_required:')),
			).toBe(true);
			const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
			expect(retained.some((command) => command.status !== 'confirmed' && command.status !== 'cancelled')).toBe(true);
			// One leaf's proof cannot discharge the barrier for the whole branch.
			proofAllowed = () => true;
			void runtime.request(controllerId);
			await settle();
			void runtime.request(controllerId);
			await settle();
			expect(sentTargets.slice(boundary).some((send) => send.on)).toBe(false);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			// Pre-drain recovery reports remain unusable. Only a new post-drain report clears the latch.
			await afterMemberDrain();
			for (const source of protectionProbes) sample(source, 20);
			void runtime.request(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
		},
	);

	it.each(['trip', 'missing', 'degraded'] as const)(
		'rechecks every member protection at final queued ON after %s without a new evaluation request',
		async (failure) => {
			await addMandatoryMember();
			void runtime.request(controllerId);
			await settle();
			let resume: () => void = () => undefined;
			onGate = ownedGate((resolve) => {
				resume = resolve;
			});
			sample(sensorId, 18);
			void runtime.request(controllerId);
			await waitForOnJournal();
			const [probe] = [...protectionProbes];
			if (failure === 'trip') sample(probe, 30);
			else if (failure === 'missing') samples.delete(probe);
			else samples.set(probe, { ...samples.get(probe), quality: 'degraded' });
			resume();
			await settle();
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			expect(runtime.readDiagnostics(controllerId).branches.some((branch) => !branch.protection.ready)).toBe(true);
		},
	);

	it('dispatches same-mode mandatory leaves with shared decision identity and retains each journal', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(
			sentTargets
				.filter((send) => send.on)
				.map((send) => send.propertyId)
				.sort(),
		).toEqual([relayId, sibling].sort());
		const commands = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(commands).toHaveLength(2);
		expect(new Set(commands.map((command) => command.decisionRevision)).size).toBe(1);
		expect(new Set(commands.map((command) => command.claimId)).size).toBe(2);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
	});

	it.each(['missing', 'offline'] as const)(
		'inhibits and releases every sibling when a mandatory member is %s instead of shrinking capacity',
		async (failure) => {
			const sibling = await addMandatoryMember();
			void runtime.request(controllerId);
			await settle();
			sample(sensorId, 18);
			void runtime.request(controllerId);
			await settle();
			if (failure === 'offline') unavailableMembers.add(sibling);
			else
				await database.manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ sourcePropertyId: sibling },
					{ sourcePropertyId: null, state: 'missing', revision: 2 },
				);
			void runtime.request(controllerId);
			await settle();
			expect(sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
			expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
			expect(runtime.readDiagnostics(controllerId).reasons).toContain(
				failure === 'missing' ? 'startup_unreconciled' : 'heating_not_ready',
			);
		},
	);

	const registeredHeatingCommand = async (setting: 'heating_setpoint' | 'heating_enabled') => {
		const channelId = uuid(),
			propertyId = uuid();
		await database.manager.insert(VirtualChannelEntity, {
			id: channelId,
			name: 'Heating settings',
			category: ChannelCategory.HEATER,
			device: controllerId,
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: propertyId,
			channel: channelId,
			identifier: setting,
			category: setting === 'heating_setpoint' ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
			dataType: setting === 'heating_setpoint' ? DataTypeType.FLOAT : DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			valueOrigin: VirtualValueOrigin.LOCAL,
		} as never);
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: propertyId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity,
			device = channel.device as DeviceEntity;
		await database.manager.insert(VirtualThermostatSettingEntity, {
			propertyId,
			controllerId,
			setting,
			contractFingerprint: thermostatPropertyContract(property, channel, device),
		});
		return { property, channel, device };
	};

	it.each(['override expiry', 'explicit OFF', 'manual configuration'] as const)(
		'fences a queued parallel leaf and drains every journal after %s',
		async (change) => {
			const queuedLeafTrace = { variant: change, phase: 'add-member', completed: false };
			queuedLeafWitness = queuedLeafTrace;
			parallelWitness = { change, stage: 'add-member' };
			const sibling = await addMandatoryMember();
			packetTick = useThermostatPacketClock();
			// This scenario advances expiry explicitly after the two original dispatches.
			// Keep both lease clocks on that same fixture timeline; async SQLite/transport scheduling stays real.
			const clockStart = Date.now(),
				monotonicStart = performance.now();
			jest.spyOn(performance, 'now').mockImplementation(() => monotonicStart + Math.max(0, Date.now() - clockStart));
			// Every evaluation boundary below is explicit. A real poll during SQLite I/O can drain the
			// energized sibling before the mutation whose queued-ON fence this fixture is testing.
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			queuedLeafTrace.phase = 'command-registration';
			const commandTarget =
				change === 'override expiry'
					? null
					: await registeredHeatingCommand(change === 'explicit OFF' ? 'heating_enabled' : 'heating_setpoint');
			void runtime.request(controllerId);
			queuedLeafTrace.phase = 'initial-settle';
			await settle();
			queuedLeafTrace.phase = 'configure-comfort';
			parallelWitness.stage = 'configure-comfort';
			await configureComfort();
			sample(sensorId, 22);
			let resumeOn!: () => void;
			onGate = ownedGate((resolve) => {
				resumeOn = resolve;
				releaseParallelOriginal = resolve;
			});
			const relayQueued = new Promise<void>((resolve) => {
				onQueued = resolve;
			});
			const siblingEnergized = new Promise<void>((resolve) => {
				onSent = (propertyId) => {
					if (propertyId === sibling) resolve();
				};
			});
			const now = Date.now();
			jest.setSystemTime(now);
			queuedLeafTrace.phase = 'select-or-override';
			parallelWitness.stage = 'select-comfort';
			if (change === 'manual configuration') {
				await comfort.select(controllerId, await comfortFence(), 'comfort', false);
			} else {
				await comfort.override(
					controllerId,
					await comfortFence(),
					{ preset: 'comfort', setpoints: null, expires_at: new Date(now + 1000).toISOString() },
					'operator',
				);
			}
			// Every comfort revision invalidates the member protection basis. Prove current all-leaf
			// OFF/drain first, then supply genuinely later receiver reports before allowing ON.
			parallelWitness.stage = 'initial-off-drain';
			for (let phase = 0; phase < 2; phase++) {
				void runtime.request(controllerId, false);
				queuedLeafTrace.phase = `protection-settle-${phase}`;
				await settle();
			}
			expect(
				runtime
					.readDiagnostics(controllerId)
					.branches.every((branch) => branch.release_proven && !branch.pending_on && branch.activity === 'off'),
			).toBe(true);
			for (const probe of protectionProbes) sample(probe, 20);
			void runtime.request(controllerId);
			// Observe the original dispatches; inspect() would request an extra evaluation that can
			// drain the sibling before the mutation this scenario is intended to test.
			parallelWitness.stage = 'await-original-leaf-dispatches';
			queuedLeafTrace.phase = 'original-dispatch-gates';
			await Promise.all([relayQueued, siblingEnergized]);
			queuedLeafTrace.phase = 'post-dispatch-flush';
			parallelWitness.stage = 'inspect-original-journals';
			await runtime.flush();
			queuedLeafTrace.phase = 'prepared-command-read';
			const prepared = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(prepared).toHaveLength(2);
			expect(new Set(prepared.map((command) => command.decisionRevision)).size).toBe(1);
			queuedLeafTrace.phase = 'queued-claim-read';
			const queuedClaim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				sourcePropertyId: relayId,
			});
			expect(prepared.find((command) => command.claimId === queuedClaim.id).status).toBe('dispatching');
			const siblingJournal = prepared.find((command) => command.claimId !== queuedClaim.id);
			queuedLeafTrace.phase = 'sibling-inflight';
			await (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.get(siblingJournal.id);
			queuedLeafTrace.phase = 'sibling-accepted-read';
			expect(
				await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: siblingJournal.id }),
			).toMatchObject({ status: 'accepted', proofId: null });
			expect(samples.get(sibling)?.value).toBe(true);
			expect(sentTargets.filter((send) => send.propertyId === sibling).at(-1)).toEqual({
				propertyId: sibling,
				on: true,
			});
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			queuedLeafTrace.phase = 'expiry-or-manual-mutation';
			const mutationBoundary = sentTargets.length;
			parallelWitness.stage = 'manual-mutation';
			if (change === 'override expiry') {
				jest.setSystemTime(now + 1000);
			} else {
				await expect(
					configs.command([{ ...commandTarget, value: change === 'explicit OFF' ? false : 21 }]),
				).resolves.toBe(true);
				const committed = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				if (change === 'manual configuration') {
					expect(committed.policy.heatingSetpoint).toBe(21);
					expect(committed.comfort.selected_preset).toBeNull();
					expect(committed.comfort.temporary_override).toBeNull();
				} else {
					expect(committed.requestedMode).toBe('off');
					expect(committed.comfort.user_off).toBe(true);
					expect(committed.comfort.temporary_override.status).toBe('active');
				}
			}
			queuedLeafTrace.phase = 'released-on-settle';
			parallelWitness.stage = 'release-original-on';
			resumeOn();
			onGate = null;
			await settle();
			queuedLeafTrace.phase = 'expiry-revision-settle';
			// Expiry persists a new configuration revision; poll again for release proof bound to that revision.
			void runtime.request(controllerId);
			await settle();
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			expect(sentTargets.slice(mutationBoundary)).toContainEqual({ propertyId: sibling, on: false });
			queuedLeafTrace.phase = 'retained-command-read';
			const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(retained.map((command) => command.id).sort()).toEqual(prepared.map((command) => command.id).sort());
			expect(retained.find((command) => command.claimId === queuedClaim.id).status).toBe('cancelled');
			expect(retained.find((command) => command.claimId !== queuedClaim.id).status).toBe('confirmed');
			expect(retained.find((command) => command.id === siblingJournal.id).proofId).toBeTruthy();
			if (change === 'override expiry') {
				queuedLeafTrace.phase = 'expired-config-read';
				const expired = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				expect(expired.comfort.temporary_override.status).toBe('expired');
				expect(expired.revision).toBeGreaterThan(prepared[0].configurationRevision);
			}
			queuedLeafTrace.phase = 'final-diagnostic-assertions';
			expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => !branch.pending_on)).toBe(true);
			queuedLeafTrace.completed = true;
			parallelWitness.stage = 'complete';
		},
	);

	it('keeps a partial late ON unresolved per leaf while releasing the rest of its group', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		allowLateOn = true;
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await waitForOnJournal();
		await runtime.flush();
		proofAllowed = (id) => id !== relayId;
		samples.delete(sibling);
		void runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		onGate = null;
		await settle();
		const pending = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(pending.some((command) => command.status !== 'cancelled' && command.status !== 'confirmed')).toBe(true);
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(diagnostics.branches).toHaveLength(2);
		expect(diagnostics.branches.some((branch) => branch.pending_on)).toBe(true);
		expect(sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
	});

	it('waits for every opposed member to drain and measures changeover from the last qualified OFF', async () => {
		const sibling = await addMandatoryMember();
		const cooling = await addMandatoryMember('cooling', 'A8032ABE5098');
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.coolingSetpoint = 24;
		config.requestedMode = 'auto';
		config.policy.changeoverMs = 60_000;
		await database.manager.save(config);
		void runtime.request(controllerId);
		await settle();
		proofAllowed = (id) => id !== sibling;
		// An earlier ON on the second heating leaf must be covered independently.
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			sourcePropertyId: sibling,
		});
		await database.manager.insert(VirtualThermostatCommandEntity, {
			id: uuid(),
			controllerId,
			claimId: claim.id,
			claimRevision: claim.revision,
			configurationRevision: config.revision,
			decisionRevision: 0,
			action: 'on',
			status: 'unknown',
			preparedAt: new Date(),
			dispatchedAt: new Date(),
		});
		sample(sensorId, 26);
		void runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		proofAllowed = () => true;
		for (let phase = 0; phase < 3; phase++) {
			void runtime.request(controllerId, false);
			await settle();
		}
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('cooling_changeover_wait');
		const rows = await database.manager.find(VirtualThermostatBranchRuntimeEntity);
		for (const row of rows) {
			row.lastVerifiedOffAt = new Date(Date.now() - 120_000);
			await database.manager.save(row);
		}
		void runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(true);
	});

	it('retains each parallel pending ON across restart and drains siblings independently before resuming', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		const original = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(new Set(original.map((command) => command.claimId)).size).toBe(2);
		runtime.onModuleDestroy();
		sample(relayId, false);
		sample(sibling, false);
		proofAllowed = (id) => id !== sibling;
		runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await settle();
		const pending = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(pending).toHaveLength(original.length);
		expect(pending.some((command) => command.status === 'confirmed')).toBe(true);
		expect(pending.some((command) => command.status !== 'confirmed' && command.status !== 'cancelled')).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
		proofAllowed = () => true;
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.latched)).toBe(true);
		for (const probe of protectionProbes) sample(probe, 20);
		for (let phase = 0; phase < 3; phase++) {
			void runtime.request(controllerId, false);
			await settle();
		}
		expect(original.every((command) => pending.some((row) => row.id === command.id))).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		await afterMemberDrain();
		for (const probe of protectionProbes) sample(probe, 20);
		void runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
	});

	it('rechecks a parallel member generation before final send and cancels its stale queued ON', async () => {
		await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		void runtime.request(controllerId);
		const command = await waitForOnJournal();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: command.claimId });
		await database.manager.update(
			VirtualThermostatActuatorClaimEntity,
			{ id: claim.id },
			{ revision: claim.revision + 1, qualificationGeneration: 'restored-generation', state: 'releasing' },
		);
		void runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		onGate = null;
		await settle();
		expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
			'cancelled',
		);
		expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
	});

	it('treats an accepted but unobserved parallel member as incomplete capacity and releases its siblings', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		acceptedWithoutFeedback = sibling;
		proofAllowed = (id) => id !== sibling;
		sample(sensorId, 18);
		void runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(true);
		expect(sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(diagnostics.branches.find((branch) => branch.pending_on)).toBeDefined();
		expect(diagnostics.reasons).toContain('heating_not_ready');
	});

	it('fences a mandatory refusal across a newly loaded context and releases the already-running sibling', async () => {
		const sibling = await addMandatoryMember();
		void runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		void runtime.request(controllerId);
		const blocked = await waitForOnJournal();
		await runtime.flush();
		const inFlight = (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight;
		await Promise.all([...inFlight].filter(([id]) => id !== blocked.id).map(([, operation]) => operation));
		expect(sentTargets.some((send) => send.propertyId === sibling && send.on)).toBe(true);
		await runtime.inspect(controllerId);
		onOutcome = 'refused';
		// The already-issued transport returns its known refusal after decision retirement.
		// Do not replace that original outcome with the fixture's pre-send guard refusal.
		allowLateOn = true;
		proofAllowed = (id) => id !== relayId;
		resumeOn();
		onGate = null;
		await settle();
		void runtime.request(controllerId, false);
		await settle();
		expect(sentTargets.filter((send) => send.on)).toEqual([{ propertyId: sibling, on: true }]);
		expect(sentTargets.some((send) => send.propertyId === sibling && !send.on)).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.fault === 'known_no_send')).toBe(
			true,
		);
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

		afterOnGate = ownedGate(() => undefined);
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)) break;
		}
		expect(sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)).toBe(true);
	});

	it('retains a disabled controller claim and its pending ON until qualified release evidence exists', async () => {
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
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
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (sentTargets.filter((send) => send.on).length > 1) break;
		}
		expect(sentTargets.filter((send) => send.on)).toHaveLength(2);
	});

	it('persists release and ON before transport, then releases at the comfort boundary', async () => {
		sample(sensorId, 18);
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
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
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		allowLateOn = true;
		sample(sensorId, 18);
		void runtime.request(controllerId);
		let beforeRelease: VirtualThermostatCommandEntity[] = [];
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.inspect(controllerId);
			beforeRelease = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			if (beforeRelease.some((command) => command.action === 'on')) break;
		}
		expect(beforeRelease.some((command) => command.action === 'on' && command.status === 'dispatching')).toBe(true);

		sample(sensorId, 21);
		void runtime.request(controllerId);
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
		await settle();
		runtime.onModuleDestroy();
		const startedAt = Date.now();
		// Advance freshness deliberately; database latency must not age otherwise fresh acceptance inputs.
		jest.useFakeTimers({
			now: startedAt,
			doNotFake: [
				'nextTick',
				'queueMicrotask',
				'hrtime',
				'performance',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
			],
		});
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
			await state.onModuleInit();
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
				// Every new physical report has a newer watermark; SQL and proof writes keep that fixed sample clock.
				jest.setSystemTime(Date.now() + 1);
				await realValues.writeSampleWithState(property, value, {
					sampledAt: new Date(Date.now()),
					receivedAt: new Date(Date.now()),
					provenance: 'live',
				});
				await aggregate.flush();
			};
			const settle = async () => {
				void runtime.request(controllerId);
				// A completed OFF can queue a fresh ON; await each finite follow-up rather than one I/O snapshot.
				for (let attempt = 0; attempt < 5; attempt++) {
					await runtime.flush();
					await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
				}
				await runtime.flush();
				expect((runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.size).toBe(0);
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
			jest.setSystemTime(startedAt + 11_000);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('floor_unavailable');
			await report(floor, 26);
			await settle();
			expect(samples.get(relayId)?.value).toBe(true);
			jest.setSystemTime(startedAt + 22_000);
			await report(floor, 26.9);
			await settle();
			expect(realValues.readQualifiedSample(floor, 10_000)?.value).toBe(26.9);
			expect(realValues.readQualifiedSample(output, 10_000)).toBeNull();
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
			expect(samples.get(relayId)?.value).toBe(false);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(producers.read(output.id).value).toBe(18);
			expect(runtime.readDiagnostics(controllerId)?.current_temperature).toBe(18);
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
		void runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(sends).not.toContain(true);

		sample(floorPropertyId, 27);
		void runtime.request(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(sends).not.toContain(true);

		sample(floorPropertyId, 26.9);
		void runtime.request(controllerId);
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
		onGate = ownedGate((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		sample(floorPropertyId, 27);
		void runtime.request(controllerId);
		await waitForOnJournal();
		sample(floorPropertyId, 28);
		void runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(sentTargets.some((send) => send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('floor_overheat');
	});

	it('keeps a contact unknown until debounced closed and releases immediately on opening', async () => {
		clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
		await settle();
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
		const startedAt = Date.now();
		// Freeze Date construction and Date.now together; native SQL and all timer APIs remain real.
		jest.useFakeTimers({
			now: startedAt,
			doNotFake: [
				'nextTick',
				'queueMicrotask',
				'hrtime',
				'performance',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
			],
		});
		try {
			sample(sensorId, 18);
			sample(contactPropertyId, true);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(sends).not.toContain(true);

			jest.setSystemTime(startedAt + 99);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(sends).not.toContain(true);

			jest.setSystemTime(startedAt + 100);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(sends).toContain(true);
			expect(samples.get(relayId)?.value).toBe(true);

			config.contactClosingMs = 250;
			config.revision++;
			await database.manager.save(config);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 349);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 350);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(true);

			jest.setSystemTime(startedAt + 351);
			sample(contactPropertyId, false);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('window_open');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 352);
			samples.delete(contactPropertyId);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			config.requestedMode = 'off';
			config.policy.heatingSetpoint = 22;
			config.revision++;
			await database.manager.save(config);
			sample(contactPropertyId, true);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			jest.setSystemTime(startedAt + 601);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(false);
			jest.setSystemTime(startedAt + 602);
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.requested_mode).toBe('off');
			expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('window_open');
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(false);
		} finally {
			jest.useRealTimers();
		}
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
			void runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await new Promise((resolve) => setTimeout(resolve, 3));
		}
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('suspected_window_open');
		const held = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
		expect(held.heuristicHold?.pausedUntil).toBeGreaterThan(Date.now());
		const degraded = samples.get(sensorId);
		if (!degraded) throw new Error('Missing ambient sample');
		samples.set(sensorId, { ...degraded, quality: 'degraded' });
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
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
		void runtime.request(controllerId);
		await runtime.inspect(controllerId);
		expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('suspected_window_open');
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('user_off');
		expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
		expect(samples.get(relayId)?.value).toBe(false);
	});
	// Establish the original baseline and K from a real runtime-issued OFF, not a seeded companion row.
	const prepareIssuedOffJournalSettlement = async (
		retire: (ids: readonly string[]) => void,
		offResult: 'accepted' | 'refused' | 'unknown' = 'accepted',
	) => {
		await settle();
		const owner = runtime,
			source = database,
			id = controllerId;
		clearInterval(owner['timer']);
		packetTick = useThermostatPacketClock();
		const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
		const baseline = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
		expect(baseline.length).toBeGreaterThan(0);
		for (const row of baseline) expect(row).toMatchObject({ claimId: claim.id, action: 'off', status: 'confirmed' });
		const P0 = Object.freeze(reconciledCommandIds.map((ids) => Object.freeze([...ids])));
		for (const ids of P0) {
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.every((entry) => baseline.some((row) => row.id === entry))).toBe(true);
		}
		// Isolate explicit public requests from feedback. The actual OFF dispatch still runs and is joined.
		jest.spyOn(owner, 'request').mockImplementation(() => Promise.resolve());
		const command = source.manager.create(VirtualThermostatCommandEntity, {
			id: uuid(),
			controllerId: id,
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
		await source.manager.insert(VirtualThermostatCommandEntity, command);
		const inserted: VirtualThermostatCommandEntity[] = [];
		const insertion = {
			listenTo: () => VirtualThermostatCommandEntity,
			afterInsert: (event: InsertEvent<VirtualThermostatCommandEntity>) => {
				if (event.entity.controllerId === id && event.entity.claimId === claim.id && event.entity.action === 'off')
					inserted.push({ ...event.entity });
			},
		};
		source.subscribers.push(insertion);
		proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		const attemptsBefore = Object.freeze([...actuationAttempts]);
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		offGate = ownedGate((resolve) => (release = resolve));
		const get = transport.get.bind(transport) as VirtualThermostatTransportService['get'];
		const delivered: string[] = [];
		const deliveredOutcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const observer = jest.spyOn(transport, 'get').mockImplementation((...args) => {
			const adapter = get(...args);
			if (!adapter) return null;
			const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
			return {
				...adapter,
				send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
					const original = send(...sendArgs);
					if (sendArgs[0].value === false && sendArgs[1].id === claim.id) {
						delivered.push(sendArgs[4].commandId);
						void original.then(
							(result) => {
								deliveredOutcomes.push(result);
							},
							() => undefined,
						);
						enter();
					}
					return original;
				},
			};
		});
		let preparation: Promise<void> | undefined;
		try {
			offOutcome = offResult;
			preparation = owner.requestInstalled(id);
			await Promise.race([
				entered,
				preparation.then(() => {
					throw new Error('Original OFF send was not reached');
				}),
			]);
			expect(inserted).toHaveLength(1);
			expect(delivered).toEqual([inserted[0].id]);
			expect(actuationAttempts).toEqual([...attemptsBefore, false]);
			expect(retire).not.toHaveBeenCalled();
			const held = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(held.map((row) => row.id).sort()).toEqual(
				[...baseline.map((row) => row.id), command.id, delivered[0]].sort(),
			);
			for (const row of baseline) expect(held.find((entry) => entry.id === row.id)).toEqual(row);
			expect(held.find((row) => row.id === command.id)).toEqual(command);
			expect(held.find((row) => row.id === delivered[0])).toMatchObject({
				claimId: claim.id,
				action: 'off',
				status: 'dispatching',
				dispatchedAt: expect.any(Date) as Date,
			});
			expect(reconciledCommandIds).toEqual(P0);
			release();
			await preparation;
		} catch (cause) {
			owner.onModuleDestroy();
			throw cause;
		} finally {
			release();
			offGate = null;
			if (preparation !== undefined) await preparation.catch(() => undefined);
			observer.mockRestore();
			source.subscribers.splice(source.subscribers.indexOf(insertion), 1);
		}
		const pendingIds = Object.freeze([command.id, delivered[0]].sort());
		const originalJournal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
		expect(deliveredOutcomes).toHaveLength(1);
		expect(deliveredOutcomes[0].outcome).toBe(offResult);
		const originalOff = originalJournal.find((row) => row.id === delivered[0]);
		expect(originalOff?.settledAt).toEqual(expect.any(Date));
		const deliveredOutcome = deliveredOutcomes[0];
		if (deliveredOutcome.outcome === 'refused') {
			expect(deliveredOutcome.reasons.length).toBeGreaterThan(0);
			expect(originalOff?.fault).toBe(deliveredOutcome.reasons.join(','));
		} else if (deliveredOutcome.outcome === 'unknown') {
			expect(originalOff?.fault).toBe('command_execution_unknown');
		}
		if (deliveredOutcomes[0].outcome !== 'accepted')
			throw new Error('Original OFF did not finish an accepted saved native outcome');
		for (const pending of pendingIds)
			expect(originalJournal.find((row) => row.id === pending)).toMatchObject({ status: 'accepted' });
		expect(reconciledCommandIds).toEqual(P0);
		expect(retire).not.toHaveBeenCalled();
		const assertTranscript = (settlements: number) => {
			for (const [index, ids] of P0.entries()) expect(reconciledCommandIds[index]).toEqual(ids);
			expect(reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
				[...P0, ...Array.from({ length: settlements }, () => pendingIds)].map((ids) => [...ids].sort()),
			);
		};
		const assertCompleteConfirmation = async (observed?: VirtualThermostatCommandEntity[]) => {
			expect(actuationAttempts).toEqual([...attemptsBefore, false]);
			expect(actuationAttempts.every((on) => !on)).toBe(true);
			const current = observed ?? (await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id }));
			expect(current.map((row) => row.id).sort()).toEqual(originalJournal.map((row) => row.id).sort());
			for (const row of current) {
				const before = originalJournal.find((original) => original.id === row.id);
				if (pendingIds.includes(row.id))
					expect(row).toMatchObject({
						...before,
						status: 'confirmed',
						settledAt: expect.any(Date) as Date,
						proofId: expect.any(String) as string,
					});
				else expect(row).toEqual(before);
			}
		};
		const target = owner as unknown as {
			reconcile(context: unknown, member: VirtualThermostatActuatorClaimEntity): Promise<void>;
		};
		const reconcile = target.reconcile.bind(target) as typeof target.reconcile;
		let armed = false;
		const entries: Promise<void>[] = [];
		const runners = new Set<object>();
		const nativeObserver = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					armed &&
					entries.length === 1 &&
					event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
					event.parameters?.includes('confirmed') &&
					pendingIds.every((entry) => event.parameters.includes(entry))
				)
					runners.add(event.queryRunner);
			},
		};
		source.subscribers.push(nativeObserver);
		const native = jest.spyOn(target, 'reconcile').mockImplementation(function (this: typeof target, ...args) {
			const original = reconcile(...args);
			if (armed && this === target && args[1].id === claim.id) {
				entries.push(original);
				void original.catch(() => undefined);
			}
			return original;
		});
		issuedProviders.push(() => {
			native.mockRestore();
			source.subscribers.splice(source.subscribers.indexOf(nativeObserver), 1);
		});
		return {
			claim,
			command,
			pendingIds,
			originalJournal,
			assertCompleteConfirmation,
			assertTranscript,
			isSettlementRunner: (runner: object) => armed && runners.has(runner),
			start: async () => {
				expect(armed).toBe(false);
				entries.length = 0;
				runners.clear();
				armed = true;
				try {
					const result = await owner.requestInstalled(id).then(
						() => ({ fulfilled: true as const }),
						(cause: unknown) => ({ fulfilled: false as const, cause }),
					);
					expect(entries).toHaveLength(1);
					await entries[0];
					if (result.fulfilled === false) throw result.cause;
				} finally {
					armed = false;
				}
			},
		};
	};

	// Observe the original Map enrollment without replacing its operation or fabricating a completion receipt.
	const observeOriginalCommandEnrollment = (owner: VirtualThermostatRuntimeService) => {
		const map = owner['inFlight'];
		const previous = Object.getOwnPropertyDescriptor(map, 'set');
		const set = map.set.bind(map) as typeof map.set;
		const enrolled = new Map<string, Promise<void>>();
		const installed = {
			configurable: true,
			enumerable: false,
			writable: true,
			value: (...args: Parameters<typeof set>) => {
				const result = set(...args);
				enrolled.set(...args);
				return result;
			},
		};
		Object.defineProperty(map, 'set', installed);
		let restored = false;
		return {
			map,
			enrolled,
			installed,
			cleanup: () => {
				if (restored) return;
				const current = Object.getOwnPropertyDescriptor(map, 'set');
				if (
					current?.value !== installed.value ||
					current.get !== undefined ||
					current.set !== undefined ||
					current.configurable !== installed.configurable ||
					current.enumerable !== installed.enumerable ||
					current.writable !== installed.writable
				)
					throw new Error('Original command enrollment observer replaced by foreign owner');
				if (previous === undefined) Reflect.deleteProperty(map, 'set');
				else Object.defineProperty(map, 'set', previous);
				restored = true;
			},
		};
	};

	it('keeps a retired A OFF completion separate from held distinct B proof and foreign observer custody', async () => {
		await settle();
		const runtimeA = runtime,
			source = database,
			id = controllerId;
		clearInterval(runtimeA['timer']);
		packetTick = useThermostatPacketClock();
		const feedbackA = jest.spyOn(runtimeA, 'request').mockResolvedValue(undefined);
		const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
		const baseline = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
		expect(baseline.length).toBeGreaterThan(0);
		for (const row of baseline) expect(row).toMatchObject({ claimId: claim.id, action: 'off', status: 'confirmed' });
		const initialProofCalls = reconciledCommandIds.map((ids) => [...ids]);
		const attemptsBefore = [...actuationAttempts];
		const command = source.manager.create(VirtualThermostatCommandEntity, {
			id: uuid(),
			controllerId: id,
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
		await source.manager.insert(VirtualThermostatCommandEntity, command);
		const enrollment = observeOriginalCommandEnrollment(runtimeA);
		const retire = jest.fn<void, [readonly string[]]>();
		proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		let enterA!: () => void, releaseA!: () => void, enterB!: () => void, releaseB!: () => void;
		const enteredA = ownedGate((resolve) => (enterA = resolve));
		const heldA = ownedGate((resolve) => (releaseA = resolve));
		const enteredB = ownedGate((resolve) => (enterB = resolve));
		const heldB = ownedGate((resolve) => (releaseB = resolve));
		offGate = heldA;
		const get = transport.get.bind(transport) as VirtualThermostatTransportService['get'];
		const delivered: string[] = [];
		const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const sendObserver = jest.spyOn(transport, 'get').mockImplementation((...args) => {
			const adapter = get(...args);
			if (!adapter) return null;
			const send = adapter.send.bind(adapter) as ThermostatActuationAdapter['send'];
			return {
				...adapter,
				send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
					const original = send(...sendArgs);
					if (delivered.length === 0 && sendArgs[0].value === false && sendArgs[1].id === claim.id) {
						delivered.push(sendArgs[4].commandId);
						void original.then(
							(result) => outcomes.push(result),
							() => undefined,
						);
						enterA();
					}
					return original;
				},
			};
		});
		const pendingA = runtimeA.requestInstalled(id);
		void pendingA.catch(() => undefined);
		let runtimeB: VirtualThermostatRuntimeService | undefined;
		let startingB: Promise<void> | undefined;
		let settlementB: Promise<void> | undefined;
		let publicB: Promise<unknown> | undefined;
		const foreign = { ...enrollment.installed, enumerable: !enrollment.installed.enumerable };
		try {
			await Promise.race([
				enteredA,
				pendingA.then(() => {
					throw new Error('Original A OFF gate not reached');
				}),
			]);
			expect(delivered).toHaveLength(1);
			const offId = delivered[0];
			const original = enrollment.enrolled.get(offId);
			expect(original).toBe(runtimeA['inFlight'].get(offId));
			expect(original).toBeDefined();
			if (original === undefined) throw new Error('Original A command was not enrolled');
			const heldJournal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(heldJournal.map((row) => row.id).sort()).toEqual(
				[...baseline.map((row) => row.id), command.id, offId].sort(),
			);
			for (const row of baseline) expect(heldJournal.find((entry) => entry.id === row.id)).toEqual(row);
			expect(heldJournal.find((row) => row.id === command.id)).toEqual(command);
			expect(heldJournal.find((row) => row.id === offId)).toMatchObject({ action: 'off', status: 'dispatching' });
			expect(reconciledCommandIds).toEqual(initialProofCalls);
			expect(actuationAttempts).toEqual([...attemptsBefore, false]);
			runtimeA.onModuleDestroy();
			// Keep the transport method pin intact: A's final guard must observe actual lifecycle retirement.
			offGate = null; // Original A still awaits heldA; B uses its own transport call.
			beforeProof = async () => {
				enterB();
				await heldB;
			};
			runtimeB = makeRuntime();
			runtime = runtimeB;
			const requestB = runtimeB.request.bind(runtimeB) as VirtualThermostatRuntimeService['request'];
			let enterInspectionB!: () => void;
			const enteredInspectionB = ownedGate((resolve) => (enterInspectionB = resolve));
			const inspectionsB: Promise<void>[] = [];
			// Isolate explicit requests from dispatch feedback, while forwarding bootstrap and public inspection.
			jest.spyOn(runtimeB, 'request').mockImplementation((...args) => {
				if (args[1] === true) return Promise.resolve();
				const original = requestB(...args);
				if (args[1] === false) {
					inspectionsB.push(original);
					enterInspectionB();
				}
				return original;
			});
			startingB = runtimeB.onApplicationBootstrap();
			void startingB.catch(() => undefined);
			await startingB;
			clearInterval(runtimeB['timer']);
			await Promise.all([...runtimeB['inFlight'].values()]);
			const issuedB = (await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).filter(
				(row) => !heldJournal.some((held) => held.id === row.id),
			);
			expect(issuedB).toHaveLength(1);
			expect(issuedB[0]).toMatchObject({ claimId: claim.id, action: 'off', status: 'accepted' });
			const pendingIds = [command.id, offId, issuedB[0].id].sort();
			settlementB = runtimeB.requestInstalled(id);
			void settlementB.catch(() => undefined);
			await Promise.race([
				enteredB,
				settlementB.then(() => {
					throw new Error('Original B proof gate not reached');
				}),
			]);
			const lifecycleB = runtimeB['lifecycle'],
				contextB = runtimeB['contexts'].get(id);
			expect(contextB).toBeDefined();
			const descriptorB = Object.getOwnPropertyDescriptor(runtimeB, 'listener');
			const commandsB = contextB?.commands.map((row) => ({ ...row }));
			const journalB = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(journalB.find((row) => row.id === offId)).toMatchObject({
				...heldJournal.find((row) => row.id === offId),
				status: 'unknown',
				fault: 'restart_requires_release_reconciliation',
			});
			const transcriptB = reconciledCommandIds.map((ids) => [...ids]);
			expect(transcriptB.map((ids) => [...ids].sort())).toEqual([
				...initialProofCalls.map((ids) => [...ids].sort()),
				pendingIds,
			]);
			let publicBCompleted = false;
			publicB = runtimeB.inspect(id);
			void publicB.then(
				() => {
					publicBCompleted = true;
				},
				() => {
					publicBCompleted = true;
				},
			);
			await enteredInspectionB;
			expect(inspectionsB).toHaveLength(1);
			Object.defineProperty(enrollment.map, 'set', foreign);
			expect(() => enrollment.cleanup()).toThrow('Original command enrollment observer replaced by foreign owner');
			expect(Object.getOwnPropertyDescriptor(enrollment.map, 'set')).toEqual(foreign);
			releaseA();
			const outcomeA = await original.then(
				() => ({ fulfilled: true as const }),
				(cause: unknown) => ({ fulfilled: false as const, cause }),
			);
			expect(outcomeA.fulfilled).toBe(false);
			if (outcomeA.fulfilled !== false) throw new Error('A overwrote B restart journal image');
			expect(outcomeA.cause).toEqual(new Error('Original thermostat command journal image required'));
			await expect(pendingA).rejects.toBe(outcomeA.cause);
			expect(outcomes).toEqual([{ outcome: 'refused', reasons: ['revoked'] }]);
			expect(feedbackA).not.toHaveBeenCalled();
			expect(enrollment.enrolled.size).toBe(1);
			expect(runtimeA['inFlight'].size).toBe(0);
			expect(retire).not.toHaveBeenCalled();
			expect(publicBCompleted).toBe(false);
			expect(runtimeB['lifecycle']).toBe(lifecycleB);
			expect(runtimeB['contexts'].get(id)).toBe(contextB);
			expect(contextB?.commands).toEqual(commandsB);
			expect(Object.getOwnPropertyDescriptor(runtimeB, 'listener')).toEqual(descriptorB);
			expect(Object.getOwnPropertyDescriptor(enrollment.map, 'set')).toEqual(foreign);
			expect(reconciledCommandIds).toEqual(transcriptB);
			const afterA = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(afterA).toEqual(journalB);
			expect(afterA.map((row) => row.id).sort()).toEqual([...heldJournal.map((row) => row.id), issuedB[0].id].sort());
			for (const row of baseline) expect(afterA.find((entry) => entry.id === row.id)).toEqual(row);
			expect(afterA.find((row) => row.id === command.id)).toEqual(command);
			releaseB();
			await settlementB;
			await publicB;
			clearInterval(runtimeB['timer']);
			const afterB = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(afterB.map((row) => row.id).sort()).toEqual(afterA.map((row) => row.id).sort());
			for (const row of baseline) expect(afterB.find((entry) => entry.id === row.id)).toEqual(row);
			for (const pendingId of pendingIds)
				expect(afterB.find((row) => row.id === pendingId)).toMatchObject({
					...afterA.find((row) => row.id === pendingId),
					status: 'confirmed',
					settledAt: expect.any(Date) as Date,
					proofId: expect.any(String) as string,
				});
			expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual([[pendingIds]]);
			expect(reconciledCommandIds).toEqual(transcriptB);
			expect(actuationAttempts).toEqual([...attemptsBefore, false, false]);
			expect(actuationAttempts.every((on) => !on)).toBe(true);
		} finally {
			runtimeA.onModuleDestroy();
			runtimeB?.onModuleDestroy();
			releaseA();
			releaseB();
			beforeProof = null;
			offGate = null;
			await Promise.allSettled([
				pendingA,
				...enrollment.enrolled.values(),
				...(startingB !== undefined ? [startingB] : []),
				...(settlementB !== undefined ? [settlementB] : []),
				...(publicB !== undefined ? [publicB] : []),
			]);
			sendObserver.mockRestore();
			// Relinquish only our deliberate foreign rewrite after both originals and consumers retired.
			const current = Object.getOwnPropertyDescriptor(enrollment.map, 'set');
			if (
				current?.value === foreign.value &&
				current.enumerable === foreign.enumerable &&
				current.configurable === foreign.configurable &&
				current.writable === foreign.writable &&
				current.get === undefined &&
				current.set === undefined
			)
				Object.defineProperty(enrollment.map, 'set', enrollment.installed);
			enrollment.cleanup();
		}
	});

	it.each(['refused', 'unknown'] as const)(
		'rejects a non-accepted original OFF before a second settlement while retaining exact native effects: %s',
		async (outcome) => {
			await settle();
			const source = database,
				id = controllerId;
			clearInterval(runtime['timer']);
			const baseline = Object.freeze(
				(await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).map((row) =>
					Object.freeze({ ...row }),
				),
			);
			const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
			const initialProofCalls = Object.freeze(reconciledCommandIds.map((ids) => Object.freeze([...ids])));
			const beforeAttempts = Object.freeze([...actuationAttempts]);
			type NativeRow = { id: string; claimId: string; action: string; status: string };
			const grammars = (commandIds: readonly string[]) => ({
				noSettlement: {
					proof: initialProofCalls,
					retirement: [] as readonly (readonly (readonly string[])[])[],
					journal: [
						...baseline.map(({ id, claimId, action, status }) => ({ id, claimId, action, status })),
						{ id: commandIds[0], claimId: claim.id, action: 'on', status: 'accepted' },
						{ id: commandIds[1], claimId: claim.id, action: 'off', status: 'unknown' },
					],
				},
				knownAcknowledgement: {
					proof: [...initialProofCalls, commandIds],
					retirement: [[commandIds]],
					journal: [
						...baseline.map(({ id, claimId, action, status }) => ({ id, claimId, action, status })),
						{ id: commandIds[0], claimId: claim.id, action: 'on', status: 'confirmed' },
						{ id: commandIds[1], claimId: claim.id, action: 'off', status: 'confirmed' },
					],
				},
			});
			// Fix K from native INSERTs independently of proof/retirement callbacks.
			const inserted: VirtualThermostatCommandEntity[] = [];
			const native = {
				listenTo: () => VirtualThermostatCommandEntity,
				afterInsert: (event: InsertEvent<VirtualThermostatCommandEntity>) => {
					if (event.entity.controllerId === id) inserted.push({ ...event.entity });
				},
			};
			source.subscribers.push(native);
			const retire = jest.fn<void, [readonly string[]]>();
			const requests = jest.spyOn(runtime, 'requestInstalled');
			try {
				await expect(prepareIssuedOffJournalSettlement(retire, outcome)).rejects.toThrow(
					'Original OFF did not finish an accepted saved native outcome',
				);
				expect(requests).toHaveBeenCalledTimes(1);
				expect(requests).toHaveBeenCalledWith(id);
				expect(inserted).toHaveLength(2);
				const on = inserted.find((row) => row.action === 'on');
				const off = inserted.find((row) => row.action === 'off');
				expect(on).toBeDefined();
				expect(off).toBeDefined();
				if (!on || !off) throw new Error('Original ON and issued OFF native identities missing');
				const commandIds = Object.freeze([on.id, off.id]);
				expect(new Set(commandIds).size).toBe(2);
				const journal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				const originalOn = journal.find((row) => row.id === on.id);
				const declared = grammars(commandIds);
				const grammar =
					originalOn?.status === 'accepted'
						? declared.noSettlement
						: originalOn?.status === 'confirmed'
							? declared.knownAcknowledgement
							: undefined;
				if (!grammar) throw new Error('Failed OFF had an undeclared native journal result');
				expect(journal.map((row) => row.id).sort()).toEqual([...baseline.map((row) => row.id), ...commandIds].sort());
				for (const row of baseline) expect(journal.find((entry) => entry.id === row.id)).toEqual(row);
				expect(
					journal
						.map(({ id, claimId, action, status }): NativeRow => ({ id, claimId, action, status }))
						.sort((a, b) => a.id.localeCompare(b.id)),
				).toEqual([...grammar.journal].sort((a, b) => a.id.localeCompare(b.id)));
				for (const [index, ids] of initialProofCalls.entries()) expect(reconciledCommandIds[index]).toEqual(ids);
				expect(reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(grammar.proof.map((ids) => [...ids].sort()));
				expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual(
					grammar.retirement.map((call) => call.map((ids) => [...ids].sort())),
				);
				expect(actuationAttempts).toEqual([...beforeAttempts, false]);
				expect(actuationAttempts.every((on) => !on)).toBe(true);
			} finally {
				requests.mockRestore();
				const index = source.subscribers.indexOf(native);
				if (index >= 0) source.subscribers.splice(index, 1);
			}
		},
	);

	it('retires only committed journal identities and retains the same pending identity after a real SQLite rollback', async () => {
		const retire = jest.fn<void, [readonly string[]]>();
		const entry = await prepareIssuedOffJournalSettlement(retire);
		const { command, pendingIds, originalJournal, assertCompleteConfirmation } = entry;
		let rollback = true;
		const subscriber = {
			listenTo: () => VirtualThermostatBranchRuntimeEntity,
			afterUpdate: (event: import('typeorm').UpdateEvent<VirtualThermostatBranchRuntimeEntity>) => {
				if (rollback && entry.isSettlementRunner(event.queryRunner)) {
					rollback = false;
					throw new Error('fixture settlement rollback');
				}
			},
		};
		database.subscribers.push(subscriber);
		try {
			await expect(entry.start()).rejects.toThrow('fixture settlement rollback');
			expect(retire).not.toHaveBeenCalled();
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'accepted',
			);
			expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(originalJournal);
			entry.assertTranscript(1);
			await entry.start();
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'confirmed',
			);
			expect(retire).toHaveBeenCalledTimes(1);
			expect([...retire.mock.calls[0][0]].sort()).toEqual(pendingIds);
			await assertCompleteConfirmation();
			entry.assertTranscript(2);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
	});
	it('does not let optional retirement failure alter committed journal confirmation', async () => {
		const retire = jest.fn<void, [readonly string[]]>(() => {
			throw new Error('optional metadata only');
		});
		const entry = await prepareIssuedOffJournalSettlement(retire);
		const { command, pendingIds, assertCompleteConfirmation } = entry;
		await entry.start();
		expect(retire).toHaveBeenCalledTimes(1);
		expect([...retire.mock.calls[0][0]].sort()).toEqual(pendingIds);
		await assertCompleteConfirmation();
		entry.assertTranscript(1);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
			'confirmed',
		);
	});
	it('uses the later cooling/member release barrier by default without changing heating or explicit zero', async () => {
		await settle();
		const internal = runtime as unknown as {
			contexts: Map<string, unknown>;
			reconciled: Map<string, { observedAt: number }>;
			memberProtection: { requiredReleaseAfter: () => number | null };
			coolingDependencies: { requiredReleaseAfter: () => number | null };
			hasCurrentDrain(context: unknown, member: VirtualThermostatActuatorClaimEntity, after?: number): boolean;
		};
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const proof = internal.reconciled.get(`${claim.id}:${claim.revision}`);
		expect(proof).toBeDefined();
		const at = proof.observedAt;
		const member = jest.spyOn(internal.memberProtection, 'requiredReleaseAfter').mockReturnValue(null);
		const cooling = jest.spyOn(internal.coolingDependencies, 'requiredReleaseAfter').mockReturnValue(at);
		const context = internal.contexts.get(controllerId);
		const coolingClaim = Object.assign(new VirtualThermostatActuatorClaimEntity(), claim, { role: 'cooling' });
		expect(internal.hasCurrentDrain(context, coolingClaim)).toBe(false);
		expect(internal.hasCurrentDrain(context, claim)).toBe(true);
		expect(internal.hasCurrentDrain(context, coolingClaim, 0)).toBe(true);
		cooling.mockReturnValue(at - 1);
		expect(internal.hasCurrentDrain(context, coolingClaim)).toBe(true);
		member.mockReturnValue(at + 1);
		expect(internal.hasCurrentDrain(context, coolingClaim)).toBe(false);
		cooling.mockReturnValue(null);
		expect(internal.hasCurrentDrain(context, coolingClaim)).toBe(false);
		member.mockReturnValue(null);
		expect(internal.hasCurrentDrain(context, coolingClaim)).toBe(true);
	});

	it('takes a new qualified fence for an idle OFF cooling claim after a later cooling trip barrier', async () => {
		await settle();
		packetTick = useThermostatPacketClock();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		await database.manager.update(VirtualThermostatActuatorClaimEntity, claim.id, { role: 'cooling' });
		await database.manager.update(VirtualThermostatConfigEntity, controllerId, {
			requestedMode: 'off',
			policy: { ...config.policy, heatingSetpoint: null, coolingSetpoint: 24 },
		});
		const internal = runtime as unknown as {
			coolingDependencies: { requiredReleaseAfter: () => number | null };
			reconciled: Map<string, { observedAt: number }>;
		};
		let after: number | null = null;
		jest.spyOn(internal.coolingDependencies, 'requiredReleaseAfter').mockImplementation(() => after);
		void runtime.request(controllerId);
		await settle();
		const oldProof = internal.reconciled.get(`${claim.id}:${claim.revision}`);
		expect(oldProof).toBeDefined();
		const before = proofCalls;
		after = oldProof.observedAt;
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'accepted' })).toBe(
			0,
		);
		packetTick();
		void runtime.request(controllerId);
		await settle();
		expect(proofCalls).toBe(before + 1);
		expect(internal.reconciled.get(`${claim.id}:${claim.revision}`).observedAt).toBeGreaterThan(after);
		expect(sentTargets.some((entry) => entry.on)).toBe(false);
	});

	it.each([
		'held acknowledgement',
		'unknown acknowledgement',
		'callback replacement',
		'callback deletion',
		'callback call replacement',
		'callback call getter',
	] as const)('waits for a known SQLite commit acknowledgement before retirement: %s', async (mode) => {
		const retire = jest.fn<void, [readonly string[]]>();
		const entry = await prepareIssuedOffJournalSettlement(retire);
		const { pendingIds, assertCompleteConfirmation } = entry;
		const originalCallDescriptor = Object.getOwnPropertyDescriptor(retire, 'call');
		let callAccesses = 0;
		let originalProof: { retireConfirmedCommandIds?: (ids: readonly string[]) => void };
		const successor = jest.fn();
		proofMutation = (proof) => {
			originalProof = { ...proof, retireConfirmedCommandIds: retire };
			return originalProof as typeof proof;
		};
		let enter: () => void = () => undefined;
		let rejectObservation: (error: unknown) => void = () => undefined;
		let committedJournal: VirtualThermostatCommandEntity[] | undefined;
		let release: () => void = () => undefined;
		const entered = new Promise<void>((resolve, reject) => {
			enter = resolve;
			rejectObservation = reject;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		let once = true;
		const subscriber = {
			afterTransactionCommit: async (event: TransactionCommitEvent) => {
				if (!once || !entry.isSettlementRunner(event.queryRunner)) return;
				once = false;
				try {
					committedJournal = await event.queryRunner.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				} catch (error: unknown) {
					rejectObservation(error);
					throw error;
				}
				enter();
				await held;
				if (mode === 'unknown acknowledgement') throw new Error('fixture lost commit acknowledgement');
			},
		};
		database.subscribers.push(subscriber);
		let outcome: Promise<unknown> | undefined;
		try {
			const pending = entry.start();
			// Attach both outcomes before releasing the controlled commit gate.
			outcome = pending.then<unknown, unknown>(
				() => null,
				(error: unknown) => error,
			);
			await Promise.race([
				entered,
				outcome.then((error) => {
					throw error === null ? new Error('Original settlement did not reach its commit ACK') : error;
				}),
			]);
			expect(retire).not.toHaveBeenCalled();
			expect(committedJournal).toBeDefined();
			await assertCompleteConfirmation(committedJournal);
			entry.assertTranscript(1);
			if (mode === 'callback replacement') originalProof.retireConfirmedCommandIds = successor;
			if (mode === 'callback deletion') delete originalProof.retireConfirmedCommandIds;
			if (mode === 'callback call replacement') {
				expect(originalProof.retireConfirmedCommandIds).toBe(retire);
				Object.defineProperty(retire, 'call', { configurable: true, value: successor });
			}
			if (mode === 'callback call getter') {
				expect(originalProof.retireConfirmedCommandIds).toBe(retire);
				Object.defineProperty(retire, 'call', {
					configurable: true,
					get: () => {
						callAccesses++;
						throw new Error('replacement retirement call getter');
					},
				});
			}
			release();
			const error = await outcome;
			if (mode !== 'unknown acknowledgement') {
				expect(error).toBeNull();
				expect([...retire.mock.calls[0][0]].sort()).toEqual(pendingIds);
				expect(retire).toHaveBeenCalledTimes(1);
				expect(retire.mock.contexts[0]).toBe(originalProof);
			} else {
				expect(error).toEqual(new Error('fixture lost commit acknowledgement'));
				expect(retire).not.toHaveBeenCalled();
			}
			await assertCompleteConfirmation();
			entry.assertTranscript(1);
			expect(successor).not.toHaveBeenCalled();
			expect(callAccesses).toBe(0);
		} finally {
			release();
			await outcome;
			if (originalCallDescriptor) Object.defineProperty(retire, 'call', originalCallDescriptor);
			else Reflect.deleteProperty(retire, 'call');
			database.subscribers.splice(database.subscribers.indexOf(subscriber), 1);
		}
	});

	it.each(['unchanged', 'member', 'source'] as const)(
		'reconciles an independent same-revision %s image while the original native OFF fence is held',
		async (kind) => {
			const { fixture, loader, claim } = await useInstalledLockedNativeClaimsGuard();
			const owner = runtime;
			const source = database;
			const peer = new SqliteDataSource({
				type: 'sqlite',
				database: join(directory, 'runtime.sqlite'),
				entities: [__dirname + '/../../../**/*.entity.ts'],
				synchronize: false,
				migrationsRun: false,
			});
			let enter!: () => void, release!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const held = ownedGate((resolve) => (release = resolve));
			const previousGate = fixture.controls.beforeFence;
			const events: { kind: 'fence' | 'proof'; scope: string | undefined }[] = [];
			const pendingScopes: string[] = [];
			const pushFence = fixture.controls.fences.push.bind(
				fixture.controls.fences,
			) as typeof fixture.controls.fences.push;
			const fenceObserver = jest.spyOn(fixture.controls.fences, 'push').mockImplementation((...properties) => {
				const result = pushFence(...properties);
				for (const property of properties)
					if (property === relayId) events.push({ kind: 'fence', scope: pendingScopes.shift() });
				return result;
			});
			Object.defineProperty(fixture.controls.fences, 'push', { enumerable: false });
			const admit = owner['reconciled'].set.bind(owner['reconciled']) as (typeof owner)['reconciled']['set'];
			const admissionObserver = jest.spyOn(owner['reconciled'], 'set').mockImplementation((key, proof) => {
				if (key === `${claim.id}:${claim.revision}`) events.push({ kind: 'proof', scope: proof.scope });
				return admit(key, proof);
			});
			let entries = 0;
			const gate = async (property: string) => {
				if (property !== relayId) return;
				pendingScopes.push(owner['releaseScope'](owner['contexts'].get(controllerId)));
				entries++;
				if (entries === 1) {
					enter();
					await held;
				}
			};
			let starting: Promise<void> | undefined;
			let primary: { cause: unknown } | undefined;
			try {
				owner.onModuleDestroy();
				await loader['queue'];
				await peer.initialize();
				const configuration = await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const member = await peer.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id });
				const inputs = await peer.manager.findBy(VirtualThermostatSourceEntity, { controllerId });
				expect(inputs).toHaveLength(1);
				fixture.controls.beforeFence = gate;
				const fences = [...fixture.controls.fences];
				const sendsBefore = [...fixture.controls.sends];
				starting = owner.onApplicationBootstrap();
				void starting.catch(() => undefined);
				await Promise.race([
					entered,
					starting.then(async () => {
						await owner.flush();
						if (entries === 0) throw new Error('Original native OFF fence was not reached');
					}),
				]);
				clearInterval(owner['timer']);
				expect(entries).toBe(1);
				expect(fixture.controls.fences).toEqual(fences);
				const heldScope = owner['releaseScope'](owner['contexts'].get(controllerId));
				if (kind === 'member')
					await peer.query(
						'UPDATE "devices_virtual_thermostat_member_protection" SET "revision" = "revision" + 1 WHERE "claimId" = ?',
						[claim.id],
					);
				else if (kind === 'source')
					await peer.query(
						'UPDATE "devices_virtual_thermostat_sources" SET "maximumAgeSeconds" = "maximumAgeSeconds" + 1 WHERE "controllerId" = ?',
						[controllerId],
					);
				if (kind !== 'unchanged') expect(await peer.query('SELECT changes() AS affected')).toEqual([{ affected: 1 }]);
				expect(await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					configuration,
				);
				expect(
					(await peer.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).revision,
				).toBe(claim.revision);
				expect(await peer.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id })).toEqual({
					...member,
					revision: member.revision + (kind === 'member' ? 1 : 0),
				});
				expect(await peer.manager.findBy(VirtualThermostatSourceEntity, { controllerId })).toEqual(
					inputs.map((input) => ({
						...input,
						maximumAgeSeconds: input.maximumAgeSeconds + (kind === 'source' ? 1 : 0),
					})),
				);
				release();
				await starting;
				clearInterval(owner['timer']);
				await settleReal(fixture);
				expect(fixture.controls.sends).toEqual(sendsBefore);
				expect(
					fixture.controls.fences.slice(fences.length).filter((property) => property === relayId).length,
				).toBeGreaterThanOrEqual(kind === 'unchanged' ? 1 : 2);
				expect(owner.readDiagnostics(controllerId).configuration_revision).toBe(configuration.revision);
				const context = owner['contexts'].get(controllerId);
				expect(context).toBeDefined();
				expect(context.bindings.map((entry) => entry.binding)).toEqual(
					inputs.map((input) => ({
						...input,
						maximumAgeSeconds: input.maximumAgeSeconds + (kind === 'source' ? 1 : 0),
					})),
				);
				expect(context.memberBindings[0].binding.revision).toBe(member.revision + (kind === 'member' ? 1 : 0));
				const freshScope = owner['releaseScope'](context);
				const settledProof = owner['reconciled'].get(`${claim.id}:${claim.revision}`);
				expect(settledProof).toBeDefined();
				expect(settledProof.scope).toBe(freshScope);
				expect(settledProof.scopeIsCurrent()).toBe(true);
				if (kind !== 'unchanged') expect(freshScope).not.toBe(heldScope);
				const freshAdmissions = events.filter((event) => event.kind === 'proof' && event.scope === freshScope);
				expect(freshAdmissions.length).toBeGreaterThan(0);
				for (const admission of freshAdmissions)
					expect(events.slice(0, events.indexOf(admission))).toContainEqual({ kind: 'fence', scope: freshScope });
				expect(pendingScopes).toEqual([]);
				expect(await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					configuration,
				);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				primary = { cause };
			} finally {
				owner.onModuleDestroy();
				loader.onModuleDestroy();
				release();
				const outcomes = await Promise.allSettled([
					...(starting !== undefined ? [starting] : []),
					owner.flush(),
					...owner['inFlight'].values(),
					loader['queue'],
				]);
				const cleanup = outcomes.find((result) => result.status === 'rejected');
				admissionObserver.mockRestore();
				fenceObserver.mockRestore();
				if (fixture.controls.beforeFence === gate) fixture.controls.beforeFence = previousGate;
				else if (fixture.controls.beforeFence !== previousGate)
					primary ??= { cause: new Error('Foreign original OFF fence gate retained') };
				try {
					if (peer.isInitialized) await peer.destroy();
				} catch (cause) {
					primary ??= { cause };
				}
				if (cleanup?.status === 'rejected') primary ??= { cause: cleanup.reason };
			}
			if (primary !== undefined) throw primary.cause;
		},
	);
	it.each(['new-id', 'same-id-risk'] as const)(
		'reconciles independently committed %s ON debt across successive held OFF fences',
		async (kind) => {
			const { fixture, loader, claim } = await useInstalledLockedNativeClaimsGuard();
			const owner = runtime;
			const source = database;
			const peer = new SqliteDataSource({
				type: 'sqlite',
				database: join(directory, 'runtime.sqlite'),
				entities: [__dirname + '/../../../**/*.entity.ts'],
				synchronize: false,
				migrationsRun: false,
			});
			let enterFirst!: () => void, releaseFirst!: () => void;
			let enterSecond!: () => void, releaseSecond!: () => void;
			const firstEntered = ownedGate((resolve) => (enterFirst = resolve));
			const firstHeld = ownedGate((resolve) => (releaseFirst = resolve));
			const secondEntered = ownedGate((resolve) => (enterSecond = resolve));
			const secondHeld = ownedGate((resolve) => (releaseSecond = resolve));
			const previousGate = fixture.controls.beforeFence;
			let entries = 0;
			const gate = async (property: string) => {
				if (property !== relayId) return;
				entries++;
				if (entries === 1) {
					enterFirst();
					await firstHeld;
				} else if (entries === 2) {
					enterSecond();
					await secondHeld;
				}
			};
			// Observe the original provider result and Promise; never obtain the expected proof ID from SQLite.
			const proofs: { fence: number; proofId: string; coveredCommandIds: string[] }[] = [];
			const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
			const proofObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
				const adapter = capture(...args);
				if (!adapter) return adapter;
				return Object.freeze({
					...adapter,
					reconcile: (...parameters: Parameters<typeof adapter.reconcile>) => {
						const original = adapter.reconcile(...parameters);
						void original.then(
							(proof) => {
								if (proof)
									proofs.push({
										fence: entries,
										proofId: proof.proofId,
										coveredCommandIds: [...proof.coveredCommandIds],
									});
							},
							() => undefined,
						);
						return original;
					},
				});
			});
			const requested: Promise<void>[] = [];
			let starting: Promise<void> | undefined;
			let primary: { cause: unknown } | undefined;
			try {
				owner.onModuleDestroy();
				await loader['queue'];
				await peer.initialize();
				const configuration = await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const baseline = await peer.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				const firstId = uuid();
				const secondId = uuid();
				const insertOn = (id: string) =>
					peer.manager.insert(VirtualThermostatCommandEntity, {
						id,
						controllerId,
						claimId: claim.id,
						claimRevision: claim.revision,
						configurationRevision: configuration.revision,
						decisionRevision: 1,
						action: 'on',
						status: 'unknown',
						preparedAt: new Date(),
						dispatchedAt: new Date(),
						settledAt: null,
						proofId: null,
						fault: 'independent-peer-obligation',
					});
				fixture.controls.beforeFence = gate;
				const sendsBefore = [...fixture.controls.sends];
				starting = owner.onApplicationBootstrap();
				void starting.catch(() => undefined);
				await Promise.race([
					firstEntered,
					starting.then(async () => {
						await owner.flush();
						if (entries === 0) throw new Error('First original OFF fence was not reached');
					}),
				]);
				clearInterval(owner['timer']);
				await insertOn(firstId);
				const firstImage = await peer.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: firstId });
				expect(firstImage).toMatchObject({ status: 'unknown', decisionRevision: 1, settledAt: null, proofId: null });
				// A real subsequent poll supplies new entry; it borrows no earlier feedback receipt.
				requested.push(owner.request(controllerId, false));
				releaseFirst();
				await Promise.race([
					secondEntered,
					starting.then(async () => {
						await owner.flush();
						if (entries < 2) throw new Error('Independent ON debt did not reach a new OFF fence');
					}),
				]);
				clearInterval(owner['timer']);
				expect(await peer.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: firstId })).toEqual(firstImage);
				if (kind === 'new-id') await insertOn(secondId);
				else
					await peer.manager.update(
						VirtualThermostatCommandEntity,
						{ id: firstId },
						{ decisionRevision: 2, dispatchedAt: new Date(), status: 'unknown' },
					);
				const obligations = await peer.manager.findBy(VirtualThermostatCommandEntity, {
					controllerId,
					action: 'on',
				});
				expect(obligations.map((row) => row.id).sort()).toEqual(
					(kind === 'new-id' ? [firstId, secondId] : [firstId]).sort(),
				);
				expect(obligations.find((row) => row.id === firstId).decisionRevision).toBe(kind === 'new-id' ? 1 : 2);
				expect(
					obligations.every((row) => row.status === 'unknown' && row.settledAt === null && row.proofId === null),
				).toBe(true);
				requested.push(owner.request(controllerId, false));
				releaseSecond();
				await starting;
				await Promise.all(requested);
				clearInterval(owner['timer']);
				await settleReal(fixture);
				const after = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				for (const original of baseline) expect(after.find((row) => row.id === original.id)).toEqual(original);
				const covering = proofs.filter(
					(proof) => proof.fence >= 3 && obligations.every((row) => proof.coveredCommandIds.includes(row.id)),
				);
				expect(covering).toHaveLength(1);
				const earlier = proofs.find((proof) => proof.fence === 2);
				expect(earlier).toBeDefined();
				expect(covering[0].proofId).not.toBe(earlier.proofId);
				for (const original of obligations) {
					const settled = after.find((row) => row.id === original.id);
					expect(settled).toEqual({
						...original,
						status: 'confirmed',
						settledAt: settled.settledAt,
						proofId: covering[0].proofId,
					});
					expect(settled.settledAt).toBeInstanceOf(Date);
					expect(typeof settled.proofId).toBe('string');
					expect(settled.proofId.length).toBeGreaterThan(0);
				}
				expect(
					after
						.filter((row) => row.action === 'on')
						.map((row) => row.id)
						.sort(),
				).toEqual(obligations.map((row) => row.id).sort());
				expect(entries).toBeGreaterThanOrEqual(3);
				expect(entries).toBeLessThan(5);
				expect(fixture.controls.sends).toEqual(sendsBefore);
				expect(await source.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					configuration,
				);
				expect(
					(await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).revision,
				).toBe(claim.revision);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				primary = { cause };
			} finally {
				owner.onModuleDestroy();
				loader.onModuleDestroy();
				releaseFirst();
				releaseSecond();
				const outcomes = await Promise.allSettled([
					...(starting !== undefined ? [starting] : []),
					...requested,
					owner.flush(),
					...owner['inFlight'].values(),
					loader['queue'],
				]);
				const cleanup = outcomes.find((result) => result.status === 'rejected');
				proofObserver.mockRestore();
				if (fixture.controls.beforeFence === gate) fixture.controls.beforeFence = previousGate;
				else if (fixture.controls.beforeFence !== previousGate)
					primary ??= { cause: new Error('Foreign held OFF fence gate retained') };
				try {
					if (peer.isInitialized) await peer.destroy();
				} catch (cause) {
					primary ??= { cause };
				}
				if (cleanup?.status === 'rejected') primary ??= { cause: cleanup.reason };
			}
			if (primary !== undefined) throw primary.cause;
		},
	);

	it.each([
		{ kind: 'Error', primary: new Error('post-OFF publication P') },
		{ kind: 'string', primary: 'post-OFF publication P' },
		{ kind: 'undefined', primary: undefined },
		{ kind: 'null', primary: null },
	])(
		'preserves post-OFF publication $kind across a failing public poll and a successful successor',
		async ({ primary }) => {
			const { fixture, loader, claim } = await useInstalledLockedNativeClaimsGuard();
			const owner = runtime;
			clearInterval(owner['timer']);
			await fixture.report(sensorId, 21);
			await settleReal(fixture);
			const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const baseline = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			const sendsBefore = [...fixture.controls.sends];
			const baselineReadiness = owner.readDiagnostics(controllerId)?.readiness;
			const obligationId = uuid();
			await database.manager.insert(VirtualThermostatCommandEntity, {
				id: obligationId,
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: configuration.revision,
				decisionRevision: 1,
				action: 'on',
				status: 'unknown',
				preparedAt: new Date(),
				dispatchedAt: new Date(),
				settledAt: null,
				proofId: null,
				fault: 'independent-publication-test-obligation',
			});
			const obligation = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: obligationId });
			type Evaluation = {
				context?: object;
				committed: boolean;
				reconciled: boolean;
				publication: boolean;
				original?: Promise<void>;
				proofId?: string;
				covered?: string[];
			};
			const evaluations = new AsyncLocalStorage<Evaluation>();
			const entered: Evaluation[] = [];
			const originalEvaluate = owner['evaluate'].bind(owner) as (typeof owner)['evaluate'];
			const originalReconcile = owner['reconcile'].bind(owner) as (typeof owner)['reconcile'];
			const originalPublish = owner['publish'].bind(owner) as (typeof owner)['publish'];
			const evaluate = jest
				.spyOn(owner as unknown as { evaluate: typeof originalEvaluate }, 'evaluate')
				.mockImplementation((...args: Parameters<typeof originalEvaluate>) => {
					const entry: Evaluation = { committed: false, reconciled: false, publication: false };
					entered.push(entry);
					const original = evaluations.run(entry, () => originalEvaluate(...args));
					entry.original = original;
					void original.catch(() => undefined);
					return original;
				});
			const reconcile = jest
				.spyOn(owner as unknown as { reconcile: typeof originalReconcile }, 'reconcile')
				.mockImplementation((...args: Parameters<typeof originalReconcile>) => {
					const entry = evaluations.getStore();
					if (entry) entry.context = args[0];
					const original = originalReconcile(...args);
					void original.then(
						() => {
							if (entry) entry.reconciled = true;
						},
						() => undefined,
					);
					return original;
				});
			const publish = jest
				.spyOn(owner as unknown as { publish: typeof originalPublish }, 'publish')
				.mockImplementation((...args: Parameters<typeof originalPublish>) => {
					const entry = evaluations.getStore();
					if (entry) {
						expect(entry.context).toBe(args[0]);
						entry.publication = true;
					}
					return originalPublish(...args);
				});
			const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
			const proofObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
				const adapter = capture(...args);
				if (!adapter) return adapter;
				return Object.freeze({
					...adapter,
					reconcile: (...parameters: Parameters<typeof adapter.reconcile>) => {
						const entry = evaluations.getStore();
						const original = adapter.reconcile(...parameters);
						void original.then(
							(proof) => {
								if (entry && proof) {
									entry.proofId = proof.proofId;
									entry.covered = [...proof.coveredCommandIds];
								}
							},
							() => undefined,
						);
						return original;
					},
				});
			});
			const secondary = new Error('successor native read Q');
			let publicationFault: Evaluation | undefined;
			let secondaryFault: Evaluation | undefined;
			let successor: Promise<void> | undefined;
			let first: Promise<void> | undefined;
			let allowRecovery = false;
			const confirmations = new Set<import('typeorm').QueryRunner>();
			const observer = {
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					if (
						event.success &&
						event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
						event.parameters?.includes('confirmed') &&
						event.parameters.includes(obligationId)
					)
						confirmations.add(event.queryRunner);
					if (event.success && event.query === 'COMMIT' && confirmations.delete(event.queryRunner)) {
						const entry = evaluations.getStore();
						if (entry) entry.committed = true;
					}
					if (event.query === 'ROLLBACK') confirmations.delete(event.queryRunner);
				},
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					const entry = evaluations.getStore();
					if (!entry || allowRecovery) return;
					if (
						!publicationFault &&
						entry.committed &&
						entry.reconciled &&
						entry.publication &&
						event.query.includes('FROM "devices_module_channels_properties"')
					) {
						publicationFault = entry;
						successor = owner.requestInstalled(controllerId);
						void successor.catch(() => undefined);
						// eslint-disable-next-line @typescript-eslint/only-throw-error -- Preserve the deliberately falsy native cause.
						throw primary;
					}
					if (
						publicationFault &&
						entry !== publicationFault &&
						event.query.includes('FROM "devices_virtual_thermostat_configs"')
					) {
						secondaryFault = entry;
						throw secondary;
					}
				},
			};
			database.subscribers.push(observer);
			let failure: { cause: unknown } | undefined;
			try {
				first = owner.requestInstalled(controllerId);
				const trigger = await Promise.allSettled([first]);
				if (trigger[0].status === 'rejected') expect(trigger[0].reason).toBe(primary);
				await owner.flush();
				expect(publicationFault).toBeDefined();
				if (publicationFault?.original === undefined) throw new Error('Native post-OFF publication was not reached');
				const outcome = await Promise.allSettled([publicationFault.original]);
				expect(outcome[0].status).toBe('rejected');
				if (outcome[0].status === 'rejected') expect(outcome[0].reason).toBe(primary);
				expect(publicationFault).toMatchObject({ committed: true, reconciled: true, publication: true });
				expect(publicationFault.covered).toContain(obligationId);
				expect(successor).toBeDefined();
				if (successor === undefined) throw new Error('Original public successor was not issued');
				const followup = await Promise.allSettled([successor]);
				expect(followup[0].status).toBe('rejected');
				if (followup[0].status === 'rejected') expect(followup[0].reason).toBe(secondary);
				expect(secondaryFault).toBeDefined();
				expect(secondaryFault).not.toBe(publicationFault);
				await owner.flush();
				expect(owner.readDiagnostics(controllerId)).toMatchObject({
					readiness: 'unavailable',
					reasons: ['runtime_error'],
				});
				const settled = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				const confirmed = settled.find((row) => row.id === obligationId);
				expect(confirmed).toEqual({
					...obligation,
					status: 'confirmed',
					settledAt: expect.any(Date) as Date,
					proofId: publicationFault.proofId,
				});
				expect(publicationFault.proofId).toEqual(expect.any(String));
				for (const row of baseline) expect(settled.find((saved) => saved.id === row.id)).toEqual(row);
				expect(settled).toHaveLength(baseline.length + 2);
				const remedialOff = settled.filter(
					(row) => row.id !== obligationId && !baseline.some((old) => old.id === row.id),
				);
				expect(remedialOff).toEqual([
					expect.objectContaining({ action: 'off', status: 'confirmed', proofId: publicationFault.proofId }),
				]);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual(sendsBefore.filter((send) => send.on));
				const countAtFailure = entered.length;
				await fixture.flushTelemetry();
				await owner.flush();
				expect(entered).toHaveLength(countAtFailure); // No self-scheduled failure/probe loop.
				allowRecovery = true;
				await expect(owner.requestInstalled(controllerId)).resolves.toBeUndefined();
				await owner.flush();
				expect(entered.length).toBeGreaterThan(countAtFailure);
				expect(owner.readDiagnostics(controllerId)).toMatchObject({
					readiness: baselineReadiness,
					configuration_revision: configuration.revision,
					branches: [expect.objectContaining({ release_proven: true, activity: 'off', pending_on: false })],
				});
				expect(owner.readDiagnostics(controllerId)?.reasons).not.toContain('runtime_error');
				expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(settled);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					configuration,
				);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual(sendsBefore.filter((send) => send.on));
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				owner.onModuleDestroy();
				loader.onModuleDestroy();
				const cleanup = await Promise.allSettled([owner.flush(), ...owner['inFlight'].values(), loader['queue']]);
				await Promise.allSettled([
					...(first !== undefined ? [first] : []),
					...(successor !== undefined ? [successor] : []),
				]);
				for (const result of cleanup) if (result.status === 'rejected') failure ??= { cause: result.reason };
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				proofObserver.mockRestore();
				publish.mockRestore();
				reconcile.mockRestore();
				evaluate.mockRestore();
			}
			if (failure) throw failure.cause;
		},
	);

	it.each(
		[
			{ kind: 'undefined', primary: undefined },
			{ kind: 'null', primary: null },
			{ kind: 'false', primary: false },
			{ kind: 'string', primary: 'first native save P' },
			{ kind: 'Error', primary: new Error('first native save P') },
		].flatMap((row) => ['succeeds', 'fails'].map((repair) => ({ ...row, repair }))),
	)('preserves original $kind outcome-save failure when the diagnostic repair $repair', async ({ primary, repair }) => {
		const { fixture, claims } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const expected = await comfortFence();
		const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		let enterOn!: () => void, releaseOn!: () => void, enterRead!: () => void, releaseRead!: () => void;
		const onEntered = ownedGate((resolve) => (enterOn = resolve));
		const onResume = ownedGate((resolve) => (releaseOn = resolve));
		const readEntered = ownedGate((resolve) => (enterRead = resolve));
		const readResume = ownedGate((resolve) => (releaseRead = resolve));
		const previousGate = fixture.controls.beforeOn;
		const gate = async (property: string) => {
			if (property === relayId) {
				enterOn();
				await onResume;
			}
		};
		fixture.controls.beforeOn = gate;
		const sends: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
		const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const transportObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const adapter = capture(...args);
			if (!adapter) return adapter;
			return Object.freeze({
				...adapter,
				send: (...parameters: Parameters<typeof adapter.send>) => {
					const original = adapter.send(...parameters);
					if (parameters[0].value === true && parameters[0].property.id === relayId) {
						sends.push(parameters);
						void original.then(
							(result) => {
								outcomes.push(result);
							},
							() => undefined,
						);
					}
					return original;
				},
			});
		});
		const roots = new AsyncLocalStorage<object>();
		const root = Object.freeze({ owner });
		const secondary = new Error('diagnostic repair Q');
		const logged = jest.spyOn(owner['logger'], 'error').mockImplementation(() => undefined);
		let readHeld = false,
			saves = 0;
		let commandId: string | undefined;
		const subscriber = {
			beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					!readHeld &&
					roots.getStore() === root &&
					event.query.startsWith('SELECT') &&
					event.query.includes('devices_virtual_thermostat_configs') &&
					event.parameters?.includes(controllerId)
				) {
					readHeld = true;
					enterRead();
					await readResume;
				}
				if (
					commandId !== undefined &&
					event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
					event.parameters?.includes(commandId) &&
					event.parameters.includes('cancelled')
				) {
					saves++;
					if (saves === 1) {
						// eslint-disable-next-line @typescript-eslint/only-throw-error -- Deliberately preserve falsy native failures.
						throw primary;
					}
					if (saves === 2 && repair === 'fails') throw secondary;
				}
			},
		};
		let operation: Promise<void> | undefined;
		let mutation: ReturnType<typeof comfort.select> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			await fixture.report(sensorId, 18);
			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					onEntered,
					new Promise<never>((_, reject) => {
						timeout = setTimeout(
							() =>
								reject(
									new Error('Native ON entry not reached: ' + JSON.stringify(owner.readDiagnostics(controllerId))),
								),
							5_000,
						);
					}),
				]);
			} finally {
				clearTimeout(timeout);
			}
			await owner.flush();
			expect(sends).toHaveLength(1);
			commandId = sends[0][4].commandId;
			expect(sends[0][3]()).toBe(true);
			expect(claims.capture().isCurrent()).toBe(true);
			const before = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			const held = before.find((row) => row.id === commandId);
			expect(held).toMatchObject({ action: 'on', status: 'dispatching', settledAt: null, proofId: null });
			operation = owner['inFlight'].get(commandId);
			if (operation === undefined) throw new Error('Original native ON command missing');
			void operation.catch(() => undefined);
			database.subscribers.push(subscriber);
			mutation = roots.run(root, () => comfort.select(controllerId, expected, 'eco', false));
			void mutation.catch(() => undefined);
			await readEntered;
			expect(sends[0][3]()).toBe(false);
			releaseOn();
			await fixture.flushTelemetry();
			owner.onModuleDestroy();
			releaseRead();
			const result = await Promise.allSettled([mutation, operation]);
			for (const outcome of result) {
				expect(outcome.status).toBe('rejected');
				if (outcome.status === 'rejected') expect(outcome.reason).toBe(primary);
			}
			expect(saves).toBe(2);
			if (repair === 'fails') {
				expect(logged).toHaveBeenCalledTimes(1);
				expect(logged).toHaveBeenCalledWith('Failed to persist original thermostat command failure', secondary);
			} else expect(logged).not.toHaveBeenCalled();
			expect(outcomes).toEqual([expect.objectContaining({ outcome: 'refused' })]);
			const after = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
			for (const row of before)
				expect(after.find((saved) => saved.id === row.id)).toEqual(
					row.id !== commandId || repair === 'fails'
						? row
						: {
								...row,
								status: 'cancelled',
								settledAt: expect.any(Date) as Date,
								fault: primary instanceof Error ? primary.message : 'dispatch_error',
							},
				);
			expect(after.find((row) => row.id === commandId)?.proofId).toBeNull();
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
				configuration,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			releaseOn();
			releaseRead();
			const cleanup = await Promise.allSettled([owner.flush()]);
			await Promise.allSettled([
				...(mutation !== undefined ? [mutation] : []),
				...(operation !== undefined ? [operation] : []),
			]);
			for (const outcome of cleanup) if (outcome.status === 'rejected') failure ??= { cause: outcome.reason };
			const index = database.subscribers.indexOf(subscriber);
			if (index >= 0) database.subscribers.splice(index, 1);
			transportObserver.mockRestore();
			logged.mockRestore();
			if (fixture.controls.beforeOn === gate) fixture.controls.beforeOn = previousGate;
			else failure ??= { cause: new Error('Foreign native ON gate retained') };
		}
		if (failure !== undefined) throw failure.cause;
	});

	it.each([
		{ kind: 'Error', primary: new Error('ordinary native outcome P'), fail: true },
		{ kind: 'undefined', primary: undefined, fail: true },
		{ kind: 'null', primary: null, fail: true },
		{ kind: 'returned-safety', primary: undefined, fail: false },
	])('allows guarded OFF with unavailable optional baseline and preserves $kind outcome', async ({ primary, fail }) => {
		const { fixture, claims } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		await fixture.report(sensorId, 21);
		await settleReal(fixture);
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const before = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		const debtId = uuid();
		await database.manager.insert(VirtualThermostatCommandEntity, {
			id: debtId,
			controllerId,
			claimId: claim.id,
			claimRevision: claim.revision,
			configurationRevision: config.revision,
			decisionRevision: 1,
			action: 'on',
			status: 'unknown',
			preparedAt: new Date(),
			dispatchedAt: new Date(),
			settledAt: null,
			proofId: null,
			fault: 'controlled-native-debt',
		});
		const debt = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: debtId });
		const loads = new AsyncLocalStorage<boolean>();
		const originalLoad = owner['load'].bind(owner) as (typeof owner)['load'];
		const load = jest
			.spyOn(owner as unknown as { load: typeof originalLoad }, 'load')
			.mockImplementation((...args) => loads.run(true, () => originalLoad(...args)));
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const issued: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
		const results: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const proofs: { proofId: string; ids: string[] }[] = [];
		const observer = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const adapter = capture(...args);
			if (!adapter) return adapter;
			return Object.freeze({
				...adapter,
				reconcile: (...parameters: Parameters<typeof adapter.reconcile>) => {
					const original = adapter.reconcile(...parameters);
					void original.then(
						(proof) => {
							if (proof) proofs.push({ proofId: proof.proofId, ids: [...proof.coveredCommandIds] });
						},
						() => undefined,
					);
					return original;
				},
				send: (...parameters: Parameters<typeof adapter.send>) => {
					const original = adapter.send(...parameters);
					if (parameters[0].property.id === relayId && parameters[0].value === false) {
						issued.push(parameters);
						void original.then(
							(result) => {
								results.push(result);
							},
							() => undefined,
						);
					}
					return original;
				},
			});
		});
		const secondary = new Error('optional ON-baseline Q');
		let baselines = 0,
			faults = 0;
		const subscriber = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					loads.getStore() === true &&
					event.query.startsWith('SELECT "owned".') &&
					event.query.includes('FROM "devices_virtual_thermostat_configs" "owned"')
				) {
					baselines++;
					throw secondary;
				}
				if (
					fail &&
					faults === 0 &&
					issued.length > 0 &&
					event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
					event.parameters?.includes(issued[0][4].commandId) &&
					event.parameters.includes('accepted')
				) {
					faults++;
					throw primary;
				}
			},
		};
		database.subscribers.push(subscriber);
		let requested: Promise<void> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			requested = owner.requestInstalled(controllerId);
			const outcome = (await Promise.allSettled([requested]))[0];
			expect(outcome.status).toBe(fail ? 'rejected' : 'fulfilled');
			if (outcome.status === 'rejected') expect(outcome.reason).toBe(primary);
			expect(baselines).toBeGreaterThan(0);
			expect(faults).toBe(fail ? 1 : 0);
			expect(issued).toHaveLength(1);
			expect(results).toMatchObject([{ outcome: 'accepted' }]);
			expect(claims.capture().isCurrent()).toBe(true);
			await owner.flush();
			const after = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(after.map((row) => row.id).sort()).toEqual(
				[...before.map((row) => row.id), debtId, issued[0][4].commandId].sort(),
			);
			for (const row of before) expect(after.find((saved) => saved.id === row.id)).toEqual(row);
			const debtAfter = after.find((row) => row.id === debtId);
			const covering = proofs.find((proof) => proof.ids.includes(debtId) && proof.ids.includes(issued[0][4].commandId));
			expect(debtAfter).toEqual(
				covering
					? { ...debt, status: 'confirmed', settledAt: expect.any(Date) as Date, proofId: covering.proofId }
					: debt,
			);
			expect(after.find((row) => row.id === issued[0][4].commandId)).toMatchObject({
				action: 'off',
				status: covering ? 'confirmed' : fail ? 'unknown' : 'accepted',
				proofId: covering?.proofId ?? null,
				fault: fail ? (primary instanceof Error ? primary.message : 'dispatch_error') : null,
			});
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(config);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			const cleanup = await Promise.allSettled([owner.flush(), ...owner['inFlight'].values()]);
			await Promise.allSettled([...(requested !== undefined ? [requested] : [])]);
			for (const result of cleanup)
				if (result.status === 'rejected' && !Object.is(result.reason, primary)) failure ??= { cause: result.reason };
			const index = database.subscribers.indexOf(subscriber);
			if (index >= 0) database.subscribers.splice(index, 1);
			observer.mockRestore();
			load.mockRestore();
		}
		if (failure !== undefined) throw failure.cause;
	});

	it('joins the original native OFF command while its outcome UPDATE is held', async () => {
		const { fixture } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		owner.onModuleDestroy();
		await owner.flush();
		const before = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const held = ownedGate((resolve) => (release = resolve));
		let enterBeforeOutcome!: () => void, releaseBeforeOutcome!: () => void;
		const beforeOutcomeEntered = ownedGate((resolve) => (enterBeforeOutcome = resolve));
		const beforeOutcomeHeld = ownedGate((resolve) => (releaseBeforeOutcome = resolve));
		const previousFence = fixture.controls.beforeFence;
		let heldBeforeOutcome = false;
		const beforeOutcome = async (property: string) => {
			if (property === relayId && !heldBeforeOutcome) {
				heldBeforeOutcome = true;
				enterBeforeOutcome();
				await beforeOutcomeHeld;
			}
			await previousFence?.(property);
		};
		fixture.controls.beforeFence = beforeOutcome;
		const commands: string[] = [];
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const transportObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const adapter = capture(...args);
			if (!adapter) return adapter;
			return Object.freeze({
				...adapter,
				send: (...parameters: Parameters<typeof adapter.send>) => {
					const original = adapter.send(...parameters);
					if (parameters[0].property.id === relayId && parameters[0].value === false)
						commands.push(parameters[4].commandId);
					return original;
				},
			});
		});
		let heldId: string | undefined;
		const subscriber = {
			beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					heldId === undefined &&
					event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
					event.parameters?.includes('accepted')
				) {
					const selected = commands.find((id) => event.parameters?.includes(id));
					if (selected !== undefined) {
						heldId = selected;
						enter();
						await held;
					}
				}
			},
		};
		database.subscribers.push(subscriber);
		let starting: Promise<void> | undefined, joined: Promise<void> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			starting = owner.onApplicationBootstrap();
			void starting.catch(() => undefined);
			// Hold the physical OFF before outcome SQL, so its issuing evaluation can finish without contention.
			await beforeOutcomeEntered;
			await starting;
			clearInterval(owner['timer']);
			await owner.flush();
			expect(owner['queues'].size).toBe(0);
			expect(owner['inFlight'].size).toBe(1);
			expect(commands).toHaveLength(1);
			const originalId = commands[0];
			const original = owner['inFlight'].get(originalId);
			expect(original).toBeDefined();
			let completed = false;
			joined = owner.capturePredecessors(controllerId);
			void joined.then(
				() => {
					completed = true;
				},
				() => {
					completed = true;
				},
			);
			await Promise.resolve();
			await Promise.resolve();
			expect(completed).toBe(false);
			expect(owner['inFlight'].get(originalId)).toBe(original);
			// Capture only the already-detached original command; later feedback evaluations cannot prolong this snapshot.
			releaseBeforeOutcome();
			await entered;
			expect(heldId).toBe(originalId);
			expect(completed).toBe(false);
			expect(owner['inFlight'].get(originalId)).toBe(original);
			release();
			await Promise.all([starting, joined, ...(original !== undefined ? [original] : [])]);
			clearInterval(owner['timer']);
			await settleReal(fixture);
			expect(completed).toBe(true);
			const after = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(after.map((row) => row.id).sort()).toEqual([...before.map((row) => row.id), ...commands].sort());
			for (const row of before) expect(after.find((saved) => saved.id === row.id)).toEqual(row);
			expect(after.find((row) => row.id === heldId)).toMatchObject({
				action: 'off',
				status: 'confirmed',
				proofId: expect.any(String) as string,
			});
			expect(owner.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			releaseBeforeOutcome();
			release();
			const results = await Promise.allSettled([
				owner.flush(),
				...owner['inFlight'].values(),
				...(starting !== undefined ? [starting] : []),
				...(joined !== undefined ? [joined] : []),
			]);
			for (const result of results) if (result.status === 'rejected') failure ??= { cause: result.reason };
			const index = database.subscribers.indexOf(subscriber);
			if (index >= 0) database.subscribers.splice(index, 1);
			transportObserver.mockRestore();
			if (fixture.controls.beforeFence === beforeOutcome) fixture.controls.beforeFence = previousFence;
			else failure ??= { cause: new Error('Foreign detached OFF gate retained') };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it.each([
		'none',
		'journal-same-value',
		'slot-same-value',
		'config-same-value',
		'claim-same-value',
		'graph',
		'missing-row',
		'foreign-fault',
		'extra-journal',
	] as const)('preserves admitted comfort repeat isolation after original native ON: %s', async (effect) => {
		const { fixture } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const expected = await comfortFence();
		let enterOn!: () => void, releaseOn!: () => void, enterRead!: () => void, releaseRead!: () => void;
		const onEntered = ownedGate((resolve) => (enterOn = resolve));
		const onHeld = ownedGate((resolve) => (releaseOn = resolve));
		const readEntered = ownedGate((resolve) => (enterRead = resolve));
		const readHeld = ownedGate((resolve) => (releaseRead = resolve));
		const previousGate = fixture.controls.beforeOn;
		const gate = async (property: string) => {
			if (property !== relayId) return;
			enterOn();
			await onHeld;
		};
		fixture.controls.beforeOn = gate;
		const sends: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
		const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const transport = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const adapter = capture(...args);
			if (!adapter) return adapter;
			return Object.freeze({
				...adapter,
				send: (...parameters: Parameters<typeof adapter.send>) => {
					const original = adapter.send(...parameters);
					if (parameters[0].property.id === relayId && parameters[0].value === true) {
						sends.push(parameters);
						void original.then(
							(result) => outcomes.push(result),
							() => undefined,
						);
					}
					return original;
				},
			});
		});
		const roots = new AsyncLocalStorage<object>();
		const root = Object.freeze({ owner });
		const tables = [
			'devices_virtual_thermostat_configs',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_sources',
			'devices_module_climate_automation_slots',
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_graph_revision',
		];
		const snapshot = async (manager: EntityManager) => {
			const image: Record<string, Array<Record<string, unknown>>> = {};
			for (const table of tables)
				image[table] = await manager.query<Array<Record<string, unknown>>>(`SELECT * FROM "${table}" ORDER BY rowid`);
			return image;
		};
		let commandId: string | undefined, claimId: string | undefined;
		let firstRead = true,
			nativeRead = false,
			originalSettled = false,
			injected = false;
		let before: Awaited<ReturnType<typeof snapshot>> | undefined;
		const extraId = uuid();
		const observer = {
			beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (
					firstRead &&
					roots.getStore() === root &&
					event.query.startsWith('SELECT') &&
					event.query.includes('devices_virtual_thermostat_configs') &&
					event.parameters?.includes(controllerId)
				) {
					firstRead = false;
					enterRead();
					await readHeld;
				}
			},
			afterQuery: async (event: AfterQueryEvent<unknown>) => {
				if (
					nativeRead ||
					roots.getStore() !== root ||
					!event.queryRunner.isTransactionActive ||
					!event.query.startsWith('SELECT') ||
					!event.query.includes('devices_virtual_thermostat_configs')
				)
					return;
				nativeRead = true;
				expect(originalSettled).toBe(true);
				expect(commandId).toBeDefined();
				before = await snapshot(event.queryRunner.manager);
				const journal = 'devices_virtual_thermostat_command_journal';
				expect(before[journal].find((row) => row.id === commandId)).toMatchObject({
					id: commandId,
					claimId,
					status: 'cancelled',
					proofId: null,
				});
				expect(
					before.devices_module_climate_automation_slots.filter((row) => row.controllerId === controllerId),
				).toHaveLength(1);
				expect(
					before.devices_virtual_thermostat_configs.filter((row) => row.controllerId === controllerId),
				).toHaveLength(1);
				expect(before.devices_virtual_thermostat_actuator_claims.filter((row) => row.id === claimId)).toHaveLength(1);

				const statements: Readonly<Record<string, readonly [string, readonly unknown[]]>> = {
					'journal-same-value': [
						'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = "status" WHERE "id" = ?',
						[commandId],
					],
					'slot-same-value': [
						'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" WHERE "controllerId" = ?',
						[controllerId],
					],
					'config-same-value': [
						'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" WHERE "controllerId" = ?',
						[controllerId],
					],
					'claim-same-value': [
						'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = "revision" WHERE "id" = ?',
						[claimId],
					],
					graph: ['UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1', []],
					'missing-row': ['DELETE FROM "devices_virtual_thermostat_command_journal" WHERE "id" = ?', [commandId]],
					'foreign-fault': [
						'UPDATE "devices_virtual_thermostat_command_journal" SET "fault" = ? WHERE "id" = ?',
						['foreign outcome', commandId],
					],
				};
				if (effect === 'extra-journal') {
					const row = await event.queryRunner.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
						id: commandId,
					});
					await event.queryRunner.manager.insert(VirtualThermostatCommandEntity, {
						...row,
						id: extraId,
						status: 'prepared',
					});
					injected = true;
				} else if (effect !== 'none') {
					const [sql, bindings] = statements[effect];
					await event.queryRunner.query(sql, [...bindings]);
					injected = true;
				}
				const during = await snapshot(event.queryRunner.manager);
				if (effect.endsWith('same-value')) {
					const table =
						effect === 'slot-same-value'
							? 'devices_module_climate_automation_slots'
							: effect === 'config-same-value'
								? 'devices_virtual_thermostat_configs'
								: effect === 'claim-same-value'
									? 'devices_virtual_thermostat_actuator_claims'
									: journal;
					expect(during[table]).toEqual(before[table]);
				}
				if (effect === 'missing-row') expect(during[journal].some((row) => row.id === commandId)).toBe(false);
				if (effect === 'foreign-fault')
					expect(during[journal].find((row) => row.id === commandId)?.fault).toBe('foreign outcome');
				if (effect === 'graph')
					expect(during.devices_virtual_graph_revision[0].revision).toBe(
						Number(before.devices_virtual_graph_revision[0].revision) + 1,
					);
				if (effect === 'extra-journal') {
					expect(during[journal]).toHaveLength(before[journal].length + 1);
					expect(during[journal].find((row) => row.id === extraId)).toMatchObject({ status: 'prepared', controllerId });
				}
			},
		};
		let operation: Promise<void> | undefined;
		let mutation: ReturnType<typeof comfort.configure> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			await fixture.report(sensorId, 18);
			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					onEntered,
					new Promise<never>((_, reject) => {
						timeout = setTimeout(
							() =>
								reject(
									new Error('Native ON entry not reached: ' + JSON.stringify(owner.readDiagnostics(controllerId))),
								),
							5000,
						);
					}),
				]);
			} finally {
				clearTimeout(timeout);
			}
			await owner.flush();
			expect(sends).toHaveLength(1);
			commandId = sends[0][4].commandId;
			claimId = sends[0][1].id;
			expect(sends[0][3]()).toBe(true);
			operation = owner['inFlight'].get(commandId);
			if (operation === undefined) throw new Error('Original managed command unavailable');
			void operation.then(
				() => {
					originalSettled = true;
				},
				() => undefined,
			);
			database.subscribers.push(observer);
			mutation = roots.run(root, () =>
				comfort.configure(controllerId, expected, {
					automation_enabled: true,
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				}),
			);
			void mutation.catch(() => undefined);
			expect(sends[0][3]()).toBe(false);
			await readEntered;
			releaseOn();
			await fixture.flushTelemetry();
			owner.onModuleDestroy();
			releaseRead();
			const [selection, command] = await Promise.allSettled([mutation, operation]);
			expect(command.status).toBe('fulfilled');
			expect(nativeRead).toBe(true);
			expect(injected).toBe(effect !== 'none');
			if (effect === 'none') {
				expect(selection.status).toBe('fulfilled');
				if (selection.status === 'fulfilled') expect(selection.value.revision).toBe(expected.expected_revision);
			} else expect(selection.status).toBe('rejected');
			expect(before).toBeDefined();
			expect(await snapshot(database.manager)).toEqual(before);
			expect(await database.manager.countBy(VirtualThermostatCommandEntity, { id: extraId })).toBe(0);
			expect(outcomes).toEqual([expect.objectContaining({ outcome: 'refused' })]);
			expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: commandId })).toMatchObject({
				status: 'cancelled',
				proofId: null,
			});
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			releaseOn();
			releaseRead();
			const cleanup = await Promise.allSettled([owner.flush()]);
			await Promise.allSettled([
				...(mutation !== undefined ? [mutation] : []),
				...(operation !== undefined ? [operation] : []),
			]);
			for (const outcome of cleanup) if (outcome.status === 'rejected') failure ??= { cause: outcome.reason };
			const index = database.subscribers.indexOf(observer);
			if (index >= 0) database.subscribers.splice(index, 1);
			transport.mockRestore();
			if (fixture.controls.beforeOn === gate) fixture.controls.beforeOn = previousGate;
			else failure ??= { cause: new Error('Foreign native ON gate retained') };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it.each([
		'none',
		'own-shadow',
		'nearer-getter',
		'canonical-getter',
		'canonical-setter',
		'canonical-flags',
		'chain-link',
		'generation-restored',
		'get-restored',
		'active-own-shadow',
	] as const)('keeps original managed OFF metadata closed after observed %s restoration', async (variant) => {
		const activeOwner = variant === 'active-own-shadow';
		const change = activeOwner ? 'own-shadow' : variant;
		const { fixture, claims } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		const provider = comfort['automation'];
		if (provider === undefined) throw new Error('Registered automation provider missing');
		const ledger = provider['ledger'];
		provider['registry'].registerProducerOwned('test-off-metadata:v1', {
			validateInManager: () => Promise.resolve({ selection: 'eco' }),
		});
		let receipt: ReturnType<typeof observeSqliteOuterOutcome> | undefined;
		let installed: Awaited<ReturnType<typeof ledger.installBundle>>[number]['facts'] | undefined;
		await owner['structure'].runExclusiveReleased(() =>
			owner['graph'].withControllerMutationWrite(
				async (manager) => {
					await provider.explicitOptIn(manager, controllerId);
					const scope = ledger.currentScope(manager);
					const previous = await ledger.readSource(manager, scope, 'test-off-metadata:v1', 'room');
					const source = await ledger.stageSource(manager, scope, {
						producerKey: 'test-off-metadata:v1',
						subjectId: 'room',
						expected: previous,
						evidence: { selection: 'eco' },
					});
					const slot = await ledger.readSlot(manager, scope, controllerId, true, 'virtual-thermostat:v1');
					const candidate = await ledger.stageSlot(manager, scope, {
						expectedSlot: slot,
						expectedSource: source,
						selection: { preset: 'eco', setpoints: null },
						bundleId: uuid(),
					});
					const [installedSlot] = await ledger.installBundle(manager, scope, source, [candidate]);
					installed = installedSlot.facts;
					await owner['graph'].sealControllerLedger(manager);
				},
				undefined,
				(manager) => {
					receipt = observeSqliteOuterOutcome(manager);
				},
				() => {
					expect(receipt?.outcome).toBe('committed');
				},
			),
		);
		if (installed === undefined) throw new Error('Installed baseline absent');
		expect(await provider.activateLocal(database.manager, installed)).toBe(true);
		const machineSession = fixture.captureSession(relayId);
		if (!machineSession?.isCurrent()) throw new Error('Original native machine session absent');
		for (const qualification of installedQualifications.values())
			claims.recordQualification({ ...qualification, machineLeaseIsCurrent: () => machineSession.isCurrent() });
		await claims.refresh();
		await settleReal(fixture);
		expect(owner['contexts'].get(controllerId)?.automation?.baseline?.preset).toBe('eco');
		clearInterval(owner['timer']);
		await owner.flush();
		const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const held = ownedGate((resolve) => (release = resolve));
		type Metadata = NonNullable<ReturnType<typeof fixture.transport.captureOffMetadata>>;
		const captures: Array<{ args: Parameters<typeof fixture.transport.captureOffMetadata>; metadata: Metadata }> = [];
		const metadataMethod = fixture.transport.captureOffMetadata.bind(
			fixture.transport,
		) as typeof fixture.transport.captureOffMetadata;
		const metadataObserver = jest.spyOn(fixture.transport, 'captureOffMetadata').mockImplementation((...args) => {
			const metadata = metadataMethod(...args);
			if (metadata && args[0].property.id === relayId) captures.push({ args, metadata });
			return metadata;
		});
		let adapter: ReturnType<typeof fixture.transport.capture>;
		let reconciling: object | undefined;
		const proofs: Array<Awaited<ReturnType<ThermostatActuationAdapter['reconcile']>>> = [];
		const captureMethod = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const adapterObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const original = captureMethod(...args);
			if (!original) return original;
			if (args[0].property.id === relayId) adapter = original;
			return Object.freeze({
				...original,
				reconcile: (...parameters: Parameters<typeof original.reconcile>) => {
					const ticket = Object.freeze({});
					reconciling = ticket;
					const result = original.reconcile(...parameters);
					void result.then(
						() => {
							if (reconciling === ticket) reconciling = undefined;
						},
						() => {
							if (reconciling === ticket) reconciling = undefined;
						},
					);
					void result.then(
						(proof) => proofs.push(proof),
						() => undefined,
					);
					return result;
				},
			});
		});
		const observedNativeProofIds: Array<string | null> = [];
		const nativeProofObserver = {
			afterQuery: async (event: import('typeorm').AfterQueryEvent<unknown>) => {
				if (
					!activeOwner ||
					!/^UPDATE /i.test(event.query) ||
					!event.query.includes('devices_virtual_thermostat_branch_runtime')
				)
					return;
				const rows = await event.queryRunner.manager.find(VirtualThermostatBranchRuntimeEntity);
				observedNativeProofIds.push(...rows.map((row) => row.releaseProofId));
			},
		};
		database.subscribers.push(nativeProofObserver);
		let selected: (typeof captures)[number] | undefined;
		const previousFence = fixture.controls.beforeFence;
		const fence = async (property: string) => {
			if (!selected && reconciling !== undefined && property === relayId && captures.length > 0) {
				selected = captures[captures.length - 1];
				enter();
				await held;
			}
			await previousFence?.(property);
		};
		fixture.controls.beforeFence = fence;
		const canonical = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');
		const getDescriptor = Object.getOwnPropertyDescriptor(fixture.transport, 'get');
		let restore: (() => void) | undefined;
		let starting: Promise<void> | undefined, driving: Promise<void> | undefined;
		let failure: { cause: unknown } | undefined;
		let getters = 0;
		try {
			const claimRow = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const evidence = claims.qualification(claimRow, false);
			if (!evidence) throw new Error('Original managed evidence absent');
			claims.revokeQualification(claimRow.physicalIdentity);
			claims.recordQualification(evidence);
			await claims.refresh();
			starting = owner.requestInstalled(controllerId);
			void starting.catch(() => undefined);
			driving = starting.then(async () => {
				for (let phase = 0; phase < 5; phase++) {
					await fixture.flushTelemetry();
					await owner.requestInstalled(controllerId);
					if (selected !== undefined) return;
				}
			});
			void driving.catch(() => undefined);
			await Promise.race([
				entered,
				driving.then(() => {
					throw new Error(
						'Original OFF metadata fence not reached: ' +
							JSON.stringify({
								captures: captures.length,
								proofs: proofs.length,
								baseline: owner['contexts'].get(controllerId)?.automation?.baseline,
								diagnostics: owner.readDiagnostics(controllerId),
							}),
					);
				}),
			]);
			if (!selected || !canonical || !adapter) throw new Error('Original OFF capture unavailable');
			const [target, claim, qualification] = selected.args;
			const device = target.device;
			const prototype = Object.getPrototypeOf(device) as object;
			const generation = claim.qualificationGeneration;
			expect(device).toBeInstanceOf(ShellyNgDeviceEntity);
			expect(prototype).toBe(ShellyNgDeviceEntity.prototype);
			expect(Object.getOwnPropertyDescriptor(device, 'type')).toBeUndefined();
			expect(generation).toBeNull();
			expect(Object.getOwnPropertyDescriptor(qualification, 'qualificationGeneration')).toBeUndefined();
			expect(
				await database.manager.query(
					'SELECT "qualificationGeneration" FROM "devices_virtual_thermostat_actuator_claims" WHERE "id" = ?',
					[claim.id],
				),
			).toEqual([{ qualificationGeneration: null }]);
			const before = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(before.some((row) => row.action === 'off' && row.status === 'confirmed')).toBe(true);
			const originalCurrent = change === 'get-restored' ? adapter.isCurrent : selected.metadata.isCurrent;
			expect(originalCurrent()).toBe(true);
			const getter = () => {
				getters++;
				return DEVICES_SHELLY_NG_TYPE;
			};
			restore = () => {
				Reflect.deleteProperty(device, 'type');
				Object.setPrototypeOf(device, prototype);
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', canonical);
				claim.qualificationGeneration = generation;
				if (getDescriptor) Object.defineProperty(fixture.transport, 'get', getDescriptor);
				else Reflect.deleteProperty(fixture.transport, 'get');
			};
			if (change === 'own-shadow')
				Object.defineProperty(device, 'type', { value: DEVICES_SHELLY_NG_TYPE, configurable: true });
			else if (change === 'nearer-getter' || change === 'chain-link') {
				const nearer = Object.create(prototype) as object;
				if (change === 'nearer-getter') Object.defineProperty(nearer, 'type', { get: getter, configurable: true });
				Object.setPrototypeOf(device, nearer);
			} else if (change === 'canonical-getter')
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, get: getter });
			else if (change === 'canonical-setter')
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, set: () => undefined });
			else if (change === 'canonical-flags')
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', {
					...canonical,
					enumerable: !canonical.enumerable,
				});
			else if (change === 'generation-restored') claim.qualificationGeneration = 'observed-foreign-generation';
			else if (change === 'get-restored')
				Object.defineProperty(fixture.transport, 'get', { configurable: true, writable: true, value: () => null });
			if (change !== 'none') {
				expect(originalCurrent()).toBe(false);
				expect(getters).toBe(0);
				restore();
				expect(originalCurrent()).toBe(false);
				expect(getters).toBe(0);
				const fresh =
					change === 'get-restored'
						? captureMethod(target, claim, qualification)
						: metadataMethod(target, claim, qualification);
				expect(fresh?.isCurrent()).toBe(true);
				if (!activeOwner) owner.onModuleDestroy();
			}
			release();
			await driving;
			await starting;
			await fixture.flushTelemetry();
			if (activeOwner) {
				expect(owner['active']).toBe(true);
				await owner.flush();
				const originalProof = proofs[0];
				if (!originalProof) throw new Error('Original SDK did not return its actual proof');
				expect(originalProof.isCurrent()).toBe(true);
				expect(selected.metadata.isCurrent()).toBe(false);
				expect(observedNativeProofIds).not.toContain(originalProof.proofId);
				await settleReal(fixture);
				const branch = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, {
					claimId: claim.id,
				});
				expect(branch.releaseProofId).not.toBe(originalProof.proofId);
				expect(proofs.slice(1).some((proof) => proof?.proofId === branch.releaseProofId)).toBe(true);
				expect(observedNativeProofIds).not.toContain(originalProof.proofId);
				expect(owner.readDiagnostics(controllerId).branches.every((entry) => entry.release_proven)).toBe(true);
			}
			if (change === 'none') {
				await settleReal(fixture);
				expect(owner.readDiagnostics(controllerId).branches.every((branch) => branch.release_proven)).toBe(true);
				const branch = await database.manager.findOneByOrFail(VirtualThermostatBranchRuntimeEntity, {
					claimId: claim.id,
				});
				expect(proofs.some((proof) => proof?.proofId === branch.releaseProofId)).toBe(true);
			}
			const after = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
			for (const row of before) {
				const current = after.find((entry) => entry.id === row.id);
				if ((change !== 'none' && !activeOwner) || row.status === 'confirmed') expect(current).toEqual(row);
				else {
					expect(current).toMatchObject({
						...row,
						status: 'confirmed',
						fault: null,
						settledAt: expect.any(Date) as Date,
						proofId: expect.any(String) as string,
					});
					expect(proofs.some((proof) => proof?.proofId === current?.proofId)).toBe(true);
				}
			}
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
				configuration,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			restore?.();
			owner.onModuleDestroy();
			release();
			const results = await Promise.allSettled([
				owner.flush(),
				fixture.flushTelemetry(),
				...(starting !== undefined ? [starting] : []),
				...(driving !== undefined ? [driving] : []),
			]);
			for (const result of results) if (result.status === 'rejected') failure ??= { cause: result.reason };
			const observerIndex = database.subscribers.indexOf(nativeProofObserver);
			if (observerIndex >= 0) database.subscribers.splice(observerIndex, 1);
			metadataObserver.mockRestore();
			adapterObserver.mockRestore();
			if (fixture.controls.beforeFence === fence) fixture.controls.beforeFence = previousFence;
			else failure ??= { cause: new Error('Foreign OFF fence gate retained') };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it.each(['proof-query', 'later-query', 'post-ACK', 'returned-safety', 'delayed-proof-query'] as const)(
		'keeps actual managed OFF failure finite until an independent public retry: %s',
		async (variant) => {
			const delayedRetry = variant === 'delayed-proof-query';
			const mode = delayedRetry ? 'proof-query' : variant;
			const { fixture, claims } = await useRegisteredNativeClaimsGuard();
			const owner = runtime;
			clearInterval(owner['timer']);
			const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const debtId = uuid();
			await database.manager.insert(VirtualThermostatCommandEntity, {
				id: debtId,
				controllerId,
				claimId: claim.id,
				claimRevision: claim.revision,
				configurationRevision: config.revision,
				decisionRevision: 1,
				action: 'on',
				status: 'unknown',
				preparedAt: new Date(),
				dispatchedAt: new Date(),
				settledAt: null,
				proofId: null,
				fault: 'independent-native-test-obligation',
			});
			const before = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			const primary = new Error('original native OFF settlement P');
			const secondary = new Error('subsequent native journal projection Q');
			let armed = true,
				proofReturned = false,
				resultReturned = false,
				invalidations = 0,
				primaryHits = 0,
				secondaryHits = 0,
				evaluations = 0;
			const failures: unknown[] = [];
			const proofs: Array<Awaited<ReturnType<ThermostatActuationAdapter['reconcile']>>> = [];
			const originalEvaluate = owner['evaluate'].bind(owner) as (typeof owner)['evaluate'];
			const evaluation = jest
				.spyOn(owner as unknown as { evaluate: typeof originalEvaluate }, 'evaluate')
				.mockImplementation((...args) => {
					evaluations++;
					const result = originalEvaluate(...args);
					void result.catch((cause: unknown) => failures.push(cause));
					return result;
				});
			const originalCapture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
			const captures = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
				const captured = originalCapture(...args);
				if (!captured) return captured;
				return Object.freeze({
					...captured,
					reconcile: (...parameters: Parameters<typeof captured.reconcile>) => {
						const result = captured.reconcile(...parameters);
						void result.then(
							(proof) => {
								proofs.push(proof);
								resultReturned = true;
								if (proof) proofReturned = true;
							},
							() => undefined,
						);
						return result;
					},
				});
			});
			let enterExcess!: () => void, releaseExcess!: () => void;
			const excess = ownedGate((resolve) => (enterExcess = resolve));
			const resume = ownedGate((resolve) => (releaseExcess = resolve));
			let releaseRecovery!: () => void, releaseFollowup!: () => void;
			const recoveryResume = ownedGate((resolve) => (releaseRecovery = resolve));
			const followupResume = ownedGate((resolve) => (releaseFollowup = resolve));
			let recoveryDelayed = false;
			let firstDelayedId: string | undefined, secondDelayedId: string | undefined;
			const firstSnapshotIds = new Set<string>();
			const ceiling = delayedRetry ? 6 : 4;
			let fences = 0;
			const previousFence = fixture.controls.beforeFence;
			const gate = async (property: string) => {
				if (property === relayId && ++fences > ceiling) {
					enterExcess();
					await resume;
				}
				if (property === relayId && delayedRetry && !armed) {
					const currentOff = [...owner['inFlightCommands'].values()].find(
						(command) => command.claimId === claim.id && command.action === 'off',
					);
					if (currentOff && firstDelayedId === undefined) {
						firstDelayedId = currentOff.id;
						recoveryDelayed = true;
						// Its retry delay expires while this actual OFF command remains held in the SDK.
						jest.setSystemTime(Date.now() + 2001);
						await recoveryResume;
					} else if (currentOff && currentOff.id !== firstDelayedId && secondDelayedId === undefined) {
						secondDelayedId = currentOff.id;
						await followupResume;
					}
				}
				await previousFence?.(property);
			};
			fixture.controls.beforeFence = gate;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (
						!armed ||
						!(mode === 'returned-safety' ? resultReturned : proofReturned) ||
						!event.query.startsWith('SELECT') ||
						!event.query.includes('devices_virtual_thermostat_command_journal')
					)
						return;
					if (mode !== 'post-ACK' && mode !== 'returned-safety' && primaryHits === 0) {
						primaryHits++;
						throw primary;
					}
					if (mode === 'proof-query' || mode === 'returned-safety') {
						secondaryHits++;
						throw secondary;
					}
				},
				afterLoad: (entity: unknown) => {
					if (armed && mode === 'later-query' && primaryHits > 0 && entity instanceof VirtualThermostatCommandEntity) {
						secondaryHits++;
						throw secondary;
					}
				},
				afterTransactionCommit: () => {
					if (armed && proofReturned && mode === 'post-ACK' && primaryHits === 0) {
						primaryHits++;
						throw primary;
					}
				},
			};
			const invalidate = (payload: { propertyId?: string }) => {
				if (armed && mode === 'returned-safety' && fences > 0 && payload.propertyId === relayId) {
					invalidations++;
					claims.invalidate();
				}
			};
			events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, invalidate);
			database.subscribers.push(observer);
			let first: Promise<void> | undefined, draining: Promise<void> | undefined, recovery: Promise<void> | undefined;
			let failure: { cause: unknown } | undefined;
			try {
				first = owner.request(controllerId, false);
				draining = first.then(async () => {
					await fixture.flushTelemetry();
					await owner.flush();
				});
				void draining.catch(() => undefined);
				expect(await Promise.race([draining.then(() => 'complete'), excess.then(() => 'excess')])).toBe('complete');
				expect(primaryHits).toBe(mode === 'returned-safety' ? 0 : 1);
				if (mode === 'returned-safety') {
					expect(invalidations).toBeGreaterThan(0);
					expect(proofs).toContain(null);
					expect(failures).toContain(secondary);
				} else expect(failures).toContain(primary);
				expect(fences).toBeGreaterThan(0);
				expect(fences).toBeLessThanOrEqual(ceiling);
				armed = false;
				const failed = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				expect(failed.map((row) => row.id)).toEqual(expect.arrayContaining(before.map((row) => row.id)));
				const retained = failed.find((row) => row.id === debtId);
				expect(retained?.action).toBe('on');
				if (mode !== 'post-ACK') {
					expect(retained?.status).toBe('unknown');
					expect(retained?.proofId).toBeNull();
					expect(secondaryHits).toBeGreaterThan(0);
				} else {
					expect(retained).toMatchObject({
						status: 'confirmed',
						proofId: expect.any(String) as string,
						settledAt: expect.any(Date) as Date,
					});
					expect(
						proofs.some((proof) => proof?.proofId === retained?.proofId && proof.coveredCommandIds.includes(debtId)),
					).toBe(true);
				}
				for (const row of before) {
					if (row.id !== debtId || mode !== 'post-ACK')
						expect(failed.find((entry) => entry.id === row.id)).toEqual(row);
				}
				if (mode === 'returned-safety') await claims.refresh();
				if (delayedRetry) jest.setSystemTime(Date.now() + 1001);
				const failureCount = failures.length;
				const count = evaluations;
				const previousContext = owner['contexts'].get(controllerId);
				await owner.request(controllerId, false);
				// Join follow-up commands started by the first retry's own feedback; issue no second public request.
				let firstSnapshot = true;
				recovery = (async () => {
					while (true) {
						await fixture.flushTelemetry();
						await owner.flush();
						const issued = [...owner['inFlight'].entries()];
						if (firstSnapshot) {
							for (const [id] of issued) firstSnapshotIds.add(id);
							firstSnapshot = false;
							releaseRecovery();
						} else releaseFollowup();
						await Promise.all(issued.map(([, command]) => command));
						await fixture.flushTelemetry();
						await owner.flush();
						if (!owner['inFlight'].size && !owner['queues'].size) break;
					}
				})();
				void recovery.catch(() => undefined);
				expect(await Promise.race([recovery.then(() => 'complete'), excess.then(() => 'excess')])).toBe('complete');
				expect(owner['inFlight'].size).toBe(0);
				expect(owner['queues'].size).toBe(0);
				expect(failures.slice(failureCount)).toEqual([]);
				const diagnostic = owner.readDiagnostics(controllerId);
				expect(diagnostic.reasons).not.toContain('runtime_error');
				expect(diagnostic.branches.some((branch) => branch.claim === claim.id)).toBe(true);
				expect(diagnostic.branches.every((branch) => branch.release_proven)).toBe(true);
				const recovered = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				if (delayedRetry) {
					const recoveryOffs = recovered.filter(
						(row) => row.action === 'off' && !failed.some((old) => old.id === row.id),
					);
					expect(recoveryDelayed).toBe(true);
					expect(firstSnapshotIds.size).toBeGreaterThan(0);
					expect(firstDelayedId).toBeDefined();
					expect(secondDelayedId).toBeDefined();
					if (firstDelayedId === undefined || secondDelayedId === undefined)
						throw new Error('Actual delayed OFF IDs missing');
					expect(firstSnapshotIds.has(firstDelayedId)).toBe(true);
					expect(firstSnapshotIds.has(secondDelayedId)).toBe(false);
					expect(recoveryOffs.length).toBeGreaterThanOrEqual(2);
					expect(recoveryOffs.some((row) => !firstSnapshotIds.has(row.id))).toBe(true);
					expect(recoveryOffs.every((row) => row.status === 'confirmed')).toBe(true);
				}
				const original = recovered.find((row) => row.id === debtId);
				const debt = before.find((row) => row.id === debtId);
				expect(original).toEqual({
					...debt,
					status: 'confirmed',
					proofId: expect.any(String) as string,
					settledAt: expect.any(Date) as Date,
				});
				for (const row of before.filter((entry) => entry.id !== debtId))
					expect(recovered.find((entry) => entry.id === row.id)).toEqual(row);
				expect(
					proofs.some((proof) => proof?.proofId === original?.proofId && proof.coveredCommandIds.includes(debtId)),
				).toBe(true);
				expect(evaluations).toBeGreaterThan(count);
				expect(owner['contexts'].get(controllerId)).not.toBe(previousContext);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(config);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				armed = false;
				events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, invalidate);
				owner.onModuleDestroy();
				releaseExcess();
				releaseRecovery();
				releaseFollowup();
				const joined = await Promise.allSettled([
					owner.flush(),
					fixture.flushTelemetry(),
					...(first !== undefined ? [first] : []),
					...(draining !== undefined ? [draining] : []),
					...(recovery !== undefined ? [recovery] : []),
				]);
				for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				captures.mockRestore();
				evaluation.mockRestore();
				if (fixture.controls.beforeFence === gate) fixture.controls.beforeFence = previousFence;
				else failure ??= { cause: new Error('Foreign OFF retry fence gate') };
			}
			if (failure !== undefined) throw failure.cause;
		},
	);
	it('an actual ordinary public poll fences its original held managed ON before SDK delivery', async () => {
		const { fixture, claims } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const resume = ownedGate((resolve) => (release = resolve));
		const beforeOn = fixture.controls.beforeOn;
		const gate = async (property: string) => {
			if (property === relayId) {
				enter();
				await resume;
			}
			await beforeOn?.(property);
		};
		fixture.controls.beforeOn = gate;
		const sends: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
		const results: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const observer = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const original = capture(...args);
			if (!original) return original;
			return Object.freeze({
				...original,
				send: (...parameters: Parameters<typeof original.send>) => {
					const result = original.send(...parameters);
					if (parameters[0].property.id === relayId && parameters[0].value === true) {
						sends.push(parameters);
						void result.then(
							(outcome) => results.push(outcome),
							() => undefined,
						);
					}
					return result;
				},
			});
		});
		let operation: Promise<void> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			await fixture.report(sensorId, 18);
			await entered;
			await owner.flush();
			expect(sends).toHaveLength(1);
			const original = sends[0];
			const commandId = original[4].commandId;
			operation = owner['inFlight'].get(commandId);
			if (operation === undefined) throw new Error('Original native ON completion absent');
			expect(original[3]()).toBe(true);
			const oldContext = owner['contexts'].get(controllerId);
			const claimCapture = claims.capture();
			const before = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: commandId });
			expect(before).toMatchObject({ action: 'on', status: 'dispatching', settledAt: null });
			await owner.request(controllerId, false);
			await owner.flush();
			expect(owner['contexts'].get(controllerId)).not.toBe(oldContext);
			expect(original[3]()).toBe(false);
			// Current ordinary controller fencing does not invalidate unrelated claims globally.
			expect(claimCapture.isCurrent()).toBe(true);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			// Guard refusal was observed before this independent demand change, with the SDK still held.
			await fixture.report(sensorId, 25);
			release();
			await operation;
			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({ outcome: 'refused' });
			await settleReal(fixture);
			const after = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: commandId });
			expect(after).toMatchObject({
				...before,
				status: 'cancelled',
				settledAt: expect.any(Date) as Date,
				fault: expect.any(String) as string,
			});
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
				configuration,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			release();
			const joined = await Promise.allSettled([
				owner.flush(),
				fixture.flushTelemetry(),
				...(operation !== undefined ? [operation] : []),
			]);
			for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
			observer.mockRestore();
			if (fixture.controls.beforeOn === gate) fixture.controls.beforeOn = beforeOn;
			else failure ??= { cause: new Error('Foreign ordinary poll ON gate') };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it('a real queued graph writer completes before the next runtime native admission reads', async () => {
		const { fixture } = await useRegisteredNativeClaimsGuard();
		const owner = runtime,
			structure = owner['structure'];
		clearInterval(owner['timer']);
		const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const graphBefore = await owner['graph'].revision();
		let enterReader!: () => void;
		const readerEntered = ownedGate((resolve) => (enterReader = resolve));
		let enterLoad!: () => void, releaseLoad!: () => void, enterWriter!: () => void, releaseWriter!: () => void;
		const loadEntered = ownedGate((resolve) => (enterLoad = resolve));
		const loadResume = ownedGate((resolve) => (releaseLoad = resolve));
		const writerEntered = ownedGate((resolve) => (enterWriter = resolve));
		const writerResume = ownedGate((resolve) => (releaseWriter = resolve));
		let selected = false,
			holdingWriter = false,
			writerCompleted = false,
			readsDuringWriter = 0,
			readsAfterWriter = 0;
		const originalShared = structure.runShared.bind(structure) as typeof structure.runShared;
		const shared = jest.spyOn(structure, 'runShared').mockImplementation(<T>(work: () => Promise<T>) => {
			if (holdingWriter) enterReader();
			return originalShared(work);
		});
		const roots = new AsyncLocalStorage<object>();
		const root = Object.freeze({ owner });
		const observer = {
			beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
				if (roots.getStore() !== root || !event.query.startsWith('SELECT')) return;
				if (
					!selected &&
					event.query.includes('devices_virtual_thermostat_configs') &&
					structure.hasCurrentStructuralLease()
				) {
					selected = true;
					enterLoad();
					await loadResume;
				}
				if (holdingWriter) readsDuringWriter++;
				if (event.query.includes('devices_virtual_thermostat_command_journal')) {
					if (writerCompleted) readsAfterWriter++;
				}
			},
		};
		database.subscribers.push(observer);
		let starting: Promise<void> | undefined, writing: Promise<void> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			starting = roots.run(root, () => owner.requestInstalled(controllerId));
			void starting.catch(() => undefined);
			expect(await Promise.race([loadEntered.then(() => 'load'), starting.then(() => 'early')])).toBe('load');
			writing = structure.runExclusive(async () => {
				holdingWriter = true;
				enterWriter();
				await writerResume;
				await database.manager.query(
					'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1',
				);
				holdingWriter = false;
				writerCompleted = true;
			});
			void writing.catch(() => undefined);
			releaseLoad();
			await writerEntered;
			await readerEntered;
			// A real independent native read completes while the queued runtime reader still waits on the graph writer.
			await database.manager.query('SELECT 1');
			expect(readsDuringWriter).toBe(0);
			releaseWriter();
			await writing;
			await starting;
			await owner.flush();
			expect(writerCompleted).toBe(true);
			expect(readsDuringWriter).toBe(0);
			expect(readsAfterWriter).toBeGreaterThan(0);
			expect(await owner['graph'].revision()).toBe(graphBefore + 1);
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
				configuration,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			releaseLoad();
			releaseWriter();
			const joined = await Promise.allSettled([
				owner.flush(),
				...(starting !== undefined ? [starting] : []),
				...(writing !== undefined ? [writing] : []),
			]);
			for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
			shared.mockRestore();
			const index = database.subscribers.indexOf(observer);
			if (index >= 0) database.subscribers.splice(index, 1);
		}
		if (failure !== undefined) throw failure.cause;
	});
	it.each(['same-value', 'restore', 'slot', 'rollback', 'journal'] as const)(
		'preserves the original override budget across actual native %s while fencing ownership separately',
		async (mode) => {
			const { fixture, claims, loader } = await useInstalledLockedNativeClaimsGuard();
			const owner = runtime;
			clearInterval(owner['timer']);
			const start = performance.now();
			let mono = start;
			const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
			let failure: { cause: unknown } | undefined;
			const writes: string[] = [];
			const observer = {
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					if (event.success && event.query.startsWith('UPDATE ')) writes.push(event.query);
				},
			};
			try {
				const entry = await comfort.get(controllerId);
				await comfort.configure(
					controllerId,
					{ expected_revision: entry.revision, expected_graph_revision: entry.graph_revision },
					{
						automation_enabled: true,
						heating_range: { minimum: 15, maximum: 25 },
						cooling_range: null,
						presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
					},
				);
				await loader['queue'];
				const before = await comfort.get(controllerId);
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: before.graph_revision },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
					'native-clock-lifetime',
				);
				await loader['queue'];
				await settleReal(fixture);
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const lease = comfort['leases'].get(controllerId);
				if (!lease || !row.comfort?.temporary_override) throw new Error('Original bounded override missing');
				const deadline = lease.deadline;
				const original = claims.capture();
				expect(original.isCurrent()).toBe(true);
				expect(comfort.isCurrent(row)).toBe(true);
				const slots = await database.query<unknown[]>(
					'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
					[controllerId],
				);
				const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
				expect(slots.length).toBeGreaterThan(0);
				expect(journal.length).toBeGreaterThan(0);
				database.subscribers.push(observer);
				const query =
					mode === 'slot'
						? 'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" WHERE "controllerId" = ?'
						: mode === 'journal'
							? 'UPDATE "devices_virtual_thermostat_command_journal" SET "fault" = "fault" WHERE "id" = ?'
							: 'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?';
				const parameters =
					mode === 'slot' ? [controllerId] : mode === 'journal' ? [journal[0].id] : [Number(row.locked), controllerId];
				if (mode === 'rollback') {
					const primary = new Error('actual rolled-back clock configuration');
					await expect(
						database.transaction(async (manager) => {
							await manager.query(query, parameters);
							throw primary;
						}),
					).rejects.toBe(primary);
				} else if (mode === 'restore') {
					await database.query(query, [Number(!row.locked), controllerId]);
					await database.query(query, parameters);
				} else await database.query(query, parameters);
				expect(writes.filter((write) => write === query)).toHaveLength(mode === 'restore' ? 2 : 1);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(row);
				expect(
					await database.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
						[controllerId],
					),
				).toEqual(slots);
				expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(journal);
				// Diagnostic journal bookkeeping is neutral; catalog attempts close the old dispatch admission even on rollback.
				expect(original.isCurrent()).toBe(mode === 'journal');
				expect(comfort.isCurrent(row)).toBe(true);
				mono = start + 10_000;
				await comfort.settle(controllerId);
				const fresh = await comfort.get(controllerId);
				expect(fresh.configuration.temporary_override.id).toBe(row.comfort.temporary_override.id);
				expect(fresh.configuration.temporary_override.expires_at).toBe(row.comfort.temporary_override.expires_at);
				expect(comfort['leases'].get(controllerId)).toBe(lease);
				expect(lease.deadline).toBe(deadline);
				expect(comfort.isCurrent(row)).toBe(true);
				expect(original.isCurrent()).toBe(mode === 'journal');
				mono = deadline + 1;
				expect(Date.now()).toBeLessThan(Date.parse(row.comfort.temporary_override.expires_at));
				expect(comfort.isCurrent(row)).toBe(false);
				expect(comfort.isCurrent(structuredClone(row))).toBe(false);
				expect(lease.deadline).toBe(deadline);
				expect(lease.status).toBe('expired');
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				owner.onModuleDestroy();
				loader.onModuleDestroy();
				const joined = await Promise.allSettled([owner.flush(), loader['queue'], fixture.flushTelemetry()]);
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				monotonic.mockRestore();
				for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
			}
			if (failure !== undefined) throw failure.cause;
		},
	);
	it('preserves one original override budget through public reads, watermark progress and an ordinary runtime poll', async () => {
		const { fixture, claims, loader } = await useInstalledLockedNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const start = performance.now();
		let mono = start;
		const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
		let failure: { cause: unknown } | undefined;
		try {
			const before = await comfort.get(controllerId);
			await comfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: before.graph_revision },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'public-neutral-clock',
			);
			await loader['queue'];
			await settleReal(fixture);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const lease = comfort['leases'].get(controllerId);
			if (!lease || !row.comfort?.temporary_override) throw new Error('Original public-read budget missing');
			const deadline = lease.deadline,
				watermark = lease.watermark;
			const original = claims.capture();
			expect(original.isCurrent()).toBe(true);
			jest.setSystemTime(Date.now() + 1);
			mono = start + 10_000;
			const first = await comfort.get(controllerId);
			const second = await comfort.get(controllerId);
			expect(first).toEqual(second);
			expect(comfort.isCurrent(structuredClone(row))).toBe(true);
			expect(lease.watermark).toBeGreaterThan(watermark);
			expect(comfort['leases'].get(controllerId)).toBe(lease);
			await owner.request(controllerId, false);
			await settleReal(fixture);
			const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect(after).toEqual(row);
			expect(comfort['leases'].get(controllerId)).toBe(lease);
			expect(lease.deadline).toBe(deadline);
			expect(original.isCurrent()).toBe(true);
			expect(comfort.isCurrent(after)).toBe(true);
			mono = deadline + 1;
			expect(Date.now()).toBeLessThan(Date.parse(row.comfort.temporary_override.expires_at));
			expect(comfort.isCurrent(row)).toBe(false);
			expect(comfort.isCurrent(after)).toBe(false);
			expect(lease.deadline).toBe(deadline);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			loader.onModuleDestroy();
			const joined = await Promise.allSettled([owner.flush(), loader['queue'], fixture.flushTelemetry()]);
			monotonic.mockRestore();
			for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it('keeps a genuine replacement override independent of late reads of the original expired identity', async () => {
		const { fixture, claims, loader } = await useInstalledLockedNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const start = performance.now();
		let mono = start;
		const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
		let failure: { cause: unknown } | undefined;
		try {
			const before = await comfort.get(controllerId);
			await comfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: before.graph_revision },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'original-clock-A',
			);
			await loader['queue'];
			await settleReal(fixture);
			const a = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const leaseA = comfort['leases'].get(controllerId);
			if (!leaseA) throw new Error('Original A budget missing');
			const originalClaims = claims.capture();
			expect(originalClaims.isCurrent()).toBe(true);
			expect(comfort.isCurrent(a)).toBe(true);
			mono = start + 1000;
			const current = await comfort.get(controllerId);
			await comfort.override(
				controllerId,
				{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
				'replacement-clock-B',
			);
			await loader['queue'];
			await settleReal(fixture);
			const b = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const leaseB = comfort['leases'].get(controllerId);
			if (!leaseB) throw new Error('Replacement B budget missing');
			const saved = { ...leaseB };
			const freshClaims = claims.capture();
			expect(leaseB).not.toBe(leaseA);
			expect(leaseB.id).not.toBe(leaseA.id);
			expect(originalClaims.isCurrent()).toBe(false);
			expect(freshClaims.isCurrent()).toBe(true);
			mono = leaseA.deadline + 1;
			expect(mono).toBeLessThan(leaseB.deadline);
			const hydrate = jest.spyOn(database.driver, 'prepareHydratedValue');
			try {
				expect(comfort.isCurrent(a)).toBe(false);
				expect(comfort.isCurrent(structuredClone(a))).toBe(false);
				expect(hydrate).not.toHaveBeenCalled();
			} finally {
				hydrate.mockRestore();
			}
			expect(comfort['leases'].get(controllerId)).toBe(leaseB);
			expect(leaseB).toEqual(saved);
			expect(freshClaims.isCurrent()).toBe(true);
			expect(comfort.isCurrent(b)).toBe(true);
			expect(leaseB.deadline).toBe(saved.deadline);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			owner.onModuleDestroy();
			loader.onModuleDestroy();
			const joined = await Promise.allSettled([owner.flush(), loader['queue'], fixture.flushTelemetry()]);
			monotonic.mockRestore();
			for (const result of joined) if (result.status === 'rejected') failure ??= { cause: result.reason };
		}
		if (failure !== undefined) throw failure.cause;
	});
	it.each(['none', 'empty-rollback', 'slot-rollback', 'config-rollback', 'captured-sql-replay'] as const)(
		'rejects native replay and rolled-back effects inside an admitted comfort repeat: %s',
		async (effect) => {
			const { fixture } = await useRegisteredNativeClaimsGuard();
			const owner = runtime;
			clearInterval(owner['timer']);
			const expected = await comfortFence();
			let enterOn!: () => void, releaseOn!: () => void, enterRead!: () => void, releaseRead!: () => void;
			const onEntered = ownedGate((resolve) => (enterOn = resolve));
			const onHeld = ownedGate((resolve) => (releaseOn = resolve));
			const readEntered = ownedGate((resolve) => (enterRead = resolve));
			const readHeld = ownedGate((resolve) => (releaseRead = resolve));
			const previousGate = fixture.controls.beforeOn;
			const gate = async (property: string) => {
				if (property !== relayId) return;
				enterOn();
				await onHeld;
			};
			fixture.controls.beforeOn = gate;
			const sends: Array<Parameters<ThermostatActuationAdapter['send']>> = [];
			const outcomes: Array<Awaited<ReturnType<ThermostatActuationAdapter['send']>>> = [];
			const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
			const transport = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
				const adapter = capture(...args);
				if (!adapter) return adapter;
				return Object.freeze({
					...adapter,
					send: (...parameters: Parameters<typeof adapter.send>) => {
						const original = adapter.send(...parameters);
						if (parameters[0].property.id === relayId && parameters[0].value === true) {
							sends.push(parameters);
							void original.then(
								(result) => outcomes.push(result),
								() => undefined,
							);
						}
						return original;
					},
				});
			});
			const roots = new AsyncLocalStorage<object>();
			const root = Object.freeze({ owner });
			const tables = [
				'devices_virtual_thermostat_configs',
				'devices_virtual_thermostat_actuator_claims',
				'devices_virtual_thermostat_sources',
				'devices_module_climate_automation_slots',
				'devices_virtual_thermostat_command_journal',
				'devices_virtual_thermostat_branch_runtime',
				'devices_virtual_graph_revision',
			];
			const snapshot = async (manager: EntityManager) => {
				const image: Record<string, Array<Record<string, unknown>>> = {};
				for (const table of tables)
					image[table] = await manager.query<Array<Record<string, unknown>>>(`SELECT * FROM "${table}" ORDER BY rowid`);
				return image;
			};
			let commandId: string | undefined, claimId: string | undefined;
			let firstRead = true,
				nativeRead = false,
				originalSettled = false,
				injected = false;
			let before: Awaited<ReturnType<typeof snapshot>> | undefined;
			const extraId = uuid();
			let originalWrite:
				| { runner: import('typeorm').QueryRunner; query: string; parameters: readonly unknown[] }
				| undefined;
			const observerTasks: Promise<void>[] = [];
			let rolledBack = false;

			const observer = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (
						firstRead &&
						roots.getStore() === root &&
						event.query.startsWith('SELECT') &&
						event.query.includes('devices_virtual_thermostat_configs') &&
						event.parameters?.includes(controllerId)
					) {
						firstRead = false;
						enterRead();
						await readHeld;
					}
				},
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					const task = (async () => {
						if (
							!originalWrite &&
							commandId &&
							event.success &&
							event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
							event.parameters?.includes(commandId) &&
							event.parameters.includes('cancelled')
						) {
							originalWrite = {
								runner: event.queryRunner,
								query: event.query,
								parameters: [...(event.parameters as readonly unknown[])],
							};
						}

						if (
							nativeRead ||
							roots.getStore() !== root ||
							!event.queryRunner.isTransactionActive ||
							!event.query.startsWith('SELECT') ||
							!event.query.includes('devices_virtual_thermostat_configs')
						)
							return;
						nativeRead = true;
						expect(originalSettled).toBe(true);
						expect(commandId).toBeDefined();
						before = await snapshot(event.queryRunner.manager);
						const journal = 'devices_virtual_thermostat_command_journal';
						expect(before[journal].find((row) => row.id === commandId)).toMatchObject({
							id: commandId,
							claimId,
							status: 'cancelled',
							proofId: null,
						});
						expect(
							before.devices_module_climate_automation_slots.filter((row) => row.controllerId === controllerId),
						).toHaveLength(1);
						expect(
							before.devices_virtual_thermostat_configs.filter((row) => row.controllerId === controllerId),
						).toHaveLength(1);
						expect(before.devices_virtual_thermostat_actuator_claims.filter((row) => row.id === claimId)).toHaveLength(
							1,
						);

						if (effect === 'empty-rollback' || effect === 'slot-rollback' || effect === 'config-rollback') {
							const table =
								effect === 'slot-rollback'
									? 'devices_module_climate_automation_slots'
									: 'devices_virtual_thermostat_configs';
							const column = effect === 'slot-rollback' ? 'manualCounter' : 'revision';
							const primary = new Error('original nested native rollback');
							await expect(
								event.queryRunner.manager.transaction(async (manager) => {
									injected = true;
									if (effect !== 'empty-rollback') {
										await manager.query(
											`UPDATE "${table}" SET "${column}" = "${column}" + 1 WHERE "controllerId" = ?`,
											[controllerId],
										);
										const during = await snapshot(manager);
										expect(during[table]).not.toEqual(before[table]);
									} else expect(await snapshot(manager)).toEqual(before);
									throw primary;
								}),
							).rejects.toBe(primary);
							rolledBack = true;
						} else if (effect === 'captured-sql-replay') {
							expect(originalWrite).toBeDefined();
							if (!originalWrite) throw new Error('Original acknowledged cancellation UPDATE missing');
							expect(originalWrite.runner === event.queryRunner).toBe(false);
							expect(originalWrite.parameters).toContain(commandId);
							expect(originalWrite.parameters).toContain('cancelled');
							injected = true;
							await event.queryRunner.query(originalWrite.query, [...originalWrite.parameters]);
						}
						expect(await snapshot(event.queryRunner.manager)).toEqual(before);
					})();
					observerTasks.push(task);
					void task.catch(() => undefined);
					return task;
				},
			};
			let operation: Promise<void> | undefined;
			let mutation: ReturnType<typeof comfort.configure> | undefined;
			let failure: { cause: unknown } | undefined;
			let readWaitExpired = false;
			try {
				await fixture.report(sensorId, 18);
				let timeout: ReturnType<typeof setTimeout> | undefined;
				try {
					await Promise.race([
						onEntered,
						new Promise<never>((_, reject) => {
							timeout = setTimeout(
								() =>
									reject(
										new Error('Native ON entry not reached: ' + JSON.stringify(owner.readDiagnostics(controllerId))),
									),
								5000,
							);
						}),
					]);
				} finally {
					clearTimeout(timeout);
				}
				await owner.flush();
				expect(sends).toHaveLength(1);
				commandId = sends[0][4].commandId;
				claimId = sends[0][1].id;
				expect(sends[0][3]()).toBe(true);
				operation = owner['inFlight'].get(commandId);
				if (operation === undefined) throw new Error('Original managed command unavailable');
				void operation.then(
					() => {
						originalSettled = true;
					},
					() => undefined,
				);
				database.subscribers.push(observer);
				mutation = roots.run(root, () =>
					comfort.configure(controllerId, expected, {
						automation_enabled: true,
						heating_range: { minimum: 10, maximum: 30 },
						cooling_range: null,
						presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
					}),
				);
				void mutation.catch(() => undefined);
				expect(sends[0][3]()).toBe(false);
				let readTimeout: ReturnType<typeof setTimeout> | undefined;
				try {
					await Promise.race([
						readEntered,
						mutation,
						new Promise<never>((_, reject) => {
							readTimeout = setTimeout(() => {
								readWaitExpired = true;
								reject(new Error('Comfort read entry not reached'));
							}, 5000);
						}),
					]);
					if (firstRead) throw new Error('Comfort mutation completed before read entry');
				} finally {
					clearTimeout(readTimeout);
				}
				releaseOn();
				await fixture.flushTelemetry();
				owner.onModuleDestroy();
				releaseRead();
				const [selection, command] = await Promise.allSettled([mutation, operation]);
				for (const observed of await Promise.allSettled(observerTasks))
					if (observed.status === 'rejected') throw observed.reason;
				expect(command.status).toBe('fulfilled');
				expect(nativeRead).toBe(true);
				expect(injected).toBe(effect !== 'none');
				expect(rolledBack).toBe(
					effect === 'empty-rollback' || effect === 'slot-rollback' || effect === 'config-rollback',
				);
				if (effect === 'none') {
					expect(selection.status).toBe('fulfilled');
					if (selection.status === 'fulfilled') expect(selection.value.revision).toBe(expected.expected_revision);
				} else expect(selection.status).toBe('rejected');
				expect(before).toBeDefined();
				expect(await snapshot(database.manager)).toEqual(before);
				expect(await database.manager.countBy(VirtualThermostatCommandEntity, { id: extraId })).toBe(0);
				expect(outcomes).toEqual([expect.objectContaining({ outcome: 'refused' })]);
				expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: commandId })).toMatchObject(
					{
						status: 'cancelled',
						proofId: null,
					},
				);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				owner.onModuleDestroy();
				releaseOn();
				releaseRead();
				const cleanup = await Promise.allSettled([owner.flush()]);
				const completions = await Promise.allSettled([
					...(mutation !== undefined ? [mutation] : []),
					...(operation !== undefined ? [operation] : []),
				]);
				if (readWaitExpired && mutation !== undefined && completions[0].status === 'rejected') {
					const originalCause: unknown = completions[0].reason;
					failure = {
						cause: new AggregateError(
							[originalCause, failure?.cause],
							'Comfort read entry timed out; mutation rejected during cleanup',
							{ cause: originalCause },
						),
					};
				}
				for (const observed of await Promise.allSettled(observerTasks))
					if (observed.status === 'rejected') failure ??= { cause: observed.reason };
				for (const outcome of cleanup) if (outcome.status === 'rejected') failure ??= { cause: outcome.reason };
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				transport.mockRestore();
				if (fixture.controls.beforeOn === gate) fixture.controls.beforeOn = previousGate;
				else failure ??= { cause: new Error('Foreign native ON gate retained') };
			}
			if (failure !== undefined) throw failure.cause;
		},
	);
	const observeNativeDispatchOrigin = async () => {
		const { fixture, claims } = await useRegisteredNativeClaimsGuard();
		const owner = runtime;
		clearInterval(owner['timer']);
		const trace = new AsyncLocalStorage<string>();
		type SendArgs = Parameters<ThermostatActuationAdapter['send']>;
		type Outcome = Awaited<ReturnType<ThermostatActuationAdapter['send']>>;
		const currentContext = () => owner['contexts'].get(controllerId);
		const calls: Array<{ args: SendArgs; context: ReturnType<typeof currentContext>; outcome?: Outcome }> = [];
		const reports: Array<{
			origin: string | undefined;
			event: Readonly<{ propertyId: string; property: ChannelPropertyEntity; sample: QualifiedPropertySample }>;
		}> = [];
		const deliveries: Array<{ origin: string | undefined; proofId: string; current: () => boolean }> = [];
		const heldReleases: Array<() => void> = [];
		let afterDelivery: (() => Promise<void>) | undefined;
		const capture = fixture.transport.capture.bind(fixture.transport) as typeof fixture.transport.capture;
		const transportObserver = jest.spyOn(fixture.transport, 'capture').mockImplementation((...args) => {
			const adapter = capture(...args);
			if (!adapter) return adapter;
			return Object.freeze({
				...adapter,
				send: (...parameters: SendArgs) => {
					const call: (typeof calls)[number] = { args: parameters, context: currentContext() };
					calls.push(call);
					const original = trace.run(parameters[4].commandId, () => adapter.send(...parameters));
					void original.then(
						(outcome) => {
							call.outcome = outcome;
						},
						() => undefined,
					);
					return original;
				},
			});
		});
		const captureDelivery = fixture.platform.captureOwnedGuardFenceSample.bind(
			fixture.platform,
		) as typeof fixture.platform.captureOwnedGuardFenceSample;
		const deliveryObserver = jest
			.spyOn(fixture.platform, 'captureOwnedGuardFenceSample')
			.mockImplementation((target) => {
				const deliver = captureDelivery(target);
				return Object.freeze(async (readback: Parameters<typeof deliver>[0]) => {
					await deliver(readback);
					if (target.property.id !== relayId) return;
					deliveries.push({ origin: trace.getStore(), proofId: readback.proofId, current: readback.isCurrent });
					await afterDelivery?.();
				});
			});
		const observe = (event: (typeof reports)[number]['event']) => {
			if (event.propertyId === relayId) reports.push({ origin: trace.getStore(), event });
		};
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
		return {
			fixture,
			claims,
			owner,
			calls,
			reports,
			deliveries,
			trace,
			setAfterDelivery: (callback: (() => Promise<void>) | undefined) => {
				afterDelivery = callback;
			},
			releaseOnCleanup: (release: () => void) => heldReleases.push(release),
			cleanup: async () => {
				const originals = [...owner['inFlight'].values()];
				owner.onModuleDestroy();
				for (const release of heldReleases) release();
				const joined = await Promise.allSettled([owner.flush(), ...originals]);
				await fixture.flushTelemetry();
				events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
				deliveryObserver.mockRestore();
				transportObserver.mockRestore();
				for (const result of joined) if (result.status === 'rejected') throw result.reason;
			},
		};
	};

	it('routes genuine ON, replayed original OFF and manual producer notifications through ordinary current admission', async () => {
		const observed = await observeNativeDispatchOrigin();
		const { fixture, owner, calls, reports } = observed;
		const request = jest.spyOn(owner, 'request');
		const relayRequests: Array<{ event: (typeof reports)[number]['event']; targets: string[] }> = [];
		const emit = events.emit.bind(events) as typeof events.emit;
		const emissions = jest.spyOn(events, 'emit').mockImplementation((event, ...values) => {
			const before = request.mock.calls.length;
			const result = emit(event, ...(values as unknown[]));
			if (event === EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED) {
				const sample = values[0] as (typeof reports)[number]['event'];
				if (sample.propertyId === relayId)
					relayRequests.push({ event: sample, targets: request.mock.calls.slice(before).map(([target]) => target) });
			}
			return result;
		});
		let failure: { cause: unknown } | undefined;
		try {
			const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await fixture.report(sensorId, 18);
			await settleReal(fixture);
			const on = calls.find((call) => call.args[0].value === true);
			if (!on) throw new Error('Original managed ON dispatch missing');
			expect(on.outcome?.outcome).toBe('accepted');
			const onReports = reports.filter(
				(entry) => entry.origin === on.args[4].commandId && entry.event.sample.value === true,
			);
			expect(onReports.length).toBeGreaterThan(0);
			for (const entry of onReports)
				expect(relayRequests.find(({ event }) => event === entry.event)?.targets).toEqual([controllerId]);
			const onRow = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
				id: on.args[4].commandId,
			});
			expect(onRow).toMatchObject({ action: 'on', status: 'accepted', proofId: null });
			expect(owner.readDiagnostics(controllerId).branches.every((branch) => !branch.release_proven)).toBe(true);
			const manualBefore = request.mock.calls.length;
			events.emit(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, { id: sensorId });
			expect(request.mock.calls.length).toBe(manualBefore + 1);
			expect(request.mock.calls.at(-1)[0]).toBe(controllerId);
			await settleReal(fixture);
			await fixture.report(sensorId, 21);
			await settleReal(fixture);
			const off = calls.find((call) => call.args[0].value === false);
			if (!off) throw new Error('Original managed OFF dispatch missing');
			const offReports = reports.filter(
				(entry) => entry.origin === off.args[4].commandId && entry.event.sample.value === false,
			);
			expect(offReports.length).toBeGreaterThan(0);
			for (const entry of offReports)
				expect(relayRequests.find(({ event }) => event === entry.event)?.targets).toEqual([controllerId]);
			const originalA = offReports[0].event;
			await owner.request(controllerId, false);
			await owner.flush();
			const b = owner['contexts'].get(controllerId);
			expect(b).not.toBe(off.context);
			const physical = originalA.property;
			const acceptedBefore = fixture.values.readQualifiedSample(physical, 30_000);
			expect(acceptedBefore?.value).toBe(false);
			const commands = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			const sends = [...fixture.controls.sends];
			const replayBefore = request.mock.calls.length;
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, originalA);
			expect(request.mock.calls.length).toBe(replayBefore + 1);
			expect(request.mock.calls.at(-1)[0]).toBe(controllerId);
			expect(fixture.values.readQualifiedSample(physical, 30_000)).toEqual(acceptedBefore);
			expect(fixture.controls.sends).toEqual(sends);
			await settleReal(fixture);
			expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).toEqual(commands);
			expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
				configuration,
			);
			expect(fixture.controls.sends).toEqual(sends);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			try {
				await observed.cleanup();
			} catch (cause) {
				failure ??= { cause };
			}
			emissions.mockRestore();
			request.mockRestore();
		}
		if (failure) throw failure.cause;
	});

	it('allows ordinary successor progress after actual OFF sample admission while its original dispatch is held', async () => {
		const observed = await observeNativeDispatchOrigin();
		const { fixture, owner, calls, reports, deliveries, trace } = observed;
		let enter!: () => void, release!: () => void;
		const entered = ownedGate((resolve) => (enter = resolve));
		const resume = ownedGate((resolve) => (release = resolve));
		observed.releaseOnCleanup(release);
		let heldId: string | undefined;
		let original: Promise<void> | undefined;
		let inspecting: ReturnType<typeof owner.inspect> | undefined;
		let failure: { cause: unknown } | undefined;
		try {
			await fixture.report(sensorId, 18);
			await settleReal(fixture);
			const sendsBefore = [...fixture.controls.sends];
			observed.setAfterDelivery(async () => {
				const id = trace.getStore();
				if (
					heldId !== undefined ||
					id === undefined ||
					!calls.some((call) => call.args[4].commandId === id && call.args[0].value === false)
				)
					return;
				heldId = id;
				enter();
				await resume;
			});
			await fixture.report(sensorId, 21);
			let deadline: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					entered,
					new Promise<never>((_, reject) => {
						deadline = setTimeout(() => reject(new Error('Original OFF native sample admission not reached')), 5000);
					}),
				]);
			} finally {
				clearTimeout(deadline);
			}
			const a = calls.find((call) => call.args[4].commandId === heldId);
			if (!a?.context) throw new Error('Original OFF context missing');
			original = owner['inFlight'].get(heldId);
			if (original === undefined) throw new Error('Original detached OFF completion missing');
			let completed = false;
			void original.then(
				() => {
					completed = true;
				},
				() => undefined,
			);
			expect(reports.some((entry) => entry.origin === heldId && entry.event.sample.value === false)).toBe(true);
			const oldProof = deliveries.find((entry) => entry.origin === heldId);
			expect(oldProof).toBeDefined();
			const before = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: heldId });
			expect(before).toMatchObject({ action: 'off', status: 'dispatching', proofId: null });
			inspecting = owner.inspect(controllerId);
			let inspectionTimeout: ReturnType<typeof setTimeout> | undefined;
			let b: Awaited<ReturnType<typeof owner.inspect>>;
			try {
				b = await Promise.race([
					inspecting,
					original.then(() => {
						throw new Error('Original held OFF completed before its successor');
					}),
					new Promise<never>((_, reject) => {
						inspectionTimeout = setTimeout(
							() => reject(new Error('Ordinary successor inspection did not progress')),
							5000,
						);
					}),
				]);
			} finally {
				clearTimeout(inspectionTimeout);
			}
			expect(completed).toBe(false);
			expect(b.configuration_revision).toBeGreaterThan(0);
			expect(owner['contexts'].get(controllerId)).not.toBe(a.context);
			expect(owner.readDiagnostics(controllerId).branches.every((branch) => !branch.release_proven)).toBe(true);
			expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: heldId })).toEqual(before);
			release();
			await original;
			expect(owner['contexts'].get(controllerId)).not.toBe(a.context);
			await settleReal(fixture);
			expect(owner['contexts'].get(controllerId)).not.toBe(a.context);
			expect(owner.readDiagnostics(controllerId).configuration_revision).toBe(b.configuration_revision);
			expect(owner.readDiagnostics(controllerId).sequence).toBeGreaterThanOrEqual(b.sequence);
			const after = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: heldId });
			expect(after.status).toBe('confirmed');
			expect(after.proofId).not.toBe(oldProof.proofId);
			expect(deliveries.some((entry) => entry.proofId === after.proofId)).toBe(true);
			expect(fixture.controls.sends).toEqual(sendsBefore);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			try {
				await observed.cleanup();
			} catch (cause) {
				failure ??= { cause };
			}
			if (inspecting !== undefined) {
				const [completion] = await Promise.allSettled([inspecting]);
				if (completion.status === 'rejected') failure ??= { cause: completion.reason };
			}
		}
		if (failure) throw failure.cause;
	});
	it.each(['none', 'claims', 'native-registration', 'destroy'] as const)(
		'withdraws an original managed OFF readback after actual %s admission loss',
		async (loss) => {
			const observed = await observeNativeDispatchOrigin();
			const { fixture, claims, owner, calls, deliveries, trace } = observed;
			let enter!: () => void, release!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const resume = ownedGate((resolve) => (release = resolve));
			observed.releaseOnCleanup(release);
			const previousGate = fixture.controls.beforeFence;
			let heldId: string | undefined;
			const gate = async (property: string) => {
				const id = trace.getStore();
				if (
					property !== relayId ||
					heldId !== undefined ||
					id === undefined ||
					!calls.some((call) => call.args[4].commandId === id && call.args[0].value === false)
				)
					return;
				heldId = id;
				enter();
				await resume;
			};
			let original: Promise<void> | undefined;
			let failure: { cause: unknown } | undefined;
			try {
				const configuration = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await fixture.report(sensorId, 18);
				await settleReal(fixture);
				const initialOn = fixture.controls.sends.filter((send) => send.on);
				expect(initialOn).toHaveLength(1);
				fixture.controls.beforeFence = gate;
				await fixture.report(sensorId, 21);
				let timeout: ReturnType<typeof setTimeout> | undefined;
				try {
					await Promise.race([
						entered,
						new Promise<never>((_, reject) => {
							timeout = setTimeout(() => reject(new Error('Original OFF fence entry missing')), 5000);
						}),
					]);
				} finally {
					clearTimeout(timeout);
				}
				const a = calls.find((call) => call.args[4].commandId === heldId);
				if (!a) throw new Error('Original managed OFF arguments missing');
				original = owner['inFlight'].get(heldId);
				if (original === undefined) throw new Error('Original managed OFF promise missing');
				const before = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: heldId });
				expect(before).toMatchObject({ action: 'off', status: 'dispatching', proofId: null });
				expect(a.args[3]()).toBe(true);
				const admitted = claims.capture();
				expect(admitted.isCurrent()).toBe(true);
				if (loss === 'claims') claims.invalidate();
				else if (loss === 'native-registration') fixture.platforms.onModuleDestroy();
				else if (loss === 'destroy') owner.onModuleDestroy();
				if (loss !== 'none') expect(a.args[3]()).toBe(false);
				expect(deliveries.filter((entry) => entry.origin === heldId)).toEqual([]);
				release();
				await original;
				if (loss !== 'none') expect(deliveries.filter((entry) => entry.origin === heldId)).toEqual([]);
				await fixture.flushTelemetry();
				await owner.flush();
				if (loss === 'none') await settleReal(fixture);
				const after = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: heldId });
				if (loss === 'none') {
					expect(a.outcome?.outcome).toBe('accepted');
					expect(deliveries.some((entry) => entry.origin === heldId)).toBe(true);
					expect(after).toEqual({
						...before,
						status: 'confirmed',
						settledAt: expect.any(Date) as Date,
						proofId: expect.any(String) as string,
					});
					expect(deliveries.some((entry) => entry.proofId === after.proofId)).toBe(true);
				} else {
					expect(a.args[3]()).toBe(false);
					expect(deliveries.filter((entry) => entry.origin === heldId)).toEqual([]);
					expect(after).toEqual({
						...before,
						status: 'unknown',
						settledAt: expect.any(Date) as Date,
						fault: expect.any(String) as string,
					});
					expect(owner.readDiagnostics(controllerId)?.branches.some((branch) => branch.release_proven)).toBe(false);
				}
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
					configuration,
				);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual(initialOn);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				try {
					await observed.cleanup();
				} catch (cause) {
					failure ??= { cause };
				}
				if (fixture.controls.beforeFence === gate) fixture.controls.beforeFence = previousGate;
				else if (fixture.controls.beforeFence !== previousGate)
					failure ??= { cause: new Error('Foreign OFF fence observer retained') };
			}
			if (failure) throw failure.cause;
		},
	);
	const waitNativeLifetime = async <T>(operation: Promise<T>, message: string): Promise<T> => {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				operation,
				new Promise<never>((_, reject) => {
					timeout = setTimeout(() => reject(new Error(message)), 5000);
				}),
			]);
		} finally {
			clearTimeout(timeout);
		}
	};
	const nativeLifetimeImage = async () => {
		const image: Record<string, Array<Record<string, unknown>>> = {};
		for (const table of [
			'devices_virtual_thermostat_configs',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_sources',
			'devices_module_climate_automation_slots',
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_graph_revision',
		])
			image[table] = await database.manager.query<Array<Record<string, unknown>>>(
				`SELECT * FROM "${table}" ORDER BY rowid`,
			);
		return image;
	};

	it.each(['fresh-instance', 'same-instance'] as const)(
		'keeps original held native command history separate from %s successor load and completion',
		async (restart) => {
			const observed = await observeNativeDispatchOrigin();
			const { fixture, claims, owner: a, calls } = observed;
			let enterOn!: () => void, releaseOn!: () => void, enterRead!: () => void, releaseRead!: () => void;
			const onEntered = ownedGate((resolve) => (enterOn = resolve));
			const onHeld = ownedGate((resolve) => (releaseOn = resolve));
			const readEntered = ownedGate((resolve) => (enterRead = resolve));
			const readHeld = ownedGate((resolve) => (releaseRead = resolve));
			observed.releaseOnCleanup(releaseOn);
			observed.releaseOnCleanup(releaseRead);
			const previousGate = fixture.controls.beforeOn;
			const gate = async (property: string) => {
				if (property !== relayId) return;
				enterOn();
				await onHeld;
			};
			fixture.controls.beforeOn = gate;
			let b: VirtualThermostatRuntimeService | undefined;
			let original: Promise<void> | undefined, loading: Promise<void> | undefined, starting: Promise<void> | undefined;
			let failure: { cause: unknown } | undefined;
			const structure = a['structure'];
			const shared = structure.runShared.bind(structure) as typeof structure.runShared;
			const sharedOwner = new AsyncLocalStorage<boolean>();
			let holdRead = false,
				nativeRead = false;
			const subscriber = {
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					if (
						holdRead &&
						event.query.startsWith('SELECT ') &&
						event.query.includes('devices_virtual_thermostat_branch_runtime')
					)
						nativeRead = true;
				},
			};
			database.subscribers.push(subscriber);
			const sharedObserver = jest
				.spyOn(structure, 'runShared')
				.mockImplementation(async <T>(work: () => Promise<T>): Promise<T> => {
					if (sharedOwner.getStore()) return shared(work);
					const result = await sharedOwner.run(true, () => shared(work));
					if (holdRead && nativeRead) {
						holdRead = false;
						await structure.runExclusiveReleased(() => Promise.resolve());
						enterRead();
						await readHeld;
					}
					return result;
				});
			try {
				await fixture.report(sensorId, 18);
				await waitNativeLifetime(onEntered, 'Original native ON gate unavailable');
				await a.flush();
				const on = calls.find((call) => call.args[0].value === true);
				if (!on?.context) throw new Error('Original ON command context missing');
				const id = on.args[4].commandId;
				original = a['inFlight'].get(id);
				if (original === undefined) throw new Error('Original native ON operation missing');
				let completed = false;
				void original.then(
					() => {
						completed = true;
					},
					() => undefined,
				);
				expect(on.args[3]()).toBe(true);
				await fixture.report(sensorId, 21);
				await a.flush();
				a.onModuleDestroy();
				expect(on.args[3]()).toBe(false);
				b =
					restart === 'same-instance'
						? a
						: new VirtualThermostatRuntimeService(
								database,
								structure,
								claims,
								a['inputs'],
								fixture.transport,
								fixture.values,
								producers,
								events,
								a['graph'],
								comfort,
								new ConfigService({ FB_CLI: 'off' }),
								undefined,
								comfort['automation'],
							);
				if (b !== a) issuedRuntimes.push(b);
				runtime = b;
				starting = b.onApplicationBootstrap();
				await waitNativeLifetime(starting, 'Successor bootstrap joined original held command');
				clearInterval(b['timer']);
				expect(completed).toBe(false);
				expect(claims.capture().isCurrent()).toBe(true);
				const lifecycle = b['lifecycle'];
				const context = b['contexts'].get(controllerId);
				expect(lifecycle).toBeDefined();
				expect(context).toBeDefined();
				expect(context).not.toBe(on.context);
				const before = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id });
				expect(before.status).toBe(restart === 'same-instance' ? 'dispatching' : 'confirmed');
				if (restart === 'fresh-instance') {
					expect(before.proofId).not.toBeNull();
					expect(observed.deliveries.some((delivery) => delivery.proofId === before.proofId)).toBe(true);
				}
				holdRead = true;
				loading = b.request(controllerId, false);
				void loading.catch(() => undefined);
				await waitNativeLifetime(readEntered, 'Successor original load did not leave its native shared owner');
				expect(nativeRead).toBe(true);
				expect(completed).toBe(false);
				releaseOn();
				const completion = await waitNativeLifetime(
					Promise.allSettled([original]),
					'Original native command joined successor load',
				);
				expect(completion[0].status).toBe(restart === 'same-instance' ? 'fulfilled' : 'rejected');
				if (completion[0].status === 'rejected')
					expect(completion[0].reason).toEqual(new Error('Original thermostat command journal image required'));
				expect(on.outcome?.outcome).toBe('refused');
				expect(b['lifecycle']).toBe(lifecycle);
				expect(b['contexts'].get(controllerId)).toBe(context);
				expect(on.args[3]()).toBe(false);
				const after = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id });
				expect(after.id).toBe(id);
				if (restart === 'same-instance') {
					expect(after.status).toBe('cancelled');
					expect(after.proofId).toBeNull();
				} else expect(after).toEqual(before);
				releaseRead();
				await loading;
				await settleReal(fixture);
				expect(b['lifecycle']).toBe(lifecycle);
				expect(b['contexts'].get(controllerId)).not.toBe(on.context);
				expect(b.readDiagnostics(controllerId).branches.every((branch) => branch.release_proven)).toBe(true);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				b?.onModuleDestroy();
				releaseOn();
				releaseRead();
				await Promise.allSettled([starting, loading, original].filter((p) => p !== undefined));
				sharedObserver.mockRestore();
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
				try {
					await observed.cleanup();
				} catch (cause) {
					failure ??= { cause };
				}
				if (fixture.controls.beforeOn === gate) fixture.controls.beforeOn = previousGate;
				else failure ??= { cause: new Error('Foreign lifetime ON gate retained') };
			}
			if (failure) throw failure.cause;
		},
	);

	it('keeps a fully settled original command out of fresh successor predecessor capture and unchanged comfort selection', async () => {
		const observed = await observeNativeDispatchOrigin();
		const { fixture, claims, owner: a, calls } = observed;
		let b: VirtualThermostatRuntimeService | undefined;
		let originalCompletion: Promise<void> | undefined;
		const promiseIds = new WeakMap<object, number>();
		const capturedContinuations: number[] = [];
		let originalAsyncId: number | undefined;
		let observingCapture = false;
		const hook = createHook({
			init(asyncId, type, triggerAsyncId, resource: object) {
				if (type !== 'PROMISE') return;
				promiseIds.set(resource, asyncId);
				if (observingCapture && triggerAsyncId === originalAsyncId) capturedContinuations.push(asyncId);
			},
		});
		hook.enable();
		const previousOn = fixture.controls.afterOn;
		const observeCompletion = async (property: string) => {
			if (property === relayId) {
				const on = calls.find((call) => call.args[0].value === true);
				const decisions = [...(a['ownership']['pending'].get(controllerId) ?? [])].filter(
					(decision) => on !== undefined && decision.commands.has(on.args[4].commandId),
				);
				if (decisions.length !== 1) throw new Error('Original issued ON completion unavailable');
				originalCompletion = decisions[0].completion;
			}
			await previousOn?.(property);
		};
		fixture.controls.afterOn = observeCompletion;
		let failure: { cause: unknown } | undefined;
		try {
			await fixture.report(sensorId, 18);
			await settleReal(fixture);
			const on = calls.find((call) => call.args[0].value === true);
			if (!on) throw new Error('Original accepted native command missing');
			await fixture.report(sensorId, 21);
			await settleReal(fixture);
			const expected = await comfortFence();
			await comfort.select(controllerId, expected, 'eco', false);
			await settleReal(fixture);
			expect(a['inFlight'].size).toBe(0);
			if (originalCompletion === undefined) throw new Error('Original settled ON completion missing');
			await originalCompletion;
			expect(
				[...(a['ownership']['pending'].get(controllerId) ?? [])].map((decision) => decision.completion),
			).not.toContain(originalCompletion);
			originalAsyncId = promiseIds.get(originalCompletion);
			expect(originalAsyncId).toBeDefined();
			const original = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
				id: on.args[4].commandId,
			});
			expect(original.status).toBe('confirmed');
			expect(original.proofId).not.toBeNull();
			a.onModuleDestroy();
			b = new VirtualThermostatRuntimeService(
				database,
				a['structure'],
				claims,
				a['inputs'],
				fixture.transport,
				fixture.values,
				producers,
				events,
				a['graph'],
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				comfort['automation'],
			);
			issuedRuntimes.push(b);
			runtime = b;
			await b.onApplicationBootstrap();
			clearInterval(b['timer']);
			await settleReal(fixture);
			expect(b['inFlight'].size).toBe(0);
			const before = await nativeLifetimeImage();
			observingCapture = true;
			try {
				await waitNativeLifetime(
					b.capturePredecessors(controllerId),
					'Fresh predecessor capture retained completed history',
				);
				expect(capturedContinuations).toEqual([]);
			} finally {
				observingCapture = false;
			}
			const current = await comfortFence();
			await comfort.select(controllerId, current, 'eco', false);
			await settleReal(fixture);
			expect(await nativeLifetimeImage()).toEqual(before);
			expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: original.id })).toEqual(
				original,
			);
			expect(fixture.controls.sends.filter((send) => send.on)).toHaveLength(1);
			expect(fixture.controls.errors).toEqual([]);
		} catch (cause) {
			failure = { cause };
		} finally {
			hook.disable();
			b?.onModuleDestroy();
			try {
				await observed.cleanup();
			} catch (cause) {
				failure ??= { cause };
			}
			if (fixture.controls.afterOn === observeCompletion) fixture.controls.afterOn = previousOn;
			else failure ??= { cause: new Error('Foreign original-completion observer retained') };
		}
		if (failure) throw failure.cause;
	});

	it.each(['oversized', 'clone'] as const)(
		'refuses a %s original-decision identity before native callbacks while a genuine runtime read is held',
		async (kind) => {
			const { fixture } = await useRegisteredNativeClaimsGuard();
			const owner = runtime;
			clearInterval(owner['timer']);
			const ownership = owner['ownership'];
			const admit = ownership.admit.bind(ownership) as typeof ownership.admit;
			let genuine: ThermostatOwnedDecision | undefined;
			const admission = jest.spyOn(ownership, 'admit').mockImplementation((id) => {
				const result = admit(id);
				genuine = result;
				return result;
			});
			const roots = new AsyncLocalStorage<object>();
			const root = Object.freeze({ kind });
			let enter!: () => void, release!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const held = ownedGate((resolve) => (release = resolve));
			let armed = true,
				queries = 0,
				getters = 0;
			const subscriber = {
				beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					queries++;
					if (
						armed &&
						roots.getStore() === root &&
						event.query.startsWith('SELECT ') &&
						event.query.includes('devices_virtual_thermostat_configs')
					) {
						armed = false;
						enter();
						await held;
					}
				},
			};
			database.subscribers.push(subscriber);
			const original = roots.run(root, () => owner.requestInstalled(controllerId));
			void original.catch(() => undefined);
			let rejected: Promise<void> | undefined;
			try {
				await waitNativeLifetime(entered, 'Genuine runtime decision first read unavailable');
				expect(genuine).toBeDefined();
				const packet = Object.freeze(
					kind === 'clone'
						? { ...genuine }
						: {
								get projections() {
									getters++;
									return Array.from({ length: 9 }, () => ({}));
								},
							},
				);
				const before = queries,
					fences = [...fixture.controls.fences],
					sends = [...fixture.controls.sends];
				const callback = jest.fn(() => database.manager.query<unknown[]>('SELECT 1').then(() => undefined));
				rejected = ownership.run(packet as ThermostatOwnedDecision, callback);
				void rejected.catch(() => undefined);
				expect(callback).not.toHaveBeenCalled();
				await expect(waitNativeLifetime(rejected, 'Foreign decision joined the original native read')).rejects.toThrow(
					'Original thermostat decision required',
				);
				expect(() => ownership.completion(packet as ThermostatOwnedDecision)).toThrow(
					'Original unstarted thermostat decision required',
				);
				expect(callback).not.toHaveBeenCalled();
				expect(getters).toBe(0);
				expect(queries).toBe(before);
				expect(fixture.controls.fences).toEqual(fences);
				expect(fixture.controls.sends).toEqual(sends);
				release();
				await original;
				await settleReal(fixture);
				expect(owner.readDiagnostics(controllerId).configuration_revision).toBeGreaterThan(0);
				expect(fixture.controls.errors).toEqual([]);
			} finally {
				owner.onModuleDestroy();
				release();
				await Promise.allSettled([original, ...(rejected !== undefined ? [rejected] : [])]);
				admission.mockRestore();
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
			}
		},
	);

	it.each(['undefined', 'null', 'false', 'string', 'error', 'Q-only'] as const)(
		'preserves native bootstrap primary %s through actual registration cleanup while original command stays held',
		async (kind) => {
			const observed = await observeNativeDispatchOrigin();
			const { fixture, claims, owner, calls } = observed;
			let enter!: () => void, release!: () => void;
			const entered = ownedGate((resolve) => (enter = resolve));
			const held = ownedGate((resolve) => (release = resolve));
			observed.releaseOnCleanup(release);
			const previousGate = fixture.controls.afterOn;
			const gate = async (property: string) => {
				if (property === relayId) {
					enter();
					await held;
				}
			};
			fixture.controls.afterOn = gate;
			const secondary = new Error('actual bootstrap registration cleanup Q');
			const primary: unknown = {
				undefined: undefined,
				null: null,
				false: false,
				string: 'native bootstrap P',
				error: new Error('native bootstrap P'),
				'Q-only': secondary,
			}[kind];
			let armed = false,
				nativeCallback = false,
				cleanupCalls = 0;
			const register = claims.registerRuntimeAdmission.bind(claims) as typeof claims.registerRuntimeAdmission;
			const registration = jest.spyOn(claims, 'registerRuntimeAdmission').mockImplementation((admission) => {
				const stop = register(admission);
				return () => {
					stop();
					cleanupCalls++;
					if (kind !== 'Q-only') throw secondary;
				};
			});
			const logger = jest.spyOn(owner['logger'], 'error').mockImplementation(() => undefined);
			const outcomes: string[] = [];
			const subscriber = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (armed && event.query.startsWith('UPDATE "devices_virtual_thermostat_branch_runtime"')) {
						armed = false;
						nativeCallback = true;
						throw primary;
					}
				},
				afterQuery: (event: AfterQueryEvent<unknown>) => {
					if (event.query === 'ROLLBACK' || event.query === 'COMMIT') outcomes.push(event.query);
				},
			};
			let original: Promise<void> | undefined, starting: Promise<void> | undefined;
			let failure: { cause: unknown } | undefined;
			try {
				await fixture.report(sensorId, 18);
				await waitNativeLifetime(entered, 'Original possibly-sent native ON not held');
				await owner.flush();
				const on = calls.find((call) => call.args[0].value === true);
				if (!on) throw new Error('Original managed ON missing');
				original = owner['inFlight'].get(on.args[4].commandId);
				if (original === undefined) throw new Error('Original pending native command missing');
				let completed = false;
				void original.then(
					() => {
						completed = true;
					},
					() => undefined,
				);
				owner.onModuleDestroy();
				const before = await nativeLifetimeImage();
				const runtimeBefore = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, {
					controllerId,
				});
				database.subscribers.push(subscriber);
				armed = true;
				starting = owner.onApplicationBootstrap();
				const result = await waitNativeLifetime(
					Promise.allSettled([starting]),
					'Failed bootstrap joined original held native command',
				);
				expect(result[0]).toEqual({ status: 'rejected', reason: primary });
				if (result[0].status === 'rejected') expect(result[0].reason).toBe(primary);
				expect(nativeCallback).toBe(true);
				expect(outcomes).toEqual(['ROLLBACK']);
				expect(cleanupCalls).toBe(1);
				expect(completed).toBe(false);
				expect(owner['inFlight'].get(on.args[4].commandId)).toBe(original);
				expect(owner['active']).toBe(false);
				expect(owner['bootstrap']).toBeUndefined();
				expect(owner['lifecycle']).toBeUndefined();
				expect(owner['timer']).toBeUndefined();
				expect(owner['contexts'].size).toBe(0);
				expect(claims['runtimeAdmission']).toBeUndefined();
				expect(await nativeLifetimeImage()).toEqual(before);
				expect(await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId })).toEqual(
					runtimeBefore,
				);
				expect(logger.mock.calls).toEqual(
					kind === 'Q-only' ? [] : [['Failed to retire original thermostat runtime', secondary]],
				);
				registration.mockRestore();
				release();
				await original;
				await fixture.flushTelemetry();
				const after = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
					id: on.args[4].commandId,
				});
				expect(after.status).toBe('unknown');
				expect(after.proofId).toBeNull();
				expect(fixture.controls.sends.filter((send) => send.on)).toHaveLength(1);
				expect(fixture.controls.errors).toEqual([]);
			} catch (cause) {
				failure = { cause };
			} finally {
				registration.mockRestore();
				try {
					await observed.cleanup();
				} catch (cause) {
					failure ??= { cause };
				}
				if (fixture.controls.afterOn === gate) fixture.controls.afterOn = previousGate;
				else failure ??= { cause: new Error('Foreign bootstrap ON gate retained') };
				logger.mockRestore();
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
				await Promise.allSettled([starting, original].filter((p) => p !== undefined));
			}
			if (failure) throw failure.cause;
		},
	);
});
