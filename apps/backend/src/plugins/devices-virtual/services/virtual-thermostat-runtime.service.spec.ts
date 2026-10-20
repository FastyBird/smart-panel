import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DataSource, TransactionCommitEvent } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { createProtectionProbe, memberInstallationSetup } from '../../../../test/support/thermostat-protection-fixture';
import {
	realThermostatGuardFixture,
	useThermostatPacketClock,
} from '../../../../test/support/thermostat-real-guard-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { IndexVirtualThermostatCommands1000000000035 } from '../../../migrations/1000000000035-IndexVirtualThermostatCommands';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import { ConfigService as ModuleConfigService } from '../../../modules/config/services/config.service';
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
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { creationMethodCurrent } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { DEVICES_SHELLY_NG_TYPE } from '../../devices-shelly-ng/devices-shelly-ng.constants';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import { ConfigureVirtualThermostatDto } from '../dto/thermostat-config.dto';
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
import { resolveInstallationSetup } from './thermostat-installation.service';
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
import { ThermostatRuntimeDiagnostic, VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import {
	RuntimeOffDispatchWork,
	RuntimeReconciliationWork,
	ThermostatActuationAdapter,
	ThermostatReleaseOrderingEvidence,
	VirtualThermostatTransportService,
} from './virtual-thermostat-transport.service';

/** Erased original-function view: same function object, explicit original receiver and result. */
type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFunctions<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };

jest.setTimeout(30_000);

describe('virtual thermostat durable runtime', () => {
	const completionObserverBackstops = new Set<Readonly<{ retire: () => void; cleanup: () => void }>>();
	let directory: string;
	let database: SqliteDataSource;
	let runtime: VirtualThermostatRuntimeService;
	let ordinaryTransportOwner:
		| Readonly<{
				platforms: PlatformRegistryService;
				transport: VirtualThermostatTransportService;
				dispose: () => void;
		  }>
		| undefined;
	let realGuardFixtures: Awaited<ReturnType<typeof realThermostatGuardFixture>>[];
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
	let mutationPipeline: TestingModule,
		mutationValues: PropertyValueService,
		mutationClaims: VirtualThermostatClaimsService;
	let mutationRegistry: ClimateAutomationRegistryService, mutationWriter: ClimateAutomationWriterService;
	let mutationProvider: VirtualThermostatAutomationService;
	let mutationGraph: VirtualDependencyGraphService;
	let mutationStructure: DeviceStructureLockService;
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
		ordinaryTransportOwner = undefined;
		realGuardFixtures = [];
		directory = await mkdtemp(join(tmpdir(), 'vd2-thermostat-runtime-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'runtime.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		// Synchronized test schemas omit migration27's installed graph singleton seed.
		await database.query('INSERT INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)');
		expect(await database.query('SELECT "id", "revision" FROM "devices_virtual_graph_revision" ORDER BY "id"')).toEqual(
			[{ id: 1, revision: 0 }],
		);
		samples.clear();
		protectionProbes.clear();
		packetTick = null;
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
			holdRecoveryFence: jest.fn(() => () => undefined),
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
		const platforms = new PlatformRegistryService();
		const transport = new VirtualThermostatTransportService(platforms, values);
		const dispose = transport.register(DEVICES_SHELLY_NG_TYPE, adapter);
		ordinaryTransportOwner = Object.freeze({ platforms, transport, dispose });
		const graph = {
			isValidated: () => graphValidated,
			capturePublishGuard: () => {
				const generation = graphGeneration;
				return () => graphValidated && generation === graphGeneration;
			},
		} as unknown as VirtualDependencyGraphService;
		// The old isolated runtime sample/delegate fixture above remains synthetic and is not route authority evidence.
		// Mutation routes use a separate real core/registry/claims/value pipeline and the SAME actual owned SQLite database.
		mutationStructure = new DeviceStructureLockService();
		mutationRegistry = new ClimateAutomationRegistryService();
		mutationWriter = new ClimateAutomationWriterService(
			database,
			mutationStructure,
			mutationRegistry,
			new ConfigService({ FB_CLI: 'off' }),
		);
		mutationGraph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), mutationWriter);
		mutationClaims = new VirtualThermostatClaimsService(
			database,
			mutationStructure,
			mutationGraph,
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		mutationPipeline = await Test.createTestingModule({
			providers: [
				PropertyValueService,
				PropertyValueLockService,
				PropertyValueSourceRegistryService,
				{ provide: PropertyProducerRegistryService, useValue: producers },
				StorageService,
				{ provide: DataSource, useValue: database },
				{ provide: EventEmitter2, useValue: events },
				{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{
					provide: ModuleConfigService,
					useValue: {
						getModuleConfig: () =>
							Object.assign(new StorageConfigModel(), { primaryStorage: 'runtime-mutation-fixture' }),
					},
				},
			],
		}).compile();
		const storage = mutationPipeline.get(StorageService);
		const plugin: StoragePlugin = {
			name: 'runtime-mutation-fixture',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => true,
			writePoints: () => Promise.resolve(),
			query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('No raw mutation fixture history')),
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		storage.registerPlugin(plugin.name, plugin);
		mutationValues = mutationPipeline.get(PropertyValueService);
		configs = new VirtualThermostatConfigService(
			database,
			mutationStructure,
			mutationGraph,
			mutationClaims,
			events,
			mutationValues,
			undefined,
			mutationWriter,
		);
		comfort = new VirtualThermostatComfortService(
			database,
			mutationStructure,
			mutationGraph,
			mutationClaims,
			events,
			mutationWriter,
		);
		mutationProvider = new VirtualThermostatAutomationService(
			mutationWriter,
			mutationRegistry,
			mutationGraph,
			new ConfigService({ FB_CLI: 'off' }),
			undefined,
			configs,
			comfort,
		);
		mutationProvider.onModuleInit();
		await mutationGraph.onApplicationBootstrap();
		await mutationClaims.onApplicationBootstrap();
		await database.query('DROP TABLE "devices_module_climate_automation_slots"');
		await database.query('DROP TABLE "devices_module_climate_automation_sources"');
		await new AddClimateAutomationOwnership1000000000047().up(database.createQueryRunner());
		makeRuntime = (runtimeGraph = graph, aggregate, runtimeTransport = transport) =>
			new VirtualThermostatRuntimeService(
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
		runtime = makeRuntime();
		installInitialRuntimeObservers(runtime, database, controllerId);
		await runtime.onApplicationBootstrap();
	});
	afterEach(async () => {
		// Snapshot exact case owners before any await; a late timed-out A cannot select next fixture B.
		const owned = {
			runtime,
			ordinary: ordinaryTransportOwner,
			provider: mutationProvider,
			comfort,
			claims: mutationClaims,
			registry: mutationRegistry,
			fixtures: [...realGuardFixtures],
			pipeline: mutationPipeline,
			database,
			directory,
			observers: [...completionObserverBackstops],
		};
		ordinaryTransportOwner = undefined;
		let failure: { cause: unknown } | undefined;
		const attempt = (action: () => void): void => {
			try {
				action();
			} catch (cause) {
				failure ??= { cause };
			}
		};
		const attemptAsync = async (action: () => Promise<unknown>): Promise<void> => {
			try {
				await action();
			} catch (cause) {
				failure ??= { cause };
			}
		};
		for (const observer of owned.observers) attempt(() => observer.retire());
		attempt(() => owned.runtime?.onModuleDestroy());
		attempt(() => owned.ordinary?.dispose());
		attempt(() => owned.ordinary?.transport.onModuleDestroy());
		attempt(() => owned.ordinary?.platforms.onModuleDestroy());
		attempt(() => owned.provider?.onModuleDestroy());
		attempt(() => owned.comfort?.onModuleDestroy());
		attempt(() => owned.claims?.onModuleDestroy());
		attempt(() => owned.registry?.onModuleDestroy());
		for (const fixture of owned.fixtures) attempt(() => fixture.revoke());
		// Remove exact owned H/S descriptors before Jest's framework restoration, even after earlier cleanup P.
		for (const observer of owned.observers) attempt(() => observer.cleanup());
		for (const fixture of owned.fixtures) await attemptAsync(() => fixture.close());
		const pipeline = owned.pipeline;
		if (pipeline) await attemptAsync(() => pipeline.close());
		attempt(() => jest.restoreAllMocks());
		attempt(() => jest.useRealTimers());
		if (owned.database?.isInitialized) await attemptAsync(() => owned.database.destroy());
		await attemptAsync(() => rm(owned.directory, { recursive: true, force: true }));
		if (failure) throw failure.cause;
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
	const createTemperatureOutput = async (
		owned?: Readonly<{ database: SqliteDataSource; controllerId: string; assertLive: () => void }>,
	): Promise<string> => {
		const channelId = uuid(),
			propertyId = uuid();
		owned?.assertLive();
		await (owned === undefined ? database : owned.database).manager.insert(VirtualChannelEntity, {
			id: channelId,
			device: owned === undefined ? controllerId : owned.controllerId,
			name: 'Current temperature',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		owned?.assertLive();
		await (owned === undefined ? database : owned.database).manager.insert(VirtualChannelPropertyEntity, {
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

	// R53: observers record ONLY original methods invoked by a genuine public evaluation.
	const originalEntryDescriptors: Readonly<{
		getOwnPropertyDescriptor: (
			owner: object,
			key: PropertyKey,
		) => (Omit<PropertyDescriptor, 'value'> & { value?: unknown }) | undefined;
	}> = Object;
	const restoreOriginalEntry = (
		owner: object,
		key: string,
		installed: PropertyDescriptor,
		original: PropertyDescriptor | undefined,
	): void => {
		const current = originalEntryDescriptors.getOwnPropertyDescriptor(owner, key);
		if (
			!current ||
			current.value !== installed.value ||
			current.get !== installed.get ||
			current.set !== installed.set ||
			current.configurable !== installed.configurable ||
			current.enumerable !== installed.enumerable ||
			current.writable !== installed.writable
		)
			throw new Error('Original entry observer replaced by foreign owner');
		if (original) Object.defineProperty(owner, key, original);
		else if (!Reflect.deleteProperty(owner, key)) throw new Error('Original entry observer could not be removed');
	};
	const installOriginalDecisionLoads = (owner: VirtualThermostatRuntimeService, originalControllerId: string) => {
		const original: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['loadDecisionCommands']> =
			owner['loadDecisionCommands'];
		let installedOwned = false;
		const before = Object.getOwnPropertyDescriptor(owner, 'loadDecisionCommands');
		const publicEntry = new AsyncLocalStorage<object>();
		let armed = false,
			retired = false,
			restored = false;
		type Snapshot = readonly VirtualThermostatCommandEntity[];
		let lastSnapshot: Promise<Snapshot> | undefined;
		let waiting:
			| {
					ticket: object;
					lifecycle: object;
					entered: boolean;
					resolve: (rows: Snapshot) => void;
					reject: (cause: unknown) => void;
			  }
			| undefined;
		const loading = function (this: VirtualThermostatRuntimeService, ...args: Parameters<typeof original>) {
			const pending = original.call(this, ...args);
			const target = waiting;
			if (
				armed &&
				!retired &&
				this === owner &&
				target &&
				!target.entered &&
				publicEntry.getStore() === target.ticket &&
				owner['lifecycle'] === target.lifecycle &&
				args[0] === originalControllerId
			) {
				target.entered = true; // Exactly the first loader of this original public invocation.
				void pending.then(
					(rows) => {
						try {
							if (retired || owner['lifecycle'] !== target.lifecycle)
								throw new Error('Original decision loader owner retired');
							if (waiting === target) waiting = undefined;
							target.resolve(Object.freeze([...rows])); // Own membership, never freeze/mutate the application's array.
						} catch (cause) {
							if (waiting === target) waiting = undefined;
							target.reject(cause);
						}
					},
					(cause: unknown) => {
						if (waiting === target) waiting = undefined;
						target.reject(cause);
					},
				);
			}
			return pending; // SAME original application Promise.
		};
		const installed = { configurable: true, enumerable: before?.enumerable ?? false, writable: true, value: loading };
		const retire = (): void => {
			retired = true;
			const target = waiting;
			waiting = undefined;
			target?.reject(new Error('Original decision loader observer retired'));
		};
		const backstop = {
			retire,
			cleanup: (): void => {
				retire();
				if (restored) return;
				if (owner['active'] || owner['lifecycle'] !== undefined) throw new Error('Decision loader owner not retired');
				if (installedOwned) restoreOriginalEntry(owner, 'loadDecisionCommands', installed, before);
				restored = true;
				completionObserverBackstops.delete(backstop);
			},
		};
		completionObserverBackstops.add(backstop);
		Object.defineProperty(owner, 'loadDecisionCommands', installed);
		installedOwned = true;
		return {
			arm: () => {
				if (retired || armed) throw new Error('Original decision loader observation unavailable');
				armed = true;
				return {
					last: (): Promise<Snapshot> => {
						if (retired || lastSnapshot === undefined) throw new Error('Genuine original decision loader not reached');
						return lastSnapshot;
					},
					read: async (): Promise<Snapshot> => {
						const lifecycle = owner['lifecycle'];
						if (retired || waiting || lifecycle === undefined)
							throw new Error('Original public loader entry unavailable');
						const ticket = Object.freeze({});
						const observation = new Promise<Snapshot>((resolve, reject) => {
							waiting = { ticket, lifecycle, entered: false, resolve, reject };
						});
						lastSnapshot = observation;
						void observation.then(
							() => undefined,
							() => undefined,
						);
						const finishWithoutLoader = (cause: unknown): void => {
							if (waiting?.ticket !== ticket) return;
							const target = waiting;
							waiting = undefined;
							target.reject(cause);
						};
						try {
							const inspection = publicEntry.run(ticket, () => owner.inspect(originalControllerId));
							void inspection.then(
								() => finishWithoutLoader(new Error('Public evaluation did not enter its original loader')),
								(cause: unknown) => finishWithoutLoader(cause),
							);
							await inspection; // Preserve the existing public-evaluation completion boundary.
						} catch (cause) {
							finishWithoutLoader(cause);
							throw cause;
						}
						return observation;
					},
				};
			},
		};
	};
	const installOriginalReconciliation = (
		owner: VirtualThermostatRuntimeService,
		source: SqliteDataSource,
		originalControllerId: string,
	) => {
		const original: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['reconcile']> = owner['reconcile'];
		let installedOwned = false;
		const before = Object.getOwnPropertyDescriptor(owner, 'reconcile');
		const publicEntry = new AsyncLocalStorage<object>();
		type Entry = {
			owner: VirtualThermostatRuntimeService;
			context: Parameters<typeof original>[0];
			claim: Parameters<typeof original>[1];
			ticket: object | undefined;
			lifecycle: object | undefined;
			nativeRead: boolean;
		};
		const scope = new AsyncLocalStorage<Entry>();
		let armed = false,
			retired = false,
			restored = false;
		let waiting:
			| { ticket: object; lifecycle: object; claimId: string; resolve: () => void; reject: (cause: unknown) => void }
			| undefined;
		const nativeObserver = {
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
				const entry = scope.getStore();
				if (
					entry &&
					event.query.startsWith('SELECT') &&
					event.query.includes('devices_virtual_thermostat_command_journal')
				)
					entry.nativeRead = true;
			},
		};
		const reconciling = function (this: VirtualThermostatRuntimeService, ...args: Parameters<typeof original>) {
			if (!armed || retired || this !== owner) return original.call(this, ...args);
			const entry = {
				owner: this,
				context: args[0],
				claim: args[1],
				ticket: publicEntry.getStore(),
				lifecycle: owner['lifecycle'],
				nativeRead: false,
			};
			const pending = scope.run(entry, () => original.call(this, ...args));
			const complete = (outcome: { fulfilled: true; cause?: never } | { fulfilled: false; cause: unknown }): void => {
				const target = waiting;
				if (
					retired ||
					(outcome.fulfilled && !entry.nativeRead) ||
					!target ||
					entry.lifecycle !== target.lifecycle ||
					owner['lifecycle'] !== target.lifecycle ||
					entry.ticket !== target.ticket ||
					entry.claim.id !== target.claimId
				)
					return;
				waiting = undefined;
				if (outcome.fulfilled) target.resolve();
				else target.reject(outcome.cause);
			};
			void pending.then(
				() => complete({ fulfilled: true }),
				(cause: unknown) => complete({ fulfilled: false, cause }),
			);
			return pending; // SAME original application Promise, not the observer receipt below.
		};
		const installed = {
			configurable: true,
			enumerable: before?.enumerable ?? false,
			writable: true,
			value: reconciling,
		};
		const retire = (): void => {
			retired = true;
			const target = waiting;
			waiting = undefined;
			target?.reject(new Error('Original public reconciliation observer retired before native entry'));
		};
		const backstop = {
			retire,
			cleanup: (): void => {
				retire();
				if (restored) return;
				if (owner['active'] || owner['lifecycle'] !== undefined) throw new Error('Reconciliation owner not retired');
				const index = source.subscribers.indexOf(nativeObserver);
				if (index >= 0) source.subscribers.splice(index, 1);
				if (installedOwned) restoreOriginalEntry(owner, 'reconcile', installed, before);
				restored = true;
				completionObserverBackstops.delete(backstop);
			},
		};
		completionObserverBackstops.add(backstop);
		Object.defineProperty(owner, 'reconcile', installed);
		installedOwned = true;
		const observation = {
			scope,
			isWaitingEntry: (entry: Entry | undefined): boolean => {
				const target = waiting;
				return (
					!retired &&
					target !== undefined &&
					entry !== undefined &&
					entry === scope.getStore() &&
					entry.owner === owner &&
					entry.lifecycle === target.lifecycle &&
					owner['lifecycle'] === target.lifecycle &&
					entry.ticket === target.ticket &&
					entry.claim.id === target.claimId &&
					entry.claim.controllerId === originalControllerId &&
					entry.context.config.controllerId === originalControllerId &&
					entry.nativeRead
				);
			},
			start: (claim: VirtualThermostatActuatorClaimEntity): Promise<void> => {
				const lifecycle = owner['lifecycle'];
				if (retired || waiting || lifecycle === undefined)
					throw new Error('Original public reconciliation observation unavailable');
				const ticket = Object.freeze({});
				const observation = new Promise<void>((resolve, reject) => {
					waiting = { ticket, lifecycle, claimId: claim.id, resolve, reject };
				});
				void observation.then(
					() => undefined,
					() => undefined,
				);
				try {
					const inspection = publicEntry.run(ticket, () => owner.inspect(originalControllerId));
					void inspection.then(
						() => {
							if (waiting?.ticket === ticket) {
								const target = waiting;
								waiting = undefined;
								target.reject(
									new Error('Original public inspection completed without its required native reconciliation entry'),
								);
							}
						},
						(cause: unknown) => {
							if (waiting?.ticket === ticket) {
								const target = waiting;
								waiting = undefined;
								target.reject(cause);
							}
						},
					);
				} catch (cause) {
					if (waiting?.ticket === ticket) {
						const target = waiting;
						waiting = undefined;
						target.reject(cause);
					}
				}
				return observation;
			},
		};
		return {
			arm: () => {
				if (retired || armed) throw new Error('Original reconciliation observation unavailable');
				armed = true;
				source.subscribers.push(nativeObserver);
				return observation;
			},
		};
	};

	const installOriginalRequest = (owner: VirtualThermostatRuntimeService) => {
		const methods: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = owner;
		const original = methods.request;
		let installedOwned = false;
		const before = Object.getOwnPropertyDescriptor(owner, 'request');
		let suppress = false,
			nextOriginal = false,
			retired = false,
			restored = false;
		const requesting = function (this: VirtualThermostatRuntimeService, ...args: Parameters<typeof original>): void {
			if (this !== owner || !suppress || retired) return original.call(this, ...args);
			if (nextOriginal) {
				nextOriginal = false;
				return original.call(this, ...args);
			}
		};
		const installed = {
			configurable: true,
			enumerable: before?.enumerable ?? false,
			writable: true,
			value: requesting,
		};
		const backstop = {
			retire: (): void => {
				retired = true;
				suppress = false;
				nextOriginal = false;
			},
			cleanup: (): void => {
				backstop.retire();
				if (restored) return;
				if (owner['active'] || owner['lifecycle'] !== undefined) throw new Error('Request owner not retired');
				if (installedOwned) restoreOriginalEntry(owner, 'request', installed, before);
				restored = true;
				completionObserverBackstops.delete(backstop);
			},
		};
		completionObserverBackstops.add(backstop);
		Object.defineProperty(owner, 'request', installed);
		installedOwned = true;
		return {
			arm: () => {
				if (retired || suppress) throw new Error('Original request suppression unavailable');
				suppress = true;
				return {
					allowNext: (): void => {
						if (retired || !suppress) throw new Error('Original request suppression retired');
						nextOriginal = true;
					},
					passThrough: (): void => {
						suppress = false;
						nextOriginal = false;
					},
				};
			},
		};
	};
	const initialRuntimeObservers = new WeakMap<
		VirtualThermostatRuntimeService,
		Readonly<{
			owner: VirtualThermostatRuntimeService;
			source: SqliteDataSource;
			id: string;
			settle: () => Promise<void>;
			assertLive: () => void;
			loads: ReturnType<typeof installOriginalDecisionLoads>;
			reconciliation: ReturnType<typeof installOriginalReconciliation>;
			request: ReturnType<typeof installOriginalRequest>;
		}>
	>();
	const installInitialRuntimeObservers = (
		owner: VirtualThermostatRuntimeService,
		source: SqliteDataSource,
		id: string,
	): void => {
		const methods: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'onModuleDestroy'>> = owner;
		const destroy = methods.onModuleDestroy;
		const retirement = {
			retire: (): void => undefined,
			cleanup: (): void => {
				try {
					if (owner['active'] || owner['lifecycle'] !== undefined) destroy.call(owner);
				} finally {
					initialRuntimeObservers.delete(owner);
					completionObserverBackstops.delete(retirement);
				}
			},
		};
		// First cleanup member: retire THIS initial owner even if a later case installed a different runtime.
		completionObserverBackstops.add(retirement);
		const lifecycleAtEntry = (): object => {
			const lifecycle = owner['lifecycle'];
			if (!owner['active'] || lifecycle === undefined) throw new Error('Original initial fixture owner retired');
			return lifecycle;
		};
		initialRuntimeObservers.set(owner, {
			owner,
			source,
			id,
			assertLive: (): void => {
				lifecycleAtEntry();
			},
			// Same existing five-cycle settle recipe; captured receiver/source, no late outer-fixture selection.
			settle: async (): Promise<void> => {
				const lifecycle = lifecycleAtEntry();
				const assertSame = (): void => {
					if (owner['lifecycle'] !== lifecycle || !owner['active']) throw new Error('Original settle owner retired');
				};
				for (let attempt = 0; attempt < 5; attempt++) {
					assertSame();
					await owner.flush();
					assertSame();
					await Promise.all([...owner['inFlight'].values()]);
				}
				assertSame();
				await owner.flush();
				assertSame();
			},
			loads: installOriginalDecisionLoads(owner, id),
			reconciliation: installOriginalReconciliation(owner, source, id),
			request: installOriginalRequest(owner),
		});
	};
	const originalObservers = (owner: VirtualThermostatRuntimeService) => {
		const observers = initialRuntimeObservers.get(owner);
		if (!observers) throw new Error('Only the original pre-bootstrap fixture owner can be observed');
		return observers;
	};
	const initialFixtureOwner = () => originalObservers(runtime);
	const observeOriginalDecisionLoads = (owner: VirtualThermostatRuntimeService) => originalObservers(owner).loads.arm();
	const observeOriginalReconciliation = (owner: VirtualThermostatRuntimeService) =>
		originalObservers(owner).reconciliation.arm();

	const observeHydrationReplacement = (driver: DataSource['driver']) => {
		const methods: OriginalFunctions<Pick<DataSource['driver'], 'prepareHydratedValue'>> = driver;
		const original = methods.prepareHydratedValue;
		const before = Object.getOwnPropertyDescriptor(driver, 'prepareHydratedValue');
		const mock = jest.fn<unknown, Parameters<typeof original>>((...args) => original.call(driver, ...args));
		const installed = { configurable: true, enumerable: before?.enumerable ?? true, writable: true, value: mock };
		let attempted = false,
			failure: { cause: unknown } | undefined;
		const restore = (): void => {
			if (attempted) return;
			attempted = true;
			try {
				restoreOriginalEntry(driver, 'prepareHydratedValue', installed, before);
				completionObserverBackstops.delete(backstop);
			} catch (cause) {
				failure = { cause };
			}
		};
		const assertRestored = (): void => {
			if (failure) throw failure.cause;
		};
		const backstop = {
			retire: (): void => undefined,
			cleanup: (): void => {
				restore();
				completionObserverBackstops.delete(backstop);
				assertRestored();
			},
		};
		completionObserverBackstops.add(backstop);
		Object.defineProperty(driver, 'prepareHydratedValue', installed);
		return { mock, restore, assertRestored };
	};
	// R53 terminal receipts are separate from the unchanged, narrow R42 helper/default callers.
	type R53ManagedFixture = Awaited<ReturnType<typeof realThermostatGuardFixture>>;
	type R53Outcome = { fulfilled: true; cause?: never } | { fulfilled: false; cause: unknown };
	type R53OffReceipt = Readonly<{
		operation: R53Outcome;
		service: R53Outcome;
		work: RuntimeOffDispatchWork;
		terminal: boolean;
		outputSaved: boolean;
		childState: string;
		failure?: { cause: unknown };
	}>;
	type R53OffBoundary = Readonly<{
		promise: Promise<R53OffReceipt>;
		flush: () => Promise<void>;
		assertOpen: () => void;
	}>;
	const observeR53OffTerminal = () => {
		const setupFixtures = realGuardFixtures,
			setupFixtureCount = setupFixtures.length;
		const transportPrototype = VirtualThermostatTransportService.prototype,
			runtimePrototype = VirtualThermostatRuntimeService.prototype;
		const originalTransport: OriginalFunctions<VirtualThermostatTransportService> = transportPrototype;
		const originalOpen = originalTransport.openRuntimeOffDispatchWork;
		const originalServiceLookup: Readonly<{
			get: (
				owner: object,
				key: 'serviceFeedback',
			) => OriginalFunction<VirtualThermostatRuntimeService, (typeof runtime)['serviceFeedback']>;
		}> = Reflect;
		const originalService = originalServiceLookup.get(runtimePrototype, 'serviceFeedback');
		const descriptors: Readonly<{
			getOwnPropertyDescriptor: (
				owner: object,
				key: PropertyKey,
			) => (Omit<PropertyDescriptor, 'value'> & { value?: unknown }) | undefined;
		}> = Object;
		const openDescriptor = descriptors.getOwnPropertyDescriptor(transportPrototype, 'openRuntimeOffDispatchWork'),
			serviceDescriptor = descriptors.getOwnPropertyDescriptor(runtimePrototype, 'serviceFeedback');
		if (
			!openDescriptor ||
			openDescriptor.get ||
			openDescriptor.set ||
			openDescriptor.value !== originalOpen ||
			!serviceDescriptor ||
			serviceDescriptor.get ||
			serviceDescriptor.set ||
			serviceDescriptor.value !== originalService
		)
			throw new Error('Original completion observation descriptors unavailable');
		const settlement: { resolve?: (receipt: R53OffReceipt) => void; reject?: (cause: unknown) => void } = {};
		const promise = new Promise<R53OffReceipt>((resolve, reject) => {
			settlement.resolve = resolve;
			settlement.reject = reject;
		});
		// This receipt is test-owned; an early original rejection must not become an unhandled side Promise.
		void promise.catch(() => undefined);
		let closed = false,
			matched = false,
			restored = false,
			openInstalled = false,
			serviceInstalled = false;
		let owner:
			| Readonly<{
					runtime: VirtualThermostatRuntimeService;
					fixture: R53ManagedFixture;
					flush: OriginalFunction<VirtualThermostatRuntimeService, VirtualThermostatRuntimeService['flush']>;
			  }>
			| undefined;
		let observerCleanup: (() => void) | undefined;
		let work: RuntimeOffDispatchWork | undefined, observationFailure: { cause: unknown } | undefined;
		const observationFailed = (cause: unknown): void => {
			try {
				observationFailure ??= { cause };
				if (!closed) settlement.reject?.(cause);
			} catch {
				// Never throw from a side handler into the original service or its native caller.
			}
		};
		const opening = function (
			this: VirtualThermostatTransportService,
			...args: Parameters<typeof originalOpen>
		): ReturnType<typeof originalOpen> {
			const result = originalOpen.call(this, ...args);
			if (!closed && owner && this === owner.fixture.transport && work === undefined && result) work = result;
			return result;
		};
		const servicing = function (
			this: VirtualThermostatRuntimeService,
			...args: Parameters<typeof originalService>
		): ReturnType<typeof originalService> {
			const result = originalService.call(this, ...args);
			if (
				!closed &&
				!matched &&
				owner &&
				this === owner.runtime &&
				work !== undefined &&
				args[0].work === work &&
				args[0].purpose === 'GUARDED_OFF_DISPATCH'
			) {
				matched = true;
				try {
					const child = args[0],
						job = child.job,
						operation = job?.operation;
					if (!job || operation === undefined) {
						observationFailed(new Error('Exact original OFF terminal operation unavailable'));
					} else {
						const selectedWork = work;
						const operationOutcome = operation.then<R53Outcome, R53Outcome>(
							() => ({ fulfilled: true }),
							(cause: unknown) => ({ fulfilled: false, cause }),
						);
						const serviceOutcome = result.then<R53Outcome, R53Outcome>(
							() => ({ fulfilled: true }),
							(cause: unknown) => ({ fulfilled: false, cause }),
						);
						const side = Promise.all([operationOutcome, serviceOutcome]).then(([operationResult, serviceResult]) => {
							if (!closed) {
								if (observationFailure) settlement.reject?.(observationFailure.cause);
								else
									settlement.resolve?.({
										operation: operationResult,
										service: serviceResult,
										work: selectedWork,
										terminal: job.terminal,
										outputSaved: job.outputSaved,
										childState: child.state,
										failure: job.failure === undefined ? undefined : { cause: job.failure.cause },
									});
							}
						});
						void side.catch(observationFailed);
					}
				} catch (cause) {
					observationFailed(cause);
				}
			}
			return result; // SAME original application Promise, including every rejection value.
		};
		const retire = (): void => {
			closed = true;
			settlement.reject?.(new Error('Original R53 terminal observer retired'));
		};
		const cleanup = (afterOwnedTeardown = false): void => {
			closed = true;
			if (restored) return;
			// Setup failure before bind is restored only by the post-fixture afterEach backstop.
			if (!owner && !afterOwnedTeardown) return;
			let failure: { cause: unknown } | undefined;
			if (owner) {
				try {
					owner.runtime.onModuleDestroy();
				} catch (cause) {
					failure = { cause };
				}
				try {
					owner.fixture.revoke();
				} catch (cause) {
					failure ??= { cause };
				}
			} else {
				// This is the original case array, never a later test's current fixture or runtime.
				for (const owned of setupFixtures.slice(setupFixtureCount)) {
					try {
						owned.revoke();
					} catch (cause) {
						failure ??= { cause };
					}
				}
			}
			const stopObservation = observerCleanup;
			observerCleanup = undefined;
			try {
				stopObservation?.();
			} catch (cause) {
				failure ??= { cause };
			}
			const restore = (target: object, key: string, original: PropertyDescriptor, expected: unknown): void => {
				const current = descriptors.getOwnPropertyDescriptor(target, key);
				if (
					!current ||
					current.get ||
					current.set ||
					current.value !== expected ||
					current.configurable !== original.configurable ||
					current.enumerable !== original.enumerable ||
					current.writable !== original.writable
				)
					throw new Error('Completion observer descriptor replaced by another owner');
				Object.defineProperty(target, key, original);
			};
			try {
				if (serviceInstalled) restore(runtimePrototype, 'serviceFeedback', serviceDescriptor, servicing);
			} catch (cause) {
				failure ??= { cause };
			}
			try {
				if (openInstalled) restore(transportPrototype, 'openRuntimeOffDispatchWork', openDescriptor, opening);
			} catch (cause) {
				failure ??= { cause };
			}
			restored = true;
			completionObserverBackstops.delete(backstop);
			if (failure) throw failure.cause;
		};
		const backstop = { retire, cleanup: (): void => cleanup(true) };
		completionObserverBackstops.add(backstop);
		try {
			Object.defineProperty(transportPrototype, 'openRuntimeOffDispatchWork', {
				...openDescriptor,
				value: opening,
			});
			openInstalled = true;
			Object.defineProperty(runtimePrototype, 'serviceFeedback', { ...serviceDescriptor, value: servicing });
			serviceInstalled = true;
		} catch (cause) {
			// Retain the original setup failure; the teardown backstop restores any installed owned descriptor.
			closed = true;
			throw cause;
		}
		const assertOpen = (): void => {
			if (closed || !owner) throw new Error('Original completion case owner retired');
		};
		return {
			bind: (current: VirtualThermostatRuntimeService, owned: R53ManagedFixture): void => {
				if (closed || owner) throw new Error('Original completion case owner cannot be rebound');
				const originalRuntime: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'flush'>> = current;
				owner = Object.freeze({ runtime: current, fixture: owned, flush: originalRuntime.flush });
			},
			observeCleanup: (stop: () => void): void => {
				assertOpen();
				if (observerCleanup) throw new Error('Original completion observation cleanup already owned');
				observerCleanup = stop;
			},
			boundary: {
				promise,
				assertOpen,
				flush: (): Promise<void> => {
					assertOpen();
					if (!owner) throw new Error('Original completion case owner missing');
					return owner.flush.call(owner.runtime);
				},
			} satisfies R53OffBoundary,
			cleanup,
		};
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
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		expect(sends).not.toContain(true);
		jest.setSystemTime(wall - 1);
		runtime.request(controllerId);
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
		onGate = new Promise<void>((resolve) => {
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
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('ambient_unavailable');
	});

	it('rejects queued ON at exact override expiry even before a poll recomputes the baseline', async () => {
		await settle();
		await configureComfort();
		let releaseOn: () => void;
		onGate = new Promise<void>((resolve) => {
			releaseOn = resolve;
		});
		const now = Date.now();
		jest.spyOn(Date, 'now').mockReturnValue(now);
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
		runtime.request(controllerId);
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
		onGate = new Promise<void>((resolve) => {
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
		runtime.request(controllerId);
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
			runtime.request(controllerId);
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
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		expect(samples.get(relayId)?.value).toBe(true);
		offOutcome = 'refused';
		proofAllowed = () => false;
		await database.manager.update(VirtualThermostatActuatorClaimEntity, { controllerId }, { state: 'releasing' });
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId }, { requestedMode: 'off' });
		runtime.request(controllerId);
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

	it('loads bounded settled-history witnesses and retains all unresolved identities for lazy drainage', async () => {
		const owned = initialFixtureOwner();
		const { owner: runtime, source: database, id: controllerId, settle } = owned;
		const entry = observeOriginalDecisionLoads(runtime);
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
		// The existing negative proof setting applies before the public read entry, preserving pending identities.
		proofAllowed = () => false;
		const loaded = await entry.read();
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
		const owned = initialFixtureOwner();
		const { owner: runtime, source: database, id: controllerId, settle } = owned;
		const entry = observeOriginalDecisionLoads(runtime);
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
		await entry.read();
		expect(fullLoad).not.toHaveBeenCalled();
		expect((await entry.last()).length).toBeLessThanOrEqual(3);
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
		offGate = new Promise<void>((resolve) => (releaseOff = resolve));
		const witnesses = await entry.read();
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
		const owned = initialFixtureOwner();
		const { owner: runtime, source: database, id: controllerId, settle } = owned;
		const entry = observeOriginalReconciliation(runtime);
		await settle();
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
		owned.assertLive();
		beforeProof = async () => {
			await database.manager.insert(VirtualThermostatCommandEntity, unseen);
		};
		await entry.start(claim);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'accepted',
		);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: unseen.id })).status).toBe(
			'accepted',
		);
		beforeProof = null;
		await entry.start(claim);
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
		const owner = runtime,
			registry = producers,
			originalDatabase = database,
			originalControllerId = controllerId;
		const requestObservation = originalObservers(owner).request.arm();
		let release: () => void = () => {
			throw new Error('Original publication gate not installed');
		};
		let retired = false;
		let originalGate: Promise<void> | undefined;
		let primary: { cause: unknown } | undefined;
		const retire = (): void => {
			retired = true;
			if (originalGate !== undefined) release();
		};
		// Logical disarm only. The pinned descriptor remains until this original owner retires.
		const restoreRequest = (): void => requestObservation.passThrough();
		const cleanup = (): void => {
			retire();
			if (publicationGate === originalGate) publicationGate = null;
			completionObserverBackstops.delete(backstop);
			restoreRequest();
		};
		const backstop = { retire, cleanup };
		completionObserverBackstops.add(backstop);
		const assertLive = (): void => {
			if (retired) throw new Error('Original pending publication observer retired');
		};
		try {
			await owner.flush();
			assertLive();
			const outputId = await createTemperatureOutput(
				Object.freeze({
					database: originalDatabase,
					controllerId: originalControllerId,
					assertLive,
				}),
			);
			assertLive();
			requestObservation.allowNext();
			originalGate = new Promise<void>((resolve) => {
				release = resolve;
			});
			publicationGate = originalGate;
			const inspection = owner.inspect(originalControllerId);
			// Observe both outcomes immediately; no unhandled side Promise if timeout retires this wait first.
			void inspection.then(
				() => undefined,
				(cause: unknown) => {
					primary ??= { cause };
				},
			);
			while (!registry.owns(outputId)) {
				assertLive();
				await new Promise<void>((resolve) => setImmediate(resolve));
			}
			assertLive();
			graphValidated = false;
			graphGeneration++;
			graphValidated = true;
			release();
			await inspection;
			assertLive();
			expect(registry.read(outputId)?.producer.quality).toBe('unavailable');
			expect(owner.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
			if (publicationGate === originalGate) publicationGate = null;
			restoreRequest();
			await owner.inspect(originalControllerId);
			assertLive();
			expect(registry.read(outputId)?.producer.quality).toBe('good');
		} catch (cause) {
			primary ??= { cause };
		} finally {
			try {
				cleanup();
			} catch (cause) {
				primary ??= { cause };
			}
		}
		if (primary) throw primary.cause;
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
		runtime.request(controllerId);
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
			runtime.request(controllerId, false);
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
		runtime.request(controllerId, false);
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
		realGuardFixtures.push(fixture);
		for (const [id, sample] of samples) await fixture.report(id, sample.value as number | boolean);
		values = fixture.values;
		runtime = makeRuntime(undefined, undefined, fixture.transport);
		await runtime.onApplicationBootstrap();
		return fixture;
	};

	it.each(['closed', 'unmanaged'] as const)(
		'keeps actual %s delegate sessions closed without an original managed runtime admission',
		async (mode) => {
			runtime.onModuleDestroy();
			const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, mode);
			realGuardFixtures.push(fixture);
			expect(fixture.captureSession(relayId)).toBeNull();
			expect(fixture.controls.fences).toEqual([]);
			expect(fixture.controls.sends).toEqual([]);
			expect(fixture.controls.errors).toEqual([]);
		},
	);

	it('requires an actual stopped-to-managed start and permanently revokes its original session at stop entry', async () => {
		runtime.onModuleDestroy();
		const fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, 'unmanaged');
		realGuardFixtures.push(fixture);
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await fixture.startManaged()).toBe(false); // A managed call cannot rescue an already unmanaged start.
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await fixture.stopManaged()).toBe(true);
		expect(await fixture.startManaged()).toBe(true);
		await fixture.insert();
		const original = fixture.captureSession(relayId);
		expect(original).not.toBeNull();
		if (!original) throw new Error('Expected original real managed session');
		expect(original.isCurrent()).toBe(true);
		const stopping = fixture.stopManaged();
		expect(original.isCurrent()).toBe(false); // Before the stop lifecycle lock/drain can await.
		await stopping;
		expect(await fixture.startManaged()).toBe(true);
		await fixture.insert();
		const fresh = fixture.captureSession(relayId);
		expect(fresh).not.toBeNull();
		expect(fresh?.isCurrent()).toBe(true);
		expect(original.isCurrent()).toBe(false);
		expect(fixture.controls.fences).toEqual([]);
		expect(fixture.controls.sends).toEqual([]); // Lifecycle and capture never replay protective actuation.
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
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await fixture.report([...protectionProbes][0], 30);
		await settleReal(fixture);
		expect(fixture.controls.fences).toHaveLength(before);
		expect(fixture.controls.sends).toHaveLength(0);
		expect(runtime.readDiagnostics(controllerId).readiness).toBe('unavailable');
		graphValidated = true;
		runtime.request(controllerId);
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
			const gate = new Promise<void>((resolve) => (release = resolve));
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
				runtime.request(controllerId, false);
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
			const gate = new Promise<void>((resolve) => (release = resolve));
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
				runtime.request(controllerId);
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
			runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		expect(
			sentTargets
				.filter((send) => send.on)
				.map((send) => send.propertyId)
				.sort(),
		).toEqual([relayId, sibling].sort());
		const [probe] = [...protectionProbes];
		sample(probe, 30);
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.ready)).toBe(true);
	});

	it.each(['trip', 'source-gap', 'reconfiguration'] as const)(
		'retains the whole-branch trip barrier across immediate recovery and %s with an energized sibling and queued ON',
		async (interruption) => {
			packetTick = useThermostatPacketClock();
			const sibling = await addMandatoryMember();
			runtime.request(controllerId);
			await settle();
			let resumeOn!: () => void;
			onGate = new Promise<void>((resolve) => (resumeOn = resolve));
			sample(sensorId, 18);
			runtime.request(controllerId);
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
			runtime.request(controllerId);
			await settle();
			runtime.request(controllerId);
			await settle();
			expect(sentTargets.slice(boundary).some((send) => send.on)).toBe(false);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			// Pre-drain recovery reports remain unusable. Only a new post-drain report clears the latch.
			await afterMemberDrain();
			for (const source of protectionProbes) sample(source, 20);
			runtime.request(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
		},
	);

	it.each(['trip', 'missing', 'degraded'] as const)(
		'rechecks every member protection at final queued ON after %s without a new evaluation request',
		async (failure) => {
			await addMandatoryMember();
			runtime.request(controllerId);
			await settle();
			let resume: () => void = () => undefined;
			onGate = new Promise<void>((resolve) => {
				resume = resolve;
			});
			sample(sensorId, 18);
			runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		runtime.request(controllerId);
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
			runtime.request(controllerId);
			await settle();
			sample(sensorId, 18);
			runtime.request(controllerId);
			await settle();
			if (failure === 'offline') unavailableMembers.add(sibling);
			else
				await database.manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ sourcePropertyId: sibling },
					{ sourcePropertyId: null, state: 'missing', revision: 2 },
				);
			runtime.request(controllerId);
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
			const sibling = await addMandatoryMember();
			packetTick = useThermostatPacketClock();
			// Every evaluation boundary below is explicit. A real poll during SQLite I/O can drain the
			// energized sibling before the mutation whose queued-ON fence this fixture is testing.
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			const commandTarget =
				change === 'override expiry'
					? null
					: await registeredHeatingCommand(change === 'explicit OFF' ? 'heating_enabled' : 'heating_setpoint');
			runtime.request(controllerId);
			await settle();
			await configureComfort();
			sample(sensorId, 22);
			let resumeOn!: () => void;
			onGate = new Promise<void>((resolve) => {
				resumeOn = resolve;
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
			for (let phase = 0; phase < 2; phase++) {
				runtime.request(controllerId, false);
				await settle();
			}
			expect(
				runtime
					.readDiagnostics(controllerId)
					.branches.every((branch) => branch.release_proven && !branch.pending_on && branch.activity === 'off'),
			).toBe(true);
			for (const probe of protectionProbes) sample(probe, 20);
			runtime.request(controllerId);
			await waitForOnJournal();
			await Promise.all([relayQueued, siblingEnergized]);
			await runtime.flush();
			const prepared = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(prepared).toHaveLength(2);
			expect(new Set(prepared.map((command) => command.decisionRevision)).size).toBe(1);
			const queuedClaim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				sourcePropertyId: relayId,
			});
			expect(prepared.find((command) => command.claimId === queuedClaim.id).status).toBe('dispatching');
			const siblingJournal = prepared.find((command) => command.claimId !== queuedClaim.id);
			await (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.get(siblingJournal.id);
			expect(
				await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: siblingJournal.id }),
			).toMatchObject({ status: 'accepted', proofId: null });
			expect(samples.get(sibling)?.value).toBe(true);
			expect(sentTargets.filter((send) => send.propertyId === sibling).at(-1)).toEqual({
				propertyId: sibling,
				on: true,
			});
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			const mutationBoundary = sentTargets.length;
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
			resumeOn();
			onGate = null;
			await settle();
			// Expiry persists a new configuration revision; poll again for release proof bound to that revision.
			runtime.request(controllerId);
			await settle();
			expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			expect(sentTargets.slice(mutationBoundary)).toContainEqual({ propertyId: sibling, on: false });
			const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(retained.map((command) => command.id).sort()).toEqual(prepared.map((command) => command.id).sort());
			expect(retained.find((command) => command.claimId === queuedClaim.id).status).toBe('cancelled');
			expect(retained.find((command) => command.claimId !== queuedClaim.id).status).toBe('confirmed');
			expect(retained.find((command) => command.id === siblingJournal.id).proofId).toBeTruthy();
			if (change === 'override expiry') {
				const expired = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				expect(expired.comfort.temporary_override.status).toBe('expired');
				expect(expired.revision).toBeGreaterThan(prepared[0].configurationRevision);
			}
			expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => !branch.pending_on)).toBe(true);
		},
	);

	it('keeps a partial late ON unresolved per leaf while releasing the rest of its group', async () => {
		const sibling = await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		allowLateOn = true;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		await runtime.flush();
		proofAllowed = (id) => id !== relayId;
		samples.delete(sibling);
		runtime.request(controllerId);
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
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		proofAllowed = () => true;
		for (let phase = 0; phase < 3; phase++) {
			runtime.request(controllerId, false);
			await settle();
		}
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('cooling_changeover_wait');
		const rows = await database.manager.find(VirtualThermostatBranchRuntimeEntity);
		for (const row of rows) {
			row.lastVerifiedOffAt = new Date(Date.now() - 120_000);
			await database.manager.save(row);
		}
		runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(true);
	});

	it('retains each parallel pending ON across restart and drains siblings independently before resuming', async () => {
		const sibling = await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		runtime.request(controllerId);
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
			runtime.request(controllerId, false);
			await settle();
		}
		expect(original.every((command) => pending.some((row) => row.id === command.id))).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		await afterMemberDrain();
		for (const probe of protectionProbes) sample(probe, 20);
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
	});

	it('rechecks a parallel member generation before final send and cancels its stale queued ON', async () => {
		await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		const command = await waitForOnJournal();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: command.claimId });
		await database.manager.update(
			VirtualThermostatActuatorClaimEntity,
			{ id: claim.id },
			{ revision: claim.revision + 1, qualificationGeneration: 'restored-generation', state: 'releasing' },
		);
		runtime.request(controllerId);
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
		runtime.request(controllerId);
		await settle();
		acceptedWithoutFeedback = sibling;
		proofAllowed = (id) => id !== sibling;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		expect(sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(true);
		expect(sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(diagnostics.branches.find((branch) => branch.pending_on)).toBeDefined();
		expect(diagnostics.reasons).toContain('heating_not_ready');
	});

	it('fences a mandatory refusal across a newly loaded context and releases the already-running sibling', async () => {
		const sibling = await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		const blocked = await waitForOnJournal();
		await runtime.flush();
		const inFlight = (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight;
		await Promise.all([...inFlight].filter(([id]) => id !== blocked.id).map(([, operation]) => operation));
		expect(sentTargets.some((send) => send.propertyId === sibling && send.on)).toBe(true);
		await runtime.inspect(controllerId);
		onOutcome = 'refused';
		proofAllowed = (id) => id !== relayId;
		resumeOn();
		onGate = null;
		await settle();
		runtime.request(controllerId, false);
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
				runtime.request(controllerId);
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
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(sends).not.toContain(true);

			jest.setSystemTime(startedAt + 99);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(sends).not.toContain(true);

			jest.setSystemTime(startedAt + 100);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(sends).toContain(true);
			expect(samples.get(relayId)?.value).toBe(true);

			config.contactClosingMs = 250;
			config.revision++;
			await database.manager.save(config);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 349);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 350);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(true);

			jest.setSystemTime(startedAt + 351);
			sample(contactPropertyId, false);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('window_open');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 352);
			samples.delete(contactPropertyId);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(samples.get(relayId)?.value).toBe(false);

			config.requestedMode = 'off';
			config.policy.heatingSetpoint = 22;
			config.revision++;
			await database.manager.save(config);
			sample(contactPropertyId, true);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			jest.setSystemTime(startedAt + 601);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(samples.get(relayId)?.value).toBe(false);
			jest.setSystemTime(startedAt + 602);
			runtime.request(controllerId);
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
	// BEGIN R14 drain-certificate lifetime drafts (UNRUN; real SQLite/managed SDK, offline qualification only)
	describe('original settled drain facts across disposable command decisions', () => {
		let actualClaims: VirtualThermostatClaimsService;
		let actualStructure: DeviceStructureLockService;
		let actualGraph: VirtualDependencyGraphService;
		let fixture: Awaited<ReturnType<typeof realThermostatGuardFixture>> | undefined;
		const gate = () => {
			let open: () => void = () => {
				throw new Error('Owned gate not initialized');
			};
			const promise = new Promise<void>((resolve) => {
				open = resolve;
			});
			return { promise, open: (): void => open() };
		};
		const prepare = async (): Promise<void> => {
			runtime.onModuleDestroy(); // close the legacy stand-in runtime; it is NOT the admission proof
			actualStructure = new DeviceStructureLockService();
			mutationProvider.onModuleDestroy();
			comfort.onModuleDestroy();
			mutationClaims.onModuleDestroy();
			mutationRegistry.onModuleDestroy();
			mutationRegistry = new ClimateAutomationRegistryService();
			mutationWriter = new ClimateAutomationWriterService(
				database,
				actualStructure,
				mutationRegistry,
				new ConfigService({ FB_CLI: 'off' }),
			);
			actualGraph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), mutationWriter);
			await actualGraph.onApplicationBootstrap();
			actualClaims = new VirtualThermostatClaimsService(
				database,
				actualStructure,
				actualGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
				new ConfigService({ FB_CLI: 'off' }),
			);
			await actualClaims.onApplicationBootstrap();
			fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, 'managed', {
				values: mutationValues,
				sources: mutationPipeline.get(PropertyValueSourceRegistryService),
			});
			realGuardFixtures.push(fixture);
			// Reuse ONLY the helper's existing explicitly synthetic qualification boundary. No new fields or private map forcing.
			for (const evidence of installedQualifications.values()) actualClaims.recordQualification(evidence);
			values = fixture.values;
			comfort = new VirtualThermostatComfortService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				mutationWriter,
			);
			configs = new VirtualThermostatConfigService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				values,
				undefined,
				mutationWriter,
			);
			mutationProvider = new VirtualThermostatAutomationService(
				mutationWriter,
				mutationRegistry,
				actualGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				configs,
				comfort,
			);
			mutationProvider.onModuleInit();
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.configure(
				controllerId,
				{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			for (const [id, sample] of samples) {
				if (typeof sample.value !== 'number' && typeof sample.value !== 'boolean')
					throw new Error('Unexpected synthetic sample');
				await fixture.report(id, sample.value);
			}
			await actualClaims.refresh();
			runtime = new VirtualThermostatRuntimeService(
				database,
				actualStructure,
				actualClaims,
				new VirtualThermostatInputsService(database, values),
				fixture.transport,
				values,
				producers,
				events,
				actualGraph,
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
		};

		const startBounded = async (): Promise<void> => {
			if (!fixture) throw new Error('Actual managed fixture required');
			const owned = fixture;
			const thirdEntered = gate(),
				thirdResume = gate();
			let entered = 0;
			owned.controls.beforeFence = () => {
				entered++;
				if (entered >= 3) {
					thirdEntered.open();
					return thirdResume.promise;
				}
				return Promise.resolve();
			};
			const starting = runtime.onApplicationBootstrap();
			const ready: Promise<'ready'> = starting.then((): 'ready' => 'ready');
			const extra: Promise<'third-fence'> = thirdEntered.promise.then((): 'third-fence' => 'third-fence');
			let primary: { cause: unknown } | undefined;
			let cleanup: { cause: unknown } | undefined;
			try {
				expect(await Promise.race([ready, extra])).toBe('ready');
				expect(owned.controls.fences).toHaveLength(2); // original mandatory OFF plus first qualified reconciliation
			} catch (cause) {
				primary = { cause };
			} finally {
				if (primary || entered >= 3) {
					try {
						runtime.onModuleDestroy();
					} catch (cause) {
						cleanup = { cause };
					}
					try {
						owned.revoke();
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				thirdResume.open();
				owned.controls.beforeFence = null;
				try {
					await starting;
				} catch (cause) {
					cleanup ??= { cause };
				}
			}
			if (primary) throw primary.cause;
			if (cleanup) throw cleanup.cause;
		};
		const startR53Bounded = async (completion: R53OffBoundary): Promise<void> => {
			if (!fixture) throw new Error('Actual managed fixture required');
			const owned = fixture;
			const thirdEntered = gate(),
				thirdResume = gate();
			let entered = 0;
			owned.controls.beforeFence = () => {
				entered++;
				if (entered >= 3) {
					thirdEntered.open();
					return thirdResume.promise;
				}
				return Promise.resolve();
			};
			const starting = runtime.onApplicationBootstrap();
			const ready: Promise<'ready'> = starting.then(async (): Promise<'ready'> => {
				const receipt = await completion.promise;
				await completion.flush();
				completion.assertOpen();
				if (!receipt.operation.fulfilled) throw receipt.operation.cause;
				if (!receipt.service.fulfilled) throw receipt.service.cause;
				return 'ready';
			});
			const extra: Promise<'third-fence'> = thirdEntered.promise.then((): 'third-fence' => 'third-fence');
			let primary: { cause: unknown } | undefined;
			let cleanup: { cause: unknown } | undefined;
			try {
				expect(await Promise.race([ready, extra])).toBe('ready');
				expect(owned.controls.fences).toHaveLength(2); // original mandatory OFF plus first qualified reconciliation
			} catch (cause) {
				primary = { cause };
			} finally {
				if (primary || entered >= 3) {
					try {
						runtime.onModuleDestroy();
					} catch (cause) {
						cleanup = { cause };
					}
					try {
						owned.revoke();
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				thirdResume.open();
				owned.controls.beforeFence = null;
				try {
					await starting;
				} catch (cause) {
					cleanup ??= { cause };
				}
			}
			if (primary) throw primary.cause;
			if (cleanup) throw cleanup.cause;
		};
		afterEach(() => {
			const observers = [...completionObserverBackstops];
			let failure: { cause: unknown } | undefined;
			for (const observer of observers) {
				try {
					observer.retire();
				} catch (cause) {
					failure ??= { cause };
				}
			}
			try {
				runtime.onModuleDestroy();
			} catch (cause) {
				failure ??= { cause };
			}
			try {
				actualClaims?.onModuleDestroy();
			} catch (cause) {
				failure ??= { cause };
			}
			try {
				fixture?.revoke();
			} catch (cause) {
				failure ??= { cause };
			}
			// Remove H before the outer resource hook asks Jest to restore the underlying owned spy S.
			for (const observer of observers) {
				try {
					observer.cleanup();
				} catch (cause) {
					failure ??= { cause };
				}
			}
			if (failure) throw failure.cause;
		});
		it('finishes genuine OFF bootstrap within two fences and retains settled facts through natural decision rotations', async () => {
			await prepare();
			if (!fixture) throw new Error('Actual managed fixture required');
			const before = database.subscribers.length;
			const completion = observeR53OffTerminal();
			completion.bind(runtime, fixture);
			await startR53Bounded(completion.boundary);
			const fences = fixture.controls.fences.length;
			for (let rotation = 0; rotation < 3; rotation++) {
				runtime.request(controllerId, false);
				await runtime.flush();
				expect(fixture.controls.fences).toHaveLength(fences);
				expect(database.subscribers.length).toBeLessThanOrEqual(before + 2);
			}
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			const commands = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(commands.some((command) => command.action === 'off' && command.status === 'confirmed')).toBe(true);
			runtime.onModuleDestroy();
			expect(database.subscribers).toHaveLength(before);
		});
		it.each(['config', 'slot'] satisfies readonly ('config' | 'slot')[])(
			'refuses retained original drain facts after an actual same-value protected native %s write',
			async (target) => {
				await prepare();
				if (!fixture) throw new Error('Actual managed fixture required');
				const completion = observeR53OffTerminal();
				completion.bind(runtime, fixture);
				await startR53Bounded(completion.boundary);
				const fences = fixture.controls.fences.length;
				if (target === 'config')
					await database.query(
						'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" WHERE "controllerId" = ?',
						[controllerId],
					);
				else
					await database.query(
						'UPDATE "devices_module_climate_automation_slots" SET "slotRevision" = "slotRevision" WHERE "controllerId" = ?',
						[controllerId],
					);
				expect(await database.query('SELECT changes() AS affected')).toEqual([{ affected: 1 }]);
				await actualClaims.refresh(); // genuine new work may obtain its own generation; the old certificate is never refreshed
				runtime.request(controllerId, false);
				await runtime.flush();
				expect(fixture.controls.fences.length).toBeGreaterThan(fences);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
			},
		);
		it('keeps saved evidence closed across actual installed qualification loss and permits only a fresh qualified drain', async () => {
			await prepare();
			if (!fixture) throw new Error('Actual managed fixture required');
			const completion = observeR53OffTerminal();
			completion.bind(runtime, fixture);
			await startR53Bounded(completion.boundary);
			const fences = fixture.controls.fences.length;
			actualClaims.revokeAllQualifications();
			runtime.request(controllerId, false);
			await runtime.flush();
			expect(fixture.controls.fences).toHaveLength(fences);
			expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			for (const evidence of installedQualifications.values()) actualClaims.recordQualification(evidence);
			await actualClaims.refresh();
			runtime.request(controllerId, false);
			await runtime.flush();
			expect(fixture.controls.fences.length).toBeGreaterThan(fences);
		});
		it('never lends an old held managed ON guard the retained drain owner after normal rotation', async () => {
			await prepare();
			if (!fixture) throw new Error('Actual managed fixture required');
			const owned = fixture;
			const entered = gate(),
				resume = gate();
			const originalGetView: OriginalFunctions<VirtualThermostatTransportService> = owned.transport;
			const originalGet = originalGetView.get;
			const observed: { guard?: () => boolean } = {};
			jest.spyOn(owned.transport, 'get').mockImplementation((...args) => {
				const adapter = originalGet.call(owned.transport, ...args);
				if (!adapter) return null;
				const originalSendView: OriginalFunctions<ThermostatActuationAdapter> = adapter;
				const send = originalSendView.send;
				return {
					...adapter,
					send: (
						...sendArgs: Parameters<ThermostatActuationAdapter['send']>
					): ReturnType<ThermostatActuationAdapter['send']> => {
						if (sendArgs[0].value === true && observed.guard === undefined) observed.guard = sendArgs[3];
						return send.call(adapter, ...sendArgs); // SAME genuine method/receiver/args/original Promise
					},
				};
			});
			owned.controls.beforeOn = () => {
				entered.open();
				return resume.promise;
			};
			try {
				await startBounded();
				await owned.report(sensorId, 18);
				await entered.promise;
				if (!observed.guard) throw new Error('Original managed ON guard was not reached');
				runtime.request(controllerId, false);
				await runtime.flush();
				expect(observed.guard()).toBe(false);
			} finally {
				try {
					runtime.onModuleDestroy(); // close original owner before releasing any native descendant
				} finally {
					try {
						owned.revoke();
					} finally {
						resume.open();
						owned.controls.beforeOn = null;
					}
				}
				await owned.flushTelemetry();
			}
		});

		// BEGIN R21 additive managed native feedback/debt drafts (UNRUN)
		describe('R21 finite authenticated OFF descendants and new native safety debt', () => {
			const active = async (): Promise<void> => {
				await prepare();
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
					'R21-original',
				);
			};
			// BEGIN R42 exact original dispatch service completion observer (SOURCE ONLY)
			type OriginalCompletionBoundary = Readonly<{
				promise: Promise<void>;
				flush: () => Promise<void>;
				assertOpen: () => void;
			}>;
			const observeOriginalOffCompletion = () => {
				const setupFixtures = realGuardFixtures,
					setupFixtureCount = setupFixtures.length;
				const transportPrototype = VirtualThermostatTransportService.prototype,
					runtimePrototype = VirtualThermostatRuntimeService.prototype;
				const originalTransport: OriginalFunctions<VirtualThermostatTransportService> = transportPrototype;
				const originalOpen = originalTransport.openRuntimeOffDispatchWork;
				const originalServiceLookup: Readonly<{
					get: (
						owner: object,
						key: 'serviceFeedback',
					) => OriginalFunction<VirtualThermostatRuntimeService, (typeof runtime)['serviceFeedback']>;
				}> = Reflect;
				const originalService = originalServiceLookup.get(runtimePrototype, 'serviceFeedback');
				const descriptors: Readonly<{
					getOwnPropertyDescriptor: (
						owner: object,
						key: PropertyKey,
					) => (Omit<PropertyDescriptor, 'value'> & { value?: unknown }) | undefined;
				}> = Object;
				const openDescriptor = descriptors.getOwnPropertyDescriptor(transportPrototype, 'openRuntimeOffDispatchWork'),
					serviceDescriptor = descriptors.getOwnPropertyDescriptor(runtimePrototype, 'serviceFeedback');
				if (
					!openDescriptor ||
					openDescriptor.get ||
					openDescriptor.set ||
					openDescriptor.value !== originalOpen ||
					!serviceDescriptor ||
					serviceDescriptor.get ||
					serviceDescriptor.set ||
					serviceDescriptor.value !== originalService
				)
					throw new Error('Original completion observation descriptors unavailable');
				const settlement: { resolve?: () => void; reject?: (cause: unknown) => void } = {};
				const promise = new Promise<void>((resolve, reject) => {
					settlement.resolve = resolve;
					settlement.reject = reject;
				});
				// This receipt is test-owned; an early original rejection must not become an unhandled side Promise.
				void promise.catch(() => undefined);
				let closed = false,
					matched = false,
					restored = false,
					openInstalled = false,
					serviceInstalled = false;
				let owner:
					| Readonly<{
							runtime: VirtualThermostatRuntimeService;
							fixture: NonNullable<typeof fixture>;
							flush: OriginalFunction<VirtualThermostatRuntimeService, VirtualThermostatRuntimeService['flush']>;
					  }>
					| undefined;
				let observerCleanup: (() => void) | undefined;
				let work: RuntimeOffDispatchWork | undefined, observationFailure: { cause: unknown } | undefined;
				const observationFailed = (cause: unknown): void => {
					try {
						observationFailure ??= { cause };
						if (!closed) settlement.reject?.(cause);
					} catch {
						// Never throw from a side handler into the original service or its native caller.
					}
				};
				const opening = function (
					this: VirtualThermostatTransportService,
					...args: Parameters<typeof originalOpen>
				): ReturnType<typeof originalOpen> {
					const result = originalOpen.call(this, ...args);
					if (!closed && owner && this === owner.fixture.transport && work === undefined && result) work = result;
					return result;
				};
				const servicing = function (
					this: VirtualThermostatRuntimeService,
					...args: Parameters<typeof originalService>
				): ReturnType<typeof originalService> {
					const result = originalService.call(this, ...args);
					if (
						!closed &&
						!matched &&
						owner &&
						this === owner.runtime &&
						work !== undefined &&
						args[0].work === work &&
						args[0].purpose === 'GUARDED_OFF_DISPATCH'
					) {
						matched = true;
						try {
							const side = result.then(
								() => {
									try {
										if (!closed) {
											if (observationFailure) settlement.reject?.(observationFailure.cause);
											else settlement.resolve?.();
										}
									} catch (cause) {
										observationFailed(cause);
									}
								},
								(cause: unknown) => {
									try {
										if (!closed) settlement.reject?.(cause);
									} catch (failure) {
										observationFailed(failure);
									}
								},
							);
							void side.catch(observationFailed);
						} catch (cause) {
							observationFailed(cause);
						}
					}
					return result; // SAME original application Promise, including every rejection value.
				};
				const retire = (): void => {
					closed = true;
				};
				const cleanup = (afterOwnedTeardown = false): void => {
					closed = true;
					if (restored) return;
					// Setup failure before bind is restored only by the post-fixture afterEach backstop.
					if (!owner && !afterOwnedTeardown) return;
					let failure: { cause: unknown } | undefined;
					if (owner) {
						try {
							owner.runtime.onModuleDestroy();
						} catch (cause) {
							failure = { cause };
						}
						try {
							owner.fixture.revoke();
						} catch (cause) {
							failure ??= { cause };
						}
					} else {
						// This is the original case array, never a later test's current fixture or runtime.
						for (const owned of setupFixtures.slice(setupFixtureCount)) {
							try {
								owned.revoke();
							} catch (cause) {
								failure ??= { cause };
							}
						}
					}
					const stopObservation = observerCleanup;
					observerCleanup = undefined;
					try {
						stopObservation?.();
					} catch (cause) {
						failure ??= { cause };
					}
					const restore = (target: object, key: string, original: PropertyDescriptor, expected: unknown): void => {
						const current = descriptors.getOwnPropertyDescriptor(target, key);
						if (
							!current ||
							current.get ||
							current.set ||
							current.value !== expected ||
							current.configurable !== original.configurable ||
							current.enumerable !== original.enumerable ||
							current.writable !== original.writable
						)
							throw new Error('Completion observer descriptor replaced by another owner');
						Object.defineProperty(target, key, original);
					};
					try {
						if (serviceInstalled) restore(runtimePrototype, 'serviceFeedback', serviceDescriptor, servicing);
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						if (openInstalled) restore(transportPrototype, 'openRuntimeOffDispatchWork', openDescriptor, opening);
					} catch (cause) {
						failure ??= { cause };
					}
					restored = true;
					completionObserverBackstops.delete(backstop);
					if (failure) throw failure.cause;
				};
				const backstop = { retire, cleanup: (): void => cleanup(true) };
				completionObserverBackstops.add(backstop);
				try {
					Object.defineProperty(transportPrototype, 'openRuntimeOffDispatchWork', {
						...openDescriptor,
						value: opening,
					});
					openInstalled = true;
					Object.defineProperty(runtimePrototype, 'serviceFeedback', { ...serviceDescriptor, value: servicing });
					serviceInstalled = true;
				} catch (cause) {
					// Retain the original setup failure; the teardown backstop restores any installed owned descriptor.
					closed = true;
					throw cause;
				}
				const assertOpen = (): void => {
					if (closed || !owner) throw new Error('Original completion case owner retired');
				};
				return {
					bind: (current: VirtualThermostatRuntimeService, owned: NonNullable<typeof fixture>): void => {
						if (closed || owner) throw new Error('Original completion case owner cannot be rebound');
						const originalRuntime: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'flush'>> = current;
						owner = Object.freeze({ runtime: current, fixture: owned, flush: originalRuntime.flush });
					},
					observeCleanup: (stop: () => void): void => {
						assertOpen();
						if (observerCleanup) throw new Error('Original completion observation cleanup already owned');
						observerCleanup = stop;
					},
					boundary: {
						promise,
						assertOpen,
						flush: (): Promise<void> => {
							assertOpen();
							if (!owner) throw new Error('Original completion case owner missing');
							return owner.flush.call(owner.runtime);
						},
					} satisfies OriginalCompletionBoundary,
					cleanup,
				};
			};
			// END R42 exact original dispatch service completion observer

			const startWithCeiling = async (maximum: number, completion?: OriginalCompletionBoundary): Promise<void> => {
				if (!fixture) throw new Error('Actual managed native fixture missing');
				const owned = fixture,
					excess = gate(),
					resume = gate();
				let calls = 0;
				owned.controls.beforeFence = () => {
					calls++;
					if (calls > maximum) {
						excess.open();
						return resume.promise;
					}
					return Promise.resolve();
				};
				const completionOwner = completion === undefined ? undefined : runtime;
				const starting = runtime.onApplicationBootstrap();
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					expect(
						await Promise.race([
							completion === undefined
								? starting.then(() => 'complete')
								: starting.then(async () => {
										await completion.promise;
										await completion.flush();
										completion.assertOpen();
										return 'complete';
									}),
							excess.promise.then(() => 'excess'),
						]),
					).toBe('complete');
					expect(calls).toBeLessThanOrEqual(maximum);
				} catch (cause) {
					primary = { cause };
				} finally {
					if (primary) {
						try {
							if (completionOwner === undefined) runtime.onModuleDestroy();
							else completionOwner.onModuleDestroy();
							owned.revoke();
						} catch (cause) {
							cleanup = { cause };
						}
					}
					resume.open();
					owned.controls.beforeFence = null;
					try {
						await starting;
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
			};
			const startR53WithCeiling = async (maximum: number, completion: R53OffBoundary): Promise<R53OffReceipt> => {
				if (!fixture) throw new Error('Actual managed native fixture missing');
				const owned = fixture,
					excess = gate(),
					resume = gate();
				let calls = 0;
				owned.controls.beforeFence = () => {
					calls++;
					if (calls > maximum) {
						excess.open();
						return resume.promise;
					}
					return Promise.resolve();
				};
				const completionOwner = runtime;
				let receipt: R53OffReceipt | undefined;
				const starting = runtime.onApplicationBootstrap();
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					expect(
						await Promise.race([
							starting.then(async () => {
								receipt = await completion.promise;
								await completion.flush();
								completion.assertOpen();
								return 'complete';
							}),
							excess.promise.then(() => 'excess'),
						]),
					).toBe('complete');
					expect(calls).toBeLessThanOrEqual(maximum);
				} catch (cause) {
					primary = { cause };
				} finally {
					if (primary) {
						try {
							completionOwner.onModuleDestroy();
							owned.revoke();
						} catch (cause) {
							cleanup = { cause };
						}
					}
					resume.open();
					owned.controls.beforeFence = null;
					try {
						await starting;
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
				if (!receipt) throw new Error('Original OFF terminal receipt missing');
				return receipt;
			};
			it('shares an actual active-C settlement across its native OFF report and closes event provenance after emit', async () => {
				const completion = observeOriginalOffCompletion();
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					await active();
					if (!fixture) throw new Error('Managed fixture missing');
					completion.bind(runtime, fixture);
					const originalDelivery: OriginalFunctions<
						Pick<VirtualThermostatTransportService, 'captureRuntimeFeedbackDelivery'>
					> = fixture.transport;
					const delivery = originalDelivery.captureRuntimeFeedbackDelivery;
					const works: (RuntimeOffDispatchWork | RuntimeReconciliationWork)[] = [];
					const originalDeliveryDescriptor = Object.getOwnPropertyDescriptor(
						fixture.transport,
						'captureRuntimeFeedbackDelivery',
					);
					const observedTransport = fixture.transport,
						observedEvents = events;
					const deliverySpy = jest
						.spyOn(fixture.transport, 'captureRuntimeFeedbackDelivery')
						.mockImplementation((event) => {
							const work = delivery.call(fixture.transport, event);
							if (work) works.push(work);
							return work;
						});
					let tagged = 0;
					const delivered: object[] = [];
					const observe = (event: object): void => {
						if (values.captureOwnedFeedbackDelivery(event)) {
							tagged++;
							delivered.push(event);
						}
					};
					const stopObserving = (): void => {
						observedEvents.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
						const current = Object.getOwnPropertyDescriptor(observedTransport, 'captureRuntimeFeedbackDelivery');
						if (current?.value === deliverySpy && !current.get && !current.set) deliverySpy.mockRestore();
						else if (
							current?.value !== originalDeliveryDescriptor?.value ||
							current?.get !== originalDeliveryDescriptor?.get ||
							current?.set !== originalDeliveryDescriptor?.set ||
							current?.configurable !== originalDeliveryDescriptor?.configurable ||
							current?.enumerable !== originalDeliveryDescriptor?.enumerable ||
							current?.writable !== originalDeliveryDescriptor?.writable
						)
							throw new Error('Original C delivery observation replaced by another owner');
					};
					completion.observeCleanup(stopObserving);
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
					await startWithCeiling(2, completion.boundary);
					expect(fixture.controls.fences).toHaveLength(2);
					expect(tagged).toBe(2);
					expect(works).toHaveLength(2);
					expect(works[0]).toBeInstanceOf(RuntimeOffDispatchWork);
					expect(works[1]).toBeInstanceOf(RuntimeReconciliationWork);
					expect(works[0]).not.toBe(works[1]);
					for (const event of delivered) expect(values.captureOwnedFeedbackDelivery(event)).toBeNull();
					expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					try {
						completion.cleanup();
					} catch (cause) {
						cleanup = { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
			});
			// BEGIN R50 actual natural interval proof draft (UNRUN)
			it('R50 a real scheduled poll retires its original runtime admission and publishes a replacement without ON', async () => {
				await active();
				if (!fixture) throw new Error('Managed native poll fixture missing');
				const owner = runtime,
					owned = fixture,
					ownedClaims = actualClaims,
					tick = gate();
				const originalMethods: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = owner;
				const originalRequest = originalMethods.request;
				const descriptors: Readonly<{
					getOwnPropertyDescriptor: (
						target: object,
						key: PropertyKey,
					) => (Omit<PropertyDescriptor, 'value'> & { value?: unknown }) | undefined;
				}> = Object;
				const originalDescriptor = descriptors.getOwnPropertyDescriptor(owner, 'request');
				let armed = false,
					retired = false,
					matched = false,
					installed = false,
					cleaned = false;
				let lifecycle: (typeof owner)['lifecycle'];
				let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
				const observing = function (
					this: VirtualThermostatRuntimeService,
					...args: Parameters<typeof originalRequest>
				): ReturnType<typeof originalRequest> {
					const result = originalRequest.call(this, ...args);
					if (
						armed &&
						!retired &&
						!matched &&
						this === owner &&
						owner['lifecycle'] === lifecycle &&
						args[0] === controllerId &&
						args[1] === false
					) {
						matched = true;
						armed = false;
						tick.open(); // Only AFTER the original void call has genuinely enqueued its ordinary work.
					}
					return result;
				};
				const retire = (): void => {
					retired = true;
					armed = false;
					tick.open(); // Abort a pending body on timeout; matched remains false, never a successful poll.
				};
				const cleanup = (): void => {
					retire();
					if (cleaned) return;
					let failure: { cause: unknown } | undefined;
					try {
						owner.onModuleDestroy();
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						ownedClaims.onModuleDestroy();
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						owned.revoke();
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						if (installed) {
							const current = descriptors.getOwnPropertyDescriptor(owner, 'request');
							if (
								!current ||
								current.value !== observing ||
								current.get !== undefined ||
								current.set !== undefined ||
								current.configurable !== true ||
								current.enumerable !== false ||
								current.writable !== true
							)
								throw new Error('Natural poll request descriptor replaced by another owner');
							if (originalDescriptor) Object.defineProperty(owner, 'request', originalDescriptor);
							else if (!Reflect.deleteProperty(owner, 'request'))
								throw new Error('Natural poll request descriptor could not be removed');
						}
					} catch (cause) {
						failure ??= { cause };
					}
					cleaned = true;
					completionObserverBackstops.delete(backstop);
					if (failure) throw failure.cause;
				};
				const backstop = { retire, cleanup };
				completionObserverBackstops.add(backstop);
				try {
					Object.defineProperty(owner, 'request', {
						configurable: true,
						enumerable: false,
						writable: true,
						value: observing,
					});
					installed = true;
					await startWithCeiling(2);
					if (retired) throw new Error('Natural poll observer retired during startup');
					lifecycle = owner['lifecycle'];
					const timer = owner['timer'],
						before = owner['contexts'].get(controllerId);
					if (lifecycle === undefined || timer === undefined || !before)
						throw new Error('Natural poll original timer/context missing');
					// One original heating claim makes detached dispatch fallback true; this case never calls inspect/request(false).
					expect(before.claims).toHaveLength(1);
					expect(before.claims[0].role).toBe('heating');
					const admission = before.admission;
					const originalAdmission: Readonly<{
						isCurrent: OriginalFunction<typeof admission, (typeof admission)['isCurrent']>;
					}> = admission;
					const isCurrent = originalAdmission.isCurrent;
					expect(isCurrent.call(admission)).toBe(true);
					const sequence = owner.readDiagnostics(controllerId)?.sequence;
					if (sequence === undefined) throw new Error('Natural poll initial diagnostic missing');
					armed = true;
					await tick.promise;
					if (retired || !matched || owner['lifecycle'] !== lifecycle)
						throw new Error('Natural poll observation retired or absent');
					await owner.flush();
					if (retired || owner['lifecycle'] !== lifecycle) throw new Error('Natural poll owner retired while flushing');
					expect(isCurrent.call(admission)).toBe(false);
					const replacement = owner['contexts'].get(controllerId);
					if (!replacement) throw new Error('Natural poll replacement context missing');
					expect(replacement).not.toBe(before);
					expect(owner.readDiagnostics(controllerId)?.sequence).toBeGreaterThan(sequence);
					expect(owner.readDiagnostics(controllerId)?.configuration_revision).toBeGreaterThan(0);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					try {
						cleanup();
					} catch (cause) {
						cleanupFailure = { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanupFailure) throw cleanupFailure.cause;
			}, 30000);
			// END R50 actual natural interval proof draft

			it('a genuine later poll retains ordinary entry fencing instead of being labeled an owned report', async () => {
				await active();
				await startWithCeiling(2);
				const before = actualClaims.capture();
				runtime.request(controllerId, false);
				await runtime.flush();
				expect(before.isCurrent()).toBe(false);
				expect(runtime.readDiagnostics(controllerId)?.configuration_revision).toBeGreaterThan(0);
			});
			it.each(['proof-query', 'probe-query', 'post-ACK'] satisfies readonly (
				| 'proof-query'
				| 'probe-query'
				| 'post-ACK'
			)[])(
				'finite failed OFF service retains native debt through actual %s failure without rearming its own unknown permit',
				async (mode) => {
					await active();
					if (!fixture) throw new Error('Managed fixture missing');
					const owned = fixture,
						primary = new Error('R21-original-native-primary'),
						secondary = new Error('R21-negative-read-secondary');
					let reported = false,
						primaryHit = false,
						secondaryHits = 0;
					const sample = (): void => {
						if (owned.controls.fences.length >= 2) reported = true;
					};
					const observer = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (
								!reported ||
								!event.query.startsWith('SELECT') ||
								!event.query.includes('devices_virtual_thermostat_command_journal')
							)
								return;
							if (mode !== 'post-ACK' && !primaryHit) {
								primaryHit = true;
								throw primary;
							}
							if (mode === 'proof-query' || (mode === 'probe-query' && event.query.includes('AND NOT ('))) {
								secondaryHits++;
								throw secondary;
							}
						},
						afterTransactionCommit: (): void => {
							if (reported && mode === 'post-ACK' && !primaryHit) {
								primaryHit = true;
								throw primary;
							}
						},
					};
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					database.subscribers.push(observer);
					try {
						// Two initial fences plus at most one genuine unknown-origin safety attempt; no timer bounds the proof.
						await startWithCeiling(3);
						expect(reported).toBe(true);
						expect(primaryHit).toBe(true);
						if (mode === 'probe-query') expect(secondaryHits).toBeGreaterThan(0);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						expect(owned.controls.fences.length).toBeLessThanOrEqual(3);
					} finally {
						runtime.onModuleDestroy();
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						database.subscribers.splice(database.subscribers.indexOf(observer), 1);
					}
				},
			);
			it.each(['new-id', 'same-id-risk'] satisfies readonly ('new-id' | 'same-id-risk')[])(
				'detects independently committed %s native ON debt despite the first consumed dirty frontier',
				async (kind) => {
					await active();
					if (!fixture) throw new Error('Managed fixture missing');
					const owned = fixture,
						secondEntered = gate(),
						secondResume = gate(),
						thirdEntered = gate(),
						thirdResume = gate(),
						fifthEntered = gate(),
						fifthResume = gate();
					const peer = await new SqliteDataSource({
						type: 'sqlite',
						database: join(directory, 'runtime.sqlite'),
						entities: [__dirname + '/../../../**/*.entity.ts'],
						synchronize: false,
						migrationsRun: false,
					}).initialize();
					const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
					const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					const firstId = uuid(),
						secondId = uuid();
					let count = 0;
					owned.controls.beforeFence = () => {
						count++;
						if (count === 2) {
							secondEntered.open();
							return secondResume.promise;
						}
						if (count === 3) {
							thirdEntered.open();
							return thirdResume.promise;
						}
						if (count >= 5) {
							fifthEntered.open();
							return fifthResume.promise;
						}
						return Promise.resolve();
					};
					const nativeON = (id: string) =>
						peer.manager.insert(VirtualThermostatCommandEntity, {
							id,
							controllerId,
							claimId: claim.id,
							claimRevision: claim.revision,
							configurationRevision: row.revision,
							decisionRevision: 1,
							action: 'on',
							status: 'unknown',
							preparedAt: new Date(),
							dispatchedAt: new Date(),
							settledAt: null,
							proofId: null,
							fault: 'peer-obligation',
						});
					const starting = runtime.onApplicationBootstrap();
					try {
						await secondEntered.promise;
						await nativeON(firstId);
						secondResume.open();
						expect(await Promise.race([thirdEntered.promise.then(() => 'third'), starting.then(() => 'early')])).toBe(
							'third',
						);
						if (kind === 'new-id') await nativeON(secondId);
						else
							await peer.manager.update(
								VirtualThermostatCommandEntity,
								{ id: firstId },
								{ decisionRevision: 2, status: 'unknown', dispatchedAt: new Date() },
							);
						thirdResume.open();
						expect(
							await Promise.race([starting.then(() => 'complete'), fifthEntered.promise.then(() => 'fifth')]),
						).toBe('complete');
						const rows = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
						expect(rows.find((command) => command.id === firstId)?.status).toBe('confirmed');
						if (kind === 'new-id') expect(rows.find((command) => command.id === secondId)?.status).toBe('confirmed');
						else expect(rows.find((command) => command.id === firstId)?.decisionRevision).toBe(2);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						runtime.onModuleDestroy();
						owned.revoke();
						secondResume.open();
						thirdResume.open();
						fifthResume.open();
						owned.controls.beforeFence = null;
						await starting;
						await peer.destroy();
					}
				},
			);
			it.each(['member', 'source'] satisfies readonly ('member' | 'source')[])(
				'a real same-revision %s change while the original fence is held remains ordinary safety work',
				async (kind) => {
					await active();
					if (!fixture) throw new Error('Managed fixture missing');
					const owned = fixture,
						entered = gate(),
						resume = gate();
					let calls = 0;
					const peer = await new SqliteDataSource({
						type: 'sqlite',
						database: join(directory, 'runtime.sqlite'),
						entities: [__dirname + '/../../../**/*.entity.ts'],
						synchronize: false,
						migrationsRun: false,
					}).initialize();
					owned.controls.beforeFence = () => {
						calls++;
						if (calls === 2) {
							entered.open();
							return resume.promise;
						}
						return Promise.resolve();
					};
					const starting = runtime.onApplicationBootstrap();
					try {
						await entered.promise;
						const before = await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
						if (kind === 'member')
							await peer.query(
								'UPDATE "devices_virtual_thermostat_member_protection" SET "revision" = "revision" + 1 WHERE "claimId" IN (SELECT "id" FROM "devices_virtual_thermostat_actuator_claims" WHERE "controllerId" = ?)',
								[controllerId],
							);
						else
							await peer.query(
								'UPDATE "devices_virtual_thermostat_sources" SET "maximumAgeSeconds" = "maximumAgeSeconds" + 1 WHERE "controllerId" = ?',
								[controllerId],
							);
						expect((await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).revision).toBe(
							before.revision,
						);
						resume.open();
						await starting;
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						runtime.onModuleDestroy();
						owned.revoke();
						resume.open();
						owned.controls.beforeFence = null;
						await starting;
						await peer.destroy();
					}
				},
			);
			it('a genuine new local ON job still takes ordinary hold fencing before its native send', async () => {
				await active();
				await startWithCeiling(2);
				if (!fixture) throw new Error('Managed fixture missing');
				const owned = fixture,
					entered = gate(),
					resume = gate();
				owned.controls.beforeOn = () => {
					entered.open();
					return resume.promise;
				};
				let settlement: Promise<void> | undefined;
				try {
					await owned.report(sensorId, 10);
					await entered.promise;
					const before = actualClaims.capture();
					settlement = comfort.settle(controllerId);
					expect(before.isCurrent()).toBe(false); // public entry hold is still synchronous, before the pending native ON resumes
					resume.open();
					await settlement;
					await runtime.flush();
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					const pending = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
					expect(pending.length).toBeGreaterThan(0);
					expect(pending.every((command) => command.status === 'cancelled' || command.status === 'confirmed')).toBe(
						true,
					);
				} finally {
					runtime.onModuleDestroy();
					owned.revoke();
					resume.open();
					owned.controls.beforeOn = null;
					if (settlement !== undefined) await settlement;
					await runtime.flush();
				}
			});

			// BEGIN R21 continuation additive finite-failure drafts (UNRUN)
			it.each(['returned-safety', 'rejected-safety'] satisfies readonly ('returned-safety' | 'rejected-safety')[])(
				'a persistent negative-read Q cannot rearm its own %s episode, while a real poll can retry',
				async (kind) => {
					await active();
					if (!fixture) throw new Error('Actual managed fixture missing');
					const owned = fixture,
						primary = new Error('native safety P'),
						secondary = new Error('native negative projection Q');
					let probes = 0,
						roots = 0,
						rootsAtReport: number | undefined,
						primaryReached = false;
					const original: OriginalFunctions<
						Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>
					> = mutationWriter;
					const commit = original.commitExistingControllerForRuntime;
					const root = jest
						.spyOn(mutationWriter, 'commitExistingControllerForRuntime')
						.mockImplementation((...args) => {
							roots++;
							return commit.call(mutationWriter, ...args); // SAME original Promise, exact function/receiver/args once
						});
					const sample = (): void => {
						if (owned.controls.fences.length < 2) return;
						rootsAtReport ??= roots;
						// A real negative authority transition, not a mocked currentness result.
						if (owned.controls.fences.length === 2 || kind === 'returned-safety') actualClaims.invalidate();
					};
					const observer = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (
								!rootsAtReport ||
								!event.query.startsWith('SELECT') ||
								!event.query.includes('devices_virtual_thermostat_command_journal')
							)
								return;
							if (event.query.includes('AND NOT (')) {
								probes++;
								throw secondary;
							}
							if (kind === 'rejected-safety' && owned.controls.fences.length >= 3 && !primaryReached) {
								primaryReached = true;
								throw primary;
							}
						},
					};
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					database.subscribers.push(observer);
					try {
						await startWithCeiling(3);
						expect(rootsAtReport).toBeDefined();
						expect(probes).toBeGreaterThanOrEqual(2);
						expect(roots).toBe((rootsAtReport ?? 0) + 1);
						expect(owned.controls.fences).toHaveLength(3);
						if (kind === 'rejected-safety') expect(primaryReached).toBe(true);
						expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						// A distinct ordinary poll, with actual native facts now readable, is not dropped by the consumed frontier.
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						database.subscribers.splice(database.subscribers.indexOf(observer), 1);
						const prior = roots,
							extra = gate(),
							resume = gate();
						let fences = 0;
						owned.controls.beforeFence = () => {
							fences++;
							if (fences > 2) {
								extra.open();
								return resume.promise;
							}
							return Promise.resolve();
						};
						runtime.request(controllerId, false);
						const flushing = runtime.flush();
						try {
							expect(await Promise.race([flushing.then(() => 'complete'), extra.promise.then(() => 'extra')])).toBe(
								'complete',
							);
							expect(roots).toBeGreaterThan(prior);
							expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						} finally {
							runtime.onModuleDestroy();
							owned.revoke();
							resume.open();
							owned.controls.beforeFence = null;
							await flushing;
						}
					} finally {
						runtime.onModuleDestroy();
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						const index = database.subscribers.indexOf(observer);
						if (index >= 0) database.subscribers.splice(index, 1);
						root.mockRestore();
					}
				},
			);
			// END R21 continuation additive finite-failure drafts

			// BEGIN R21 continuation additive lower-member native draft (UNRUN)
			it('observes a lower second-member barrier even while the original whole-branch maximum stays unchanged', async () => {
				// The existing catalog fixture creates real rows/installations; its offline qualification remains explicitly synthetic.
				await addMandatoryMember();
				await active();
				if (!fixture) throw new Error('Actual two-member fixture missing');
				const owned = fixture;
				const protection = new ThermostatMemberProtectionService(database, values);
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const claims = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
					controllerId,
					role: 'heating',
				});
				const bindings = await protection.load(config, claims);
				expect(bindings).toHaveLength(2);
				const first = bindings[0],
					second = bindings[1],
					sourceId = second.binding?.sourcePropertyId;
				if (!sourceId) throw new Error('Actual second-member floor source missing');
				for (const probe of protectionProbes) await owned.report(probe, 20);
				// A conservative, future-dated observation creates unavailable A debt; it grants no authority and changes no clock/timeout.
				protection.read([first], Date.now() + 10_000);
				protection.read([second], Date.now());
				runtime.onModuleDestroy();
				runtime = new VirtualThermostatRuntimeService(
					database,
					actualStructure,
					actualClaims,
					new VirtualThermostatInputsService(database, values),
					owned.transport,
					values,
					producers,
					events,
					actualGraph,
					comfort,
					new ConfigService({ FB_CLI: 'off' }),
					protection,
				);
				const original: OriginalFunctions<Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>> =
					mutationWriter;
				const commit = original.commitExistingControllerForRuntime;
				let roots = 0,
					negativeReads = 0,
					rootAfterNegative = false;
				const root = jest.spyOn(mutationWriter, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
					roots++;
					if (negativeReads > 0) rootAfterNegative = true;
					return commit.call(mutationWriter, ...args);
				});
				const originalRuntime: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = runtime;
				const request = originalRuntime.request;
				let ordinaryRequests = 0,
					requestsAtTrip = 0;
				const requests = jest.spyOn(runtime, 'request').mockImplementation((...args) => {
					ordinaryRequests++;
					return request.call(runtime, ...args);
				});
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (witness && event.query.startsWith('SELECT') && event.query.includes('AND NOT (')) negativeReads++;
					},
				};
				database.subscribers.push(observer);
				let count = 0,
					rootsAtTrip = 0;
				let witness:
					| { before: number | null; after: number | null; wholeBefore: number | null; wholeAfter: number | null }
					| undefined;
				const excess = gate(),
					resume = gate();
				owned.controls.beforeFence = () => {
					count++;
					if (count === 3) {
						rootsAtTrip = roots;
						requestsAtTrip = ordinaryRequests;
						const before = protection.requiredReleaseAfter([second]),
							wholeBefore = protection.requiredReleaseAfter(bindings);
						protection.invalidateSource(sourceId); // actual public negative transition, no notification/request to mask the native probe
						witness = {
							before,
							after: protection.requiredReleaseAfter([second]),
							wholeBefore,
							wholeAfter: protection.requiredReleaseAfter(bindings),
						};
					}
					if (count > 6) {
						excess.open();
						return resume.promise;
					}
					return Promise.resolve();
				};
				const starting = runtime.onApplicationBootstrap();
				let failure: { cause: unknown } | undefined;
				try {
					expect(await Promise.race([starting.then(() => 'complete'), excess.promise.then(() => 'excess')])).toBe(
						'complete',
					);
					expect(witness).toBeDefined();
					if (!witness || witness.after === null || witness.wholeAfter === null)
						throw new Error('Actual trip not reached');
					expect(witness.after).not.toBe(witness.before);
					expect(witness.after).toBeLessThan(witness.wholeAfter);
					expect(witness.wholeAfter).toBe(witness.wholeBefore);
					expect(negativeReads).toBeGreaterThan(0);
					expect(rootAfterNegative).toBe(true);
					expect(ordinaryRequests).toBe(requestsAtTrip); // no new ordinary request explains the post-probe safety root
					expect(roots).toBeGreaterThan(rootsAtTrip);
					expect(count).toBeLessThanOrEqual(6);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					failure = { cause };
				} finally {
					runtime.onModuleDestroy();
					owned.revoke();
					resume.open();
					owned.controls.beforeFence = null;
					try {
						await starting;
					} catch (cause) {
						failure ??= { cause };
					}
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					root.mockRestore();
					requests.mockRestore();
				}
				if (failure) throw failure.cause;
			});
			// END R21 continuation additive lower-member native draft

			// BEGIN R22 completion-owned negative evidence drafts (UNRUN)
			it('does not consume native N2 when completion Q follows its inverse SELECT on a consumed unknown frontier', async () => {
				await addMandatoryMember();
				await active();
				if (!fixture) throw new Error('Actual managed fixture missing');
				const owned = fixture,
					q = new Error('R22 completion Q'),
					firstQ = new Error('R22 original unknown observation');
				const peer = await new SqliteDataSource({
					type: 'sqlite',
					database: join(directory, 'runtime.sqlite'),
					entities: [__dirname + '/../../../**/*.entity.ts'],
					synchronize: false,
					migrationsRun: false,
				}).initialize();
				const claim = await peer.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
				const config = await peer.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const id = uuid();
				let roots = 0,
					unknownConsumed = false,
					insertAfterCommit = false,
					inserted = false;
				let selected = 0,
					completionFailed = false,
					rootsAtFailure = 0,
					requests = 0,
					requestsAtFailure = 0;
				const original: OriginalFunctions<Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>> =
					mutationWriter;
				const commit = original.commitExistingControllerForRuntime;
				const root = jest.spyOn(mutationWriter, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
					roots++;
					return commit.call(mutationWriter, ...args);
				});
				const originalRuntime: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = runtime;
				const request = originalRuntime.request;
				const requested = jest.spyOn(runtime, 'request').mockImplementation((...args) => {
					requests++;
					return request.call(runtime, ...args);
				});
				const sample = (): void => {
					if (owned.controls.fences.length < 2) return;
					if (!unknownConsumed) actualClaims.invalidate();
					else actualGraph.invalidateValidation(); // Real graph withholding keeps later OFF history truthful but its certificate unusable.
				};
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (!unknownConsumed && event.query.startsWith('SELECT') && event.query.includes('AND NOT (')) {
							unknownConsumed = true;
							throw firstQ;
						}
					},
					afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
						if (
							unknownConsumed &&
							roots >= 2 &&
							event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
							event.parameters?.includes('confirmed') &&
							!inserted
						)
							insertAfterCommit = true;
						if (
							inserted &&
							event.query.startsWith('SELECT') &&
							event.query.includes('AND NOT (') &&
							Array.isArray(event.rawResults) &&
							event.rawResults.some(
								(row: unknown) =>
									!!row && typeof row === 'object' && Object.getOwnPropertyDescriptor(row, 'id')?.value === id,
							)
						)
							selected++;
					},
					afterTransactionCommit: async (): Promise<void> => {
						if (insertAfterCommit && !inserted) {
							inserted = true;
							await peer.manager.insert(VirtualThermostatCommandEntity, {
								id,
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
								fault: 'R22 independent obligation',
							});
						}
						if (selected === 1 && !completionFailed) {
							completionFailed = true;
							rootsAtFailure = roots;
							requestsAtFailure = requests;
							throw q;
						}
					},
				};
				events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
				database.subscribers.push(observer);
				try {
					await startWithCeiling(12); // At most three original two-member/two-fence evaluations.
					expect(unknownConsumed).toBe(true);
					expect(inserted).toBe(true);
					expect(completionFailed).toBe(true);
					expect(selected).toBeGreaterThanOrEqual(2); // Failed completion did not add N2 to the next inverse exclusion.
					expect(roots).toBeGreaterThan(rootsAtFailure);
					expect(requests).toBe(requestsAtFailure);
					// A real ordinary admission is required; graph withholding may still refuse its original native gates.
					expect((await peer.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id })).status).toBe('unknown');
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					runtime.onModuleDestroy();
					events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					root.mockRestore();
					requested.mockRestore();
					await peer.destroy();
				}
			});
			it('admits the negative observer only after a genuinely queued native graph writer releases', async () => {
				await active();
				if (!fixture) throw new Error('Actual managed fixture missing');
				const owned = fixture,
					loadEntered = gate(),
					loadResume = gate(),
					writerEntered = gate(),
					writerResume = gate();
				let rootReturned = false,
					heldLoad = false,
					wrote = false,
					baselineAfterWriter = false;
				let atLoad: readonly object[] = [];
				const original: OriginalFunctions<Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>> =
					mutationWriter;
				const commit = original.commitExistingControllerForRuntime;
				const root = jest.spyOn(mutationWriter, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
					const result = commit.call(mutationWriter, ...args);
					void result.then(
						() => {
							rootReturned = true;
						},
						() => undefined,
					);
					return result;
				});
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
						if (
							rootReturned &&
							!heldLoad &&
							event.query.includes('FROM "devices_virtual_thermostat_command_journal" "VirtualThermostatCommandEntity"')
						) {
							heldLoad = true;
							atLoad = [...database.subscribers];
							loadEntered.open();
							return loadResume.promise;
						}
						if (
							wrote &&
							event.query.startsWith('SELECT "') &&
							event.query.includes(' FROM "devices_virtual_thermostat_configs" WHERE ')
						)
							baselineAfterWriter = true;
					},
				};
				database.subscribers.push(observer);
				const starting = startWithCeiling(3);
				let writing: Promise<void> | undefined;
				try {
					expect(await Promise.race([loadEntered.promise.then(() => 'load'), starting.then(() => 'early')])).toBe(
						'load',
					);
					writing = actualStructure.runExclusive(async () => {
						writerEntered.open();
						await writerResume.promise;
						await database.query(
							'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1',
						);
						wrote = true;
					});
					loadResume.open();
					await writerEntered.promise;
					// The writer is real and graph-invalidating, but no waiting negative reader has installed an observer yet.
					expect(database.subscribers.filter((item) => Object.isFrozen(item) && !atLoad.includes(item))).toEqual([]);
					writerResume.open();
					await writing;
					await starting;
					expect(wrote).toBe(true);
					expect(baselineAfterWriter).toBe(true);
					expect(owned.controls.fences.length).toBeGreaterThan(0);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					runtime.onModuleDestroy();
					owned.revoke();
					loadResume.open();
					writerResume.open();
					if (writing !== undefined) await writing;
					await starting;
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					root.mockRestore();
				}
			});
			it.each([
				{ kind: 'Error', primary: new Error('R22 original ordinary native P'), fail: true },
				{ kind: 'undefined', primary: undefined, fail: true },
				{ kind: 'null', primary: null, fail: true },
				{ kind: 'returned-safety', primary: undefined, fail: false },
			])(
				'an unavailable baseline Q permits guarded OFF and preserves subsequent native $kind outcome at its real root boundary',
				async ({ primary, fail }) => {
					await active();
					if (!fixture) throw new Error('Actual managed fixture missing');
					const owned = fixture,
						q = new Error('R22 optional baseline Q');
					let baselineFaults = 0,
						roots = 0,
						nativeFaults = 0,
						firstRootCompleted = false;
					const failures: unknown[] = [];
					const original: OriginalFunctions<
						Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>
					> = mutationWriter;
					const commit = original.commitExistingControllerForRuntime;
					const root = jest
						.spyOn(mutationWriter, 'commitExistingControllerForRuntime')
						.mockImplementation((...args) => {
							roots++;
							const result = commit.call(mutationWriter, ...args);
							void result.then(
								() => {
									if (roots === 1) firstRootCompleted = true;
								},
								(cause: unknown) => {
									failures.push(cause);
								},
							);
							return result;
						});
					const sample = (): void => {
						if (owned.controls.fences.length >= 2) actualClaims.invalidate();
					};
					const observer = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							// This full, unaliased read is the optional baseline, not the ordinary ORM load or root protocol.
							if (
								firstRootCompleted &&
								roots === 1 &&
								event.query.startsWith('SELECT "') &&
								event.query.includes(' FROM "devices_virtual_thermostat_configs" WHERE ')
							) {
								baselineFaults++;
								throw q;
							}
							if (
								fail &&
								roots === 2 &&
								event.query.startsWith('SELECT') &&
								event.query.includes('devices_virtual_thermostat_configs')
							) {
								nativeFaults++;
								throw primary;
							}
						},
					};
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					database.subscribers.push(observer);
					try {
						await startWithCeiling(3);
						expect(baselineFaults).toBeGreaterThan(0);
						expect(owned.controls.fences.length).toBeGreaterThan(0);
						expect(roots).toBe(2);
						if (fail) {
							expect(nativeFaults).toBeGreaterThan(0);
							expect(failures).toHaveLength(1);
							const failure = failures[0];
							expect(failure).toBeInstanceOf(Error);
							if (!(failure instanceof Error)) throw new Error('Original native boundary did not expose its genuine P');
							expect(failure.cause).toBe(primary);
							expect(failure.cause).not.toBe(q);
						} else {
							expect(nativeFaults).toBe(0);
							expect(failures).toEqual([]);
						}
						expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						runtime.onModuleDestroy();
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						const index = database.subscribers.indexOf(observer);
						if (index >= 0) database.subscribers.splice(index, 1);
						root.mockRestore();
					}
				},
			);
			it('does not consume a lower member barrier when the completed native probe throws Q before scheduling', async () => {
				// The existing catalog fixture creates real rows/installations; its offline qualification remains explicitly synthetic.
				await addMandatoryMember();
				await active();
				if (!fixture) throw new Error('Actual two-member fixture missing');
				const owned = fixture;
				const protection = new ThermostatMemberProtectionService(database, values);
				const q = new Error('R22 lower barrier completion Q'),
					firstQ = new Error('R22 consumed unknown observation');
				let barrierObserved = false,
					failed = false,
					rootsAtFailure = 0,
					unknownConsumed = false;
				let witness:
					| { before: number | null; after: number | null; wholeBefore: number | null; wholeAfter: number | null }
					| undefined;
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const claims = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
					controllerId,
					role: 'heating',
				});
				const bindings = await protection.load(config, claims);
				expect(bindings).toHaveLength(2);
				const first = bindings[0],
					second = bindings[1],
					sourceId = second.binding?.sourcePropertyId;
				if (!sourceId) throw new Error('Actual second-member floor source missing');
				for (const probe of protectionProbes) await owned.report(probe, 20);
				// A conservative, future-dated observation creates unavailable A debt; it grants no authority and changes no clock/timeout.
				protection.read([first], Date.now() + 10_000);
				protection.read([second], Date.now());
				const protectionMethods: OriginalFunctions<Pick<ThermostatMemberProtectionService, 'requiredReleaseAfter'>> =
					protection;
				const requiredReleaseAfter = protectionMethods.requiredReleaseAfter;
				const observedBarrier = jest.spyOn(protection, 'requiredReleaseAfter').mockImplementation((...args) => {
					const result = requiredReleaseAfter.call(protection, ...args);
					if (witness && args[0].length === 1 && args[0][0].claimId === second.claimId && result === witness.after)
						barrierObserved = true;
					return result;
				});
				runtime.onModuleDestroy();
				runtime = new VirtualThermostatRuntimeService(
					database,
					actualStructure,
					actualClaims,
					new VirtualThermostatInputsService(database, values),
					owned.transport,
					values,
					producers,
					events,
					actualGraph,
					comfort,
					new ConfigService({ FB_CLI: 'off' }),
					protection,
				);
				const original: OriginalFunctions<Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>> =
					mutationWriter;
				const commit = original.commitExistingControllerForRuntime;
				let roots = 0,
					negativeReads = 0,
					rootAfterNegative = false;
				const root = jest.spyOn(mutationWriter, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
					roots++;
					if (negativeReads > 0) rootAfterNegative = true;
					return commit.call(mutationWriter, ...args);
				});
				const originalRuntime: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = runtime;
				const request = originalRuntime.request;
				let ordinaryRequests = 0,
					requestsAtTrip = 0;
				const requests = jest.spyOn(runtime, 'request').mockImplementation((...args) => {
					ordinaryRequests++;
					return request.call(runtime, ...args);
				});
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (event.query.startsWith('SELECT') && event.query.includes('AND NOT (')) {
							if (!unknownConsumed) {
								unknownConsumed = true;
								throw firstQ;
							}
							if (witness) {
								negativeReads++;
								barrierObserved = false;
							}
						}
					},
					afterTransactionCommit: (): void => {
						if (barrierObserved && negativeReads > 0 && !failed) {
							failed = true;
							rootsAtFailure = roots;
							throw q;
						}
					},
				};
				const sample = (): void => {
					if ((fixture?.controls.fences.length ?? 0) < 2) return;
					if (!unknownConsumed) actualClaims.invalidate();
					else actualGraph.invalidateValidation();
				};
				events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
				database.subscribers.push(observer);
				let count = 0,
					rootsAtTrip = 0;
				const excess = gate(),
					resume = gate();
				owned.controls.beforeFence = () => {
					count++;
					if (count === 3) {
						rootsAtTrip = roots;
						requestsAtTrip = ordinaryRequests;
						const before = protection.requiredReleaseAfter([second]),
							wholeBefore = protection.requiredReleaseAfter(bindings);
						protection.invalidateSource(sourceId); // actual public negative transition, no notification/request to mask the native probe
						witness = {
							before,
							after: protection.requiredReleaseAfter([second]),
							wholeBefore,
							wholeAfter: protection.requiredReleaseAfter(bindings),
						};
					}
					if (count > 6) {
						excess.open();
						return resume.promise;
					}
					return Promise.resolve();
				};
				const starting = runtime.onApplicationBootstrap();
				let failure: { cause: unknown } | undefined;
				try {
					expect(await Promise.race([starting.then(() => 'complete'), excess.promise.then(() => 'excess')])).toBe(
						'complete',
					);
					expect(witness).toBeDefined();
					if (!witness || witness.after === null || witness.wholeAfter === null)
						throw new Error('Actual trip not reached');
					expect(witness.after).not.toBe(witness.before);
					expect(witness.after).toBeLessThan(witness.wholeAfter);
					expect(witness.wholeAfter).toBe(witness.wholeBefore);
					expect(negativeReads).toBeGreaterThan(0);
					expect(rootAfterNegative).toBe(true);
					expect(ordinaryRequests).toBe(requestsAtTrip); // no new ordinary request explains the post-probe safety root
					expect(roots).toBeGreaterThan(rootsAtTrip);
					expect(unknownConsumed).toBe(true);
					expect(barrierObserved).toBe(true);
					expect(failed).toBe(true);
					expect(roots).toBeGreaterThan(rootsAtFailure);
					expect(negativeReads).toBeGreaterThanOrEqual(2);
					expect(count).toBeLessThanOrEqual(6);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					failure = { cause };
				} finally {
					runtime.onModuleDestroy();
					owned.revoke();
					resume.open();
					owned.controls.beforeFence = null;
					try {
						await starting;
					} catch (cause) {
						failure ??= { cause };
					}
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					root.mockRestore();
					requests.mockRestore();
					observedBarrier.mockRestore();
				}
				if (failure) throw failure.cause;
			});
			// END R22 completion-owned negative evidence drafts

			// BEGIN R23 original initial publication P observation drafts (UNRUN)
			it.each<Readonly<{ kind: string; primary: unknown }>>([
				{ kind: 'Error', primary: new Error('R23 original initial publication P') },
				{ kind: 'string', primary: 'R23 original initial publication P' },
				{ kind: 'undefined', primary: undefined },
				{ kind: 'null', primary: null },
			])('retains initial post-OFF publication $kind P through actual failed-child probe Q', async ({ primary }) => {
				await active();
				if (!fixture) throw new Error('Actual managed fixture missing');
				const owned = fixture,
					owner = runtime,
					writerOwner = mutationWriter,
					q = new Error('R23 private negative observation Q');
				// Observers are installed BEFORE genuine bootstrap/consumer/helper-method pinning.
				// No private cell is read or forced; only original application calls enter these methods.
				const originals: Readonly<{
					evaluate: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['evaluate']>;
					publish: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['publish']>;
					serviceFeedback: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['serviceFeedback']>;
				}> = { evaluate: owner['evaluate'], publish: owner['publish'], serviceFeedback: owner['serviceFeedback'] };
				const descriptors = {
					evaluate: Object.getOwnPropertyDescriptor(owner, 'evaluate'),
					publish: Object.getOwnPropertyDescriptor(owner, 'publish'),
					serviceFeedback: Object.getOwnPropertyDescriptor(owner, 'serviceFeedback'),
				};
				const evaluated: { cause: unknown }[] = [],
					serviced: { cause: unknown }[] = [];
				let publicationActive = false,
					publicationFaulted = false,
					ownedReports = 0,
					probes = 0;
				let roots = 0,
					rootsAtPublication = 0;
				Object.defineProperty(owner, 'evaluate', {
					configurable: true,
					writable: true,
					value: (...args: Parameters<typeof originals.evaluate>): ReturnType<typeof originals.evaluate> => {
						const pending = originals.evaluate.call(owner, ...args);
						void pending.then(
							() => undefined,
							(cause: unknown) => {
								evaluated.push({ cause });
							},
						);
						return pending;
					},
				});
				Object.defineProperty(owner, 'publish', {
					configurable: true,
					writable: true,
					value: (...args: Parameters<typeof originals.publish>): ReturnType<typeof originals.publish> => {
						publicationActive = true;
						const pending = originals.publish.call(owner, ...args);
						void pending.then(
							() => {
								publicationActive = false;
							},
							() => {
								publicationActive = false;
							},
						);
						return pending;
					},
				});
				Object.defineProperty(owner, 'serviceFeedback', {
					configurable: true,
					writable: true,
					value: (
						...args: Parameters<typeof originals.serviceFeedback>
					): ReturnType<typeof originals.serviceFeedback> => {
						const pending = originals.serviceFeedback.call(owner, ...args);
						void pending.then(
							() => undefined,
							(cause: unknown) => {
								serviced.push({ cause });
							},
						);
						return pending;
					},
				});
				const originalWriter: OriginalFunctions<
					Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>
				> = writerOwner;
				const commit = originalWriter.commitExistingControllerForRuntime;
				const root = jest.spyOn(writerOwner, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
					roots++;
					return commit.call(writerOwner, ...args);
				});
				const sample = (event: object): void => {
					if (!values.captureOwnedFeedbackDelivery(event)) return;
					ownedReports++;
				};
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (
							publicationActive &&
							ownedReports > 0 &&
							!publicationFaulted &&
							event.query.includes('FROM "devices_module_channels_properties"')
						) {
							publicationFaulted = true;
							rootsAtPublication = roots;
							actualGraph.invalidateValidation();
							throw primary;
						}
						if (publicationFaulted && event.query.startsWith('SELECT') && event.query.includes('AND NOT (')) {
							probes++;
							throw q;
						}
					},
				};
				events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
				database.subscribers.push(observer);
				try {
					await startWithCeiling(3);
					expect(ownedReports).toBeGreaterThan(0);
					expect(publicationFaulted).toBe(true);
					expect(evaluated.length).toBeGreaterThan(0);
					expect(evaluated[0].cause).toBe(primary);
					expect(probes).toBeGreaterThan(0);
					expect(serviced.length).toBeGreaterThan(0);
					for (const failure of serviced) {
						expect(failure.cause).toBe(primary);
						expect(failure.cause).not.toBe(q);
					}
					// The one inherited unknown-origin attempt may remain, but it cannot create a root feedback loop.
					expect(roots).toBeLessThanOrEqual(rootsAtPublication + 1);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
				} finally {
					owner.onModuleDestroy();
					events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					root.mockRestore();
					for (const key of [
						'evaluate',
						'publish',
						'serviceFeedback',
					] satisfies readonly (keyof typeof descriptors)[]) {
						const descriptor = descriptors[key];
						if (descriptor) Object.defineProperty(owner, key, descriptor);
						else Reflect.deleteProperty(owner, key);
					}
				}
			});

			// BEGIN R31 same-evaluation post-certificate publication drafts (UNRUN)
			it.each<Readonly<{ kind: string; primary: unknown }>>([
				{ kind: 'Error', primary: new Error('R31 post-certificate publication P') },
				{ kind: 'string', primary: 'R31 post-certificate publication P' },
				{ kind: 'undefined', primary: undefined },
				{ kind: 'null', primary: null },
			])(
				'R31 correlates genuine native certificate SUCCESS then same-evaluation publication $kind P and probe Q',
				async ({ primary }) => {
					await active();
					if (!fixture) throw new Error('Actual managed fixture missing');
					const owned = fixture,
						owner = runtime,
						writerOwner = mutationWriter,
						q = new Error('R31 post-certificate Q');
					// Observers are installed BEFORE genuine bootstrap/consumer/helper-method pinning.
					// No private cell is read or forced; only original application calls enter these methods.
					const originals: Readonly<{
						reconcile: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['reconcile']>;
						evaluate: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['evaluate']>;
						publish: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['publish']>;
						serviceFeedback: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['serviceFeedback']>;
					}> = {
						reconcile: owner['reconcile'],
						evaluate: owner['evaluate'],
						publish: owner['publish'],
						serviceFeedback: owner['serviceFeedback'],
					};
					const descriptors = {
						reconcile: Object.getOwnPropertyDescriptor(owner, 'reconcile'),
						evaluate: Object.getOwnPropertyDescriptor(owner, 'evaluate'),
						publish: Object.getOwnPropertyDescriptor(owner, 'publish'),
						serviceFeedback: Object.getOwnPropertyDescriptor(owner, 'serviceFeedback'),
					};
					const evaluated: { cause: unknown }[] = [],
						serviced: { cause: unknown }[] = [];
					type Publication = {
						context: Parameters<typeof originals.publish>[0];
						witness?: { epoch: string; sequence: number };
					};
					const publications = new AsyncLocalStorage<Publication>();
					let acknowledged = 0;
					let pendingAck: Parameters<typeof originals.reconcile>[0] | undefined;
					const nativeScopes = new AsyncLocalStorage<Parameters<typeof originals.reconcile>[0]>();
					const nativeAcks = new WeakMap<object, number>(),
						completedReconciles = new WeakSet<object>();
					Object.defineProperty(owner, 'reconcile', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.reconcile>): ReturnType<typeof originals.reconcile> => {
							const pending = nativeScopes.run(args[0], () => originals.reconcile.call(owner, ...args));
							void pending.then(
								() => {
									completedReconciles.add(args[0]);
								},
								() => undefined,
							);
							return pending;
						},
					});
					let selectedPublication: Publication | undefined;
					const changed = (
						event: Readonly<{
							controller: string;
							configuration_revision: number;
							decision_revision: number;
							epoch: string;
							sequence: number;
							runtime: ThermostatRuntimeDiagnostic;
						}>,
					): void => {
						const current = publications.getStore();
						if (
							current &&
							(nativeAcks.get(current.context) ?? 0) > 0 &&
							completedReconciles.has(current.context) &&
							event.controller === current.context.config.controllerId &&
							event.configuration_revision === current.context.config.revision &&
							event.decision_revision === current.context.state.decisionRevision &&
							event.runtime.epoch === event.epoch &&
							event.runtime.sequence === event.sequence &&
							event.runtime.branches.some((branch) => branch.release_proven)
						)
							current.witness = { epoch: event.epoch, sequence: event.sequence };
					};
					let publicationActive = false,
						publicationFaulted = false,
						ownedReports = 0,
						probes = 0;
					let roots = 0,
						rootsAtPublication = 0;
					Object.defineProperty(owner, 'evaluate', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.evaluate>): ReturnType<typeof originals.evaluate> => {
							const pending = originals.evaluate.call(owner, ...args);
							void pending.then(
								() => undefined,
								(cause: unknown) => {
									evaluated.push({ cause });
								},
							);
							return pending;
						},
					});
					Object.defineProperty(owner, 'publish', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.publish>): ReturnType<typeof originals.publish> => {
							publicationActive = true;
							const publication: Publication = { context: args[0] };
							const pending = publications.run(publication, () => originals.publish.call(owner, ...args));
							void pending.then(
								() => {
									publicationActive = false;
								},
								() => {
									publicationActive = false;
								},
							);
							return pending;
						},
					});
					Object.defineProperty(owner, 'serviceFeedback', {
						configurable: true,
						writable: true,
						value: (
							...args: Parameters<typeof originals.serviceFeedback>
						): ReturnType<typeof originals.serviceFeedback> => {
							const pending = originals.serviceFeedback.call(owner, ...args);
							void pending.then(
								() => undefined,
								(cause: unknown) => {
									serviced.push({ cause });
								},
							);
							return pending;
						},
					});
					const originalWriter: OriginalFunctions<
						Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>
					> = writerOwner;
					const commit = originalWriter.commitExistingControllerForRuntime;
					const root = jest.spyOn(writerOwner, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
						roots++;
						return commit.call(writerOwner, ...args);
					});
					const sample = (event: object): void => {
						if (!values.captureOwnedFeedbackDelivery(event)) return;
						ownedReports++;
					};
					const observer = {
						afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
							if (
								event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
								event.parameters?.includes('confirmed')
							)
								pendingAck = nativeScopes.getStore();
						},
						afterTransactionCommit: (): void => {
							if (pendingAck) {
								acknowledged++;
								nativeAcks.set(pendingAck, (nativeAcks.get(pendingAck) ?? 0) + 1);
								pendingAck = undefined;
							}
						},
						afterTransactionRollback: (): void => {
							pendingAck = undefined;
						},
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (
								publicationActive &&
								publications.getStore()?.witness !== undefined &&
								ownedReports > 0 &&
								!publicationFaulted &&
								event.query.includes('FROM "devices_module_channels_properties"')
							) {
								selectedPublication = publications.getStore();
								publicationFaulted = true;
								rootsAtPublication = roots;
								actualGraph.invalidateValidation();
								throw primary;
							}
							if (publicationFaulted && event.query.startsWith('SELECT') && event.query.includes('AND NOT (')) {
								probes++;
								throw q;
							}
						},
					};
					events.on('DevicesVirtualPlugin.Thermostat.RuntimeChanged', changed);
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					database.subscribers.push(observer);
					try {
						await startWithCeiling(3);
						expect(ownedReports).toBeGreaterThan(0);
						expect(publicationFaulted).toBe(true);
						expect(acknowledged).toBeGreaterThan(0);
						expect(selectedPublication?.witness).toBeDefined();
						expect(selectedPublication?.context.state.decisionRevision).toBeGreaterThan(0);
						expect(evaluated.length).toBeGreaterThan(0);
						expect(evaluated[0].cause).toBe(primary);
						expect(probes).toBeGreaterThan(0);
						expect(serviced.length).toBeGreaterThan(0);
						for (const failure of serviced) {
							expect(failure.cause).toBe(primary);
							expect(failure.cause).not.toBe(q);
						}
						// The one inherited unknown-origin attempt may remain, but it cannot create a root feedback loop.
						expect(roots).toBeLessThanOrEqual(rootsAtPublication + 1);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						expect(runtime.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
					} finally {
						owner.onModuleDestroy();
						events.off('DevicesVirtualPlugin.Thermostat.RuntimeChanged', changed);
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						const index = database.subscribers.indexOf(observer);
						if (index >= 0) database.subscribers.splice(index, 1);
						root.mockRestore();
						for (const key of [
							'reconcile',
							'evaluate',
							'publish',
							'serviceFeedback',
						] satisfies readonly (keyof typeof descriptors)[]) {
							const descriptor = descriptors[key];
							if (descriptor) Object.defineProperty(owner, key, descriptor);
							else Reflect.deleteProperty(owner, key);
						}
					}
				},
			);

			// BEGIN R31 inherited-primary recovery drafts (UNRUN)
			it.each<Readonly<{ kind: string; primary: unknown }>>([
				{ kind: 'Error', primary: new Error('R31 post-certificate publication P') },
				{ kind: 'string', primary: 'R31 post-certificate publication P' },
				{ kind: 'undefined', primary: undefined },
				{ kind: 'null', primary: null },
			])(
				'R31 admits a later genuine successful inherited evaluation despite its original $kind publication P',
				async ({ primary }) => {
					await active();
					if (!fixture) throw new Error('Actual managed fixture missing');
					const owned = fixture,
						owner = runtime,
						writerOwner = mutationWriter,
						q = new Error('R31 post-certificate Q');
					// Observers are installed BEFORE genuine bootstrap/consumer/helper-method pinning.
					// Original invocation arguments are observed without changing any private cell.
					const originals: Readonly<{
						reconcile: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['reconcile']>;
						probeOriginalFeedbackDebt: OriginalFunction<
							VirtualThermostatRuntimeService,
							(typeof owner)['probeOriginalFeedbackDebt']
						>;
						evaluate: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['evaluate']>;
						publish: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['publish']>;
						serviceFeedback: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['serviceFeedback']>;
					}> = {
						reconcile: owner['reconcile'],
						probeOriginalFeedbackDebt: owner['probeOriginalFeedbackDebt'],
						evaluate: owner['evaluate'],
						publish: owner['publish'],
						serviceFeedback: owner['serviceFeedback'],
					};
					const descriptors = {
						reconcile: Object.getOwnPropertyDescriptor(owner, 'reconcile'),
						probeOriginalFeedbackDebt: Object.getOwnPropertyDescriptor(owner, 'probeOriginalFeedbackDebt'),
						evaluate: Object.getOwnPropertyDescriptor(owner, 'evaluate'),
						publish: Object.getOwnPropertyDescriptor(owner, 'publish'),
						serviceFeedback: Object.getOwnPropertyDescriptor(owner, 'serviceFeedback'),
					};
					const evaluated: { cause: unknown }[] = [],
						serviced: { cause: unknown }[] = [];
					type Publication = {
						context: Parameters<typeof originals.publish>[0];
						witness?: { epoch: string; sequence: number };
					};
					const publications = new AsyncLocalStorage<Publication>();
					let recovery: Promise<void> | undefined, recoveryError: { cause: unknown } | undefined;
					const inherited: { context?: object; complete: boolean; nativeSelected: boolean }[] = [];
					const evaluations = new AsyncLocalStorage<(typeof inherited)[number]>();
					Object.defineProperty(owner, 'probeOriginalFeedbackDebt', {
						configurable: true,
						writable: true,
						value: (
							...args: Parameters<typeof originals.probeOriginalFeedbackDebt>
						): ReturnType<typeof originals.probeOriginalFeedbackDebt> => {
							const pending = originals.probeOriginalFeedbackDebt.call(owner, ...args);
							void pending.then(
								(result) => {
									// Original readonly TX/shared admission have finished. Real public validation starts before
									// the original caller's continuation, without replacing its Promise or returning fake evidence.
									if (result.kind === 'UNPROVABLE' && probes === 1 && recovery === undefined) {
										recovery = actualGraph.refreshQuarantine();
										void recovery.catch((cause: unknown) => {
											recoveryError = { cause };
										});
									}
								},
								() => undefined,
							);
							return pending;
						},
					});
					let acknowledged = 0;
					let pendingAck: Parameters<typeof originals.reconcile>[0] | undefined;
					const nativeScopes = new AsyncLocalStorage<Parameters<typeof originals.reconcile>[0]>();
					const nativeAcks = new WeakMap<object, number>(),
						completedReconciles = new WeakSet<object>();
					Object.defineProperty(owner, 'reconcile', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.reconcile>): ReturnType<typeof originals.reconcile> => {
							const pending = nativeScopes.run(args[0], () => originals.reconcile.call(owner, ...args));
							void pending.then(
								() => {
									completedReconciles.add(args[0]);
								},
								() => undefined,
							);
							return pending;
						},
					});
					let selectedPublication: Publication | undefined;
					const changed = (
						event: Readonly<{
							controller: string;
							configuration_revision: number;
							decision_revision: number;
							epoch: string;
							sequence: number;
							runtime: ThermostatRuntimeDiagnostic;
						}>,
					): void => {
						const current = publications.getStore();
						if (
							current &&
							(nativeAcks.get(current.context) ?? 0) > 0 &&
							completedReconciles.has(current.context) &&
							event.controller === current.context.config.controllerId &&
							event.configuration_revision === current.context.config.revision &&
							event.decision_revision === current.context.state.decisionRevision &&
							event.runtime.epoch === event.epoch &&
							event.runtime.sequence === event.sequence &&
							event.runtime.branches.some((branch) => branch.release_proven)
						)
							current.witness = { epoch: event.epoch, sequence: event.sequence };
					};
					let publicationActive = false,
						publicationFaulted = false,
						ownedReports = 0,
						probes = 0;
					let roots = 0,
						rootsAtPublication = 0;
					Object.defineProperty(owner, 'evaluate', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.evaluate>): ReturnType<typeof originals.evaluate> => {
							const entry = {
								context: undefined,
								complete: false,
								nativeSelected: false,
							} satisfies (typeof inherited)[number];
							const record: (typeof inherited)[number] = entry;
							if (args[2]?.failure.primary && Object.is(args[2].failure.primary.cause, primary)) inherited.push(record);
							const pending = evaluations.run(record, () => originals.evaluate.call(owner, ...args));
							void pending.then(
								() => {
									record.complete = true;
								},
								(cause: unknown) => {
									evaluated.push({ cause });
								},
							);
							return pending;
						},
					});
					Object.defineProperty(owner, 'publish', {
						configurable: true,
						writable: true,
						value: (...args: Parameters<typeof originals.publish>): ReturnType<typeof originals.publish> => {
							publicationActive = true;
							const evaluation = evaluations.getStore();
							if (evaluation) evaluation.context = args[0];
							const publication: Publication = { context: args[0] };
							const pending = publications.run(publication, () => originals.publish.call(owner, ...args));
							void pending.then(
								() => {
									publicationActive = false;
								},
								() => {
									publicationActive = false;
								},
							);
							return pending;
						},
					});
					Object.defineProperty(owner, 'serviceFeedback', {
						configurable: true,
						writable: true,
						value: (
							...args: Parameters<typeof originals.serviceFeedback>
						): ReturnType<typeof originals.serviceFeedback> => {
							const pending = originals.serviceFeedback.call(owner, ...args);
							void pending.then(
								() => undefined,
								(cause: unknown) => {
									serviced.push({ cause });
								},
							);
							return pending;
						},
					});
					const originalWriter: OriginalFunctions<
						Pick<ClimateAutomationWriterService, 'commitExistingControllerForRuntime'>
					> = writerOwner;
					const commit = originalWriter.commitExistingControllerForRuntime;
					const root = jest.spyOn(writerOwner, 'commitExistingControllerForRuntime').mockImplementation((...args) => {
						roots++;
						return commit.call(writerOwner, ...args);
					});
					const sample = (event: object): void => {
						if (!values.captureOwnedFeedbackDelivery(event)) return;
						ownedReports++;
					};
					const observer = {
						afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
							const evaluation = evaluations.getStore(),
								publication = publications.getStore();
							if (
								publicationFaulted &&
								evaluation &&
								publication?.witness &&
								publication.context === evaluation.context &&
								event.query.includes('FROM "devices_module_channels_properties"')
							)
								evaluation.nativeSelected = true;
							if (
								event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
								event.parameters?.includes('confirmed')
							)
								pendingAck = nativeScopes.getStore();
						},
						afterTransactionCommit: (): void => {
							if (pendingAck) {
								acknowledged++;
								nativeAcks.set(pendingAck, (nativeAcks.get(pendingAck) ?? 0) + 1);
								pendingAck = undefined;
							}
						},
						afterTransactionRollback: (): void => {
							pendingAck = undefined;
						},
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (
								publicationActive &&
								publications.getStore()?.witness !== undefined &&
								ownedReports > 0 &&
								!publicationFaulted &&
								event.query.includes('FROM "devices_module_channels_properties"')
							) {
								selectedPublication = publications.getStore();
								publicationFaulted = true;
								rootsAtPublication = roots;
								actualGraph.invalidateValidation();
								throw primary;
							}
							if (
								publicationFaulted &&
								recovery === undefined &&
								event.query.startsWith('SELECT') &&
								event.query.includes('AND NOT (')
							) {
								probes++;
								throw q;
							}
						},
					};
					events.on('DevicesVirtualPlugin.Thermostat.RuntimeChanged', changed);
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					database.subscribers.push(observer);
					try {
						await startWithCeiling(3);
						if (recovery !== undefined) await recovery;
						await owner.flush();
						expect(recovery).toBeDefined();
						expect(recoveryError).toBeUndefined();
						expect(inherited.some((entry) => entry.complete && entry.nativeSelected)).toBe(true);
						expect(ownedReports).toBeGreaterThan(0);
						expect(publicationFaulted).toBe(true);
						expect(acknowledged).toBeGreaterThan(0);
						expect(selectedPublication?.witness).toBeDefined();
						expect(selectedPublication?.context.state.decisionRevision).toBeGreaterThan(0);
						expect(evaluated.length).toBeGreaterThan(0);
						expect(evaluated[0].cause).toBe(primary);
						expect(probes).toBeGreaterThan(0);
						expect(probes).toBe(1); // Q may be consumed by the one genuine recovery attempt that actually succeeds.
						for (const failure of serviced) {
							expect(failure.cause).toBe(primary);
							expect(failure.cause).not.toBe(q);
						}
						// The one inherited unknown-origin attempt may remain, but it cannot create a root feedback loop.
						expect(roots).toBeLessThanOrEqual(rootsAtPublication + 1);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
					} finally {
						owner.onModuleDestroy();
						events.off('DevicesVirtualPlugin.Thermostat.RuntimeChanged', changed);
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						const index = database.subscribers.indexOf(observer);
						if (index >= 0) database.subscribers.splice(index, 1);
						root.mockRestore();
						for (const key of [
							'probeOriginalFeedbackDebt',
							'reconcile',
							'evaluate',
							'publish',
							'serviceFeedback',
						] satisfies readonly (keyof typeof descriptors)[]) {
							const descriptor = descriptors[key];
							if (descriptor) Object.defineProperty(owner, key, descriptor);
							else Reflect.deleteProperty(owner, key);
						}
					}
				},
			);
			// END R31 inherited-primary recovery drafts
			// END R31 same-evaluation post-certificate publication drafts

			// BEGIN R40 genuine SQL absence lineage draft (UNRUN; synthetic installed evidence only)
			it('R40 joins the actual SQL-null claim and omitted installed generation through original managed OFF provenance', async () => {
				const originalView: OriginalFunctions<VirtualThermostatTransportService> =
					VirtualThermostatTransportService.prototype;
				const open = originalView.openRuntimeOffDispatchWork,
					delivery = originalView.captureRuntimeFeedbackDelivery;
				const openingDescriptor = Object.getOwnPropertyDescriptor(
						VirtualThermostatTransportService.prototype,
						'openRuntimeOffDispatchWork',
					),
					deliveryDescriptor = Object.getOwnPropertyDescriptor(
						VirtualThermostatTransportService.prototype,
						'captureRuntimeFeedbackDelivery',
					);
				const captures: {
					claim: VirtualThermostatActuatorClaimEntity;
					qualification: ThermostatInstalledQualification | null;
					work: RuntimeOffDispatchWork | null;
				}[] = [];
				const works: (RuntimeOffDispatchWork | RuntimeReconciliationWork)[] = [],
					eventsSeen: object[] = [];
				// Original functions/receivers/arguments/results retained; installed BEFORE legitimate runtime pins.
				const opening = jest
					.spyOn(VirtualThermostatTransportService.prototype, 'openRuntimeOffDispatchWork')
					.mockImplementation(function (
						this: VirtualThermostatTransportService,
						...args: Parameters<typeof open>
					): ReturnType<typeof open> {
						const work = open.call(this, ...args);
						captures.push({ claim: args[3], qualification: args[4], work });
						return work;
					});
				const delivering = jest
					.spyOn(VirtualThermostatTransportService.prototype, 'captureRuntimeFeedbackDelivery')
					.mockImplementation(function (
						this: VirtualThermostatTransportService,
						...args: Parameters<typeof delivery>
					): ReturnType<typeof delivery> {
						const work = delivery.call(this, ...args);
						if (work) works.push(work);
						return work;
					});
				const observe = (event: object): void => {
					if (values.captureOwnedFeedbackDelivery(event)) eventsSeen.push(event);
				};
				const installedOpeningDescriptor = Object.getOwnPropertyDescriptor(
					VirtualThermostatTransportService.prototype,
					'openRuntimeOffDispatchWork',
				);
				const installedDeliveryDescriptor = Object.getOwnPropertyDescriptor(
					VirtualThermostatTransportService.prototype,
					'captureRuntimeFeedbackDelivery',
				);
				const setupFixtures = realGuardFixtures,
					previousCompletionObservers = new Set(completionObserverBackstops),
					observedEvents = events;
				const ownedCompletionObservers: Readonly<{ retire: () => void; cleanup: () => void }>[] = [];
				let completion: ReturnType<typeof observeOriginalOffCompletion> | undefined;
				let activeStarted = false,
					bound = false;
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					try {
						completion = observeOriginalOffCompletion();
					} finally {
						// Capture ONLY this synchronous installation before active() can await or a later case can exist.
						for (const observer of completionObserverBackstops)
							if (!previousCompletionObservers.has(observer)) ownedCompletionObservers.push(observer);
					}
					activeStarted = true;
					await active();
					if (!fixture) throw new Error('Managed native fixture missing');
					completion.bind(runtime, fixture);
					bound = true;
					const stored = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
					expect(stored.qualificationGeneration).toBeNull();
					expect(
						await database.query(
							'SELECT "qualificationGeneration" FROM "devices_virtual_thermostat_actuator_claims" WHERE "id" = ?',
							[stored.id],
						),
					).toEqual([{ qualificationGeneration: null }]);
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
					await startWithCeiling(2, completion.boundary);
					expect(captures).toHaveLength(1);
					expect(captures[0].claim.id).toBe(stored.id);
					expect(captures[0].claim.qualificationGeneration).toBeNull();
					expect(captures[0].qualification).not.toBeNull();
					if (!captures[0].qualification) throw new Error('Original installed qualification missing');
					expect(Object.getOwnPropertyDescriptor(captures[0].qualification, 'qualificationGeneration')).toBeUndefined();
					expect(captures[0].qualification.qualificationGeneration).toBeUndefined();
					expect(captures[0].work).toBeInstanceOf(RuntimeOffDispatchWork);
					expect(works).toHaveLength(2);
					expect(works[0]).toBe(captures[0].work);
					expect(works[1]).toBeInstanceOf(RuntimeReconciliationWork);
					expect(works[0]).not.toBe(works[1]);
					expect(eventsSeen).toHaveLength(2);
					for (const event of eventsSeen) expect(values.captureOwnedFeedbackDelivery(event)).toBeNull();
					const commands = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
					expect(commands.some((command) => command.action === 'off' && command.status === 'confirmed')).toBe(true);
					expect(commands.filter((command) => command.action === 'off' && command.status !== 'confirmed')).toEqual([]);
					expect(fixture.controls.fences).toHaveLength(2);
					expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					// A partial active() failure has no bound helper owner. Never stop a later test's runtime.
					if (!bound && activeStarted && realGuardFixtures === setupFixtures) {
						try {
							runtime.onModuleDestroy();
						} catch (cause) {
							cleanup = { cause };
						}
					}
					try {
						completion?.cleanup(true);
					} catch (cause) {
						cleanup ??= { cause };
					}
					// Synchronous helper setup can install one wrapper before throwing/returning no helper.
					// Its existing backstop must restore that wrapper to our spy BEFORE our spy is restored.
					for (const observer of ownedCompletionObservers) {
						try {
							observer.cleanup();
						} catch (cause) {
							cleanup ??= { cause };
						}
					}
					try {
						observedEvents.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
					} catch (cause) {
						cleanup ??= { cause };
					}
					try {
						const current = Object.getOwnPropertyDescriptor(
							VirtualThermostatTransportService.prototype,
							'captureRuntimeFeedbackDelivery',
						);
						if (
							current?.value === delivering &&
							current?.value === installedDeliveryDescriptor?.value &&
							current?.get === installedDeliveryDescriptor?.get &&
							current?.set === installedDeliveryDescriptor?.set &&
							current?.configurable === installedDeliveryDescriptor?.configurable &&
							current?.enumerable === installedDeliveryDescriptor?.enumerable &&
							current?.writable === installedDeliveryDescriptor?.writable
						)
							delivering.mockRestore();
						else if (
							current?.value !== deliveryDescriptor?.value ||
							current?.get !== deliveryDescriptor?.get ||
							current?.set !== deliveryDescriptor?.set ||
							current?.configurable !== deliveryDescriptor?.configurable ||
							current?.enumerable !== deliveryDescriptor?.enumerable ||
							current?.writable !== deliveryDescriptor?.writable
						) {
							const cause = new Error(
								'Original R40 captureRuntimeFeedbackDelivery observation replaced by another owner',
							);
							cleanup ??= { cause };
						}
					} catch (cause) {
						cleanup ??= { cause };
					}
					try {
						const current = Object.getOwnPropertyDescriptor(
							VirtualThermostatTransportService.prototype,
							'openRuntimeOffDispatchWork',
						);
						if (
							current?.value === opening &&
							current?.value === installedOpeningDescriptor?.value &&
							current?.get === installedOpeningDescriptor?.get &&
							current?.set === installedOpeningDescriptor?.set &&
							current?.configurable === installedOpeningDescriptor?.configurable &&
							current?.enumerable === installedOpeningDescriptor?.enumerable &&
							current?.writable === installedOpeningDescriptor?.writable
						)
							opening.mockRestore();
						else if (
							current?.value !== openingDescriptor?.value ||
							current?.get !== openingDescriptor?.get ||
							current?.set !== openingDescriptor?.set ||
							current?.configurable !== openingDescriptor?.configurable ||
							current?.enumerable !== openingDescriptor?.enumerable ||
							current?.writable !== openingDescriptor?.writable
						) {
							const cause = new Error('Original R40 openRuntimeOffDispatchWork observation replaced by another owner');
							cleanup ??= { cause };
						}
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
			}, 30000);
			// END R40 genuine SQL absence lineage draft

			// BEGIN R40 original raw generation sticky negative (UNRUN)
			it('R40 keeps original SQL-null dispatch work closed after a live raw generation mutation and restoration', async () => {
				const originalView: OriginalFunctions<VirtualThermostatTransportService> =
					VirtualThermostatTransportService.prototype;
				const open = originalView.openRuntimeOffDispatchWork,
					delivery = originalView.captureRuntimeFeedbackDelivery;
				const captured: {
					claim?: VirtualThermostatActuatorClaimEntity;
					work?: RuntimeOffDispatchWork;
					generation?: string | null;
				} = {};
				const opening = jest
					.spyOn(VirtualThermostatTransportService.prototype, 'openRuntimeOffDispatchWork')
					.mockImplementation(function (
						this: VirtualThermostatTransportService,
						...args: Parameters<typeof open>
					): ReturnType<typeof open> {
						const work = open.call(this, ...args);
						if (work && captured.work === undefined) {
							captured.claim = args[3];
							captured.work = work;
							captured.generation = args[3].qualificationGeneration;
						}
						return work;
					});
				let selected = 0;
				const observations: {
					first?: ReturnType<typeof delivery>;
					restored?: ReturnType<typeof delivery>;
					liveBefore?: boolean;
					liveAfterFirst?: boolean;
					liveAfterRestore?: boolean;
					error?: { cause: unknown };
					stopError?: { cause: unknown };
				} = {};
				let restoreRaw: (() => void) | undefined, starting: Promise<void> | undefined;
				const mutate = (event: object): void => {
					if (
						selected !== 0 ||
						!captured.claim ||
						!captured.work ||
						!fixture ||
						!values.captureOwnedFeedbackDelivery(event)
					)
						return;
					selected++;
					const claim = captured.claim,
						generation = claim.qualificationGeneration;
					restoreRaw = (): void => {
						claim.qualificationGeneration = generation;
					};
					try {
						if (generation !== null) throw new Error('Original hydrated SQL-null generation required');
						observations.liveBefore = values.captureOwnedFeedbackDelivery(event) !== null;
						claim.qualificationGeneration = 'R40-observed-foreign-generation';
						// SAME genuine live PVS event, before the original consumer can mark the work delivered.
						observations.first = delivery.call(fixture.transport, event);
						observations.liveAfterFirst = values.captureOwnedFeedbackDelivery(event) !== null;
						restoreRaw();
						observations.restored = delivery.call(fixture.transport, event);
						observations.liveAfterRestore = values.captureOwnedFeedbackDelivery(event) !== null;
					} catch (cause) {
						observations.error = { cause };
					} finally {
						try {
							restoreRaw();
						} catch (cause) {
							observations.error ??= { cause };
						}
					}
				};
				const stop = (): void => {
					if (selected === 0) return;
					// This new negative stops AFTER the original runtime listener, not inside delivery or native admission.
					try {
						runtime.onModuleDestroy();
					} catch (cause) {
						observations.stopError ??= { cause };
					}
				};
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					await active();
					if (!fixture) throw new Error('Managed native fixture missing');
					events.prependListener(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, mutate);
					starting = runtime.onApplicationBootstrap(); // Original listener registers synchronously before its first await.
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, stop);
					await starting;
					await fixture.flushTelemetry();
					if (observations.error) throw observations.error.cause;
					if (observations.stopError) throw observations.stopError.cause;
					expect(captured.work).toBeInstanceOf(RuntimeOffDispatchWork);
					expect(captured.claim).toBeInstanceOf(VirtualThermostatActuatorClaimEntity);
					expect(captured.generation).toBeNull();
					expect(captured.claim?.qualificationGeneration).toBeNull();
					expect(selected).toBe(1);
					expect(observations.liveBefore).toBe(true);
					expect(observations.first).toBeNull();
					expect(observations.liveAfterFirst).toBe(true);
					expect(observations.restored).toBeNull();
					expect(observations.liveAfterRestore).toBe(true);
					expect(fixture.controls.fences).toHaveLength(1);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					try {
						restoreRaw?.();
					} catch (cause) {
						cleanup = { cause };
					}
					try {
						runtime.onModuleDestroy();
					} catch (cause) {
						cleanup ??= { cause };
					}
					try {
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, mutate);
					} catch (cause) {
						cleanup ??= { cause };
					}
					try {
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, stop);
					} catch (cause) {
						cleanup ??= { cause };
					}
					if (starting !== undefined) {
						try {
							await starting;
						} catch (cause) {
							cleanup ??= { cause };
						}
					}
					try {
						await fixture?.flushTelemetry();
					} catch (cause) {
						cleanup ??= { cause };
					}
					try {
						opening.mockRestore();
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
			}, 30000);
			// END R40 original raw generation sticky negative

			// BEGIN R37 genuine getter-chain provenance drafts (UNRUN)
			const r37ObjectMethods: Readonly<{
				getPrototypeOf: (owner: object) => object | null;
				create: (prototype: object | null) => object;
			}> = Object;
			it('R37 owns the unshadowed hydrated Shelly getter through genuine native OFF and retained release proof', async () => {
				const originalView: OriginalFunctions<VirtualThermostatTransportService> =
					VirtualThermostatTransportService.prototype;
				const original = originalView.openRuntimeOffDispatchWork;
				const openingDescriptor = Object.getOwnPropertyDescriptor(
					VirtualThermostatTransportService.prototype,
					'openRuntimeOffDispatchWork',
				);
				const devices: object[] = [],
					works: RuntimeOffDispatchWork[] = [];
				// Original callthrough installed before active() constructs the platform/transport and runtime pins.
				const opening = jest
					.spyOn(VirtualThermostatTransportService.prototype, 'openRuntimeOffDispatchWork')
					.mockImplementation(function (
						this: VirtualThermostatTransportService,
						...args: Parameters<typeof original>
					): ReturnType<typeof original> {
						const work = original.call(this, ...args);
						if (work) {
							devices.push(args[2].device);
							works.push(work);
						}
						return work;
					});
				const installedOpeningDescriptor = Object.getOwnPropertyDescriptor(
					VirtualThermostatTransportService.prototype,
					'openRuntimeOffDispatchWork',
				);
				const setupFixtures = realGuardFixtures,
					previousCompletionObservers = new Set(completionObserverBackstops);
				const ownedCompletionObservers: Readonly<{ retire: () => void; cleanup: () => void }>[] = [];
				let completion: ReturnType<typeof observeOriginalOffCompletion> | undefined;
				let activeStarted = false,
					bound = false;
				let primary: { cause: unknown } | undefined, cleanup: { cause: unknown } | undefined;
				try {
					try {
						completion = observeOriginalOffCompletion();
					} finally {
						// Capture ONLY this synchronous installation before active() can await or a later case can exist.
						for (const observer of completionObserverBackstops)
							if (!previousCompletionObservers.has(observer)) ownedCompletionObservers.push(observer);
					}
					activeStarted = true;
					await active();
					if (!fixture) throw new Error('Managed native fixture missing');
					completion.bind(runtime, fixture);
					bound = true;
					await startWithCeiling(2, completion.boundary);
					expect(devices).toHaveLength(1);
					expect(works[0]).toBeInstanceOf(RuntimeOffDispatchWork);
					expect(devices[0]).toBeInstanceOf(ShellyNgDeviceEntity);
					expect(r37ObjectMethods.getPrototypeOf(devices[0])).toBe(ShellyNgDeviceEntity.prototype);
					expect(Object.getOwnPropertyDescriptor(devices[0], 'type')).toBeUndefined();
					expect(fixture.controls.fences).toHaveLength(2);
					expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					// A partial active() failure has no bound helper owner. Never stop a later test's runtime.
					if (!bound && activeStarted && realGuardFixtures === setupFixtures) {
						try {
							runtime.onModuleDestroy();
						} catch (cause) {
							cleanup = { cause };
						}
					}
					try {
						completion?.cleanup(true);
					} catch (cause) {
						cleanup ??= { cause };
					}
					// Synchronous helper setup can install one wrapper before throwing/returning no helper.
					// Its existing backstop must restore that wrapper to our spy BEFORE our spy is restored.
					for (const observer of ownedCompletionObservers) {
						try {
							observer.cleanup();
						} catch (cause) {
							cleanup ??= { cause };
						}
					}
					try {
						const current = Object.getOwnPropertyDescriptor(
							VirtualThermostatTransportService.prototype,
							'openRuntimeOffDispatchWork',
						);
						if (
							current?.value === opening &&
							current?.value === installedOpeningDescriptor?.value &&
							current?.get === installedOpeningDescriptor?.get &&
							current?.set === installedOpeningDescriptor?.set &&
							current?.configurable === installedOpeningDescriptor?.configurable &&
							current?.enumerable === installedOpeningDescriptor?.enumerable &&
							current?.writable === installedOpeningDescriptor?.writable
						)
							opening.mockRestore();
						else if (
							current?.value !== openingDescriptor?.value ||
							current?.get !== openingDescriptor?.get ||
							current?.set !== openingDescriptor?.set ||
							current?.configurable !== openingDescriptor?.configurable ||
							current?.enumerable !== openingDescriptor?.enumerable ||
							current?.writable !== openingDescriptor?.writable
						) {
							const cause = new Error('Original R37 openRuntimeOffDispatchWork observation replaced by another owner');
							cleanup ??= { cause };
						}
					} catch (cause) {
						cleanup ??= { cause };
					}
				}
				if (primary) throw primary.cause;
				if (cleanup) throw cleanup.cause;
			}, 30000);

			it.each([
				'own-shadow',
				'nearer-getter',
				'canonical-getter',
				'canonical-setter',
				'canonical-flags',
				'chain-link',
			] satisfies readonly string[])(
				'R37 keeps original native dispatch provenance closed after observed %s restoration during its actual emit',
				async (change) => {
					const originalView: OriginalFunctions<VirtualThermostatTransportService> =
						VirtualThermostatTransportService.prototype;
					const original = originalView.openRuntimeOffDispatchWork;
					const captured: { device?: object; work?: RuntimeOffDispatchWork } = {};
					const opening = jest
						.spyOn(VirtualThermostatTransportService.prototype, 'openRuntimeOffDispatchWork')
						.mockImplementation(function (
							this: VirtualThermostatTransportService,
							...args: Parameters<typeof original>
						): ReturnType<typeof original> {
							const work = original.call(this, ...args);
							if (work && !captured.work) {
								captured.device = args[2].device;
								captured.work = work;
							}
							return work;
						});
					let selected = 0,
						getters = 0;
					const observations: {
						first?: RuntimeOffDispatchWork | RuntimeReconciliationWork | null;
						restored?: RuntimeOffDispatchWork | RuntimeReconciliationWork | null;
						error?: { cause: unknown };
						stopped?: { cause: unknown };
					} = {};
					let starting: Promise<void> | undefined;
					const canonical = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');
					if (!canonical) throw new Error('Original Shelly getter missing');
					let restoreDevice: (() => void) | undefined;
					const mutate = (event: object): void => {
						if (selected || !captured.device || !fixture || !values.captureOwnedFeedbackDelivery(event)) return;
						selected++;
						const device = captured.device,
							prototype: object | null = r37ObjectMethods.getPrototypeOf(device);
						const getter = (): string => {
							getters++;
							return 'devices-shelly-ng';
						};
						restoreDevice = () => {
							Reflect.deleteProperty(device, 'type');
							Object.setPrototypeOf(device, prototype);
							Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', canonical);
						};
						try {
							if (change === 'own-shadow')
								Object.defineProperty(device, 'type', { value: 'devices-shelly-ng', configurable: true });
							else if (change === 'nearer-getter' || change === 'chain-link') {
								const nearer: object = r37ObjectMethods.create(prototype);
								if (change === 'nearer-getter')
									Object.defineProperty(nearer, 'type', { get: getter, configurable: true });
								Object.setPrototypeOf(device, nearer);
							} else if (change === 'canonical-getter')
								Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, get: getter });
							else if (change === 'canonical-setter')
								Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, set: () => undefined });
							else
								Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', {
									...canonical,
									enumerable: !canonical.enumerable,
								});
							// Same actual PVS-owned event, still inside emit: both calls are original public delivery checks.
							observations.first = fixture.transport.captureRuntimeFeedbackDelivery(event);
							restoreDevice();
							observations.restored = fixture.transport.captureRuntimeFeedbackDelivery(event);
						} catch (cause) {
							observations.error = { cause };
						} finally {
							try {
								restoreDevice();
							} catch (cause) {
								observations.error ??= { cause };
							}
						}
					};
					const stop = (): void => {
						if (!selected) return;
						// Only this new negative test stops after the real sample; no completion/drain PASS is claimed.
						try {
							runtime.onModuleDestroy();
						} catch (cause) {
							observations.stopped = { cause };
						}
					};
					try {
						await active();
						if (!fixture) throw new Error('Managed native fixture missing');
						events.prependListener(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, mutate);
						starting = runtime.onApplicationBootstrap(); // Registers its original listener synchronously before its first await.
						events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, stop); // After the original listener, outside assertion callbacks.
						await starting;
						await fixture.flushTelemetry();
						if (observations.error) throw observations.error.cause;
						if (observations.stopped) throw observations.stopped.cause;
						expect(captured.work).toBeInstanceOf(RuntimeOffDispatchWork);
						expect(selected).toBe(1);
						expect(observations.first).toBeNull();
						expect(observations.restored).toBeNull();
						expect(getters).toBe(0);
						expect(fixture.controls.fences).toHaveLength(1);
						expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						restoreDevice?.();
						try {
							runtime.onModuleDestroy();
						} finally {
							events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, mutate);
							events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, stop);
							if (starting !== undefined) {
								try {
									await starting;
								} catch {
									/* Already recorded above; cleanup must settle it. */
								}
							}
							opening.mockRestore();
						}
					}
				},
				30000,
			);
			// END R37 genuine getter-chain provenance drafts

			// BEGIN R32 held-after-native-admission B-progress draft (UNRUN)
			it('R32 allows public ordinary B progress while original A is held after real sample admission and retires only A at completion', async () => {
				// R50 test-only stimulus isolation; S and detached A operation retain their original identities.
				let bodyFailure: { cause: unknown } | undefined,
					bootstrapFailure: { cause: unknown } | undefined,
					observerFailure: { cause: unknown } | undefined,
					observerCleanupFailure: { cause: unknown } | undefined;
				let pollBackstop: Readonly<{ retire: () => void; cleanup: () => void }> | undefined;
				try {
					const entered = gate(),
						release = gate();
					let armed = false,
						held = false,
						samplesSeen = 0,
						nativeAdmissionsReturned = 0;
					const originalPlatform: Readonly<{
						admitGuardFenceSample: OriginalFunction<
							ShellyNgDevicePlatform,
							ShellyNgDevicePlatform['admitGuardFenceSample']
						>;
					}> = ShellyNgDevicePlatform.prototype;
					const original: OriginalFunction<ShellyNgDevicePlatform, ShellyNgDevicePlatform['admitGuardFenceSample']> =
						originalPlatform.admitGuardFenceSample;
					// Installed before active() creates/registers the real platform and the transport pins its method.
					// This test-only async wrapper delays return; it does not preserve the original Promise identity.
					const admission = jest
						.spyOn(ShellyNgDevicePlatform.prototype, 'admitGuardFenceSample')
						.mockImplementation(async function (
							this: ShellyNgDevicePlatform,
							...args: Parameters<typeof original>
						): Promise<void> {
							await original.call(this, ...args);
							if (armed && !held) {
								nativeAdmissionsReturned++;
								held = true;
								entered.open();
								await release.promise;
							}
						});
					const sample = (event: object): void => {
						if (armed && values.captureOwnedFeedbackDelivery(event)) samplesSeen++;
					};
					let starting: Promise<void> | undefined;
					try {
						await active();
						if (!fixture) throw new Error('Managed native fixture missing');
						const owned = fixture,
							owner = runtime;
						const request = jest.spyOn(owner, 'request');
						events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						try {
							armed = true;
							starting = owner.onApplicationBootstrap();
							const originalLifecycle = owner['lifecycle'];
							let retired = false;
							// Native S reactions run before the next timer phase; no await inside this reaction.
							const stopped = starting.then(
								() => {
									try {
										if (
											retired ||
											originalLifecycle === undefined ||
											owner['lifecycle'] !== originalLifecycle ||
											!owner['active']
										)
											throw new Error('Original B bootstrap timer owner retired');
										const timer = owner['timer'];
										if (timer === undefined) throw new Error('Original B bootstrap native interval missing');
										clearInterval(timer); // Exact original owner handle; leave the stored field unchanged.
									} catch (cause) {
										observerFailure ??= { cause };
									}
								},
								(cause: unknown) => {
									bootstrapFailure ??= { cause };
								},
							);
							const retire = (): void => {
								retired = true;
							};
							const backstop = {
								retire,
								cleanup: (): void => {
									retire();
									completionObserverBackstops.delete(backstop);
								},
							};
							pollBackstop = backstop;
							completionObserverBackstops.add(backstop);
							await entered.promise;
							expect(nativeAdmissionsReturned).toBe(1);
							const heldAContext = owner['contexts'].get(controllerId),
								heldAEpisode = owner['feedbackEpisodes'].get(controllerId);
							if (!heldAContext || !heldAEpisode || heldAEpisode.context !== heldAContext)
								throw new Error('Original held A context and episode unavailable');
							expect(heldAEpisode.retired).toBe(false);
							expect(samplesSeen).toBe(1);
							expect(owned.controls.fences).toHaveLength(1);
							// The real admission has returned: no held native query/transaction/value commit is this gate.
							const originalA = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
								controllerId,
								action: 'off',
								status: 'dispatching',
							});
							const originalAOperation = owner['inFlight'].get(originalA.id);
							if (originalAOperation === undefined) throw new Error('Original held A operation unavailable');
							await starting;
							await stopped;
							if (observerFailure) throw observerFailure.cause;
							if (retired) throw new Error('Original B timer observation retired before public B');
							await owner.flush();
							expect(owner['contexts'].get(controllerId)).toBe(heldAContext);
							expect(owner['feedbackEpisodes'].get(controllerId)).toBe(heldAEpisode);
							expect(heldAEpisode.retired).toBe(false);
							const sequenceBeforeB = owner.readDiagnostics(controllerId)?.sequence ?? 0;
							// Public inspect creates a genuine ordinary request and waits for its actual evaluation, not A's send.
							const b = await owner.inspect(controllerId);
							expect(heldAEpisode.retired).toBe(true);
							const replacementContext = owner['contexts'].get(controllerId),
								replacementEpisode = owner['feedbackEpisodes'].get(controllerId);
							if (!replacementContext || !replacementEpisode) throw new Error('Public B replacement unavailable');
							expect(replacementContext).not.toBe(heldAContext);
							expect(replacementEpisode).not.toBe(heldAEpisode);
							expect(b?.configuration_revision).toBeGreaterThan(0);
							expect(b?.sequence).toBeGreaterThan(sequenceBeforeB);
							expect(b?.branches[0].release_proven).toBe(false);
							expect(held).toBe(true);
							expect(nativeAdmissionsReturned).toBe(1);
							expect(
								(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: originalA.id })).status,
							).toBe('dispatching');
							const requestsAtB = request.mock.calls.length;
							release.open();
							await originalAOperation;
							await starting;
							await owned.flushTelemetry();
							await owner.flush();
							expect(request.mock.calls.length).toBe(requestsAtB);
							expect(owner.readDiagnostics(controllerId)?.sequence).toBe(b?.sequence);
							expect(owner.readDiagnostics(controllerId)?.configuration_revision).toBe(b?.configuration_revision);
							expect(owner.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
							const lateA = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
								id: originalA.id,
							});
							expect(['accepted', 'unknown']).toContain(lateA.status);
							expect(lateA.settledAt).not.toBeNull();
							expect(lateA.proofId).toBeNull();
							expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
						} catch (cause) {
							bodyFailure ??= { cause };
							throw cause;
						} finally {
							try {
								owner.onModuleDestroy();
							} finally {
								release.open();
								try {
									if (starting !== undefined) await starting;
								} finally {
									events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
									request.mockRestore();
								}
							}
						}
					} catch (cause) {
						bodyFailure ??= { cause };
						throw cause;
					} finally {
						release.open();
						admission.mockRestore();
					}
				} catch (cause) {
					bodyFailure ??= { cause };
				} finally {
					try {
						pollBackstop?.cleanup();
					} catch (cause) {
						observerCleanupFailure = { cause };
					}
				}
				if (bodyFailure) throw bodyFailure.cause;
				if (bootstrapFailure) throw bootstrapFailure.cause;
				if (observerFailure) throw observerFailure.cause;
				if (observerCleanupFailure) throw observerCleanupFailure.cause;
			}, 30000);
			// END R32 held-after-native-admission B-progress draft

			// BEGIN R31 actual managed OFF-work/completion drafts (UNRUN)
			it('R31 joins only the original detached OFF operation while its actual outcome SAVE is held and schedules one ticket', async () => {
				await active();
				if (!fixture) throw new Error('Managed native fixture missing');
				const completion = observeR53OffTerminal();
				completion.bind(runtime, fixture);
				const owned = fixture,
					entered = gate(),
					release = gate();
				const caseEvents = events,
					caseDatabase = database,
					caseValues = values;
				let bodyFailure: { cause: unknown } | undefined;
				let holds = 0,
					samplesSeen = 0;
				const served: object[] = [];
				const originalService: OriginalFunction<VirtualThermostatRuntimeService, (typeof runtime)['serviceFeedback']> =
					runtime['serviceFeedback'];
				const owner = runtime,
					serviceDescriptor = Object.getOwnPropertyDescriptor(owner, 'serviceFeedback');
				Object.defineProperty(owner, 'serviceFeedback', {
					configurable: true,
					writable: true,
					value: (child: Parameters<typeof originalService>[0]): ReturnType<typeof originalService> => {
						if (child.purpose === 'GUARDED_OFF_DISPATCH') served.push(child);
						return originalService.call(owner, child);
					},
				});
				const serviceInstalled = Object.getOwnPropertyDescriptor(owner, 'serviceFeedback');
				if (!serviceInstalled) throw new Error('Original service observer not installed');
				const sample = (event: object): void => {
					if (caseValues.captureOwnedFeedbackDelivery(event)) samplesSeen++;
				};
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
						if (
							!holds &&
							event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
							event.parameters?.includes('accepted')
						) {
							holds++;
							entered.open();
							return release.promise;
						}
					},
				};
				completion.observeCleanup(() => {
					let failure: { cause: unknown } | undefined;
					try {
						caseEvents.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					} catch (cause) {
						failure = { cause };
					}
					try {
						const index = caseDatabase.subscribers.indexOf(observer);
						if (index >= 0) caseDatabase.subscribers.splice(index, 1);
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						restoreOriginalEntry(owner, 'serviceFeedback', serviceInstalled, serviceDescriptor);
					} catch (cause) {
						failure ??= { cause };
					}
					if (failure) throw failure.cause;
				});
				caseEvents.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
				caseDatabase.subscribers.push(observer);
				const starting = startR53WithCeiling(2, completion.boundary);
				try {
					await entered.promise;
					expect(samplesSeen).toBe(1);
					expect(owned.controls.fences).toHaveLength(1);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					release.open();
					const receipt = await starting;
					expect(holds).toBe(1);
					expect(served).toHaveLength(1);
					expect(owned.controls.fences).toHaveLength(2);
					expect(
						(
							await database.manager.find(VirtualThermostatCommandEntity, { where: { controllerId, action: 'off' } })
						).every((row) => row.status === 'confirmed'),
					).toBe(true);
					expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
					expect(receipt.operation).toEqual({ fulfilled: true });
					expect(receipt.service).toEqual({ fulfilled: true });
					expect(receipt.terminal && receipt.outputSaved).toBe(true);
				} catch (cause) {
					bodyFailure = { cause };
				} finally {
					release.open();
					try {
						await starting;
					} catch (cause) {
						bodyFailure ??= { cause };
					}
					// Exact captured listeners/descriptors retire via the owner backstop before framework restoration.
				}
				if (bodyFailure) throw bodyFailure.cause;
			});

			it('R31 routes the original accepted A payload ordinarily after genuine same-controller B replacement and after-emit closure', async () => {
				await active();
				if (!fixture) throw new Error('Managed fixture missing');
				const completion = observeR53OffTerminal();
				completion.bind(runtime, fixture);
				const owner = runtime,
					caseEvents = events,
					caseValues = values,
					ownedFixture = fixture;
				const payloads: object[] = [];
				const observed = (event: object): void => {
					if (caseValues.captureOwnedFeedbackDelivery(event)) payloads.push(event);
				};
				const requestMethods: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'request'>> = owner;
				const originalRequest = requestMethods.request;
				const requestBefore = Object.getOwnPropertyDescriptor(owner, 'request');
				const request = jest.fn<ReturnType<typeof originalRequest>, Parameters<typeof originalRequest>>((...args) =>
					originalRequest.call(owner, ...args),
				);
				const requestInstalled = {
					configurable: true,
					enumerable: requestBefore?.enumerable ?? true,
					writable: true,
					value: request,
				};
				Object.defineProperty(owner, 'request', requestInstalled);
				completion.observeCleanup(() => {
					let failure: { cause: unknown } | undefined;
					try {
						caseEvents.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observed);
					} catch (cause) {
						failure = { cause };
					}
					try {
						restoreOriginalEntry(owner, 'request', requestInstalled, requestBefore);
					} catch (cause) {
						failure ??= { cause };
					}
					if (failure) throw failure.cause;
				});
				caseEvents.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observed);
				try {
					const receipt = await startR53WithCeiling(2, completion.boundary);
					expect(payloads).toHaveLength(2);
					const originalA = payloads[0];
					expect(caseValues.captureOwnedFeedbackDelivery(originalA)).toBeNull();
					owner.request(controllerId, false); // genuine ordinary B, not an adopted A context
					await owner.flush();
					completion.boundary.assertOpen();
					const before = request.mock.calls.length;
					// Delayed/replayed original native A payload, not a new accepted sample or manufactured origin.
					caseEvents.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, originalA);
					expect(request.mock.calls.length).toBe(before + 1);
					expect(request.mock.calls[before][0]).toBe(controllerId);
					await owner.flush();
					completion.boundary.assertOpen();
					expect(caseValues.captureOwnedFeedbackDelivery(originalA)).toBeNull();
					expect(ownedFixture.controls.sends.filter((send) => send.on)).toEqual([]);
					expect(receipt.operation).toEqual({ fulfilled: true });
					expect(receipt.service).toEqual({ fulfilled: true });
				} finally {
					// Captured DATA observers restore only after original owner retirement in the backstop.
				}
			});

			it('R31 keeps a retired original held OFF completion from requesting or closing the installed B decision', async () => {
				await active();
				if (!fixture) throw new Error('Managed fixture missing');
				const owned = fixture,
					owner = runtime,
					entered = gate(),
					release = gate();
				let calls = 0;
				owned.controls.beforeFence = () => {
					if (++calls === 1) {
						entered.open();
						return release.promise;
					}
					return Promise.resolve();
				};
				const request = jest.spyOn(owner, 'request');
				const starting = owner.onApplicationBootstrap();
				try {
					await entered.promise;
					owner.request(controllerId, false);
					await owner.flush();
					const b = owner.readDiagnostics(controllerId),
						before = request.mock.calls.length;
					expect(b?.configuration_revision).toBeGreaterThan(0);
					expect(b?.branches[0].release_proven).toBe(false);
					release.open();
					await starting;
					await owned.flushTelemetry();
					await owner.flush();
					expect(request.mock.calls.length).toBe(before);
					expect(owner.readDiagnostics(controllerId)?.configuration_revision).toBe(b?.configuration_revision);
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					const late = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
						controllerId,
						action: 'off',
					});
					expect(['accepted', 'unknown', 'cancelled']).toContain(late.status);
					expect(late.proofId).toBeNull();
				} finally {
					owner.onModuleDestroy();
					release.open();
					owned.controls.beforeFence = null;
					await starting;
					request.mockRestore();
				}
			});

			it.each(['packet-clone', 'send-replaced', 'claim-replaced', 'guard-replaced'] satisfies readonly string[])(
				'R31 leaves actual native false delivery unowned for %s without minting a replacement work',
				async (kind) => {
					await active();
					if (!fixture) throw new Error('Managed fixture missing');
					const owned = fixture,
						reported = gate();
					const originals: OriginalFunctions<Pick<VirtualThermostatTransportService, 'openRuntimeOffDispatchWork'>> =
						owned.transport;
					const open = originals.openRuntimeOffDispatchWork;
					let admitted = 0,
						tagged = 0,
						observed = 0;
					const restores: (() => void)[] = [];
					const opening = jest.spyOn(owned.transport, 'openRuntimeOffDispatchWork').mockImplementation((...args) => {
						const work = open.call(
							owned.transport,
							args[0],
							args[1],
							args[2],
							kind === 'claim-replaced' ? { ...args[3] } : args[3],
							args[4],
							kind === 'guard-replaced' ? () => args[5]() : args[5],
							kind === 'packet-clone' ? Object.freeze({ ...args[6] }) : args[6],
						);
						if (work && admitted++ === 0 && kind === 'send-replaced') {
							const adapter = args[1],
								original: OriginalFunctions<ThermostatActuationAdapter> = adapter,
								send = original.send;
							adapter.send = (...sendArgs) => send.call(adapter, ...sendArgs);
							restores.push(() => {
								adapter.send = send;
							});
						}
						return work;
					});
					const sample = (event: object): void => {
						observed++;
						if (values.captureOwnedFeedbackDelivery(event)) tagged++;
						reported.open();
					};
					events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
					const starting = runtime.onApplicationBootstrap();
					try {
						await reported.promise;
						expect(admitted).toBeGreaterThan(0);
						expect(observed).toBeGreaterThan(0);
						expect(tagged).toBe(0);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						runtime.onModuleDestroy();
						owned.revoke();
						await starting;
						events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, sample);
						for (const restore of restores) restore();
						opening.mockRestore();
					}
				},
			);
			it('R31 keeps a real failed outcome SAVE out of OFF_REPORTED without discarding native history', async () => {
				await active();
				if (!fixture) throw new Error('Managed fixture missing');
				const completion = observeR53OffTerminal();
				completion.bind(runtime, fixture);
				const caseDatabase = database;
				const primary = new Error('R31 native accepted-outcome SAVE P'),
					owned = fixture;
				let faults = 0;
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (
							!faults &&
							event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
							event.parameters?.includes('accepted')
						) {
							faults++;
							throw primary;
						}
					},
				};
				caseDatabase.subscribers.push(observer);
				try {
					const receipt = await startR53WithCeiling(3, completion.boundary);
					expect(faults).toBe(1);
					const commands = await database.manager.find(VirtualThermostatCommandEntity, {
						where: { controllerId, action: 'off' },
					});
					expect(commands.length).toBeGreaterThan(0);
					for (const command of commands) {
						expect(['unknown', 'confirmed']).toContain(command.status);
						if (command.status === 'confirmed') expect(command.proofId).not.toBeNull();
					}
					expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					expect(receipt.failure).toEqual({ cause: primary });
					expect(receipt.childState).not.toBe('OFF_REPORTED');
					if (!receipt.operation.fulfilled) expect(receipt.operation.cause).toBe(primary);
					if (!receipt.service.fulfilled) expect(receipt.service.cause).toBe(primary);
				} finally {
					const index = caseDatabase.subscribers.indexOf(observer);
					if (index >= 0) caseDatabase.subscribers.splice(index, 1);
				}
			});

			it('R31 never tags actual ON telemetry as OFF work and keeps manual producer-state notification ordinary', async () => {
				await active();
				if (!fixture) throw new Error('Managed fixture missing');
				const owned = fixture,
					owner = runtime,
					entered = gate();
				const dispatch: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['dispatch']> =
					owner['dispatch'];
				const descriptor = Object.getOwnPropertyDescriptor(owner, 'dispatch');
				const operations: { action: string; pending: ReturnType<typeof dispatch> }[] = [];
				Object.defineProperty(owner, 'dispatch', {
					configurable: true,
					writable: true,
					value: (...args: Parameters<typeof dispatch>): ReturnType<typeof dispatch> => {
						const pending = dispatch.call(owner, ...args);
						operations.push({ action: args[3].action, pending });
						return pending;
					},
				});
				const request = jest.spyOn(owner, 'request');
				await startWithCeiling(2);
				owned.controls.beforeOn = () => {
					entered.open();
					return Promise.resolve();
				};
				let actualOnReports = 0;
				const wrong: object[] = [];
				const observe = (event: Readonly<{ sample: QualifiedPropertySample }>): void => {
					if (event.sample.value === true) {
						actualOnReports++;
						if (values.captureOwnedFeedbackDelivery(event)) wrong.push(event);
					}
				};
				events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
				try {
					await owned.report(sensorId, 10);
					await entered.promise;
					const on = operations.find((entry) => entry.action === 'on');
					expect(on).toBeDefined();
					if (!on) throw new Error('Genuine original ON operation not entered');
					await on.pending;
					await owned.flushTelemetry();
					await runtime.flush();
					expect(owned.controls.sends.filter((send) => send.on).length).toBeGreaterThan(0);
					expect(actualOnReports).toBeGreaterThan(0);
					expect(wrong).toEqual([]);
					const before = request.mock.calls.length;
					events.emit(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, { id: sensorId });
					expect(request.mock.calls.length).toBe(before + 1);
					const original = actualClaims.capture();
					runtime.request(controllerId, false);
					await runtime.flush();
					expect(original.isCurrent()).toBe(false);
				} finally {
					owner.onModuleDestroy();
					owned.controls.beforeOn = null;
					events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
					request.mockRestore();
					if (descriptor) Object.defineProperty(owner, 'dispatch', descriptor);
					else Reflect.deleteProperty(owner, 'dispatch');
				}
			});
			it.each(['claims', 'native-registration', 'destroy'] satisfies readonly string[])(
				'R31 closes the genuine original dispatch origin on actual %s loss before its native readback',
				async (kind) => {
					await active();
					if (!fixture) throw new Error('Actual managed fixture missing');
					const owned = fixture;
					let losses = 0;
					const opened: RuntimeOffDispatchWork[] = [],
						delivered: (RuntimeOffDispatchWork | RuntimeReconciliationWork)[] = [];
					const original: OriginalFunctions<
						Pick<VirtualThermostatTransportService, 'openRuntimeOffDispatchWork' | 'captureRuntimeFeedbackDelivery'>
					> = owned.transport;
					const open = original.openRuntimeOffDispatchWork,
						capture = original.captureRuntimeFeedbackDelivery;
					const opening = jest.spyOn(owned.transport, 'openRuntimeOffDispatchWork').mockImplementation((...args) => {
						const work = open.call(owned.transport, ...args);
						if (work) opened.push(work);
						return work;
					});
					const delivery = jest.spyOn(owned.transport, 'captureRuntimeFeedbackDelivery').mockImplementation((event) => {
						const work = capture.call(owned.transport, event);
						if (work) delivered.push(work);
						return work;
					});
					owned.controls.beforeFence = () => {
						if (losses++ === 0) {
							if (kind === 'claims') actualClaims.invalidate();
							else if (kind === 'native-registration') owned.revoke();
							else runtime.onModuleDestroy();
						}
						return Promise.resolve();
					};
					try {
						await runtime.onApplicationBootstrap();
						await owned.flushTelemetry();
						await runtime.flush();
						expect(losses).toBeGreaterThan(0);
						expect(opened.length).toBeGreaterThan(0);
						expect(delivered).not.toContain(opened[0]);
						expect(owned.controls.sends.filter((send) => send.on)).toEqual([]);
					} finally {
						runtime.onModuleDestroy();
						owned.controls.beforeFence = null;
						opening.mockRestore();
						delivery.mockRestore();
					}
				},
			);
			// END R31 actual managed OFF-work/completion drafts
			// END R23 original initial publication P observation drafts
		});
		// END R21 additive managed native feedback/debt drafts
	});
	// END R14 drain-certificate lifetime drafts
	// BEGIN real claims comfort pending-ON regressions (SOURCE-ONLY drafts; synthetic qualification, no installed authority)
	describe('comfort entry with actual claims/runtime and original managed SDK send guards', () => {
		let actualClaims: VirtualThermostatClaimsService;
		let actualStructure: DeviceStructureLockService;
		let actualGraph: VirtualDependencyGraphService;
		let fixture: Awaited<ReturnType<typeof realThermostatGuardFixture>>;
		const barrier = () => {
			let open: () => void = () => {
				throw new Error('Barrier not initialized');
			};
			const promise = new Promise<void>((resolve) => {
				open = resolve;
			});
			return { promise, open: () => open() };
		};
		beforeEach(async () => {
			runtime.onModuleDestroy(); // close the legacy stand-in runtime; it is NOT the admission proof
			actualStructure = new DeviceStructureLockService();
			mutationProvider.onModuleDestroy();
			comfort.onModuleDestroy();
			mutationClaims.onModuleDestroy();
			mutationRegistry.onModuleDestroy();
			mutationRegistry = new ClimateAutomationRegistryService();
			mutationWriter = new ClimateAutomationWriterService(
				database,
				actualStructure,
				mutationRegistry,
				new ConfigService({ FB_CLI: 'off' }),
			);
			actualGraph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), mutationWriter);
			await actualGraph.onApplicationBootstrap();
			actualClaims = new VirtualThermostatClaimsService(
				database,
				actualStructure,
				actualGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
				new ConfigService({ FB_CLI: 'off' }),
			);
			await actualClaims.onApplicationBootstrap();
			fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, 'managed', {
				values: mutationValues,
				sources: mutationPipeline.get(PropertyValueSourceRegistryService),
			});
			realGuardFixtures.push(fixture);
			// Reuse ONLY the helper's existing explicitly synthetic qualification boundary. No new fields or private map forcing.
			for (const evidence of installedQualifications.values()) actualClaims.recordQualification(evidence);
			values = fixture.values;
			comfort = new VirtualThermostatComfortService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				mutationWriter,
			);
			configs = new VirtualThermostatConfigService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				values,
				undefined,
				mutationWriter,
			);
			mutationProvider = new VirtualThermostatAutomationService(
				mutationWriter,
				mutationRegistry,
				actualGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				configs,
				comfort,
			);
			mutationProvider.onModuleInit();
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.configure(
				controllerId,
				{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
				{
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				},
			);
			for (const [id, sample] of samples) {
				if (typeof sample.value !== 'number' && typeof sample.value !== 'boolean')
					throw new Error('Unexpected synthetic sample');
				await fixture.report(id, sample.value);
			}
			await actualClaims.refresh();
			runtime = new VirtualThermostatRuntimeService(
				database,
				actualStructure,
				actualClaims,
				new VirtualThermostatInputsService(database, values),
				fixture.transport,
				values,
				producers,
				events,
				actualGraph,
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
			await runtime.onApplicationBootstrap();
			await settleReal(fixture);
			expect(actualClaims.capture().isCurrent()).toBe(true);
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
			expect(fixture.controls.sends).toEqual([]); // initial ambient21 vs manual20, before the positive ON trigger
		});
		afterEach(() => {
			// Synchronous source/core revocation before outer teardown awaits or restores SDK/HTTP mocks.
			runtime.onModuleDestroy();
			actualClaims?.onModuleDestroy();
			fixture?.revoke();
		});

		// BEGIN original native proof/clock integration drafts (UNRUN; existing synthetic installation boundary only)
		it('keeps counter-only effects claims-neutral and the original joined override time current without minting send authority', async () => {
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.override(
				controllerId,
				{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'original-clock-proof',
			);
			await settleReal(fixture);
			await actualClaims.refresh();
			const active = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }),
				intent = await comfort.readIntentInManager(database.manager, active);
			const original = actualClaims.capture();
			try {
				expect(intent.isOverrideCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(true);
				await database.query('UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1');
				expect(original.isCurrent()).toBe(true);
				expect(intent.isOverrideCurrent()).toBe(true);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			} finally {
				intent.close();
			}
		});
		it.each(['clean', 'qualification-loss'] satisfies readonly ('clean' | 'qualification-loss')[])(
			'uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:%s',
			async (mode) => {
				let actualQualifiedUpdates = 0;
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
						if (
							!event.query.startsWith('UPDATE "devices_virtual_thermostat_actuator_claims"') ||
							!event.query.includes('releaseEvidence')
						)
							return;
						actualQualifiedUpdates++;
						if (mode === 'qualification-loss') actualClaims.revokeAllQualifications();
					},
				};
				database.subscribers.push(observer);
				try {
					const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					await configs.requestRelease(controllerId, before.revision);
					await settleReal(fixture);
					const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
					expect(actualQualifiedUpdates).toBeGreaterThan(0);
					expect(claim.state).toBe(mode === 'clean' ? 'released' : 'releasing');
					if (mode === 'clean')
						expect(claim.releaseEvidence).toMatchObject({ outputConfirmedOff: true, pendingOnDrained: true });
					else expect(claim.releaseEvidence).toBeNull();
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
			},
		);
		// END original native proof/clock integration drafts

		// BEGIN closed runtime bookkeeping and persistent TIME drafts (UNRUN; real native DB, synthetic installation boundary)
		const makeActualRuntime = (transport = fixture.transport) =>
			new VirtualThermostatRuntimeService(
				database,
				actualStructure,
				actualClaims,
				new VirtualThermostatInputsService(database, values),
				transport,
				values,
				producers,
				events,
				actualGraph,
				comfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
		const useSharedNativePipeline = async (): Promise<TestingModule> => {
			runtime.onModuleDestroy();
			fixture.revoke();
			await fixture.close();
			const pipeline = await Test.createTestingModule({
				providers: [
					PropertyValueService,
					PropertyValueLockService,
					PropertyValueSourceRegistryService,
					StorageService,
					{ provide: PropertyProducerRegistryService, useValue: producers },
					{ provide: DataSource, useValue: database },
					{ provide: EventEmitter2, useValue: events },
					{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }) },
					{
						provide: ModuleConfigService,
						useValue: {
							getModuleConfig: () =>
								Object.assign(new StorageConfigModel(), { primaryStorage: 'owned-bookkeeping-native' }),
						},
					},
				],
			}).compile();
			const storage = pipeline.get(StorageService);
			const backend: StoragePlugin = {
				name: 'owned-bookkeeping-native',
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
			storage.registerPlugin(backend.name, backend);
			values = pipeline.get(PropertyValueService);
			fixture = await realThermostatGuardFixture(database, events, producers, installedQualifications, 'managed', {
				values,
				sources: pipeline.get(PropertyValueSourceRegistryService),
			});
			realGuardFixtures.push(fixture);
			for (const evidence of installedQualifications.values()) actualClaims.recordQualification(evidence);
			mutationProvider.onModuleDestroy();
			comfort.onModuleDestroy();
			comfort = new VirtualThermostatComfortService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				mutationWriter,
			);
			configs = new VirtualThermostatConfigService(
				database,
				actualStructure,
				actualGraph,
				actualClaims,
				events,
				values,
				undefined,
				mutationWriter,
			);
			mutationProvider = new VirtualThermostatAutomationService(
				mutationWriter,
				mutationRegistry,
				actualGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				configs,
				comfort,
			);
			mutationProvider.onModuleInit();
			for (const [id, sample] of samples)
				if (typeof sample.value === 'number' || typeof sample.value === 'boolean')
					await fixture.report(id, sample.value);
			return pipeline;
		};
		it('keeps actual state, branch/noop, command journal and enabled derived lock writes command-current through managed ON', async () => {
			await createTemperatureOutput();
			await actualGraph.refreshQuarantine();
			const pipeline = await useSharedNativePipeline();
			const writes: string[] = [];
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
					if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) writes.push(event.query);
				},
			};
			database.subscribers.push(observer);
			try {
				runtime = makeActualRuntime();
				await runtime.onApplicationBootstrap();
				await settleReal(fixture);
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
					{
						preset: null,
						setpoints: { heating_setpoint: 23, cooling_setpoint: null },
						expires_at: new Date(Date.now() + 30_000).toISOString(),
					},
					'bookkeeping',
				);
				await settleReal(fixture);
				expect(fixture.values).toBe(values);
				expect(fixture.controls.sends.some((send) => send.property === relayId && send.on)).toBe(true);
				expect(actualClaims.capture().isCurrent()).toBe(true);
				expect(
					writes.some((query) => query.startsWith('INSERT INTO "devices_virtual_thermostat_command_journal"')),
				).toBe(true);
				expect(writes.some((query) => query.startsWith('UPDATE "devices_virtual_thermostat_runtime"'))).toBe(true);
				expect(writes.some((query) => query.startsWith('INSERT INTO "devices_module_property_value_locks"'))).toBe(
					true,
				);
				expect(writes.some((query) => query.startsWith('DELETE FROM "devices_module_property_value_locks"'))).toBe(
					true,
				);
				runtime.request(controllerId, false);
				await settleReal(fixture);
				expect(actualClaims.capture().isCurrent()).toBe(true);
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				await fixture.close();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				await pipeline.close();
			}
		});
		it('rejects identical native journal SQL and ALL bindings from an actual same-runner subscriber without borrowing its enclosing ORM effect', async () => {
			const entered = barrier(),
				resume = barrier();
			let armed = true,
				nested: Promise<unknown> | undefined,
				originalCapture: ReturnType<VirtualThermostatClaimsService['capture']> | undefined;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
					if (
						!armed ||
						!event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') ||
						!event.query.includes('dispatchedAt')
					)
						return;
					armed = false;
					originalCapture = actualClaims.capture();
					const preciseEventView1: Readonly<{ parameters?: readonly unknown[] }> = event;
					nested = event.queryRunner.query(event.query, [...(preciseEventView1.parameters ?? [])]);
					void nested.catch(() => undefined);
					entered.open();
				},
			};
			database.subscribers.push(observer);
			fixture.controls.beforeOn = async () => {
				await resume.promise;
			};
			try {
				await fixture.report(sensorId, 18);
				await entered.promise;
				await nested;
				expect(originalCapture?.isCurrent()).toBe(false);
				resume.open();
				await settleReal(fixture);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
				expect(journal.length).toBeGreaterThan(0);
				expect(journal.every((row) => row.status === 'cancelled')).toBe(true);
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				resume.open();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				await nested?.catch(() => undefined);
			}
		});
		it.each(['same-value', 'restore', 'slot'] satisfies readonly ('same-value' | 'restore' | 'slot')[])(
			'keeps an original time owner closed after relevant native %s and same-lifetime rejoin',
			async (mode) => {
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
					'no-clock-revival',
				);
				await settleReal(fixture);
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const original = await comfort.readIntentInManager(database.manager, row);
				try {
					expect(original.isOverrideCurrent()).toBe(true);
					if (mode === 'slot')
						await database.query(
							'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" WHERE "controllerId" = ?',
							[controllerId],
						);
					else {
						await database.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
							[mode === 'restore' ? 1 : Number(row.locked), controllerId],
						);
						if (mode === 'restore')
							await database.query(
								'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
								[Number(row.locked), controllerId],
							);
					}
					expect(original.isOverrideCurrent()).toBe(false);
					const fresh = await comfort.readIntentInManager(
						database.manager,
						await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }),
					);
					try {
						expect(fresh.isOverrideCurrent()).toBe(false);
					} finally {
						fresh.close();
					}
				} finally {
					original.close();
				}
			},
		);
		it('refreshes genuine claims after recovery TX AND original structure release, and cleans a failed original bootstrap before same-instance restart', async () => {
			runtime.onModuleDestroy();
			const original: Readonly<{ refresh: { call: (receiver: VirtualThermostatClaimsService) => Promise<void> } }> =
				actualClaims;
			const refresh = original.refresh,
				trace: string[] = [],
				failure = new Error('original recovery subscriber');
			let fail = true;
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
					if (
						!/^UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = \?, "releaseAttempts" = 0, "nextReleaseAt" = \?$/.test(
							event.query,
						) ||
						event.parameters?.length !== 2 ||
						event.parameters[0] !== 'unknown' ||
						event.parameters[1] !== null
					)
						return;
					trace.push('recovery');
					if (fail) {
						fail = false;
						throw failure;
					}
				},
			};
			database.subscribers.push(observer);
			const spy = jest.spyOn(actualClaims, 'refresh').mockImplementation(() => {
				expect(actualStructure.hasCurrentStructuralLease()).toBe(false);
				trace.push('released-refresh');
				return refresh.call(actualClaims);
			});
			runtime = makeActualRuntime();
			try {
				await expect(runtime.onApplicationBootstrap()).rejects.toBe(failure);
				expect(trace).toEqual(['recovery']);
				await runtime.onApplicationBootstrap();
				await settleReal(fixture);
				expect(trace.indexOf('released-refresh')).toBeGreaterThan(trace.lastIndexOf('recovery'));
				expect(actualClaims.capture().isCurrent()).toBe(true);
				const a = runtime;
				a.onModuleDestroy();
				runtime = makeActualRuntime();
				await runtime.onApplicationBootstrap();
				await settleReal(fixture);
				const b = actualClaims.capture();
				expect(b.isCurrent()).toBe(true);
				a.onModuleDestroy();
				expect(b.isCurrent()).toBe(true);
			} finally {
				runtime.onModuleDestroy();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				spy.mockRestore();
			}
		});
		it('preserves only C original remaining TIME across D complete requestRelease, native slot/config effects, qualified drain and new graph generation', async () => {
			runtime.onModuleDestroy();
			const d = uuid(),
				relayDevice = database.manager.create(ShellyNgDeviceEntity, {
					id: uuid(),
					name: 'D physical',
					identifier: 'shellyplus1pm-a8032abe5085',
					canonicalMac: 'A8032ABE5085',
					category: DeviceCategory.SWITCHER,
					enabled: true,
				});
			const device = database.manager.create(VirtualDeviceEntity, {
				id: d,
				name: 'D controller',
				mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
				category: DeviceCategory.THERMOSTAT,
				enabled: true,
			});
			const channel = database.manager.create(ShellyNgChannelEntity, {
				id: uuid(),
				device: relayDevice,
				name: 'D switch',
				identifier: 'switch:0',
				category: ChannelCategory.SWITCHER,
			});
			const property = database.manager.create(ShellyNgChannelPropertyEntity, {
				id: uuid(),
				channel,
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			});
			await database.manager.insert(VirtualDeviceEntity, device);
			await database.manager.insert(ShellyNgDeviceEntity, relayDevice);
			await database.manager.insert(ShellyNgChannelEntity, channel);
			await database.manager.insert(ShellyNgChannelPropertyEntity, property);
			const c = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			// Actual configure bootstrap for an existing catalog controller, not a fabricated releasing claim/slot.
			await configs.configure(
				d,
				Object.assign(new ConfigureVirtualThermostatDto(), {
					schemaVersion: 1,
					expectedRevision: 0,
					expectedGraphRevision: await actualGraph.revision(),
					requestedMode: 'heat',
					policy: structuredClone(c.policy),
					heuristic: null,
					contactOpeningMs: 0,
					contactClosingMs: 0,
					sources: [{ role: 'ambient', sourcePropertyId: sensorId, maximumAgeSeconds: 300 }],
					actuators: [{ role: 'heating', sourcePropertyId: property.id, leaseSeconds: 30 }],
					settings: [],
				}),
			);
			const pipeline = await useSharedNativePipeline();
			let mono = performance.now();
			const initialMono = mono;
			const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
			const onEntered = barrier(),
				onResume = barrier();
			const effects: string[] = [];
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
					if (/^(UPDATE|INSERT|DELETE) /.test(event.query)) effects.push(event.query);
				},
			};
			database.subscribers.push(observer);
			try {
				runtime = makeActualRuntime();
				await runtime.onApplicationBootstrap();
				await settleReal(fixture);
				fixture.controls.beforeOn = async (id) => {
					if (id === relayId) {
						onEntered.open();
						await onResume.promise;
					}
				};
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
					{
						preset: null,
						setpoints: { heating_setpoint: 23, cooling_setpoint: null },
						expires_at: new Date(Date.now() + 30_000).toISOString(),
					},
					'C-original-budget',
				);
				await onEntered.promise;
				const originalClaims = actualClaims.capture(),
					originalGraph = actualGraph.capturePublishGuard();
				const originalConfig = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const originalIntent = await comfort.readIntentInManager(database.manager, originalConfig);
				const slot = await database.query<Record<string, unknown>[]>(
					'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
					[controllerId],
				);
				const dBefore = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: d });
				const dSlot = await database.query<{ slotRevision: number }[]>(
					'SELECT "slotRevision" FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
					[d],
				);
				try {
					expect(originalIntent.isOverrideCurrent()).toBe(true);
					expect(originalClaims.isCurrent()).toBe(true);
					mono = initialMono + 500;
					effects.length = 0;
					const release = configs.requestRelease(d, dBefore.revision);
					void release.catch(() => undefined);
					expect(originalClaims.isCurrent()).toBe(false);
					onResume.open();
					fixture.controls.beforeOn = null;
					await release;
					await fixture.flushTelemetry();
					await settle();
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: d })).state,
					).toBe('released');
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: d })).revision,
					).toBe(dBefore.revision + 1);
					expect(
						(
							await database.query<{ slotRevision: number }[]>(
								'SELECT "slotRevision" FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
								[d],
							)
						)[0].slotRevision,
					).toBe(dSlot[0].slotRevision + 1);
					expect(effects.some((query) => query.startsWith('UPDATE "devices_virtual_thermostat_configs"'))).toBe(true);
					expect(effects.some((query) => query.startsWith('UPDATE "devices_module_climate_automation_slots"'))).toBe(
						true,
					);
					expect(effects.some((query) => query.includes('releaseEvidence'))).toBe(true);
					expect(
						effects.some(
							(query) =>
								query === 'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1',
						),
					).toBe(true);
					// Source/head facts are reread fences on this route; actual requestRelease does not rewrite them.
					expect(
						effects.filter((query) =>
							/^(UPDATE|INSERT INTO|DELETE FROM) "devices_module_climate_automation_sources"/.test(query),
						),
					).toEqual([]);
					expect(originalClaims.isCurrent()).toBe(false);
					expect(originalGraph()).toBe(false);
					expect(originalIntent.isCurrent()).toBe(false);
					const afterC = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					// A genuine intervening C settlement may advance ONLY its original watermark, not the lifetime/budget.
					expect(afterC.comfort?.temporary_override?.wall_watermark_ms).toBeGreaterThanOrEqual(
						originalConfig.comfort?.temporary_override?.wall_watermark_ms ?? 0,
					);
					expect(afterC).toEqual({
						...originalConfig,
						comfort: originalConfig.comfort && {
							...originalConfig.comfort,
							temporary_override: originalConfig.comfort.temporary_override && {
								...originalConfig.comfort.temporary_override,
								wall_watermark_ms: afterC.comfort?.temporary_override?.wall_watermark_ms,
							},
						},
					});
					expect(
						await database.query('SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?', [
							controllerId,
						]),
					).toEqual(slot);
					const fresh = await comfort.readIntentInManager(database.manager, afterC);
					try {
						expect(fresh.isOverrideCurrent()).toBe(true);
						runtime.request(controllerId);
						await settleReal(fixture);
						expect(fixture.controls.sends.some((send) => send.property === relayId && send.on)).toBe(true);
						mono = initialMono + 30_100; // would still fit a new D-time budget; cannot fit C's ORIGINAL deadline
						expect(fresh.isOverrideCurrent()).toBe(false);
					} finally {
						fresh.close();
					}
				} finally {
					originalIntent.close();
				}
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				onResume.open();
				await fixture.close();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				monotonic.mockRestore();
				await pipeline.close();
			}
		});
		it.each(['before-send', 'after-send'] satisfies readonly ('before-send' | 'after-send')[])(
			'keeps real enabled publication locks neutral while managed ON is pending %s, then preserves actual refusal/UNKNOWN on original claims loss',
			async (boundary) => {
				runtime.onModuleDestroy();
				await createTemperatureOutput();
				await actualGraph.refreshQuarantine();
				const pipeline = await useSharedNativePipeline();
				const entered = barrier(),
					resume = barrier(),
					locks: string[] = [];
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (/^(INSERT INTO|DELETE FROM) "devices_module_property_value_locks"/.test(event.query))
							locks.push(event.query);
					},
				};
				database.subscribers.push(observer);
				try {
					runtime = makeActualRuntime();
					await runtime.onApplicationBootstrap();
					await settleReal(fixture);
					locks.length = 0;
					fixture.controls[boundary === 'before-send' ? 'beforeOn' : 'afterOn'] = async (id) => {
						if (id === relayId) {
							entered.open();
							await resume.promise;
						}
					};
					await fixture.report(sensorId, 18);
					await entered.promise;
					await runtime.flush();
					const original = actualClaims.capture();
					expect(original.isCurrent()).toBe(true);
					expect(locks.some((query) => query.startsWith('INSERT INTO'))).toBe(true);
					expect(locks.some((query) => query.startsWith('DELETE FROM'))).toBe(true);
					expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(
						boundary === 'before-send' ? 0 : 1,
					);
					actualClaims.invalidate();
					expect(original.isCurrent()).toBe(false);
					resume.open();
					await settleReal(fixture);
					const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
					expect(journal).toHaveLength(1);
					expect(journal[0].status).toBe(boundary === 'before-send' ? 'cancelled' : 'unknown');
					expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(
						boundary === 'before-send' ? 0 : 1,
					);
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId }))
							.releaseEvidence,
					).toBeNull();
				} finally {
					runtime.onModuleDestroy();
					fixture.revoke();
					resume.open();
					await fixture.close();
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
					await pipeline.close();
				}
			},
		);
		it.each(['before-commit', 'after-ack'] satisfies readonly ('before-commit' | 'after-ack')[])(
			'preserves an original native bootstrap %s error and exact persisted outcome without first context/admission leakage',
			async (stage) => {
				runtime.onModuleDestroy();
				const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const command = database.manager.create(VirtualThermostatCommandEntity, {
					id: uuid(),
					controllerId,
					claimId: claim.id,
					claimRevision: claim.revision,
					configurationRevision: row.revision,
					decisionRevision: 1,
					action: 'on',
					status: 'prepared',
					preparedAt: new Date(),
					dispatchedAt: null,
					settledAt: null,
					proofId: null,
					fault: null,
				});
				await database.manager.insert(VirtualThermostatCommandEntity, command);
				const failure = new Error('original bootstrap settlement'),
					observer = {
						beforeTransactionCommit: (): void => {
							if (stage === 'before-commit') throw failure;
						},
						afterTransactionCommit: (): void => {
							if (stage === 'after-ack') throw failure;
						},
					};
				database.subscribers.push(observer);
				runtime = makeActualRuntime();
				try {
					await expect(runtime.onApplicationBootstrap()).rejects.toBe(failure);
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status,
					).toBe(stage === 'before-commit' ? 'prepared' : 'unknown');
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					runtime.onModuleDestroy();
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
			},
		);
		it('treats a foreign same-row journal write as claims-DIRTY even when its finite native effect preserves original TIME', async () => {
			const entered = barrier(),
				resume = barrier();
			fixture.controls.beforeOn = async (id) => {
				if (id === relayId) {
					entered.open();
					await resume.promise;
				}
			};
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.override(
				controllerId,
				{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
				{
					preset: null,
					setpoints: { heating_setpoint: 23, cooling_setpoint: null },
					expires_at: new Date(Date.now() + 30_000).toISOString(),
				},
				'foreign-effect',
			);
			await entered.promise;
			await runtime.flush();
			const active = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }),
				intent = await comfort.readIntentInManager(database.manager, active),
				original = actualClaims.capture();
			try {
				const command = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
					controllerId,
					action: 'on',
					status: 'dispatching',
				});
				expect(intent.isOverrideCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(true);
				await database.query('UPDATE "devices_virtual_thermostat_command_journal" SET "fault" = ? WHERE "id" = ?', [
					null,
					command.id,
				]);
				expect(original.isCurrent()).toBe(false);
				expect(intent.isOverrideCurrent()).toBe(true);
				resume.open();
				await settleReal(fixture);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status,
				).toBe('cancelled');
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				resume.open();
				intent.close();
			}
		});
		it('keeps an original clock closed after a rolled-back same-value C write without resetting the restored lifetime', async () => {
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'rollback-clock',
			);
			await settleReal(fixture);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }),
				intent = await comfort.readIntentInManager(database.manager, row);
			const failure = new Error('known rollback');
			try {
				expect(intent.isOverrideCurrent()).toBe(true);
				await expect(
					database.transaction(async (manager) => {
						await manager.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
							[Number(row.locked), controllerId],
						);
						throw failure;
					}),
				).rejects.toBe(failure);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(row);
				expect(intent.isOverrideCurrent()).toBe(false);
				const restored = await comfort.readIntentInManager(database.manager, row);
				try {
					expect(restored.isOverrideCurrent()).toBe(false);
				} finally {
					restored.close();
				}
			} finally {
				intent.close();
			}
		});
		it('pins the original native hydration method and never revives a clock after its observed replacement restores', async () => {
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await comfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'native-method-clock',
			);
			await settleReal(fixture);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }),
				intent = await comfort.readIntentInManager(database.manager, row);
			const methods: OriginalFunctions<{
				prepareHydratedValue: {
					call: (
						receiver: DataSource['driver'],
						...args: Parameters<DataSource['driver']['prepareHydratedValue']>
					) => unknown;
				};
			}> = database.driver;
			const hydrate = methods.prepareHydratedValue;
			const spy = jest
				.spyOn(database.driver, 'prepareHydratedValue')
				.mockImplementation((...args) => hydrate.call(database.driver, ...args));
			try {
				expect(intent.isOverrideCurrent()).toBe(false);
				expect(spy).not.toHaveBeenCalled();
			} finally {
				spy.mockRestore();
				intent.close();
			}
			const fresh = await comfort.readIntentInManager(database.manager, row);
			try {
				expect(fresh.isOverrideCurrent()).toBe(false);
			} finally {
				fresh.close();
			}
		});
		// R53 additive source-native clock counterexamples. UNEXECUTED; no private state is mutated.
		it('R53 keeps original TIME through read close, same-token watermark clones and genuine ordinary neutral recovery', async () => {
			const caseDatabase = database,
				caseComfort = comfort,
				caseGraph = actualGraph,
				caseClaims = actualClaims,
				caseRuntime = runtime,
				caseFixture = fixture,
				caseWriter = mutationWriter;
			let retired = false;
			const reads: { close: () => void }[] = [];
			const readBackstop = {
				retire: (): void => {
					retired = true;
				},
				cleanup: (): void => {
					retired = true;
					let failure: { cause: unknown } | undefined;
					for (const view of reads) {
						try {
							view.close();
						} catch (cause) {
							failure ??= { cause };
						}
					}
					completionObserverBackstops.delete(readBackstop);
					if (failure) throw failure.cause;
				},
			};
			completionObserverBackstops.add(readBackstop);
			const track = <View extends { close: () => void }>(view: View): View => {
				reads.push(view);
				if (retired) {
					view.close();
					throw new Error('Original clock read observer retired');
				}
				return view;
			};
			const before = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await caseComfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: await caseGraph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'R53-read-and-native-neutral',
			);
			await caseRuntime.flush();
			const row = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const first = track(await caseComfort.readIntentInManager(caseDatabase.manager, row));
			const original = caseWriter['existingClockLeases'].get(controllerId);
			if (!original) throw new Error('Genuine installed original TIME missing');
			const originalOverride = row.comfort?.temporary_override;
			expect(first.isOverrideCurrent()).toBe(true);
			first.close();
			await caseClaims.refresh();
			const fresh = track(await caseComfort.readIntentInManager(caseDatabase.manager, row));
			try {
				expect(fresh.isOverrideCurrent()).toBe(true);
				const beforeClone = caseWriter['existingClockLeases'].get(controllerId);
				if (!beforeClone) throw new Error('Original TIME disappeared before monotone read');
				// Existing caseFixture already owns this logical packet clock; advance only one ms, never renew budget.
				jest.setSystemTime(Date.now() + 1);
				expect(fresh.isOverrideCurrent()).toBe(true);
				const clone = caseWriter['existingClockLeases'].get(controllerId);
				if (!clone) throw new Error('Monotone original TIME missing');
				expect(clone).not.toBe(beforeClone);
				expect(clone.token).toBe(beforeClone.token);
				expect(clone.nativeCurrent).toBe(beforeClone.nativeCurrent);
				expect(clone.vetoNativeLoss).toBe(beforeClone.vetoNativeLoss);
				expect(clone.watermark).toBeGreaterThan(beforeClone.watermark);
				expect(clone.deadline).toBe(original.deadline);
			} finally {
				fresh.close();
			}
			caseRuntime.request(controllerId, false); // genuine ordinary ENTRY and native caseRuntime/branch/journal effects
			await caseRuntime.flush();
			const after = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const retained = caseWriter['existingClockLeases'].get(controllerId);
			if (!retained) throw new Error('Original lifetime unavailable after genuine recovery');
			expect(retained.id).toBe(original.id);
			expect(retained.incarnation).toBe(original.incarnation);
			expect(retained.deadline).toBe(original.deadline);
			expect(retained.slot).toEqual(original.slot);
			expect(after.comfort?.temporary_override?.id).toBe(originalOverride?.id);
			expect(after.comfort?.temporary_override?.expires_at).toBe(originalOverride?.expires_at);
			expect(after.comfort?.temporary_override?.original_duration_ms).toBe(originalOverride?.original_duration_ms);
			const joined = track(await caseComfort.readIntentInManager(caseDatabase.manager, after));
			try {
				expect(joined.isOverrideCurrent()).toBe(true);
			} finally {
				joined.close();
			}
			expect(caseFixture.controls.sends.filter((send) => send.on)).toEqual([]);
		});
		it('R53 latches only observed original native A loss and never lets delayed A observation or close veto genuine B', async () => {
			const caseDatabase = database,
				caseComfort = comfort,
				caseGraph = actualGraph,
				caseRuntime = runtime,
				caseFixture = fixture,
				caseWriter = mutationWriter;
			let retired = false;
			const reads: { close: () => void }[] = [];
			const readBackstop = {
				retire: (): void => {
					retired = true;
				},
				cleanup: (): void => {
					retired = true;
					let failure: { cause: unknown } | undefined;
					for (const view of reads) {
						try {
							view.close();
						} catch (cause) {
							failure ??= { cause };
						}
					}
					completionObserverBackstops.delete(readBackstop);
					if (failure) throw failure.cause;
				},
			};
			completionObserverBackstops.add(readBackstop);
			const track = <View extends { close: () => void }>(view: View): View => {
				reads.push(view);
				if (retired) {
					view.close();
					throw new Error('Original clock read observer retired');
				}
				return view;
			};
			const before = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await caseComfort.override(
				controllerId,
				{ expected_revision: before.revision, expected_graph_revision: await caseGraph.revision() },
				{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
				'R53-original-native-A',
			);
			await caseRuntime.flush();
			const row = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const intentA = track(await caseComfort.readIntentInManager(caseDatabase.manager, row));
			const ownerA = caseWriter['existingClockLeases'].get(controllerId);
			if (!ownerA) throw new Error('Original A TIME missing');
			const replace = () => observeHydrationReplacement(caseDatabase.driver);
			try {
				const unseen = replace();
				expect(unseen.mock).not.toHaveBeenCalled();
				unseen.restore(); // no observation inside the interval: no ABA detection is claimed
				unseen.assertRestored();
				expect(intentA.isOverrideCurrent()).toBe(true);
				const observed = replace();
				try {
					expect(intentA.isOverrideCurrent()).toBe(false);
					expect(observed.mock).not.toHaveBeenCalled();
				} finally {
					observed.restore();
				}
				observed.assertRestored();
				const restored = track(await caseComfort.readIntentInManager(caseDatabase.manager, row));
				try {
					expect(restored.isOverrideCurrent()).toBe(false);
				} finally {
					restored.close();
				}
				await caseComfort.override(
					controllerId,
					{ expected_revision: row.revision, expected_graph_revision: await caseGraph.revision() },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
					'R53-genuine-new-B',
				);
				const bRow = await caseDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const intentB = track(await caseComfort.readIntentInManager(caseDatabase.manager, bRow));
				const ownerB = caseWriter['existingClockLeases'].get(controllerId);
				if (!ownerB) throw new Error('Genuine original B TIME missing');
				try {
					expect(ownerB.token).not.toBe(ownerA.token);
					expect(intentB.isOverrideCurrent()).toBe(true);
					const late = replace();
					try {
						// Only old A observes this interval. B is never evaluated under the replacement.
						expect(intentA.isOverrideCurrent()).toBe(false);
						expect(late.mock).not.toHaveBeenCalled();
					} finally {
						late.restore();
					}
					late.assertRestored();
					intentA.close();
					expect(intentB.isOverrideCurrent()).toBe(true);
					const stillB = caseWriter['existingClockLeases'].get(controllerId);
					expect(stillB?.token).toBe(ownerB.token);
					expect(stillB?.nativeCurrent).toBe(ownerB.nativeCurrent);
					expect(stillB?.vetoNativeLoss).toBe(ownerB.vetoNativeLoss);
					expect(stillB?.deadline).toBe(ownerB.deadline);
				} finally {
					intentB.close();
				}
			} finally {
				intentA.close();
			}
			expect(caseFixture.controls.sends.filter((send) => send.on)).toEqual([]);
		});
		// END R53 additive clock counterexamples
		it('denies original command claims after a foreign actual claim revision mutation even with matching source and unchanged journal', async () => {
			const entered = barrier(),
				resume = barrier();
			fixture.controls.beforeOn = async (id) => {
				if (id === relayId) {
					entered.open();
					await resume.promise;
				}
			};
			await fixture.report(sensorId, 18);
			await entered.promise;
			const original = actualClaims.capture(),
				claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			try {
				expect(original.isCurrent()).toBe(true);
				await database.query(
					'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = ? WHERE "id" = ? AND "revision" = ?',
					[claim.revision + 1, claim.id, claim.revision],
				);
				expect(original.isCurrent()).toBe(false);
				resume.open();
				await settleReal(fixture);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).revision,
				).toBe(claim.revision + 1);
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				resume.open();
			}
		});
		it('never lends a closed ORM effect to a held AfterQuery descendant issuing the identical native write later', async () => {
			const queryEntered = barrier(),
				queryResume = barrier(),
				onEntered = barrier(),
				onResume = barrier();
			let armed = true,
				descendant: Promise<void> | undefined;
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): Promise<void> | undefined => {
					if (!armed || !event.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"')) return;
					armed = false;
					queryEntered.open();
					descendant = queryResume.promise.then(async () => {
						const preciseEventView2: Readonly<{ parameters?: readonly unknown[] }> = event;
						await event.queryRunner.query(event.query, [...(preciseEventView2.parameters ?? [])]);
					});
					return descendant;
				},
			};
			database.subscribers.push(observer);
			fixture.controls.beforeOn = async (id) => {
				if (id === relayId) {
					onEntered.open();
					await onResume.promise;
				}
			};
			try {
				await fixture.report(sensorId, 18);
				await queryEntered.promise;
				await onEntered.promise;
				const original = actualClaims.capture();
				expect(original.isCurrent()).toBe(true);
				queryResume.open();
				await descendant;
				expect(original.isCurrent()).toBe(false);
				onResume.open();
				await settleReal(fixture);
				expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				queryResume.open();
				onResume.open();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				await descendant?.catch(() => undefined);
			}
		});
		// BEGIN R17 mapped UUID and callback reporting drafts (UNRUN; genuine managed fixture)
		it.each(['uuid', 'malformed', 'protected'] satisfies readonly ('uuid' | 'malformed' | 'protected')[])(
			'keeps mapped UUID native journal work distinct from %s scalar/protected rejection',
			async (mode) => {
				runtime.onModuleDestroy();
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
					'mapped-uuid-native-domain',
				);
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
				const intent = await comfort.readIntentInManager(database.manager, config);
				const claims = actualClaims.capture();
				const slot: unknown = await database.query(
					'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
					[controllerId],
				);
				const id = uuid();
				const inserts: string[] = [];
				const observer = {
					afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
						if (event.query.startsWith('INSERT INTO "devices_virtual_thermostat_command_journal"'))
							inserts.push(event.query);
					},
				};
				database.subscribers.push(observer);
				try {
					expect(
						database
							.getMetadata(VirtualThermostatCommandEntity)
							.columns.find((column) => column.propertyName === 'claimId')?.type,
					).toBe('uuid');
					expect(intent.isOverrideCurrent()).toBe(true);
					expect(claims.isCurrent()).toBe(true);
					if (mode === 'protected') {
						await database.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
							[Number(config.locked), controllerId],
						);
					} else {
						const insertion = database.manager.insert(VirtualThermostatCommandEntity, {
							id,
							controllerId,
							claimId: mode === 'uuid' ? claim.id : 'not-a-uuid',
							claimRevision: claim.revision,
							configurationRevision: config.revision,
							decisionRevision: 0,
							action: 'on',
							status: 'prepared',
							preparedAt: new Date(),
							dispatchedAt: null,
							settledAt: null,
							proofId: null,
							fault: null,
						});
						if (mode === 'uuid') {
							await insertion;
							expect(inserts).toHaveLength(1);
							expect(inserts[0]).toMatch(/^INSERT INTO "devices_virtual_thermostat_command_journal"\(/);
							expect(await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id })).toMatchObject({
								claimId: claim.id,
								status: 'prepared',
							});
						} else {
							// This is a refused native FK attempt, never a committed malformed claim or positive control.
							await expect(insertion).rejects.toThrow('FOREIGN KEY constraint failed');
							expect(await database.manager.countBy(VirtualThermostatCommandEntity, { id })).toBe(0);
						}
					}
					expect(intent.isOverrideCurrent()).toBe(mode === 'uuid');
					expect(claims.isCurrent()).toBe(false); // Foreign journal work is not claims authority.
					expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
						config,
					);
					expect(
						await database.query('SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?', [
							controllerId,
						]),
					).toEqual(slot);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					runtime.onModuleDestroy();
					intent.close();
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
				}
				expect(database.subscribers.includes(observer)).toBe(false);
				expect(intent.isOverrideCurrent()).toBe(false);
			},
		);
		it.each(['Q-only', 'P+Q'] satisfies readonly ('Q-only' | 'P+Q')[])(
			'reports a genuine recovery callback %s without changing bootstrap primary identity',
			async (mode) => {
				runtime.onModuleDestroy();
				const journalSql =
					'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = ?, "fault" = ? WHERE "status" IN (?, ?)';
				const branchSql =
					'UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = ?, "releaseAttempts" = 0, "nextReleaseAt" = ?';
				const secondaryLine = '[virtual-thermostat-test] secondary recovery callback assertion recorded\n';
				const primary = new Error('second real recovery query refused');
				let callbackFailure: { cause: unknown } | undefined;
				let callbackFailureReplayed = false;
				let intent: Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>> | undefined;
				let captured: ReturnType<VirtualThermostatClaimsService['capture']> | undefined;
				let rejected: { cause: unknown } | undefined;
				let armed = false;
				let callbackEntries = 0,
					refreshCompleted = 0;
				const originalRefresh: Readonly<{
					refresh: { call: (receiver: VirtualThermostatClaimsService) => Promise<void> };
				}> = actualClaims;
				const refresh = originalRefresh.refresh;
				const refreshSpy = jest.spyOn(actualClaims, 'refresh').mockImplementation(async () => {
					await refresh.call(actualClaims);
					if (!armed) return;
					expect(actualStructure.hasCurrentStructuralLease()).toBe(false);
					refreshCompleted++;
					if (callbackFailure !== undefined) {
						callbackFailureReplayed = true;
						throw callbackFailure.cause;
					}
				});
				// Default spy preserves the original stderr callthrough, including its receiver/result.
				const stderr = jest.spyOn(process.stderr, 'write');
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (armed && mode === 'P+Q' && event.query === branchSql) throw primary;
					},
					afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
						if (!armed || (event.query !== journalSql && event.query !== branchSql)) return;
						callbackEntries++;
						try {
							expect(intent?.isOverrideCurrent()).toBe(true);
							expect(captured?.isCurrent()).toBe(false);
						} catch (cause) {
							callbackFailure ??= { cause };
						}
					},
				};
				try {
					mutationProvider.onModuleDestroy();
					mutationProvider = new VirtualThermostatAutomationService(
						mutationWriter,
						mutationRegistry,
						actualGraph,
						new ConfigService({ FB_CLI: 'off' }),
						undefined,
						configs,
						comfort,
					);
					mutationProvider.onModuleInit();
					const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					await comfort.override(
						controllerId,
						{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
						{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
						'recovery-report-identity',
					);
					const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					intent = await comfort.readIntentInManager(database.manager, config);
					captured = actualClaims.capture();
					expect(intent.isOverrideCurrent()).toBe(true);
					// A genuine protected same-value native write closes A; no currentness function is substituted.
					await database.query(
						'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
						[Number(config.locked), controllerId],
					);
					expect(intent.isOverrideCurrent()).toBe(false);
					database.subscribers.push(observer);
					armed = true;
					try {
						await runtime.onApplicationBootstrap();
					} catch (error) {
						if (callbackFailure !== undefined && !callbackFailureReplayed) {
							try {
								process.stderr.write(secondaryLine);
							} catch {
								// Keep the exact genuine bootstrap primary, including falsy causes.
							}
						}
						rejected = { cause: error };
					}
					expect(callbackFailure).toBeDefined();
					expect(rejected).toBeDefined();
					expect(callbackEntries).toBe(mode === 'Q-only' ? 2 : 1);
					expect(refreshCompleted).toBe(mode === 'Q-only' ? 1 : 0);
					expect(callbackFailureReplayed).toBe(mode === 'Q-only');
					expect(rejected?.cause).toBe(mode === 'Q-only' ? callbackFailure?.cause : primary);
					expect(stderr.mock.calls.filter((call) => call[0] === secondaryLine)).toHaveLength(mode === 'Q-only' ? 0 : 1);
					expect(actualStructure.hasCurrentStructuralLease()).toBe(false);
					expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(
						config,
					);
					expect(fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					runtime.onModuleDestroy();
					intent?.close();
					const index = database.subscribers.indexOf(observer);
					if (index >= 0) database.subscribers.splice(index, 1);
					mutationProvider.onModuleDestroy();
					refreshSpy.mockRestore();
					stderr.mockRestore();
				}
				expect(database.subscribers.includes(observer)).toBe(false);
				expect(originalRefresh.refresh).toBe(refresh);
				expect(intent?.isOverrideCurrent()).toBe(false);
			},
		);
		// END R17 mapped UUID and callback reporting drafts
		// BEGIN R4 original startup/TIME/lifecycle drafts (UNRUN)
		it('retains only the original C deadline through BOTH actual recovery effects and a fresh post-release claims generation', async () => {
			runtime.onModuleDestroy();
			let mono = performance.now();
			const initialMono = mono;
			const monotonic = jest.spyOn(performance, 'now').mockImplementation(() => mono);
			const journalSql =
				'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = ?, "fault" = ? WHERE "status" IN (?, ?)';
			const branchSql =
				'UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = ?, "releaseAttempts" = 0, "nextReleaseAt" = ?';
			const native: { query: string; parameters: readonly unknown[] }[] = [];
			let original: Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>> | undefined;
			let captured: ReturnType<VirtualThermostatClaimsService['capture']> | undefined;
			let callbackFailure: { cause: unknown } | undefined;
			let callbackFailureReplayed = false;
			let recoveryId: string | undefined,
				releasedRefresh = false;
			const originalRefresh: Readonly<{
				refresh: { call: (receiver: VirtualThermostatClaimsService) => Promise<void> };
			}> = actualClaims;
			const refresh = originalRefresh.refresh;
			const refreshSpy = jest.spyOn(actualClaims, 'refresh').mockImplementation(async () => {
				if (releasedRefresh || !native.length) return refresh.call(actualClaims);
				expect(actualStructure.hasCurrentStructuralLease()).toBe(false);
				await refresh.call(actualClaims);
				if (callbackFailure !== undefined) {
					callbackFailureReplayed = true;
					throw callbackFailure.cause;
				}
				expect(original?.isOverrideCurrent()).toBe(true);
				expect(actualClaims.capture().isCurrent()).toBe(true);
				const recovered = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: recoveryId });
				expect(recovered.status).toBe('unknown');
				expect(recovered.fault).toBe('restart_requires_release_reconciliation');
				const branches = await database.manager.findBy(VirtualThermostatBranchRuntimeEntity, {
					claimId: recovered.claimId,
				});
				expect(branches).toHaveLength(1);
				expect(branches[0]).toMatchObject({ activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null });
				releasedRefresh = true;
			});
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (event.query !== journalSql && event.query !== branchSql) return;
					const preciseEventView3: Readonly<{ parameters?: readonly unknown[] }> = event;
					native.push({ query: event.query, parameters: [...(preciseEventView3.parameters ?? [])] });
					try {
						expect(original?.isOverrideCurrent()).toBe(true);
						expect(captured?.isCurrent()).toBe(false); // CLOCK-neutral is not command membership authority.
					} catch (cause) {
						callbackFailure ??= { cause };
					}
				},
			};
			try {
				const previousProvider = mutationRegistry.captureProvider('virtual-thermostat:v1');
				expect(previousProvider?.isCurrent()).toBe(true);
				mutationProvider.onModuleDestroy();
				expect(previousProvider?.isCurrent()).toBe(false);
				mutationProvider = new VirtualThermostatAutomationService(
					mutationWriter,
					mutationRegistry,
					actualGraph,
					new ConfigService({ FB_CLI: 'off' }),
					undefined,
					configs,
					comfort,
				);
				mutationProvider.onModuleInit();
				expect(mutationRegistry.captureProvider('virtual-thermostat:v1')?.isCurrent()).toBe(true);
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				await comfort.override(
					controllerId,
					{ expected_revision: before.revision, expected_graph_revision: await actualGraph.revision() },
					{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 30_000).toISOString() },
					'restart-original-budget',
				);
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const slot: unknown = await database.query(
					'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
					[controllerId],
				);
				original = await comfort.readIntentInManager(database.manager, config);
				captured = actualClaims.capture();
				expect(original.isOverrideCurrent()).toBe(true);
				expect(captured.isCurrent()).toBe(true);
				const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
				const id = uuid();
				recoveryId = id;
				await database.manager.insert(VirtualThermostatCommandEntity, {
					id,
					controllerId,
					claimId: claim.id,
					claimRevision: claim.revision,
					configurationRevision: config.revision,
					decisionRevision: 0,
					action: 'on',
					status: 'prepared',
					preparedAt: new Date(),
					dispatchedAt: null,
					settledAt: null,
					proofId: null,
					fault: null,
				});
				await actualClaims.refresh();
				captured = actualClaims.capture();
				database.subscribers.push(observer);
				mono = initialMono + 500;
				// Same instance, its original lifecycle was synchronously closed above.
				try {
					await runtime.onApplicationBootstrap();
				} catch (primary) {
					if (callbackFailure !== undefined && !callbackFailureReplayed) {
						try {
							process.stderr.write('[virtual-thermostat-test] secondary recovery callback assertion recorded\n');
						} catch {
							// The original bootstrap rejection stays primary.
						}
					}
					throw primary;
				}
				if (callbackFailure !== undefined) {
					callbackFailureReplayed = true;
					throw callbackFailure.cause;
				}
				await settleReal(fixture);
				expect(native).toEqual([
					{
						query: journalSql,
						parameters: ['unknown', 'restart_requires_release_reconciliation', 'prepared', 'dispatching'],
					},
					{ query: branchSql, parameters: ['unknown', null] },
				]);
				expect(releasedRefresh).toBe(true);
				expect(captured.isCurrent()).toBe(false);
				expect(actualClaims.capture().isCurrent()).toBe(true);
				const recovered = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id });
				expect(recovered.fault).toBe('restart_requires_release_reconciliation');
				expect(recovered.status === 'unknown' || recovered.status === 'confirmed').toBe(true);
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				expect(after.comfort?.temporary_override?.expires_at).toBe(config.comfort?.temporary_override?.expires_at);
				expect(after.comfort?.temporary_override?.wall_watermark_ms).toBeGreaterThanOrEqual(
					config.comfort?.temporary_override?.wall_watermark_ms ?? 0,
				);
				expect(
					await database.query('SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?', [
						controllerId,
					]),
				).toEqual(slot);
				const fresh = await comfort.readIntentInManager(database.manager, after);
				try {
					expect(fresh.isOverrideCurrent()).toBe(true);
					mono = initialMono + 30_100;
					expect(fresh.isOverrideCurrent()).toBe(false);
				} finally {
					fresh.close();
				}
			} finally {
				runtime.onModuleDestroy();
				original?.close();
				const index = database.subscribers.indexOf(observer);
				if (index >= 0) database.subscribers.splice(index, 1);
				monotonic.mockRestore();
				mutationProvider.onModuleDestroy();
				refreshSpy.mockRestore();
			}
		});
		it.each(['success', 'failure'] satisfies readonly ('success' | 'failure')[])(
			'joins the original pending bootstrap %s completion and exact rejection identity',
			async (mode) => {
				runtime.onModuleDestroy();
				const entered = barrier(),
					resume = barrier(),
					failure = new Error('owned concurrent recovery');
				let armed = true,
					secondSettled = false;
				const observer = {
					beforeTransactionStart: async (): Promise<void> => {
						if (!armed) return;
						armed = false;
						entered.open();
						await resume.promise;
					},
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (mode === 'failure' && event.query.startsWith('UPDATE "devices_virtual_thermostat_branch_runtime"'))
							throw failure;
					},
				};
				database.subscribers.push(observer);
				const first = runtime.onApplicationBootstrap();
				void first.catch(() => undefined);
				await entered.promise;
				const second = runtime.onApplicationBootstrap();
				void second.then(
					() => {
						secondSettled = true;
					},
					() => {
						secondSettled = true;
					},
				);
				try {
					expect(second).toBe(first);
					expect(secondSettled).toBe(false);
					resume.open();
					if (mode === 'failure') {
						await expect(first).rejects.toBe(failure);
						await expect(second).rejects.toBe(failure);
					} else {
						await first;
						await second;
						expect(actualClaims.capture().isCurrent()).toBe(true);
					}
				} finally {
					runtime.onModuleDestroy();
					resume.open();
					await first.catch(() => undefined);
					database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				}
			},
		);
		it('keeps a destroyed pending A bootstrap completion from clearing the fresh same-instance B attempt', async () => {
			runtime.onModuleDestroy();
			const entered = barrier(),
				resume = barrier();
			let armed = true;
			const observer = {
				beforeTransactionStart: async (): Promise<void> => {
					if (!armed) return;
					armed = false;
					entered.open();
					await resume.promise;
				},
			};
			database.subscribers.push(observer);
			const a = runtime.onApplicationBootstrap();
			void a.catch(() => undefined);
			await entered.promise;
			runtime.onModuleDestroy();
			const b = runtime.onApplicationBootstrap();
			void b.catch(() => undefined);
			try {
				expect(b).not.toBe(a);
				expect(runtime.onApplicationBootstrap()).toBe(b);
				resume.open();
				await expect(a).rejects.toThrow('Original runtime lifecycle ended');
				await b;
				await settleReal(fixture);
				const capture = actualClaims.capture();
				expect(capture.isCurrent()).toBe(true);
				runtime.request(controllerId, false);
				await settleReal(fixture);
				expect(runtime.readDiagnostics(controllerId)?.configuration_revision).toBeGreaterThan(0);
				expect(capture.isCurrent()).toBe(true);
			} finally {
				runtime.onModuleDestroy();
				resume.open();
				await Promise.allSettled([a, b]);
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});
		it('stops A at an actual late native load read and admits fresh B only through its own structural ticket', async () => {
			const entered = barrier();
			let armed = true,
				oldQueue: Promise<void> | undefined;
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (
						!armed ||
						!event.query.startsWith('SELECT ') ||
						!event.query.includes('devices_virtual_thermostat_branch_runtime')
					)
						return;
					armed = false;
					// Synchronous native completion boundary, before TypeORM resolves this query to A.
					// Destroy only; B is started by the external test chain, never inside A's shared ALS.
					runtime.onModuleDestroy();
					entered.open();
				},
			};
			database.subscribers.push(observer);
			try {
				runtime.request(controllerId, false);
				oldQueue = runtime.flush();
				void oldQueue.catch(() => undefined);
				await entered.promise;
				await runtime.onApplicationBootstrap();
				await oldQueue;
				await settleReal(fixture);
				expect(armed).toBe(false);
				expect(actualClaims.capture().isCurrent()).toBe(true);
				const before = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
				expect(runtime.readDiagnostics(controllerId)?.decision_revision).toBe(before.decisionRevision);
				runtime.request(controllerId, false);
				await settleReal(fixture);
				expect(runtime.readDiagnostics(controllerId)?.decision_revision).toBeGreaterThan(before.decisionRevision);
			} finally {
				runtime.onModuleDestroy();
				await oldQueue?.catch(() => undefined);
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});

		it('drops a real completed A native load held after original shared release without closing B context or persisting A work', async () => {
			const entered = barrier(),
				resume = barrier();
			let nativeLoaded = false,
				armed = true;
			const original: Readonly<{
				runShared: { call: <T>(receiver: DeviceStructureLockService, fn: () => Promise<T>) => Promise<T> };
			}> = actualStructure;
			const shared = original.runShared;
			const observer = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					if (
						armed &&
						event.query.startsWith('SELECT ') &&
						event.query.includes('devices_virtual_thermostat_branch_runtime')
					)
						nativeLoaded = true;
				},
			};
			database.subscribers.push(observer);
			const spy = jest
				.spyOn(actualStructure, 'runShared')
				.mockImplementation(async <T>(fn: () => Promise<T>): Promise<T> => {
					const result = await shared.call(actualStructure, fn);
					if (armed && nativeLoaded) {
						armed = false;
						// Ordinary shared promise settlement precedes its finally. A real exclusive ticket
						// proves the original shared owner has released, without a sleep or private flag.
						await actualStructure.runExclusiveReleased(() => Promise.resolve(undefined));
						entered.open();
						await resume.promise;
					}
					return result;
				});
			let oldQueue: Promise<void> | undefined, bBootstrap: Promise<void> | undefined;
			const bLoaded = barrier(),
				bReturn = barrier();
			const originalFlush: Readonly<{ flush: { call: (receiver: VirtualThermostatRuntimeService) => Promise<void> } }> =
				runtime;
			const flush = originalFlush.flush;
			let restoreFlush: (() => void) | undefined;
			try {
				runtime.request(controllerId, false);
				oldQueue = runtime.flush();
				void oldQueue.catch(() => undefined);
				await entered.promise;
				// All original load SQL ran; its shared owner is actually released before B starts.
				runtime.onModuleDestroy();
				const flushSpy = jest.spyOn(runtime, 'flush').mockImplementation(async () => {
					await flush.call(runtime);
					bLoaded.open();
					await bReturn.promise;
				});
				restoreFlush = () => flushSpy.mockRestore();
				bBootstrap = runtime.onApplicationBootstrap();
				void bBootstrap.catch(() => undefined);
				await bLoaded.promise;
				// B's genuine native context/decision is loaded; its interval has not yet been installed.
				const before = await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId });
				const diagnostic = runtime.readDiagnostics(controllerId),
					capture = actualClaims.capture();
				expect(diagnostic?.configuration_revision).toBeGreaterThan(0);
				expect(capture.isCurrent()).toBe(true);
				const writes: string[] = [];
				const watch = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) writes.push(event.query);
					},
				};
				database.subscribers.push(watch);
				try {
					resume.open();
					await oldQueue;
					expect(writes).toEqual([]);
				} finally {
					database.subscribers.splice(database.subscribers.indexOf(watch), 1);
				}
				expect(await database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, { controllerId })).toEqual(
					before,
				);
				expect(runtime.readDiagnostics(controllerId)?.decision_revision).toBe(diagnostic?.decision_revision);
				expect(capture.isCurrent()).toBe(true);
				bReturn.open();
				await bBootstrap;
				restoreFlush();
				restoreFlush = undefined;
				runtime.request(controllerId, false);
				await settleReal(fixture);
				expect(runtime.readDiagnostics(controllerId)?.decision_revision).toBeGreaterThan(before.decisionRevision);
			} finally {
				runtime.onModuleDestroy();
				resume.open();
				bReturn.open();
				await oldQueue?.catch(() => undefined);
				await bBootstrap?.catch(() => undefined);
				restoreFlush?.();
				spy.mockRestore();
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		});
		it('persists a genuinely possibly-sent A outcome after same-instance B startup without borrowing B admission or scheduling A work', async () => {
			const entered = barrier(),
				resume = barrier();
			fixture.controls.afterOn = async (id) => {
				if (id === relayId) {
					entered.open();
					await resume.promise;
				}
			};
			try {
				await fixture.report(sensorId, 18);
				await entered.promise;
				await runtime.flush();
				const command = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
					controllerId,
					action: 'on',
					status: 'dispatching',
				});
				expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(1);
				runtime.onModuleDestroy();
				await runtime.onApplicationBootstrap();
				expect(actualClaims.capture().isCurrent()).toBe(true);
				resume.open();
				await fixture.flushTelemetry();
				await settle();
				const late = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id });
				expect(late.status).toBe('unknown');
				expect(late.settledAt).not.toBeNull();
				expect(fixture.controls.sends.filter((send) => send.property === relayId && send.on)).toHaveLength(1);
				expect(
					(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId }))
						.releaseEvidence,
				).toBeNull();
			} finally {
				runtime.onModuleDestroy();
				fixture.revoke();
				resume.open();
				await fixture.close();
			}
		});

		// END R4 original startup/TIME/lifecycle drafts
		// END closed runtime bookkeeping and persistent TIME drafts

		// New diagnostic-only captures reuse the existing explicitly synthetic installation boundary, not HW authority.
		it('observes original qualification data without installation or events and refuses a subsequent revoke without recapture', async () => {
			const rows = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId });
			const capture = actualClaims.captureDiagnosticQualifications(rows),
				emit = jest.spyOn(events, 'emit');
			try {
				const clock = Object.freeze({ wallMs: Date.now(), monoMs: performance.now() });
				for (const row of rows)
					expect(actualClaims.evaluateDiagnosticQualification(capture, row.id, false, clock)).not.toBeNull();
				expect(actualClaims.diagnosticQualificationsCurrent(capture)).toBe(true);
				expect(emit).not.toHaveBeenCalled();
				actualClaims.revokeAllQualifications();
				expect(actualClaims.diagnosticQualificationsCurrent(capture)).toBe(false);
				for (const row of rows)
					expect(() => actualClaims.evaluateDiagnosticQualification(capture, row.id, false, clock)).toThrow('lost');
			} finally {
				actualClaims.closeDiagnosticQualifications(capture);
				emit.mockRestore();
			}
		});
		it('keeps missing qualification unavailable and remembers actual absence ABA across an admitted finite capture', async () => {
			const rows = await database.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId });
			actualClaims.revokeAllQualifications();
			const capture = actualClaims.captureDiagnosticQualifications(rows);
			try {
				const clock = Object.freeze({ wallMs: Date.now(), monoMs: performance.now() });
				for (const row of rows)
					expect(actualClaims.evaluateDiagnosticQualification(capture, row.id, false, clock)).toBeNull();
				for (const evidence of installedQualifications.values()) actualClaims.recordQualification(evidence);
				actualClaims.revokeAllQualifications();
				expect(actualClaims.diagnosticQualificationsCurrent(capture)).toBe(false);
			} finally {
				actualClaims.closeDiagnosticQualifications(capture);
			}
		});
		it.each(['before-send', 'after-send'] as const)(
			'keeps original actual SDK %s outcome truthful when comfort entry waits on its first real read',
			async (boundary) => {
				const onEntered = barrier(),
					onResume = barrier(),
					resultObserved = barrier(),
					readEntered = barrier(),
					readResume = barrier();
				const requestContext = new AsyncLocalStorage<boolean>();
				const outcomes: Awaited<ReturnType<ThermostatActuationAdapter['send']>>[] = [];
				const originalGetMethods: {
					readonly get: {
						call: (
							receiver: VirtualThermostatTransportService,
							...args: Parameters<VirtualThermostatTransportService['get']>
						) => ReturnType<VirtualThermostatTransportService['get']>;
					};
				} = fixture.transport;
				const originalGet = originalGetMethods.get;
				// Observe, never replace, actual builtin adapter/session/RPC/HTTP guard execution and its returned outcome.
				jest.spyOn(fixture.transport, 'get').mockImplementation((...args) => {
					const adapter = originalGet.call(fixture.transport, ...args);
					if (!adapter) return null;
					const originalSendMethods: {
						readonly send: {
							call: (
								receiver: ThermostatActuationAdapter,
								...args: Parameters<ThermostatActuationAdapter['send']>
							) => ReturnType<ThermostatActuationAdapter['send']>;
						};
					} = adapter;
					const originalSend = originalSendMethods.send;
					return {
						...adapter,
						send: async (...sendArgs) => {
							const outcome = await originalSend.call(adapter, ...sendArgs);
							if (sendArgs[0].property.id === relayId && sendArgs[0].value === true) {
								outcomes.push(outcome);
								resultObserved.open();
							}
							return outcome;
						},
					};
				});
				fixture.controls[boundary === 'before-send' ? 'beforeOn' : 'afterOn'] = async (property) => {
					if (property !== relayId) return;
					onEntered.open();
					await onResume.promise;
				};
				let pauseRead = true;
				database.subscribers.push({
					beforeQuery: async (event) => {
						if (
							!requestContext.getStore() ||
							!pauseRead ||
							!event.query.startsWith('SELECT') ||
							!event.query.includes('devices_virtual_thermostat_configs')
						)
							return;
						pauseRead = false;
						readEntered.open();
						await readResume.promise;
					},
				});
				let mutation: ReturnType<VirtualThermostatComfortService['get']> | undefined;
				try {
					const expected = await comfortFence();
					await fixture.report(sensorId, 18);
					await onEntered.promise;
					const originalCapture = actualClaims.capture();
					expect(originalCapture.isCurrent()).toBe(true);
					// Positive reachability is beyond matched real SDK inspection/status and at actual HTTP ON pre/post onSend.
					expect(fixture.controls.sends.filter((send) => send.property === relayId)).toHaveLength(
						boundary === 'before-send' ? 0 : 1,
					);
					const fences = fixture.controls.fences.length;
					mutation = requestContext.run(true, () => comfort.select(controllerId, expected, 'eco', false));
					void mutation.catch(() => undefined);
					expect(originalCapture.isCurrent()).toBe(false);
					await readEntered.promise;
					expect(actualClaims.capture().isCurrent()).toBe(false);
					onResume.open();
					await resultObserved.promise;
					expect(outcomes).toHaveLength(1);
					if (boundary === 'before-send') {
						expect(outcomes[0]).toMatchObject({ outcome: 'refused' });
						expect(fixture.controls.sends.filter((send) => send.property === relayId)).toHaveLength(0);
					} else {
						expect(outcomes[0]).toEqual({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
						expect(fixture.controls.sends.filter((send) => send.property === relayId)).toHaveLength(1);
					}
					expect(fixture.controls.fences).toHaveLength(fences); // no fabricated physical OFF/drain while the comfort read is held
					// Observation above precedes this stop: the refusal/uncertainty was caused by real comfort entry, not teardown.
					runtime.onModuleDestroy();
					readResume.open();
					await mutation;
					await settle();
					const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
					expect(journal).toHaveLength(1);
					expect(journal[0].status).toBe(boundary === 'before-send' ? 'cancelled' : 'unknown');
					expect(originalCapture.isCurrent()).toBe(false);
					expect(fixture.controls.errors).toEqual([]);
				} finally {
					// Revoke first; never release a held ON as a successful cleanup operation or invent drainage.
					runtime.onModuleDestroy();
					fixture.revoke();
					readResume.open();
					onResume.open();
					if (mutation !== undefined) await mutation.catch(() => undefined);
				}
			},
		);
	});
	// END real claims comfort pending-ON regressions
	it('retires only committed journal identities and retains the same pending identity after a real SQLite rollback', async () => {
		const owned = initialFixtureOwner();
		const { owner: runtime, source: database, id: controllerId, settle } = owned;
		const entry = observeOriginalReconciliation(runtime);
		await settle();
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
			dispatchedAt: null,
			settledAt: null,
			proofId: null,
			fault: null,
		});
		await database.manager.insert(VirtualThermostatCommandEntity, command);
		const retire = jest.fn<void, [readonly string[]]>();
		owned.assertLive();
		proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		const nativeRunners = new Map<object, NonNullable<ReturnType<typeof entry.scope.getStore>>>();
		let rollback = true,
			retired = false;
		let primary: { cause: unknown } | undefined;
		const subscriber = {
			listenTo: () => VirtualThermostatBranchRuntimeEntity,
			afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
				const original = entry.scope.getStore();
				if (
					!retired &&
					original &&
					entry.isWaitingEntry(original) &&
					original.claim.id === claim.id &&
					event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
					event.parameters?.includes('confirmed') &&
					event.parameters.includes(command.id)
				)
					nativeRunners.set(event.queryRunner, original);
			},
			afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
				nativeRunners.delete(event.queryRunner);
			},
			afterTransactionCommit: (event: TransactionCommitEvent): void => {
				nativeRunners.delete(event.queryRunner);
			},
			afterUpdate: (event: import('typeorm').UpdateEvent<VirtualThermostatBranchRuntimeEntity>): void => {
				const original = entry.scope.getStore();
				if (
					!retired &&
					rollback &&
					original &&
					nativeRunners.get(event.queryRunner) === original &&
					entry.isWaitingEntry(original)
				) {
					nativeRunners.delete(event.queryRunner);
					rollback = false;
					throw new Error('fixture settlement rollback');
				}
			},
		};
		const backstop = {
			retire: (): void => {
				retired = true;
				nativeRunners.clear();
			},
			cleanup: (): void => {
				backstop.retire();
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
				completionObserverBackstops.delete(backstop);
			},
		};
		completionObserverBackstops.add(backstop);
		database.subscribers.push(subscriber);
		try {
			await expect(entry.start(claim)).rejects.toThrow('fixture settlement rollback');
			expect(retire).not.toHaveBeenCalled();
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'accepted',
			);
			await entry.start(claim);
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'confirmed',
			);
			expect(retire).toHaveBeenCalledWith([command.id]);
			expect(reconciledCommandIds.slice(-2)).toEqual([[command.id], [command.id]]);
		} catch (cause) {
			primary = { cause };
		} finally {
			try {
				backstop.cleanup();
			} catch (cause) {
				primary ??= { cause };
			}
		}
		if (primary) throw primary.cause;
	});
	it('does not let optional retirement failure alter committed journal confirmation', async () => {
		const owned = initialFixtureOwner();
		const { owner: runtime, source: database, id: controllerId, settle } = owned;
		const entry = observeOriginalReconciliation(runtime);
		await settle();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		// BEGIN R63 explicit original OFF journal baseline; no case callback is installed yet.
		{
			const baseline = Object.freeze(
				(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map((row) =>
					Object.freeze({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }),
				),
			);
			expect(
				baseline.every(
					(row) =>
						row.claimId === claim.id &&
						row.action === 'off' &&
						['prepared', 'dispatching', 'accepted', 'unknown', 'confirmed'].includes(row.status),
				),
			).toBe(true);
			await entry.start(claim);
			const settledBaseline = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(
				settledBaseline
					.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			).toEqual(
				baseline
					.map((row) => ({ ...row, status: 'confirmed' }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			);
			expect(settledBaseline.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
		}
		// END R63 explicit original OFF journal baseline.
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
			dispatchedAt: null,
			settledAt: null,
			proofId: null,
			fault: null,
		});
		await database.manager.insert(VirtualThermostatCommandEntity, command);
		const retire = jest.fn(() => {
			throw new Error('optional metadata only');
		});
		owned.assertLive();
		proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		await entry.start(claim);
		expect(retire).toHaveBeenCalledWith([command.id]);
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
		runtime.request(controllerId);
		await settle();
		const oldProof = internal.reconciled.get(`${claim.id}:${claim.revision}`);
		expect(oldProof).toBeDefined();
		const before = proofCalls;
		after = oldProof.observedAt;
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'accepted' })).toBe(
			0,
		);
		packetTick();
		runtime.request(controllerId);
		await settle();
		expect(proofCalls).toBe(before + 1);
		expect(internal.reconciled.get(`${claim.id}:${claim.revision}`).observedAt).toBeGreaterThan(after);
		expect(sentTargets.some((entry) => entry.on)).toBe(false);
	});

	it.each(['held acknowledgement', 'unknown acknowledgement'] as const)(
		'waits for a known SQLite commit acknowledgement before retirement: %s',
		async (mode) => {
			const owned = initialFixtureOwner();
			const { owner: runtime, source: database, id: controllerId, settle } = owned;
			const entry = observeOriginalReconciliation(runtime);
			await settle();
			const caseDatabase = database;
			let retired = false,
				completed = false;
			let primary: { cause: unknown } | undefined;
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
				dispatchedAt: null,
				settledAt: null,
				proofId: null,
				fault: null,
			});
			await database.manager.insert(VirtualThermostatCommandEntity, command);
			const retire = jest.fn<void, [readonly string[]]>();
			owned.assertLive();
			proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
			let enter: () => void = () => undefined;
			let rejectObservation: (error: unknown) => void = () => undefined;
			let committedStatus: VirtualThermostatCommandEntity['status'] | undefined;
			let release: () => void = () => undefined;
			const entered = new Promise<void>((resolve, reject) => {
				enter = resolve;
				rejectObservation = reject;
			});
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			const nativeRunners = new Map<object, NonNullable<ReturnType<typeof entry.scope.getStore>>>();
			let once = true;
			const subscriber = {
				afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): void => {
					const original = entry.scope.getStore();
					if (
						!retired &&
						original &&
						entry.isWaitingEntry(original) &&
						original.claim.id === claim.id &&
						original.context.config.controllerId === controllerId &&
						event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
						event.parameters?.includes('confirmed') &&
						event.parameters.includes(command.id)
					)
						nativeRunners.set(event.queryRunner, original);
				},
				afterTransactionRollback: (event: import('typeorm').TransactionRollbackEvent): void => {
					nativeRunners.delete(event.queryRunner);
				},
				afterTransactionCommit: async (event: TransactionCommitEvent) => {
					const original = entry.scope.getStore();
					if (
						retired ||
						!once ||
						original === undefined ||
						nativeRunners.get(event.queryRunner) !== original ||
						!entry.isWaitingEntry(original) ||
						original.claim.id !== claim.id
					)
						return;
					nativeRunners.delete(event.queryRunner);
					once = false;
					try {
						committedStatus = (
							await event.queryRunner.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })
						).status;
					} catch (error: unknown) {
						rejectObservation(error);
						throw error;
					}
					enter();
					await held;
					if (mode === 'unknown acknowledgement') throw new Error('fixture lost commit acknowledgement');
				},
			};
			caseDatabase.subscribers.push(subscriber);
			const retireAckObserver = (): void => {
				retired = true;
				nativeRunners.clear();
				if (!completed) rejectObservation(new Error('Original native commit observation retired'));
				release(); // only this test's original held acknowledgement gate
			};
			const backstop = {
				retire: retireAckObserver,
				cleanup: (): void => {
					retireAckObserver();
					const index = caseDatabase.subscribers.indexOf(subscriber);
					if (index >= 0) caseDatabase.subscribers.splice(index, 1);
					completionObserverBackstops.delete(backstop);
				},
			};
			completionObserverBackstops.add(backstop);
			try {
				const pending = entry.start(claim);
				// Attach both outcomes before releasing the controlled commit gate.
				const outcome: Promise<unknown> = pending.then<unknown, unknown>(
					() => null,
					(error: unknown) => error,
				);
				await entered;
				if (retired) throw new Error('Original ACK owner retired');
				expect(retire).not.toHaveBeenCalled();
				expect(committedStatus).toBe('confirmed');
				release();
				const error = await outcome;
				if (retired) throw new Error('Original ACK owner retired');
				if (mode === 'held acknowledgement') {
					expect(error).toBeNull();
					expect(retire).toHaveBeenCalledWith([command.id]);
				} else {
					expect(error).toEqual(new Error('fixture lost commit acknowledgement'));
					expect(retire).not.toHaveBeenCalled();
				}
			} catch (cause) {
				primary = { cause };
			} finally {
				completed = true;
				try {
					backstop.cleanup();
				} catch (cause) {
					primary ??= { cause };
				}
			}
			if (primary) throw primary.cause;
		},
	);
});

// BEGIN inherited static method descriptor regressions (SOURCE-ONLY; UNEXECUTED)
describe('original method currentness through function-valued prototypes', () => {
	it('accepts the original inherited Date.parse on a local Date subclass', () => {
		class LocalDate extends Date {}
		const original = Date.parse;

		expect(creationMethodCurrent(LocalDate, 'parse', original)).toBe(true);
	});

	it('preserves original identity through multiple function-valued parents', () => {
		class Original {
			static read = (value: number): number => value;
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const original = Original.read;

		expect(creationMethodCurrent(Leaf, 'read', original)).toBe(true);
	});

	it('refuses an own static replacement without recapturing the original', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		Leaf.read = (): string => 'replacement';

		expect(creationMethodCurrent(Leaf, 'read', original)).toBe(false);
	});

	it('refuses a nearer inherited static replacement', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const original = Original.read;
		Middle.read = (): string => 'replacement';

		expect(creationMethodCurrent(Leaf, 'read', original)).toBe(false);
	});

	it('refuses an own accessor returning the original without invoking its getter', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		let getterCalls = 0;
		Object.defineProperty(Leaf, 'read', {
			get: () => {
				getterCalls++;
				return original;
			},
		});

		expect(creationMethodCurrent(Leaf, 'read', original)).toBe(false);
		expect(getterCalls).toBe(0);
	});

	it('refuses a nearer inherited accessor without invoking it or falling through', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const original = Original.read;
		let getterCalls = 0;
		Object.defineProperty(Middle, 'read', {
			get: () => {
				getterCalls++;
				return original;
			},
		});

		expect(creationMethodCurrent(Leaf, 'read', original)).toBe(false);
		expect(getterCalls).toBe(0);
	});

	it('preserves ordinary prototype identity checks and refuses changed or missing methods', () => {
		const original = (): string => 'original';
		const prototype: { read?: () => string } = { read: original };
		const receiver = {};
		Object.setPrototypeOf(receiver, prototype);

		expect(creationMethodCurrent(receiver, 'read', original)).toBe(true);
		prototype.read = (): string => 'replacement';
		expect(creationMethodCurrent(receiver, 'read', original)).toBe(false);
		delete prototype.read;
		expect(creationMethodCurrent(receiver, 'read', original)).toBe(false);
		expect(creationMethodCurrent({}, 'missing', undefined)).toBe(false);
	});
});
// END inherited static method descriptor regressions
