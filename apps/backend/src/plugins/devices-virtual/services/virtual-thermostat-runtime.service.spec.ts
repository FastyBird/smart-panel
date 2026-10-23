import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
import { ClimateAutomationPredecessors } from '../../../modules/devices/contracts/climate-automation.contract';
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
import * as guardedHttp from '../../devices-shelly-ng/services/guarded-shelly-http';
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
	type FixtureBackstop = Readonly<{ retire: () => void; cleanup: () => void | Promise<void> }>;
	const completionObserverBackstops = new Set<FixtureBackstop>();
	type FixtureCaseLease = {
		retired: boolean;
		setup?: FixtureSetupLease;
		setups: Set<FixtureSetupLease>;
		cleanup?: Promise<void>;
		observers: Set<FixtureBackstop>;
	};
	type FixtureSetupLease = {
		caseOwner: FixtureCaseLease;
		retired: boolean;
		completed: boolean;
		completion?: Promise<RuntimeFixtureOwner>;
		cleanup: Promise<void>;
		cleanupStarted: boolean;
		resolveCleanup: () => void;
		rejectCleanup: (cause: unknown) => void;
		issued: Set<Promise<unknown>>;
		cleanupAttempted: boolean;
		cleanupDelivered?: boolean;
		cleanupFailure?: { cause: unknown };
		adopted?: RuntimeFixtureOwner;
		failure?: { cause: unknown };
		observers: Set<FixtureBackstop>;
		assertLive: () => void;
	};
	let currentFixtureCase: FixtureCaseLease | undefined;
	const completionObserverOwners = new WeakMap<
		FixtureBackstop,
		Readonly<{ caseOwner: FixtureCaseLease; setup?: FixtureSetupLease }>
	>();
	const assertFixtureCaseLive = (owner: FixtureCaseLease): void => {
		if (owner.retired || currentFixtureCase !== owner) throw new Error('Fixture case retired');
	};
	const requireFixtureSetup = (): FixtureSetupLease => {
		const owner = currentFixtureCase;
		if (owner === undefined) throw new Error('Fixture case missing');
		assertFixtureCaseLive(owner);
		const setup = owner.setup;
		if (setup === undefined) throw new Error('Fixture setup missing');
		setup.assertLive();
		return setup;
	};
	const registerCaseBackstop = (owner: FixtureCaseLease, observer: FixtureBackstop): void => {
		assertFixtureCaseLive(owner);
		owner.observers.add(observer);
		completionObserverOwners.set(observer, { caseOwner: owner });
		completionObserverBackstops.add(observer);
	};
	const registerCompletionObserver = (observer: FixtureBackstop): void => {
		const setup = requireFixtureSetup();
		setup.observers.add(observer);
		setup.caseOwner.observers.add(observer);
		completionObserverOwners.set(observer, { caseOwner: setup.caseOwner, setup });
		completionObserverBackstops.add(observer);
	};
	const unregisterCompletionObserver = (observer: FixtureBackstop): void => {
		const owner = completionObserverOwners.get(observer);
		owner?.setup?.observers.delete(observer);
		owner?.caseOwner.observers.delete(observer);
		completionObserverOwners.delete(observer);
		completionObserverBackstops.delete(observer);
	};
	const beginFixtureCase = (): FixtureCaseLease => {
		if (currentFixtureCase !== undefined && !currentFixtureCase.retired)
			throw new Error('Previous fixture case still live');
		const owner: FixtureCaseLease = { retired: false, setups: new Set(), observers: new Set() };
		currentFixtureCase = owner;
		return owner;
	};
	const beginFixtureSetup = (owner: FixtureCaseLease): FixtureSetupLease => {
		assertFixtureCaseLive(owner);
		if (owner.setup !== undefined && !owner.setup.retired) throw new Error('Previous fixture setup still live');
		let resolveCleanup: () => void = () => undefined;
		let rejectCleanup: (cause: unknown) => void = () => undefined;
		const cleanup = new Promise<void>((yes, no) => {
			resolveCleanup = yes;
			rejectCleanup = no;
		});
		void cleanup.catch(() => undefined);
		const setup: FixtureSetupLease = {
			cleanup,
			cleanupStarted: false,
			resolveCleanup,
			rejectCleanup,
			caseOwner: owner,
			retired: false,
			completed: false,
			cleanupAttempted: false,
			issued: new Set(),
			observers: new Set(),
			assertLive: (): void => {
				assertFixtureCaseLive(owner);
				if (setup.retired || owner.setup !== setup) throw new Error('Fixture setup retired');
			},
		};
		owner.setup = setup;
		owner.setups.add(setup);
		const backstop = {
			retire: (): void => {
				setup.retired = true;
			},
			cleanup: (): void => {
				setup.retired = true;
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop); // Registered synchronously before the factory's first await.
		return setup;
	};
	type FixtureSetupObservation = Readonly<{
		install: (source: SqliteDataSource) => void;
		issued: (pending: Promise<unknown>) => void;
		sourceAllocated?: (source: SqliteDataSource, directory: string) => void;
		builderCreated?: (builder: ReturnType<typeof Test.createTestingModule>) => void;
	}>;
	let directory: string;
	let database: SqliteDataSource;
	let runtime: VirtualThermostatRuntimeService;
	let realGuardFixtures: Awaited<ReturnType<typeof realThermostatGuardFixture>>[];
	let comfort: VirtualThermostatComfortService;
	let configs: VirtualThermostatConfigService;
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
	let mutationRegistry: ClimateAutomationRegistryService, mutationWriter: ClimateAutomationWriterService;
	let mutationProvider: VirtualThermostatAutomationService;
	type HeldOffSendObserver = Readonly<{
		observe: (
			target: Parameters<ThermostatActuationAdapter['send']>[0],
			claim: Parameters<ThermostatActuationAdapter['send']>[1],
			packet: Parameters<ThermostatActuationAdapter['send']>[4],
		) => void;
		fail: (cause: unknown) => void;
	}>;
	type FixtureState = {
		onSent: ((propertyId: string) => void) | null;
		onQueued: (() => void) | null;
		graphValidated: boolean;
		graphGeneration: number;
		publicationGate: Promise<void> | null;
		samples: Map<string, QualifiedPropertySample>;
		unavailableMembers: Set<string>;
		sends: boolean[];
		sentTargets: { propertyId: string; on: boolean }[];
		actuationAttempts: boolean[];
		onOutcome: 'accepted' | 'refused' | 'unknown';
		offOutcome: 'accepted' | 'refused' | 'unknown';
		onGate: Promise<void> | null;
		offGate: Promise<void> | null;
		heldOffSendObserver: HeldOffSendObserver | null;
		beforeProof: (() => Promise<void>) | null;
		reconciledCommandIds: string[][];
		afterOnGate: Promise<void> | null;
		allowLateOn: boolean;
		acceptedWithoutFeedback: string | null;
		proofAllowed: (propertyId: string) => boolean;
		proofCalls: number;
		installedQualifications: Map<string, ThermostatInstalledQualification>;
		providerCurrent: boolean;
		proofMutation: (proof: ThermostatReleaseOrderingEvidence) => ThermostatReleaseOrderingEvidence;
		protectionProbes: Set<string>;
		packetTick: (() => void) | null;
		retired: boolean;
		cleanupCauses: unknown[];
	};
	const createFixtureState = (): FixtureState => ({
		onSent: null,
		onQueued: null,
		graphValidated: true,
		graphGeneration: 0,
		publicationGate: null,
		samples: new Map(),
		unavailableMembers: new Set(),
		sends: [],
		sentTargets: [],
		actuationAttempts: [],
		onOutcome: 'accepted',
		offOutcome: 'accepted',
		onGate: null,
		offGate: null,
		heldOffSendObserver: null,
		beforeProof: null,
		reconciledCommandIds: [],
		afterOnGate: null,
		allowLateOn: false,
		acceptedWithoutFeedback: null,
		proofAllowed: () => true,
		proofCalls: 0,
		installedQualifications: new Map(),
		providerCurrent: true,
		proofMutation: (proof) => proof,
		protectionProbes: new Set(),
		packetTick: null,
		retired: false,
		cleanupCauses: [],
	});
	let fixtureState: FixtureState;
	const sample = (id: string, value: number | boolean): void => {
		fixtureState.packetTick?.();
		const at = new Date();
		if (id === sensorId) for (const probe of fixtureState.protectionProbes) sample(probe, 20);
		fixtureState.samples.set(id, {
			propertyId: id,
			value,
			sampledAt: at,
			receivedAt: at,
			provenance: 'live',
			quality: 'good',
			reasons: [],
		});
	};
	const createRuntimeFixture = async (
		assertSetupLive?: () => void,
		observation?: FixtureSetupObservation,
		setup?: FixtureSetupLease,
	) => {
		const issued = new Set<Promise<unknown>>();
		const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
			assertSetupLive?.();
			const original = invoke();
			issued.add(original);
			setup?.issued.add(original);
			return original;
		};
		const ownedState = createFixtureState();
		const lifetime: { retired: boolean; cleanup?: Promise<void> } = { retired: false };
		const observers: Readonly<{ retire: () => void; cleanup: () => void }>[] = [];
		assertSetupLive?.();
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
		let comfort: VirtualThermostatComfortService;
		let configs: VirtualThermostatConfigService;
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
		const sample = (id: string, value: number | boolean): void => {
			if (!ownedState.retired) ownedState.packetTick?.();
			const at = new Date();
			if (id === sensorId) for (const probe of ownedState.protectionProbes) sample(probe, 20);
			ownedState.samples.set(id, {
				propertyId: id,
				value,
				sampledAt: at,
				receivedAt: at,
				provenance: 'live',
				quality: 'good',
				reasons: [],
			});
		};
		ordinaryTransportOwner = undefined;
		const realGuardFixtures: Awaited<ReturnType<typeof realThermostatGuardFixture>>[] = [];
		try {
			directory = await issue(() => mkdtemp(join(tmpdir(), 'vd2-thermostat-runtime-')));
			assertSetupLive?.();
			database = new SqliteDataSource({
				type: 'sqlite',
				database: join(directory, 'runtime.sqlite'),
				entities: [__dirname + '/../../../**/*.entity.ts'],
				synchronize: true,
			});
			observation?.sourceAllocated?.(database, directory);
			assertSetupLive?.();
			database = await issue(() => database.initialize());
			assertSetupLive?.();
			// Synchronized test schemas omit migration27's installed graph singleton seed.
			await issue(() =>
				database.query('INSERT INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)'),
			);
			assertSetupLive?.();
			let observationFailure: { cause: unknown } | undefined;
			try {
				observation?.install(database);
			} catch (cause) {
				observationFailure = { cause };
			}
			const initialGraphRead: Promise<unknown> = issue(() =>
				database.query('SELECT "id", "revision" FROM "devices_virtual_graph_revision" ORDER BY "id"'),
			);
			try {
				observation?.issued(initialGraphRead);
			} catch (cause) {
				observationFailure ??= { cause };
			}
			const initialGraphRows = await initialGraphRead; // Original native P wins over optional observation Q.
			if (observationFailure !== undefined) throw observationFailure.cause;
			assertSetupLive?.();
			expect(initialGraphRows).toEqual([{ id: 1, revision: 0 }]);
			events = new EventEmitter2();
			controllerId = uuid();
			sensorId = uuid();
			relayId = uuid();
			const sensorDeviceId = uuid(),
				sensorChannelId = uuid(),
				relayDeviceId = uuid(),
				relayChannelId = uuid();
			await issue(() =>
				database.manager.insert(VirtualDeviceEntity, {
					id: controllerId,
					name: 'Thermostat',
					category: DeviceCategory.THERMOSTAT,
					enabled: true,
					mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
				}),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(DeviceEntity, {
					id: sensorDeviceId,
					name: 'Ambient',
					category: DeviceCategory.SENSOR,
					enabled: true,
				}),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(ChannelEntity, {
					id: sensorChannelId,
					device: sensorDeviceId,
					name: 'Temperature',
					identifier: 'temperature',
					category: ChannelCategory.TEMPERATURE,
				} as never),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(ChannelPropertyEntity, {
					id: sensorId,
					channel: sensorChannelId,
					identifier: 'temperature',
					category: PropertyCategory.TEMPERATURE,
					dataType: DataTypeType.FLOAT,
					permissions: [PermissionType.READ_ONLY],
					unit: '°C',
				} as never),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(ShellyNgDeviceEntity, {
					id: relayDeviceId,
					name: '1PM',
					identifier: 'shellyplus1pm-a8032abe5084',
					category: DeviceCategory.SWITCHER,
					enabled: true,
					canonicalMac: 'A8032ABE5084',
				}),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(ShellyNgChannelEntity, {
					id: relayChannelId,
					device: relayDeviceId,
					name: 'Switch',
					identifier: 'switch:0',
					category: ChannelCategory.SWITCHER,
				} as never),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(ShellyNgChannelPropertyEntity, {
					id: relayId,
					channel: relayChannelId,
					identifier: 'output',
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
				} as never),
			);
			assertSetupLive?.();
			const sensor = await issue(() =>
				database.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: sensorId },
					relations: ['channel', 'channel.device'],
				}),
			);
			assertSetupLive?.();
			const relay = await issue(() =>
				database.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: relayId },
					relations: ['channel', 'channel.device'],
				}),
			);
			assertSetupLive?.();
			const sensorChannel = sensor.channel as ChannelEntity,
				relayChannel = relay.channel as ChannelEntity;
			await issue(() =>
				database.manager.insert(VirtualThermostatConfigEntity, {
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
				}),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(VirtualThermostatSourceEntity, {
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
				}),
			);
			assertSetupLive?.();
			await issue(() =>
				database.manager.insert(VirtualThermostatActuatorClaimEntity, {
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
				}),
			);
			assertSetupLive?.();
			sample(sensorId, 21);
			sample(relayId, false);
			producers = new PropertyProducerRegistryService(events);
			values = {
				write: jest.fn((property: ChannelPropertyEntity, value: number | boolean) => {
					sample(property.id, value);
					return Promise.resolve();
				}),
				readLatest: jest.fn((property: ChannelPropertyEntity) =>
					Promise.resolve(
						Object.assign(new PropertyValueState(), { value: ownedState.samples.get(property.id)?.value }),
					),
				),
				captureSampleSourceGuard: () => () => ownedState.providerCurrent,
				readQualifiedSample: jest.fn((property: ChannelPropertyEntity) =>
					ownedState.unavailableMembers.has(property.id) ? null : (ownedState.samples.get(property.id) ?? null),
				),
				readQualifiedSampleSnapshot: jest.fn((property: ChannelPropertyEntity, maxAgeMs: number, now: Date) => {
					const sample = ownedState.samples.get(property.id);
					return !ownedState.providerCurrent ||
						ownedState.unavailableMembers.has(property.id) ||
						!sample ||
						now.getTime() - sample.sampledAt.getTime() > maxAgeMs
						? null
						: sample;
				}),
				readSampleFreshness: jest.fn((property: ChannelPropertyEntity) => {
					const sample = ownedState.samples.get(property.id);
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
					(...[property, lease, value, publication]: Parameters<PropertyValueService['publishDerived']>) => {
						const pending = (async () => {
							const epoch = producers.version(lease);
							if (ownedState.publicationGate !== null) await ownedState.publicationGate;
							const changed = producers.commit(
								lease,
								Object.assign(new PropertyValueState(), { value }),
								publication,
								epoch,
							);
							return { changed, state: producers.read(property.id) };
						})();
						issued.add(pending);
						return pending; // Same original issued publication Promise; no added reaction/await.
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
					if (!ownedState.installedQualifications.has(claim.physicalIdentity))
						ownedState.installedQualifications.set(
							claim.physicalIdentity,
							Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
						);
					return ownedState.installedQualifications.get(claim.physicalIdentity);
				},
				mintAuthority: () => ({}),
				isAuthorized: () => true,
			} as unknown as VirtualThermostatClaimsService;
			const adapter: ThermostatActuationAdapter = {
				contractVersion: 1,
				providerProfile: { id: 'shelly-ng.guarded-switch', version: 1 },
				canReconcile: () => true,
				send: async (target, _claim, _qualification, isAdmitted, packet) => {
					ownedState.actuationAttempts.push(target.value === true);
					if (target.property.id === relayId && target.value === true && ownedState.onGate !== null) {
						if (!ownedState.retired) ownedState.onQueued?.();
						await ownedState.onGate;
					}
					if (target.value === false && ownedState.offGate !== null) {
						const observer = ownedState.retired ? null : ownedState.heldOffSendObserver;
						try {
							observer?.observe(target, _claim, packet);
						} catch (cause) {
							try {
								observer?.fail(cause);
							} catch {
								/* Optional observation never replaces the original send outcome. */
							}
						}
						await ownedState.offGate;
					}
					if (!isAdmitted() && !(target.value === true && ownedState.allowLateOn))
						return { outcome: 'refused' as const, reasons: ['revoked'] };
					const outcome = target.value === true ? ownedState.onOutcome : ownedState.offOutcome;
					if (outcome === 'refused') return { outcome, reasons: ['known_no_send'] };
					const wasOn = ownedState.samples.get(target.property.id)?.value === true;
					ownedState.sends.push(target.value as boolean);
					ownedState.sentTargets.push({ propertyId: target.property.id, on: target.value as boolean });
					if (target.value !== true || target.property.id !== ownedState.acceptedWithoutFeedback)
						sample(target.property.id, target.value as boolean);
					if (!ownedState.retired && target.value === true) ownedState.onSent?.(target.property.id);
					if (target.property.id === relayId && target.value === true && ownedState.afterOnGate !== null)
						await ownedState.afterOnGate;
					if (outcome === 'unknown') return { outcome, outputConfirmed: false, pendingOnDrained: false };
					return {
						outcome: 'accepted' as const,
						wasOn,
						outputConfirmed: false as const,
						pendingOnDrained: false as const,
					};
				},
				reconcile: async (target, ids, _off, isCurrent, scope) => {
					ownedState.proofCalls++;
					ownedState.reconciledCommandIds.push([...ids]);
					if (!ownedState.retired) await ownedState.beforeProof?.();
					if (ownedState.retired) return null; // Synthetic proof callbacks have no authority after their fixture closes.
					const observedAt = new Date();
					if (isCurrent() && ownedState.proofAllowed(target.property.id)) sample(target.property.id, false);
					return isCurrent() && ownedState.proofAllowed(target.property.id)
						? ownedState.proofMutation({
								proofId: uuid(),
								scope,
								observedAt,
								isCurrent,
								sourceIsCurrent: () => ownedState.providerCurrent,
								physicalIdentity: thermostatActuatorIdentity(target.property, target.channel, target.device) ?? '',
								connectionIdentity: 'ordered-fake-connection',
								coveredCommandIds: ids,
								externalWriterBarrier: true,
								offSample: ownedState.samples.get(target.property.id),
							})
						: null;
				},
			};
			const platforms = new PlatformRegistryService();
			const transport = new VirtualThermostatTransportService(platforms, values);
			const dispose = transport.register(DEVICES_SHELLY_NG_TYPE, adapter);
			ordinaryTransportOwner = Object.freeze({ platforms, transport, dispose });
			const graph = {
				isValidated: () => ownedState.graphValidated,
				capturePublishGuard: () => {
					const generation = ownedState.graphGeneration;
					return () => ownedState.graphValidated && generation === ownedState.graphGeneration;
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
			const builder = Test.createTestingModule({
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
			});
			observation?.builderCreated?.(builder);
			assertSetupLive?.();
			mutationPipeline = await issue(() => builder.compile());
			assertSetupLive?.();
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
			await issue(() => mutationGraph.onApplicationBootstrap());
			assertSetupLive?.();
			await issue(() => mutationClaims.onApplicationBootstrap());
			assertSetupLive?.();
			await issue(() => database.query('DROP TABLE "devices_module_climate_automation_slots"'));
			assertSetupLive?.();
			await issue(() => database.query('DROP TABLE "devices_module_climate_automation_sources"'));
			assertSetupLive?.();
			await issue(() => new AddClimateAutomationOwnership1000000000047().up(database.createQueryRunner()));
			assertSetupLive?.();
			const runtimePorts = { values, comfort };
			makeRuntime = (runtimeGraph = graph, aggregate, runtimeTransport = transport) =>
				new VirtualThermostatRuntimeService(
					database,
					new DeviceStructureLockService(),
					claims,
					new VirtualThermostatInputsService(database, runtimePorts.values, aggregate),
					runtimeTransport,
					runtimePorts.values,
					producers,
					events,
					runtimeGraph,
					runtimePorts.comfort,
					new ConfigService(),
				);
			runtime = makeRuntime();
			assertSetupLive?.();
			const previousObservers = new Set(completionObserverBackstops);
			try {
				installInitialRuntimeObservers(runtime, database, controllerId);
			} finally {
				observers.push(...[...completionObserverBackstops].filter((observer) => !previousObservers.has(observer)));
			}
			await issue(() => runtime.onApplicationBootstrap());
			assertSetupLive?.();
			assertSetupLive?.();
			return {
				directory,
				database,
				runtime,
				ordinaryTransportOwner,
				realGuardFixtures,
				comfort,
				configs,
				controllerId,
				sensorId,
				relayId,
				makeRuntime,
				events,
				producers,
				values,
				mutationPipeline,
				mutationValues,
				mutationClaims,
				mutationRegistry,
				mutationWriter,
				mutationProvider,
				mutationGraph,
				mutationStructure,
				state: ownedState,
				lifetime,
				issued,
				sample,
				runtimePorts,
				observers,
			};
		} catch (cause) {
			if (setup !== undefined) setup.failure ??= { cause };
			ownedState.retired = true;
			const native = runtime === undefined ? [] : [...runtime['queues'].values(), ...runtime['inFlight'].values()];
			// These optional references are local to THIS construction, never an earlier/later suite owner.
			const attempt = (action: () => void): void => {
				try {
					action();
				} catch (cause) {
					ownedState.cleanupCauses.push(cause);
					if (setup !== undefined) setup.cleanupFailure ??= { cause }; /* Original setup P is retained. */
				}
			};
			const attemptAsync = async (action: () => Promise<unknown>): Promise<void> => {
				try {
					await action();
				} catch (cause) {
					ownedState.cleanupCauses.push(cause);
					if (setup !== undefined) setup.cleanupFailure ??= { cause }; /* Original setup P is retained. */
				}
			};
			for (const observer of observers) attempt(() => observer.retire());
			attempt(() => runtime?.onModuleDestroy());
			attempt(() => ordinaryTransportOwner?.dispose());
			attempt(() => ordinaryTransportOwner?.transport.onModuleDestroy());
			attempt(() => ordinaryTransportOwner?.platforms.onModuleDestroy());
			attempt(() => mutationProvider?.onModuleDestroy());
			attempt(() => comfort?.onModuleDestroy());
			attempt(() => mutationClaims?.onModuleDestroy());
			attempt(() => mutationRegistry?.onModuleDestroy());
			for (const fixture of realGuardFixtures) attempt(() => fixture.revoke());
			for (const pending of native) await attemptAsync(() => pending);
			for (const observer of observers) {
				await attemptAsync(async () => {
					const cleanupObserver: FixtureBackstop = observer;
					await cleanupObserver.cleanup();
				});
			}
			for (const fixture of realGuardFixtures) await attemptAsync(() => fixture.close());
			await attemptAsync(async () => {
				if (mutationPipeline) await mutationPipeline.close();
			});
			attempt(() => producers?.onModuleDestroy());
			await attemptAsync(async () => {
				if (database?.isInitialized) await database.destroy();
			});
			await attemptAsync(async () => {
				if (directory !== undefined) await rm(directory, { recursive: true, force: true });
			});
			throw cause;
		}
	};
	type RuntimeFixtureOwner = Awaited<ReturnType<typeof createRuntimeFixture>>;
	const registerOwnedFixtureObserver = (
		owned: RuntimeFixtureOwner,
		observer: RuntimeFixtureOwner['observers'][number],
	): void => {
		const observers = owned.observers;
		if (!observers.includes(observer)) observers.push(observer);
	};
	const removeOwnedFixtureObserver = (
		owned: RuntimeFixtureOwner,
		observer: RuntimeFixtureOwner['observers'][number],
	): void => {
		const observers = owned.observers;
		const index = observers.indexOf(observer);
		if (index !== -1) observers.splice(index, 1);
	};
	let fixtureOwner: RuntimeFixtureOwner;
	const adoptRuntimeFixture = (setup: FixtureSetupLease, owner: RuntimeFixtureOwner): void => {
		setup.assertLive();
		setup.adopted = owner;
		fixtureOwner = owner;
		fixtureState = owner.state;
		directory = owner.directory;
		database = owner.database;
		runtime = owner.runtime;
		void owner.ordinaryTransportOwner; // Preserve the original adoption lookup; no unused suite alias.
		realGuardFixtures = owner.realGuardFixtures;
		comfort = owner.comfort;
		configs = owner.configs;
		controllerId = owner.controllerId;
		sensorId = owner.sensorId;
		relayId = owner.relayId;
		makeRuntime = owner.makeRuntime;
		events = owner.events;
		producers = owner.producers;
		values = owner.values;
		void owner.mutationPipeline; // Preserve the original adoption lookup; no unused suite alias.
		void owner.mutationValues; // Preserve the original adoption lookup; no unused suite alias.
		void owner.mutationClaims; // Preserve the original adoption lookup; no unused suite alias.
		mutationRegistry = owner.mutationRegistry;
		mutationWriter = owner.mutationWriter;
		mutationProvider = owner.mutationProvider;
	};
	const completeFixtureSetup = (
		setup: FixtureSetupLease,
		observation?: FixtureSetupObservation,
	): Promise<RuntimeFixtureOwner> => {
		if (setup.completion !== undefined) return setup.completion;
		let resolve: (owner: RuntimeFixtureOwner) => void = () => undefined;
		let reject: (cause: unknown) => void = () => undefined;
		const completion = new Promise<RuntimeFixtureOwner>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		setup.completion = completion; // Before factory entry, its first await or a reentrant retirement.
		void completion.catch(() => undefined); // Test completion only, not an application Promise replacement.
		const finish = async (): Promise<void> => {
			let owned: RuntimeFixtureOwner | undefined;
			let failure: { cause: unknown } | undefined;
			try {
				setup.assertLive();
				owned = await createRuntimeFixture(setup.assertLive, observation, setup);
				adoptRuntimeFixture(setup, owned);
			} catch (cause) {
				failure = { cause };
				setup.failure ??= failure;
			}
			if (owned !== undefined && setup.adopted !== owned) {
				try {
					await closeRuntimeFixture(owned);
				} catch (cause) {
					failure ??= { cause };
					setup.cleanupFailure ??= { cause };
				}
			}
			setup.completed = true; // Adoption OR exact orphan-result cleanup is complete.
			if (failure !== undefined) reject(failure.cause);
			else if (owned === undefined) reject(new Error('Completed fixture setup has no owner'));
			else resolve(owned);
		};
		void finish().catch((cause: unknown) => {
			setup.failure ??= { cause };
			setup.completed = true;
			reject(cause);
		});
		return completion;
	};
	const teardownFixtureSetup = (setup: FixtureSetupLease, finishCase = false): Promise<void> => {
		setup.retired = true;
		if (!setup.cleanupStarted) {
			setup.cleanupStarted = true; // Promise was published by beginFixtureSetup before any factory await.
			const resolve = setup.resolveCleanup,
				reject = setup.rejectCleanup;
			const clean = async (): Promise<void> => {
				let failure = setup.failure ?? setup.cleanupFailure;
				const attempt = (action: () => void): void => {
					try {
						action();
					} catch (cause) {
						setup.cleanupFailure ??= { cause };
						failure ??= { cause };
					}
				};
				const attemptAsync = async (action: () => Promise<unknown>): Promise<void> => {
					try {
						await action();
					} catch (cause) {
						setup.cleanupFailure ??= { cause };
						failure ??= { cause };
					}
				};
				const observers = [...setup.observers];
				for (const observer of observers) attempt(() => observer.retire());
				const owned = setup.adopted;
				const native =
					owned === undefined ? [] : [...owned.runtime['queues'].values(), ...owned.runtime['inFlight'].values()];
				if (owned !== undefined) attempt(() => retireRuntimeFixture(owned));
				const originalSetup = setup.completion;
				if (originalSetup !== undefined) {
					try {
						await originalSetup;
					} catch (cause) {
						failure ??= { cause };
					}
				}
				for (const pending of setup.issued) {
					try {
						await pending;
					} catch (cause) {
						failure ??= { cause };
					}
				}
				for (const pending of native) await attemptAsync(() => pending);
				const fixtureObservers = new Set<FixtureBackstop>(owned?.observers ?? []);
				for (const observer of observers) {
					if (!fixtureObservers.has(observer))
						await attemptAsync(async () => {
							await observer.cleanup();
						});
				}
				if (owned !== undefined) await attemptAsync(() => closeRuntimeFixture(owned));
				setup.cleanupAttempted = true;
				if (setup.failure !== undefined) throw setup.failure.cause;
				if (failure !== undefined) throw failure.cause;
			};
			void clean().then(resolve, reject);
		}
		// Existing ownership7 intentionally retire held unadopted A before B. This returns
		// retirement only; final case cleanup retains/joins the exact pending completion.
		if (!finishCase && setup.completion !== undefined && !setup.completed && setup.adopted === undefined)
			return Promise.resolve();
		if (!finishCase) setup.cleanupDelivered = true; // The exact rejected/fulfilled cleanup Promise is handed to that caller.
		return setup.cleanup;
	};
	const teardownFixtureCase = (owner: FixtureCaseLease): Promise<void> => {
		if (owner.cleanup !== undefined) return owner.cleanup;
		let resolve: () => void = () => undefined;
		let reject: (cause: unknown) => void = () => undefined;
		const completion = new Promise<void>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		owner.cleanup = completion; // Before retire callbacks or cleanup can reenter.
		owner.retired = true;
		void completion.catch(() => undefined);
		const finish = async (): Promise<void> => {
			let failure: { cause: unknown } | undefined;
			const attempt = (action: () => void): void => {
				try {
					action();
				} catch (cause) {
					failure ??= { cause };
				}
			};
			for (const observer of owner.observers) attempt(() => observer.retire()); // Open held gates BEFORE joins.
			for (const setup of owner.setups) {
				setup.retired = true;
				try {
					await teardownFixtureSetup(setup, true);
				} catch (cause) {
					if (!setup.cleanupDelivered) failure ??= { cause };
				}
			}
			if (currentFixtureCase === owner) {
				if ([...owner.setups].every((setup) => setup.cleanupFailure === undefined))
					attempt(() => jest.restoreAllMocks());
				// Foreign descriptors remain untouched; the exact current case still attempts its own timer restoration.
				attempt(() => jest.useRealTimers());
			}
			if (failure !== undefined) throw failure.cause;
		};
		void finish().then(resolve, reject);
		return completion;
	};
	beforeEach(async () => {
		const owner = beginFixtureCase();
		const setup = beginFixtureSetup(owner);
		await completeFixtureSetup(setup);
	});
	afterEach(async () => {
		const owner = currentFixtureCase;
		if (owner !== undefined) await teardownFixtureCase(owner);
	});

	// Test-only exact setup/resource issuance; never native admission or runtime lifecycle authority.
	const captureFixtureWorkOwner = (owned = fixtureOwner, setup = requireFixtureSetup()) => {
		const owner = captureRealGuardOwner(owned, setup);
		const pending = new Set<Promise<unknown>>();
		let retired = false;
		const assertLive = (): void => {
			owner.assertLive();
			if (retired) throw new Error('Original fixture work retired');
		};
		const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
			assertLive();
			const original = invoke();
			pending.add(original);
			setup.issued.add(original);
			owned.issued.add(original);
			return original; // SAME application Promise, no reaction or replacement at the port.
		};
		const consumed = (original: Promise<unknown>): void => {
			pending.delete(original);
			setup.issued.delete(original);
			owned.issued.delete(original);
		};
		const observe = async <T>(original: Promise<T>): Promise<T> => {
			try {
				return await original;
			} finally {
				consumed(original);
			} // Only after genuine original outcome observation.
		};
		const joinIssued = async (): Promise<void> => {
			let failure: { cause: unknown } | undefined;
			const issued = [...pending]; // Original already-issued work only, never this join/body/test gates.
			for (const original of issued) {
				try {
					await original;
				} catch (cause) {
					failure ??= { cause };
				}
				consumed(original);
			}
			if (failure !== undefined) throw failure.cause;
		};
		assertLive();
		return Object.freeze({
			owner,
			owned,
			setup,
			assertLive,
			issue,
			observe,
			joinIssued,
			retire: (): void => {
				retired = true;
			},
		});
	};
	type FixtureWorkOwner = ReturnType<typeof captureFixtureWorkOwner>;
	type FixtureResourceInput = Readonly<{
		database: SqliteDataSource;
		controllerId: string;
		assertLive: () => void;
		owner?: RealGuardOwner;
		work?: FixtureWorkOwner;
	}>;
	const captureFixtureResourceWork = (
		resource?: FixtureResourceInput,
		selected?: FixtureWorkOwner,
	): FixtureWorkOwner => {
		resource?.assertLive();
		const work =
			selected ??
			resource?.work ??
			(resource?.owner === undefined
				? captureFixtureWorkOwner()
				: captureFixtureWorkOwner(resource.owner.owned, resource.owner.setup));
		work.assertLive();
		if (
			resource !== undefined &&
			(resource.database !== work.owned.database || resource.controllerId !== work.owned.controllerId)
		)
			throw new Error('Supplied resource has a different original fixture work owner');
		return work; // A literal A resource cannot enroll into current B's ledger on a mismatch.
	};

	const waitForOnJournal = async (selected?: FixtureWorkOwner): Promise<VirtualThermostatCommandEntity> => {
		const work = selected ?? captureFixtureWorkOwner();
		work.assertLive();
		const owner = work.owned.runtime,
			source = work.owned.database,
			id = work.owned.controllerId;
		for (let attempt = 0; attempt < 6; attempt++) {
			work.assertLive();
			await work.observe(work.issue(() => owner.inspect(id)));
			work.assertLive();
			const command = (
				await work.observe(
					work.issue(() => source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })),
				)
			).find(
				// SAME original six-attempt durable dispatch predicate and product calls.
				(row) => row.action === 'on' && row.status === 'dispatching',
			);
			work.assertLive();
			if (command) return command;
		}
		throw new Error('ON did not reach the durable dispatch journal');
	};
	const createTemperatureOutput = async (
		owned?: FixtureResourceInput,
		selected?: FixtureWorkOwner,
	): Promise<string> => {
		const work = captureFixtureResourceWork(owned, selected);
		const source = work.owned.database,
			id = work.owned.controllerId;
		const channelId = uuid(),
			propertyId = uuid();
		work.assertLive();
		await work.observe(
			work.issue(() =>
				source.manager.insert(VirtualChannelEntity, {
					id: channelId,
					device: id,
					name: 'Current temperature',
					identifier: 'temperature',
					category: ChannelCategory.TEMPERATURE,
				} as never),
			),
		);
		work.assertLive();
		await work.observe(
			work.issue(() =>
				source.manager.insert(VirtualChannelPropertyEntity, {
					id: propertyId,
					channel: channelId,
					identifier: 'temperature',
					category: PropertyCategory.TEMPERATURE,
					dataType: DataTypeType.FLOAT,
					permissions: [PermissionType.READ_ONLY],
					unit: '°C',
					valueOrigin: VirtualValueOrigin.LOCAL,
				} as never),
			),
		);
		work.assertLive();
		return propertyId;
	};

	// A body lease is a negative test-lifetime check, never native admission/currentness authority.
	const captureFixtureBodyOwner = (fixture: RuntimeFixtureOwner) => {
		const lifecycle = fixture.runtime['lifecycle'];
		const work = captureFixtureWorkOwner(fixture);
		let retired = false;
		const assertLive = (): void => {
			if (retired || fixture.state.retired || !fixture.runtime['active'] || fixture.runtime['lifecycle'] !== lifecycle)
				throw new Error('Original fixture body retired');
		};
		const backstop = {
			retire: (): void => {
				retired = true;
				work.retire();
			},
			cleanup: (): void => {
				retired = true;
				work.retire();
				unregisterCompletionObserver(backstop);
			},
		};
		assertLive();
		registerCompletionObserver(backstop);
		return Object.freeze({
			fixture,
			work,
			runtime: fixture.runtime,
			comfort: fixture.comfort,
			database: fixture.database,
			controllerId: fixture.controllerId,
			sensorId: fixture.sensorId,
			state: fixture.state,
			assertLive,
			retire: backstop.retire,
			cleanup: backstop.cleanup,
			sample: (id: string, value: number | boolean): void => {
				assertLive();
				fixture.sample(id, value);
			},
		});
	};
	type FixtureBodyOwner = ReturnType<typeof captureFixtureBodyOwner>;
	const settle = async (
		owned?: FixtureBodyOwner,
		forward?: <T>(invoke: () => Promise<T>) => Promise<T>,
	): Promise<void> => {
		const issue = <T>(invoke: () => Promise<T>): Promise<T> => (forward === undefined ? invoke() : forward(invoke));
		if (owned !== undefined) {
			for (let attempt = 0; attempt < 5; attempt++) {
				owned.assertLive();
				await issue(() => owned.runtime.flush());
				owned.assertLive();
				await issue(() => Promise.all([...owned.runtime['inFlight'].values()]));
				owned.assertLive();
			}
			owned.assertLive();
			await issue(() => owned.runtime.flush());
			owned.assertLive();
			return;
		}
		const originalFixture = fixtureOwner,
			originalRuntime = originalFixture.runtime,
			originalSetup = requireFixtureSetup();
		const assertLive = (): void => {
			originalSetup.assertLive();
			if (originalFixture.state.retired || originalFixture.runtime !== originalRuntime)
				throw new Error('Original settle owner retired');
		};
		for (let attempt = 0; attempt < 5; attempt++) {
			assertLive();
			await originalRuntime.flush();
			assertLive();
			await Promise.all([...originalRuntime['inFlight'].values()]);
			assertLive();
		}
		assertLive();
		await originalRuntime.flush();
		assertLive();
	};

	// Used only by the ownership negatives for an additional real fixture in the SAME case.
	// No framework mock/timer restoration: those global resources belong to the enclosing current case.
	const retireRuntimeFixture = (owned: RuntimeFixtureOwner): void => {
		if (owned.lifetime.retired) return;
		owned.lifetime.retired = true;
		owned.state.retired = true;
		let failure: { cause: unknown } | undefined;
		const attempt = (action: () => void): void => {
			try {
				action();
			} catch (cause) {
				owned.state.cleanupCauses.push(cause);
				failure ??= { cause };
			}
		};
		for (const observer of [...owned.observers]) attempt(() => observer.retire());
		attempt(() => owned.runtime.onModuleDestroy());
		attempt(() => owned.ordinaryTransportOwner?.dispose());
		attempt(() => owned.ordinaryTransportOwner?.transport.onModuleDestroy());
		attempt(() => owned.ordinaryTransportOwner?.platforms.onModuleDestroy());
		attempt(() => owned.mutationProvider.onModuleDestroy());
		attempt(() => owned.comfort.onModuleDestroy());
		attempt(() => owned.mutationClaims.onModuleDestroy());
		attempt(() => owned.mutationRegistry.onModuleDestroy());
		for (const fixture of owned.realGuardFixtures) attempt(() => fixture.revoke());
		if (failure !== undefined) throw failure.cause;
	};
	const closeRuntimeFixture = (owned: RuntimeFixtureOwner): Promise<void> => {
		if (owned.lifetime.cleanup !== undefined) return owned.lifetime.cleanup;
		let resolve: () => void = () => undefined;
		let reject: (cause: unknown) => void = () => undefined;
		const completion = new Promise<void>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		owned.lifetime.cleanup = completion;
		void completion.catch(() => undefined);
		const close = async (): Promise<void> => {
			let failure: { cause: unknown } | undefined;
			const attempt = (action: () => void): void => {
				try {
					action();
				} catch (cause) {
					owned.state.cleanupCauses.push(cause);
					failure ??= { cause };
				}
			};
			const attemptAsync = async (action: () => Promise<unknown>): Promise<void> => {
				try {
					await action();
				} catch (cause) {
					owned.state.cleanupCauses.push(cause);
					failure ??= { cause };
				}
			};
			const native = [...owned.runtime['queues'].values(), ...owned.runtime['inFlight'].values()];
			attempt(() => retireRuntimeFixture(owned));
			for (const pending of native) await attemptAsync(() => pending);
			for (const pending of owned.issued) await attemptAsync(() => pending);
			attempt(() => owned.producers.onModuleDestroy());
			for (const observer of [...owned.observers]) {
				await attemptAsync(async () => {
					const cleanupObserver: FixtureBackstop = observer;
					await cleanupObserver.cleanup();
				});
			}
			for (const fixture of owned.realGuardFixtures) await attemptAsync(() => closeRecordedRealGuard(fixture));
			await attemptAsync(() => owned.mutationPipeline.close());
			if (owned.database.isInitialized) await attemptAsync(() => owned.database.destroy());
			await attemptAsync(() => rm(owned.directory, { recursive: true, force: true }));
			if (failure !== undefined) throw failure.cause;
		};
		void close().then(resolve, reject);
		return completion;
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
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop);
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
		// R68 opt-in test protocol. These observers are installed BEFORE bootstrap/native method pins.
		type Outcome = { fulfilled: true; cause?: never } | { fulfilled: false; cause: unknown };
		type ServiceReceipt = { observed: true; outcome: Outcome } | { observed: false };
		type Job = NonNullable<ReturnType<(typeof owner)['offJobs']['get']>>;
		type Child = Parameters<(typeof owner)['serviceFeedback']>[0];
		type Frame = {
			readonly identity: object;
			readonly publicTicket: object | undefined;
			readonly lifecycle: object;
			readonly child?: Child;
			closed: boolean;
		};
		type Native = { entry: Entry; frame: Frame; outcome: Promise<Outcome>; completed: boolean; result?: Outcome };
		type NamedRecord = {
			readonly seed: VirtualThermostatCommandEntity;
			readonly claim: VirtualThermostatActuatorClaimEntity;
			readonly lifecycle: object;
			readonly job: Job;
			readonly operation: Promise<void>;
			readonly ids: readonly string[];
			readonly operationOutcome: Promise<Outcome>;
			readonly operationState: { outcome?: Outcome };
			readonly serviceState: { receipt?: ServiceReceipt };
			readonly serviceOutcome: Promise<ServiceReceipt>;
			finishService: (receipt: ServiceReceipt) => void;
			child?: Child;
		};
		type Attempt = {
			readonly claim: VirtualThermostatActuatorClaimEntity;
			readonly seed: VirtualThermostatCommandEntity;
			readonly lifecycle: object;
			readonly entries: WeakMap<Entry, Native>;
			readonly frames: Set<Frame>;
			readonly secondary: unknown[];
			readonly opening: Promise<readonly string[]>;
			opened: (ids: readonly string[]) => void;
			failOpening: (cause: unknown) => void;
			native?: Native;
			observerFailure?: { cause: unknown };
			closed: boolean;
			inspections: number;
		};
		const namedFlow = new AsyncLocalStorage<Frame>();
		const inFlight = owner['inFlight'];
		const originalSetView: OriginalFunctions<typeof inFlight> = inFlight;
		const originalSet: OriginalFunction<typeof inFlight, (typeof inFlight)['set']> = originalSetView.set;
		const setBefore = Object.getOwnPropertyDescriptor(inFlight, 'set');
		const originalService: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['serviceFeedback']> =
			owner['serviceFeedback'];
		const serviceBefore = Object.getOwnPropertyDescriptor(owner, 'serviceFeedback');
		const originalInspectView: OriginalFunctions<VirtualThermostatRuntimeService> = owner;
		const originalInspect: OriginalFunction<VirtualThermostatRuntimeService, (typeof owner)['inspect']> =
			originalInspectView.inspect;
		let named: Attempt | undefined;
		let namedRecord: NamedRecord | undefined;
		let setOwned = false,
			serviceOwned = false;
		const failObserver = (attempt: Attempt, cause: unknown): void => {
			if (attempt.closed) return;
			if (attempt.observerFailure === undefined) attempt.observerFailure = { cause };
			else attempt.secondary.push(cause);
			attempt.failOpening(cause);
		};
		const namedEntryCurrent = (entry: Entry, frame: Frame, attempt: Attempt): boolean =>
			!retired &&
			!attempt.closed &&
			!frame.closed &&
			attempt.frames.has(frame) &&
			namedFlow.getStore() === frame &&
			entry.owner === owner &&
			entry.lifecycle === attempt.lifecycle &&
			frame.lifecycle === attempt.lifecycle &&
			owner['active'] &&
			owner['dataSource'] === source &&
			owner['lifecycle'] === attempt.lifecycle &&
			entry.ticket === frame.publicTicket &&
			entry.claim.id === attempt.claim.id &&
			entry.claim.revision === attempt.claim.revision &&
			entry.claim.contractFingerprint === attempt.claim.contractFingerprint &&
			entry.claim.sourcePropertyId === attempt.claim.sourcePropertyId &&
			entry.claim.physicalIdentity === attempt.claim.physicalIdentity &&
			entry.claim.controllerId === originalControllerId &&
			entry.context.config.controllerId === originalControllerId;
		const selectNative = (entry: Entry, originalFailure = false): void => {
			const attempt = named;
			if (attempt === undefined || attempt.closed) return;
			try {
				const native = attempt.entries.get(entry);
				if (
					native === undefined ||
					(!originalFailure && (native.completed || !namedEntryCurrent(entry, native.frame, attempt)))
				)
					return;
				if (attempt.native === undefined) attempt.native = native;
				else if (attempt.native !== native)
					failObserver(attempt, new Error('More than one full native entry in a named attempt'));
			} catch (cause) {
				failObserver(attempt, cause);
			}
		};
		const setting = function (this: typeof inFlight, ...args: Parameters<typeof originalSet>) {
			const result = originalSet.call(this, ...args); // Original native call/throw is OUTSIDE observation containment.
			const attempt = named;
			if (attempt !== undefined && !attempt.closed) {
				try {
					const frame = namedFlow.getStore();
					const command = owner['inFlightCommands'].get(args[0]);
					const job = command === undefined ? undefined : owner['offJobs'].get(command);
					if (
						this !== inFlight ||
						namedRecord !== undefined ||
						frame === undefined ||
						frame.child !== undefined ||
						frame.closed ||
						!attempt.frames.has(frame) ||
						publicEntry.getStore() !== frame.publicTicket ||
						owner['lifecycle'] !== attempt.lifecycle ||
						owner['dataSource'] !== source ||
						!owner['active'] ||
						command === undefined ||
						job === undefined ||
						command.action !== 'off' ||
						command.controllerId !== originalControllerId ||
						command.claimId !== attempt.claim.id ||
						command.claimRevision !== attempt.claim.revision ||
						job.command !== command ||
						job.operation !== args[1] ||
						job.context.config.controllerId !== originalControllerId ||
						!job.context.claims.some(
							(member) => member.id === attempt.claim.id && member.revision === attempt.claim.revision,
						) ||
						!job.context.commands.some((member) => member.id === attempt.seed.id && member.action === 'on') ||
						job.evaluation.context !== job.context ||
						job.evaluation.lifecycle !== attempt.lifecycle ||
						owner['contexts'].get(originalControllerId) !== job.context ||
						owner['feedbackContexts'].get(job.context) !== job.evaluation.episode ||
						job.evaluation.episode.retired
					)
						throw new Error('Original OFF insertion did not match the unique named preparation');
					const ids = Object.freeze([attempt.seed.id, command.id]);
					if (new Set(ids).size !== 2) throw new Error('Named OFF reused its accepted ON identity');
					const operationState: { outcome?: Outcome } = {};
					const operationOutcome = args[1].then<Outcome, Outcome>(
						() => {
							try {
								const outcome: Outcome =
									job.failure !== undefined
										? { fulfilled: false, cause: job.failure.cause }
										: !job.terminal || !job.outputSaved || job.result !== 'accepted'
											? {
													fulfilled: false,
													cause: new Error('Named OFF did not finish an accepted saved native outcome'),
												}
											: { fulfilled: true };
								operationState.outcome = outcome;
								return outcome;
							} catch (cause) {
								failObserver(attempt, cause);
								return { fulfilled: true };
							}
						},
						(cause: unknown) => {
							const outcome: Outcome = { fulfilled: false, cause };
							operationState.outcome = outcome;
							return outcome;
						},
					);
					const serviceState: { receipt?: ServiceReceipt } = {};
					let finishService: (receipt: ServiceReceipt) => void = () => undefined;
					const serviceOutcome = new Promise<ServiceReceipt>((resolve) => {
						finishService = (receipt): void => {
							serviceState.receipt ??= receipt;
							resolve(receipt);
						};
					});
					namedRecord = {
						seed: attempt.seed,
						claim: attempt.claim,
						lifecycle: attempt.lifecycle,
						job,
						operation: args[1],
						ids,
						operationOutcome,
						operationState,
						serviceState,
						serviceOutcome,
						finishService,
					};
					attempt.opened(ids);
				} catch (cause) {
					failObserver(attempt, cause);
				}
			}
			return result; // SAME native Map return, not a receipt.
		};
		const servicing = function (this: VirtualThermostatRuntimeService, ...args: Parameters<typeof originalService>) {
			const attempt = named,
				record = namedRecord,
				child = args[0];
			let frame: Frame | undefined;
			if (attempt !== undefined && !attempt.closed && record !== undefined) {
				try {
					// Reconciliation children are not the detached OFF completion. Only the exact fallback/job tuple qualifies.
					if (child.purpose !== 'RECONCILIATION_OFF') {
						if (
							this !== owner ||
							retired ||
							owner['lifecycle'] !== attempt.lifecycle ||
							!owner['active'] ||
							record.lifecycle !== attempt.lifecycle ||
							record.child !== undefined ||
							child.context !== record.job.context ||
							child.evaluation !== record.job.evaluation ||
							child.episode !== record.job.evaluation.episode ||
							child.episode.retired ||
							(child.purpose === 'OFF_COMMAND_COMPLETION'
								? child.job !== undefined
								: child.purpose !== 'GUARDED_OFF_DISPATCH' || child.job !== record.job)
						)
							throw new Error('Original OFF completion service was foreign or ambiguous');
						record.child = child;
						frame = {
							identity: Object.freeze({}),
							publicTicket: publicEntry.getStore(),
							lifecycle: attempt.lifecycle,
							child,
							closed: false,
						};
						attempt.frames.add(frame);
					}
				} catch (cause) {
					failObserver(attempt, cause);
					record.finishService({ observed: false });
				}
			}
			// No application callback awaits a test receipt. Preserve the original receiver/arguments/Promise.
			const pending =
				frame === undefined
					? originalService.call(this, ...args)
					: namedFlow.run(frame, () => originalService.call(this, ...args));
			if (frame !== undefined && attempt !== undefined && record !== undefined) {
				const observedFrame = frame;
				void pending.then(
					() => {
						observedFrame.closed = true;
						record.finishService({ observed: true, outcome: { fulfilled: true } });
					},
					(cause: unknown) => {
						observedFrame.closed = true;
						attempt.secondary.push(cause);
						record.finishService({ observed: true, outcome: { fulfilled: false, cause } });
					},
				);
			}
			return pending;
		};
		const setInstalled = {
			configurable: true,
			enumerable: setBefore?.enumerable ?? false,
			writable: true,
			value: setting,
		};
		const serviceInstalled = {
			configurable: true,
			enumerable: serviceBefore?.enumerable ?? false,
			writable: true,
			value: servicing,
		};
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
				) {
					entry.nativeRead = true;
					selectNative(entry);
				}
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
			const attempt = named,
				frame = namedFlow.getStore();
			let finishNamed: ((outcome: Outcome) => void) | undefined;
			if (attempt !== undefined && frame !== undefined) {
				try {
					if (namedEntryCurrent(entry, frame, attempt)) {
						const outcome = new Promise<Outcome>((resolve) => {
							finishNamed = resolve;
						});
						attempt.entries.set(entry, { entry, frame, outcome, completed: false });
					}
				} catch (cause) {
					failObserver(attempt, cause);
				}
			}
			const pending = scope.run(entry, () => original.call(this, ...args));
			const completeNamed = (outcome: Outcome): void => {
				if (finishNamed === undefined) return;
				try {
					if (!outcome.fulfilled) selectNative(entry, true); // Preserve the original enrolled error, including after retirement; never admit from it.
					const native = attempt?.entries.get(entry);
					if (native !== undefined) {
						native.result = outcome;
						native.completed = true;
					}
					finishNamed(outcome);
				} catch (cause) {
					if (attempt !== undefined) failObserver(attempt, cause);
				}
			};
			if (finishNamed !== undefined)
				void pending.then(
					() => completeNamed({ fulfilled: true }),
					(cause: unknown) => completeNamed({ fulfilled: false, cause }),
				);
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
			const attempt = named;
			if (attempt !== undefined && !attempt.closed) {
				failObserver(attempt, new Error('Named OFF observation owner retired'));
				attempt.closed = true;
				for (const frame of attempt.frames) frame.closed = true;
			}
			namedRecord?.finishService({ observed: false });
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
				let failure: { cause: unknown } | undefined;
				const restore = (action: () => void): void => {
					try {
						action();
					} catch (cause) {
						failure ??= { cause };
					}
				};
				if (installedOwned)
					restore(() => {
						restoreOriginalEntry(owner, 'reconcile', installed, before);
						installedOwned = false;
					});
				if (serviceOwned)
					restore(() => {
						restoreOriginalEntry(owner, 'serviceFeedback', serviceInstalled, serviceBefore);
						serviceOwned = false;
					});
				if (setOwned)
					restore(() => {
						restoreOriginalEntry(inFlight, 'set', setInstalled, setBefore);
						setOwned = false;
					});
				if (failure !== undefined) throw failure.cause;
				restored = true;
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop);
		Object.defineProperty(owner, 'reconcile', installed);
		installedOwned = true;
		Object.defineProperty(inFlight, 'set', setInstalled);
		setOwned = true;
		Object.defineProperty(owner, 'serviceFeedback', serviceInstalled);
		serviceOwned = true;
		const observation = {
			scope,
			// The default R64 start below remains byte-exact. Only the named rows call this distinct protocol.
			startAfterOriginalOff: (
				claim: VirtualThermostatActuatorClaimEntity,
				seed: VirtualThermostatCommandEntity,
			): Promise<void> => {
				const lifecycle = owner['lifecycle'];
				if (
					!armed ||
					retired ||
					waiting !== undefined ||
					(named !== undefined && !named.closed) ||
					lifecycle === undefined ||
					!owner['active'] ||
					seed.action !== 'on' ||
					seed.status !== 'accepted' ||
					seed.controllerId !== originalControllerId ||
					seed.claimId !== claim.id ||
					seed.claimRevision !== claim.revision ||
					(namedRecord !== undefined &&
						(namedRecord.seed !== seed || namedRecord.claim !== claim || namedRecord.lifecycle !== lifecycle))
				)
					throw new Error('Original named OFF attempt unavailable');
				const reusing = namedRecord !== undefined;
				if (namedRecord !== undefined) {
					const previous = named;
					const previousNative = previous?.native?.result;
					const previousOperation = namedRecord.operationState.outcome;
					const previousService = namedRecord.serviceState.receipt;
					if (previous === undefined || !previous.closed || previousNative === undefined || previousNative.fulfilled)
						throw new Error('Only the explicit post-native-rollback logical retry may retain K');
					if (previousOperation === undefined)
						throw new Error('Original OFF terminal outcome missing at rollback retry');
					if (!previousOperation.fulfilled) throw previousOperation.cause;
					if (previousService === undefined || !previousService.observed)
						throw new Error('Original OFF service outcome missing at rollback retry');
					if (!previousService.outcome.fulfilled && !Object.is(previousService.outcome.cause, previousNative.cause))
						throw previousService.outcome.cause;
					if (previous.observerFailure !== undefined) throw previous.observerFailure.cause;
				}
				let opened: (ids: readonly string[]) => void = () => undefined;
				let failOpening: (cause: unknown) => void = () => undefined;
				const opening = new Promise<readonly string[]>((resolve, reject) => {
					opened = resolve;
					failOpening = reject;
				});
				void opening.then(
					() => undefined,
					() => undefined,
				);
				const attempt: Attempt = {
					claim,
					seed,
					lifecycle,
					entries: new WeakMap(),
					frames: new Set(),
					secondary: [],
					opening,
					opened,
					failOpening,
					closed: false,
					inspections: 0,
				};
				named = attempt;
				if (namedRecord !== undefined) opened(namedRecord.ids); // F67's explicit post-rollback attempt retains SAME K.
				const inspectOnce = async (): Promise<Outcome> => {
					const ticket = Object.freeze({});
					const frame: Frame = { identity: Object.freeze({}), publicTicket: ticket, lifecycle, closed: false };
					attempt.frames.add(frame);
					attempt.inspections++;
					try {
						await publicEntry.run(ticket, () =>
							namedFlow.run(frame, () => originalInspect.call(owner, originalControllerId)),
						);
						return { fulfilled: true };
					} catch (cause) {
						return { fulfilled: false, cause };
					} finally {
						frame.closed = true;
					}
				};
				const run = async (): Promise<void> => {
					let inspected = await inspectOnce(); // S0: ONE original public preparation.
					let operation: Outcome = { fulfilled: true },
						service: Outcome = { fulfilled: true };
					try {
						const record = namedRecord;
						if (record === undefined)
							failObserver(attempt, new Error('Public preparation did not insert its named original OFF'));
						else {
							operation = await record.operationOutcome;
							if (!attempt.closed && !reusing) {
								if ((retired || !owner['active'] || owner['lifecycle'] !== lifecycle) && record.child === undefined)
									failObserver(attempt, new Error('Named OFF service owner retired before service entry'));
								else {
									const receipt = await record.serviceOutcome;
									if (receipt.observed) service = receipt.outcome;
									else
										failObserver(
											attempt,
											new Error('Named OFF service observation closed without an original outcome'),
										);
								}
							}
						}
						let native: Outcome | undefined = attempt.native === undefined ? undefined : await attempt.native.outcome;
						const failures = [native, operation, service, inspected];
						for (const outcome of failures)
							if (outcome !== undefined && !outcome.fulfilled) attempt.secondary.push(outcome.cause);
						if (native !== undefined && !native.fulfilled) throw native.cause;
						if (!operation.fulfilled) throw operation.cause;
						if (!service.fulfilled) throw service.cause;
						if (!inspected.fulfilled) throw inspected.cause;
						if (attempt.observerFailure !== undefined) throw attempt.observerFailure.cause;
						if (native === undefined) {
							if (reusing) throw new Error('Explicit rollback retry had no new original native entry');
							if (
								retired ||
								attempt.closed ||
								!owner['active'] ||
								owner['lifecycle'] !== lifecycle ||
								record === undefined ||
								record.lifecycle !== lifecycle ||
								record.child === undefined
							)
								throw new Error('Named OFF completion lost its original owner before S1');
							inspected = await inspectOnce(); // S1: fresh correlation, never rearm S0, never a third phase.
							native = attempt.native === undefined ? undefined : await attempt.native.outcome;
							for (const outcome of [native, inspected])
								if (outcome !== undefined && !outcome.fulfilled) attempt.secondary.push(outcome.cause);
							if (native !== undefined && !native.fulfilled) throw native.cause;
							if (!inspected.fulfilled) throw inspected.cause;
							if (attempt.observerFailure !== undefined) throw attempt.observerFailure.cause;
						}
						if (native === undefined) throw new Error('Named OFF completion had no full original native entry');
						if (retired || attempt.closed || !owner['active'] || owner['lifecycle'] !== lifecycle)
							throw new Error('Named native completion lost its original owner');
					} finally {
						attempt.closed = true;
						for (const frame of attempt.frames) frame.closed = true;
						attempt.failOpening(new Error('Named OFF attempt closed before insertion'));
					}
				};
				const completion = run();
				void completion.then(
					() => undefined,
					() => undefined,
				);
				return completion;
			},
			namedIds: (seed: VirtualThermostatCommandEntity): readonly string[] => {
				if (namedRecord === undefined || namedRecord.seed !== seed) throw new Error('Named OFF identity unavailable');
				return namedRecord.ids;
			},
			namedOpening: (): Promise<readonly string[]> => {
				if (named === undefined) throw new Error('Named OFF attempt not started');
				return named.opening;
			},
			namedInspectionCount: (): number => named?.inspections ?? 0,
			cleanupAfterRetirement: (): void => backstop.cleanup(),

			isWaitingEntry: (entry: Entry | undefined): boolean => {
				const attempt = named;
				if (attempt !== undefined && !attempt.closed && entry !== undefined) {
					const native = attempt.entries.get(entry);
					return (
						entry === scope.getStore() &&
						native !== undefined &&
						!native.completed &&
						attempt.native === native &&
						namedEntryCurrent(entry, native.frame, attempt) &&
						entry.nativeRead
					);
				}
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
				type Outcome = { fulfilled: true; cause?: never } | { fulfilled: false; cause: unknown };
				const nativeOutcome = observation.then<Outcome, Outcome>(
					() => ({ fulfilled: true }),
					(cause: unknown) => ({ fulfilled: false, cause }),
				);
				let inspectionOutcome: Promise<Outcome>;
				try {
					const inspection = publicEntry.run(ticket, () => owner.inspect(originalControllerId));
					inspectionOutcome = inspection.then<Outcome, Outcome>(
						() => {
							if (waiting?.ticket === ticket) {
								const target = waiting;
								waiting = undefined;
								target.reject(
									new Error('Original public inspection completed without its required native reconciliation entry'),
								);
							}
							return { fulfilled: true };
						},
						(cause: unknown) => {
							if (waiting?.ticket === ticket) {
								const target = waiting;
								waiting = undefined;
								target.reject(cause);
							}
							return { fulfilled: false, cause };
						},
					);
				} catch (cause) {
					if (waiting?.ticket === ticket) {
						const target = waiting;
						waiting = undefined;
						target.reject(cause);
					}
					inspectionOutcome = Promise.resolve<Outcome>({ fulfilled: false, cause });
				}
				const completion = Promise.all([nativeOutcome, inspectionOutcome]).then(([native, inspected]) => {
					if (!native.fulfilled) throw native.cause;
					if (!inspected.fulfilled) throw inspected.cause;
				});
				void completion.then(
					() => undefined,
					() => undefined,
				);
				return completion;
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
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop);
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
					unregisterCompletionObserver(retirement);
				}
			},
		};
		// First cleanup member: retire THIS initial owner even if a later case installed a different runtime.
		registerCompletionObserver(retirement);
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
				unregisterCompletionObserver(backstop);
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
				unregisterCompletionObserver(backstop);
				assertRestored();
			},
		};
		registerCompletionObserver(backstop);
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
			unregisterCompletionObserver(backstop);
			if (failure) throw failure.cause;
		};
		const backstop = { retire, cleanup: (): void => cleanup(true) };
		registerCompletionObserver(backstop);
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

	const comfortFence = async (owned?: FixtureBodyOwner, selected?: FixtureWorkOwner) => {
		owned?.assertLive();
		const work = selected ?? owned?.work ?? captureFixtureWorkOwner();
		work.assertLive();
		const service = owned === undefined ? work.owned.comfort : owned.comfort;
		const id = owned === undefined ? work.owned.controllerId : owned.controllerId;
		const current = await work.observe(work.issue(() => service.get(id)));
		work.assertLive();
		owned?.assertLive();
		return { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
	};
	const configureComfort = async (owned?: FixtureBodyOwner, selected?: FixtureWorkOwner) => {
		if (owned === undefined) {
			const work = selected ?? captureFixtureWorkOwner();
			work.assertLive();
			const service = work.owned.comfort,
				id = work.owned.controllerId;
			const methods: OriginalFunctions<Pick<VirtualThermostatComfortService, 'configure'>> = service;
			const configure = methods.configure; // Original lookup BEFORE the original fence await.
			const fence = await comfortFence(undefined, work);
			work.assertLive();
			const result = await work.observe(
				work.issue(() =>
					configure.call(service, id, fence, {
						heating_range: { minimum: 10, maximum: 30 },
						cooling_range: null,
						presets: [{ preset: 'comfort', setpoints: { heating_setpoint: 24, cooling_setpoint: null } }],
					}),
				),
			);
			work.assertLive();
			return result;
		}
		owned.assertLive();
		const work = selected ?? owned.work;
		work.assertLive();
		const originalComfort: OriginalFunctions<Pick<VirtualThermostatComfortService, 'configure'>> = owned.comfort;
		const configure = originalComfort.configure;
		const fence = await comfortFence(owned, work);
		owned.assertLive();
		work.assertLive();
		const result = await work.observe(
			work.issue(() =>
				configure.call(owned.comfort, owned.controllerId, fence, {
					heating_range: { minimum: 10, maximum: 30 },
					cooling_range: null,
					presets: [{ preset: 'comfort', setpoints: { heating_setpoint: 24, cooling_setpoint: null } }],
				}),
			),
		);
		work.assertLive();
		owned.assertLive();
		return result;
	};

	const captureFixtureCaseLifetime = () => {
		let retired = false;
		const backstop = {
			retire: (): void => {
				retired = true;
			},
			cleanup: (): void => {
				retired = true;
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop);
		return {
			assertLive: (): void => {
				if (retired) throw new Error('Fixture ownership case retired');
			},
			cleanup: backstop.cleanup,
		};
	};
	// R117: real independent SQLite fixtures; these are isolation negatives, not native authority positives.
	const fixtureGate = () => {
		let open: () => void = () => undefined;
		const promise = new Promise<void>((resolve) => {
			open = resolve;
		});
		return { promise, open };
	};
	type FixtureOutcome<T> = { fulfilled: true; value: T; cause?: never } | { fulfilled: false; cause: unknown };
	const fixtureOutcome = <T>(promise: Promise<T>): Promise<FixtureOutcome<T>> =>
		promise.then<FixtureOutcome<T>, FixtureOutcome<T>>(
			(value) => ({ fulfilled: true, value }),
			(cause: unknown) => ({ fulfilled: false, cause }),
		);

	describe('original case fixture ownership after retirement', () => {
		it('retires a genuinely held unadopted setup A before B adopts and never lets late A completion reclaim or close B', async () => {
			const caseOwner = currentFixtureCase;
			if (caseOwner === undefined || caseOwner.setup === undefined) throw new Error('Original case setup missing');
			assertFixtureCaseLive(caseOwner);
			const initialSetup = caseOwner.setup;
			let rowRetired = false;
			const assertRowLive = (): void => {
				assertFixtureCaseLive(caseOwner);
				if (rowRetired) throw new Error('Setup turnover row retired');
			};
			const enteredA = fixtureGate(),
				releaseA = fixtureGate(),
				enteredB = fixtureGate(),
				releaseB = fixtureGate();
			const selectedRead = 'SELECT "id", "revision" FROM "devices_virtual_graph_revision" ORDER BY "id"';
			const a: { source?: SqliteDataSource; query?: Promise<FixtureOutcome<unknown>> } = {};
			let aSetup: FixtureSetupLease | undefined, bSetup: FixtureSetupLease | undefined;
			let pendingA: Promise<FixtureOutcome<RuntimeFixtureOwner>> | undefined;
			let b: RuntimeFixtureOwner | undefined;
			let bInspection:
				| Promise<FixtureOutcome<Awaited<ReturnType<VirtualThermostatRuntimeService['inspect']>>>>
				| undefined;
			let bObserver:
				| { beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => Promise<void> | void }
				| undefined;
			let bSentinel: { note: () => void } | undefined;
			let sentinelOriginal: PropertyDescriptor | undefined, sentinelInstalled: PropertyDescriptor | undefined;
			let heldA = false;
			const aObserver = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
					if (event.query === selectedRead) {
						if (heldA) throw new Error('Setup A initial query was not unique');
						heldA = true;
						enteredA.open();
						return releaseA.promise;
					}
				},
			};
			const observation: FixtureSetupObservation = {
				install: (source): void => {
					a.source = source;
					source.subscribers.push(aObserver);
				},
				issued: (pending): void => {
					a.query = fixtureOutcome(pending);
				},
			};
			let rowCleaned = false;
			const retireRow = (): void => {
				rowRetired = true;
				releaseA.open();
				releaseB.open();
			};
			const rowBackstop = {
				retire: retireRow,
				cleanup: (): void => {
					retireRow();
					if (rowCleaned) return;
					rowCleaned = true;
					let failure: { cause: unknown } | undefined;
					const attempt = (action: () => void): void => {
						try {
							action();
						} catch (cause) {
							failure ??= { cause };
						}
					};
					if (a.source !== undefined) {
						const source = a.source;
						attempt(() => {
							const index = source.subscribers.indexOf(aObserver);
							if (index >= 0) source.subscribers.splice(index, 1);
						});
					}
					if (b !== undefined && bObserver !== undefined) {
						const source = b.database,
							observer = bObserver;
						attempt(() => {
							const index = source.subscribers.indexOf(observer);
							if (index >= 0) source.subscribers.splice(index, 1);
						});
					}
					if (bSentinel !== undefined && sentinelInstalled !== undefined) {
						const receiver = bSentinel,
							installed = sentinelInstalled,
							original = sentinelOriginal;
						attempt(() => restoreOriginalEntry(receiver, 'note', installed, original));
					}
					attempt(() => unregisterCompletionObserver(rowBackstop));
					if (failure !== undefined) throw failure.cause;
				},
			};
			// Case-owned, not owned by the initial/A setup deliberately retired within this row.
			// Actual afterEach retirement releases only this row's held gates before closing storage.
			registerCaseBackstop(caseOwner, rowBackstop);
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
			try {
				await teardownFixtureSetup(initialSetup);
				assertRowLive();
				aSetup = beginFixtureSetup(caseOwner);
				pendingA = fixtureOutcome(completeFixtureSetup(aSetup, observation));
				await enteredA.promise;
				assertRowLive();
				const sourceA = a.source,
					nativeQuery = a.query;
				if (sourceA === undefined || nativeQuery === undefined) throw new Error('Actual held setup A read missing');
				expect(aSetup.adopted).toBeUndefined();
				expect(aSetup.completed).toBe(false);
				expect(sourceA.isInitialized).toBe(true);
				// SAME exact teardown helper used by afterEach, without waiting for pending A SQL/factory.
				await teardownFixtureSetup(aSetup);
				assertRowLive();
				expect(aSetup.retired).toBe(true);
				expect(aSetup.completed).toBe(false);
				expect(sourceA.isInitialized).toBe(true); // Issued SQL was not cancelled/closed to manufacture retirement.
				bSetup = beginFixtureSetup(caseOwner);
				b = await completeFixtureSetup(bSetup);
				assertRowLive();
				await originalObservers(b.runtime).settle();
				assertRowLive();
				const configBefore = await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: b.controllerId,
				});
				assertRowLive();
				const lane = new AsyncLocalStorage<object>(),
					ticket = Object.freeze({});
				let deliveredQueries = 0,
					heldB = false;
				bObserver = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
						deliveredQueries++;
						if (!heldB && lane.getStore() === ticket && event.query.startsWith('SELECT')) {
							heldB = true;
							enteredB.open();
							return releaseB.promise;
						}
					},
				};
				b.database.subscribers.push(bObserver);
				const currentB = b;
				bInspection = fixtureOutcome(lane.run(ticket, () => currentB.runtime.inspect(currentB.controllerId)));
				await enteredB.promise;
				assertRowLive();
				// A test-owned sentinel detects an illicit global restoreAllMocks without replacing a pinned app method.
				bSentinel = { note: (): void => undefined };
				sentinelOriginal = Object.getOwnPropertyDescriptor(bSentinel, 'note');
				jest.spyOn(bSentinel, 'note');
				sentinelInstalled = Object.getOwnPropertyDescriptor(bSentinel, 'note');
				const before = {
					queries: deliveredQueries,
					bytes: await readFile(join(b.directory, 'runtime.sqlite')),
					samples: [...b.state.samples],
					sends: [...b.state.sends],
					targets: [...b.state.sentTargets],
					attempts: [...b.state.actuationAttempts],
					timer: b.runtime['timer'],
					timeout: setTimeout,
					date: Date,
					load: Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands'),
					reconcile: Object.getOwnPropertyDescriptor(b.runtime, 'reconcile'),
				};
				assertRowLive();
				releaseA.open();
				expect(await nativeQuery).toEqual({ fulfilled: true, value: [{ id: 1, revision: 0 }] });
				const completedA = await pendingA;
				assertRowLive();
				expect(completedA.fulfilled).toBe(false);
				if (completedA.fulfilled) throw new Error('Retired setup A unexpectedly adopted');
				expect(completedA.cause).toEqual(new Error('Fixture setup retired'));
				expect(aSetup.failure?.cause).toBe(completedA.cause);
				expect(aSetup.completed).toBe(true);
				expect(aSetup.adopted).toBeUndefined();
				expect(sourceA.isInitialized).toBe(false); // Late factory cleanup closed only its own A database.
				// Repeated A teardown truthfully retains its already-observed original setup P, without touching B.
				const lateATeardown = await fixtureOutcome(teardownFixtureSetup(aSetup));
				assertRowLive();
				expect(lateATeardown.fulfilled).toBe(false);
				if (lateATeardown.fulfilled) throw new Error('Original setup A primary was lost');
				expect(lateATeardown.cause).toBe(completedA.cause);
				expect(currentFixtureCase).toBe(caseOwner);
				expect(caseOwner.setup).toBe(bSetup);
				expect(bSetup.adopted).toBe(b);
				expect(bSetup.retired).toBe(false);
				expect(fixtureOwner).toBe(b);
				expect(runtime).toBe(b.runtime);
				expect(database).toBe(b.database);
				expect(fixtureState).toBe(b.state);
				expect(b.database.isInitialized).toBe(true);
				expect(Object.getOwnPropertyDescriptor(bSentinel, 'note')).toEqual(sentinelInstalled);
				expect(await readFile(join(b.directory, 'runtime.sqlite'))).toEqual(before.bytes);
				assertRowLive();
				expect(deliveredQueries).toBe(before.queries);
				expect([...b.state.samples]).toEqual(before.samples);
				expect(b.state.sends).toEqual(before.sends);
				expect(b.state.sentTargets).toEqual(before.targets);
				expect(b.state.actuationAttempts).toEqual(before.attempts);
				expect(b.runtime['timer']).toBe(before.timer);
				expect(setTimeout).toBe(before.timeout);
				expect(Date).toBe(before.date);
				expect(Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands')).toEqual(before.load);
				expect(Object.getOwnPropertyDescriptor(b.runtime, 'reconcile')).toEqual(before.reconcile);
				releaseB.open();
				const progressed = await bInspection;
				assertRowLive();
				expect(progressed.fulfilled).toBe(true);
				if (!progressed.fulfilled) throw progressed.cause;
				expect(
					await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: b.controllerId }),
				).toEqual(configBefore);
				assertRowLive();
				expect(b.runtime.readDiagnostics(b.controllerId)?.configuration_revision).toBeGreaterThan(0);
				expect(b.state.sends).not.toContain(true);
			} catch (cause) {
				failure = { cause };
			} finally {
				releaseA.open();
				releaseB.open();
				if (a.query !== undefined) {
					const pending = a.query;
					await attemptAsync(() => pending);
				}
				if (pendingA !== undefined) {
					const pending = pendingA;
					await attemptAsync(() => pending);
				}
				if (bInspection !== undefined) {
					const pending = bInspection;
					await attemptAsync(() => pending);
				}
				if (aSetup !== undefined && !aSetup.cleanupAttempted) {
					const setup = aSetup;
					await attemptAsync(() => teardownFixtureSetup(setup));
				}
				attempt(() => rowBackstop.cleanup());
				// The genuine current B setup remains owned by the SAME normal afterEach helper, never a latest-alias close here.
			}
			if (failure !== undefined) throw failure.cause;
		});
		it('keeps an issued A read and publication on A while its resumed body cannot change a genuine held B inspection', async () => {
			const caseSetup = requireFixtureSetup();
			const caseLifetime = captureFixtureCaseLifetime();
			const a = fixtureOwner,
				body = captureFixtureBodyOwner(a);
			const readEntered = fixtureGate(),
				readRelease = fixtureGate(),
				publicationRelease = fixtureGate();
			const bEntered = fixtureGate(),
				bRelease = fixtureGate(),
				onEntered = fixtureGate(),
				onRelease = fixtureGate();
			const parameters = [a.controllerId];
			const query = 'SELECT "id" FROM "devices_module_devices" WHERE "id" = ?';
			const aObserver = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
					if (event.query === query && event.parameters === parameters) {
						readEntered.open();
						return readRelease.promise;
					}
				},
			};
			let b: RuntimeFixtureOwner | undefined;
			let bAdopted = false;
			let bObserver:
				| { beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => Promise<void> | void }
				| undefined;
			let read: Promise<FixtureOutcome<unknown>> | undefined;
			let publication: Promise<FixtureOutcome<Awaited<ReturnType<PropertyValueService['publishDerived']>>>> | undefined;
			let resumed: Promise<FixtureOutcome<void>> | undefined;
			let nativeCompletion: Promise<FixtureOutcome<void>> | undefined;
			let inspection:
				| Promise<FixtureOutcome<Awaited<ReturnType<VirtualThermostatRuntimeService['inspect']>>>>
				| undefined;
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
			try {
				await settle(body);
				caseLifetime.assertLive();
				a.state.afterOnGate = onRelease.promise;
				a.state.onSent = (id) => {
					if (id === a.relayId) onEntered.open();
				};
				a.sample(a.sensorId, 18);
				a.runtime.request(a.controllerId);
				await onEntered.promise; // Actual original guard and sample/send branch, BEFORE its existing afterOnGate await.
				caseLifetime.assertLive();
				const onRows = await a.database.manager.findBy(VirtualThermostatCommandEntity, {
					controllerId: a.controllerId,
					action: 'on',
				});
				caseLifetime.assertLive();
				expect(onRows).toHaveLength(1);
				const command = onRows[0];
				if (!command) throw new Error('Actual A ON journal missing');
				expect(command.status).toBe('dispatching');
				const operation = a.runtime['inFlight'].get(command.id);
				if (operation === undefined) throw new Error('Exact original A detached operation missing');
				nativeCompletion = fixtureOutcome(operation); // Observe SAME existing application Promise, never replace it.
				a.state.onOutcome = 'refused'; // Later slot changes cannot relabel the already-selected accepted native result.
				const property = await a.database.manager.findOneByOrFail(ChannelPropertyEntity, { id: a.relayId });
				const lease = a.producers.register(property, 1);
				const at = new Date();
				a.state.publicationGate = publicationRelease.promise;
				// Original beforeEach-created callback enters NOW and waits on its original A gate.
				publication = fixtureOutcome(
					a.values.publishDerived(property, lease, false, {
						quality: 'good',
						reasons: [],
						sampledAt: at,
						evaluatedAt: at,
						expiresAt: new Date(at.getTime() + 60_000),
					}),
				);
				a.database.subscribers.push(aObserver);
				const originalRead: Promise<unknown> = a.database.query(query, parameters);
				read = fixtureOutcome(originalRead);
				resumed = fixtureOutcome(
					(async (): Promise<void> => {
						await originalRead; // Keep the original SQL result/error; retirement is checked only afterwards.
						body.assertLive();
						body.sample(a.sensorId, 18);
						await configureComfort(body);
					})(),
				);
				await readEntered.promise;
				caseLifetime.assertLive();
				body.retire();
				retireRuntimeFixture(a);
				b = await createRuntimeFixture(caseLifetime.assertLive);
				caseLifetime.assertLive();
				adoptRuntimeFixture(caseSetup, b);
				bAdopted = true;
				await originalObservers(b.runtime).settle();
				caseLifetime.assertLive();
				const bConfig = await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: b.controllerId,
				});
				caseLifetime.assertLive();
				const lane = new AsyncLocalStorage<object>(),
					ticket = Object.freeze({});
				let deliveredQueries = 0,
					held = false;
				bObserver = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
						deliveredQueries++;
						if (!held && lane.getStore() === ticket && event.query.startsWith('SELECT')) {
							held = true;
							bEntered.open();
							return bRelease.promise;
						}
					},
				};
				b.database.subscribers.push(bObserver);
				const currentB = b;
				inspection = fixtureOutcome(lane.run(ticket, () => currentB.runtime.inspect(currentB.controllerId)));
				await bEntered.promise;
				caseLifetime.assertLive();
				const before = {
					queries: deliveredQueries,
					samples: [...b.state.samples],
					sends: [...b.state.sends],
					databaseBytes: await readFile(join(b.directory, 'runtime.sqlite')),
					targets: [...b.state.sentTargets],
					attempts: [...b.state.actuationAttempts],
					timer: b.runtime['timer'],
					timerFunction: setTimeout,
					load: Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands'),
					reconcile: Object.getOwnPropertyDescriptor(b.runtime, 'reconcile'),
				};
				caseLifetime.assertLive();
				expect(before.timer).toBeDefined();
				let retiredTicks = 0;
				a.state.packetTick = () => {
					retiredTicks++;
				};
				readRelease.open();
				publicationRelease.open();
				onRelease.open();
				expect(await read).toEqual({ fulfilled: true, value: [{ id: a.controllerId }] });
				const stopped = await resumed;
				caseLifetime.assertLive();
				expect(stopped.fulfilled).toBe(false);
				if (stopped.fulfilled) throw new Error('Retired A body unexpectedly continued');
				expect(stopped.cause).toEqual(new Error('Original fixture body retired'));
				const published = await publication;
				caseLifetime.assertLive();
				expect(published.fulfilled).toBe(true);
				if (!published.fulfilled) throw published.cause;
				expect(published.value.changed).toBe(true);
				expect(published.value.state?.value).toBe(false);
				expect(a.producers.read(a.relayId)?.value).toBe(false);
				expect(await nativeCompletion).toEqual({ fulfilled: true, value: undefined });
				caseLifetime.assertLive();
				const persisted = await a.database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id });
				caseLifetime.assertLive();
				expect(persisted.status).toBe('accepted');
				expect(persisted.fault).toBeNull();
				expect(a.state.sends).toContain(true);
				expect(b.producers.read(a.relayId)).toBeNull();
				// Even a late A data callback cannot invoke its old global-clock effect.
				a.sample(a.sensorId, 18);
				expect(retiredTicks).toBe(0);
				expect(await readFile(join(b.directory, 'runtime.sqlite'))).toEqual(before.databaseBytes);
				caseLifetime.assertLive();
				expect(deliveredQueries).toBe(before.queries);
				expect([...b.state.samples]).toEqual(before.samples);
				expect(b.state.sends).toEqual(before.sends);
				expect(b.state.sentTargets).toEqual(before.targets);
				expect(b.state.actuationAttempts).toEqual(before.attempts);
				expect(b.runtime['timer']).toBe(before.timer);
				expect(setTimeout).toBe(before.timerFunction);
				expect(Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands')).toEqual(before.load);
				expect(Object.getOwnPropertyDescriptor(b.runtime, 'reconcile')).toEqual(before.reconcile);
				bRelease.open();
				const progressed = await inspection;
				caseLifetime.assertLive();
				expect(progressed.fulfilled).toBe(true);
				if (!progressed.fulfilled) throw progressed.cause;
				expect(
					await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: b.controllerId }),
				).toEqual(bConfig);
				expect(b.runtime.readDiagnostics(b.controllerId)?.configuration_revision).toBeGreaterThan(0);
				expect(b.state.sends).not.toContain(true);
			} catch (cause) {
				failure = { cause };
			} finally {
				readRelease.open();
				publicationRelease.open();
				bRelease.open();
				onRelease.open();
				if (read !== undefined) {
					const pending = read;
					await attemptAsync(() => pending);
				}
				if (publication !== undefined) {
					const pending = publication;
					await attemptAsync(() => pending);
				}
				if (resumed !== undefined) {
					const pending = resumed;
					await attemptAsync(() => pending);
				}
				if (nativeCompletion !== undefined) {
					const pending = nativeCompletion;
					await attemptAsync(() => pending);
				}
				if (inspection !== undefined) {
					const pending = inspection;
					await attemptAsync(() => pending);
				}
				attempt(() => body.cleanup());
				attempt(() => caseLifetime.cleanup());
				attempt(() => {
					const index = a.database.subscribers.indexOf(aObserver);
					if (index >= 0) a.database.subscribers.splice(index, 1);
				});
				if (b !== undefined && bObserver !== undefined) {
					const source = b.database,
						observer = bObserver;
					attempt(() => {
						const index = source.subscribers.indexOf(observer);
						if (index >= 0) source.subscribers.splice(index, 1);
					});
				}
				await attemptAsync(() => closeRuntimeFixture(a));
				if (b !== undefined && !bAdopted) {
					const unadopted = b;
					await attemptAsync(() => closeRuntimeFixture(unadopted));
				}
			}
			if (failure !== undefined) throw failure.cause;
		});

		it.each([undefined, null, false, 'native A primary', new Error('native A primary')])(
			'preserves issued A SQL primary %p before cleanup Q and leaves a foreign A descriptor and fresh B intact',
			async (primary: unknown) => {
				const caseSetup = requireFixtureSetup();
				const caseLifetime = captureFixtureCaseLifetime();
				const a = fixtureOwner,
					body = captureFixtureBodyOwner(a);
				const entered = fixtureGate(),
					release = fixtureGate(),
					bEntered = fixtureGate(),
					bRelease = fixtureGate();
				const parameters = [a.controllerId],
					query = 'SELECT "id" FROM "devices_module_devices" WHERE "id" = ?';
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
						if (event.query === query && event.parameters === parameters) {
							entered.open();
							return release.promise.then(() => {
								throw primary;
							});
						}
					},
				};
				let read: Promise<FixtureOutcome<unknown>> | undefined, resumed: Promise<FixtureOutcome<void>> | undefined;
				let b: RuntimeFixtureOwner | undefined;
				let bAdopted = false;
				let bObserver:
					| { beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => Promise<void> | void }
					| undefined;
				let inspection:
					| Promise<FixtureOutcome<Awaited<ReturnType<VirtualThermostatRuntimeService['inspect']>>>>
					| undefined;
				let originalDescriptor: PropertyDescriptor | undefined, foreignDescriptor: PropertyDescriptor | undefined;
				const cleanupState: { failure?: { cause: unknown } } = {};
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
				try {
					await settle(body);
					a.database.subscribers.push(observer);
					const originalRead: Promise<unknown> = a.database.query(query, parameters);
					read = fixtureOutcome(originalRead);
					resumed = fixtureOutcome(
						(async (): Promise<void> => {
							let primaryFailure: { cause: unknown } | undefined;
							try {
								await originalRead;
								body.assertLive();
								body.sample(a.sensorId, 18);
							} catch (cause) {
								primaryFailure = { cause };
							} finally {
								try {
									await closeRuntimeFixture(a);
								} catch (cause) {
									cleanupState.failure = { cause };
									primaryFailure ??= { cause };
								}
							}
							if (primaryFailure !== undefined) throw primaryFailure.cause;
						})(),
					);
					await entered.promise;
					caseLifetime.assertLive();
					body.retire();
					retireRuntimeFixture(a);
					originalDescriptor = Object.getOwnPropertyDescriptor(a.runtime, 'loadDecisionCommands');
					if (!originalDescriptor) throw new Error('Original owned loader descriptor missing');
					foreignDescriptor = { ...originalDescriptor, enumerable: !originalDescriptor.enumerable };
					Object.defineProperty(a.runtime, 'loadDecisionCommands', foreignDescriptor);
					b = await createRuntimeFixture(caseLifetime.assertLive);
					caseLifetime.assertLive();
					adoptRuntimeFixture(caseSetup, b);
					bAdopted = true;
					await originalObservers(b.runtime).settle();
					caseLifetime.assertLive();
					const configBefore = await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
						controllerId: b.controllerId,
					});
					caseLifetime.assertLive();
					const lane = new AsyncLocalStorage<object>(),
						ticket = Object.freeze({});
					let deliveredQueries = 0,
						held = false;
					bObserver = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
							deliveredQueries++;
							if (!held && lane.getStore() === ticket && event.query.startsWith('SELECT')) {
								held = true;
								bEntered.open();
								return bRelease.promise;
							}
						},
					};
					b.database.subscribers.push(bObserver);
					const currentB = b;
					inspection = fixtureOutcome(lane.run(ticket, () => currentB.runtime.inspect(currentB.controllerId)));
					await bEntered.promise;
					caseLifetime.assertLive();
					const before = {
						config: configBefore,
						queries: deliveredQueries,
						databaseBytes: await readFile(join(b.directory, 'runtime.sqlite')),
						samples: [...b.state.samples],
						sends: [...b.state.sends],
						timer: b.runtime['timer'],
						timerFunction: setTimeout,
						load: Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands'),
					};
					caseLifetime.assertLive();
					release.open();
					const native = await read,
						stopped = await resumed;
					caseLifetime.assertLive();
					expect(native.fulfilled).toBe(false);
					if (native.fulfilled) throw new Error('Injected original A SQL primary missing');
					expect(native.cause).toBe(primary);
					expect(stopped.fulfilled).toBe(false);
					if (stopped.fulfilled) throw new Error('A body unexpectedly resumed after SQL failure');
					expect(stopped.cause).toBe(primary);
					const cleanupCause = cleanupState.failure;
					expect(cleanupCause).toBeDefined();
					if (cleanupCause === undefined) throw new Error('Foreign descriptor cleanup Q missing');
					expect(cleanupCause.cause).toEqual(new Error('Original entry observer replaced by foreign owner'));
					expect(a.state.cleanupCauses).toContain(cleanupCause.cause);
					// The actual resumed body's finally already attempted cleanup; its result retained P by presence.
					expect(stopped.cause).toBe(primary);
					expect(Object.getOwnPropertyDescriptor(a.runtime, 'loadDecisionCommands')).toEqual(foreignDescriptor);
					expect(a.database.isInitialized).toBe(false); // Storage cleanup was attempted despite Q.
					expect([...b.state.samples]).toEqual(before.samples);
					expect(b.state.sends).toEqual(before.sends);
					expect(b.runtime['timer']).toBe(before.timer);
					expect(setTimeout).toBe(before.timerFunction);
					expect(Object.getOwnPropertyDescriptor(b.runtime, 'loadDecisionCommands')).toEqual(before.load);
					expect(await readFile(join(b.directory, 'runtime.sqlite'))).toEqual(before.databaseBytes);
					caseLifetime.assertLive();
					expect(deliveredQueries).toBe(before.queries);
					bRelease.open();
					const progressed = await inspection;
					caseLifetime.assertLive();
					expect(progressed.fulfilled).toBe(true);
					if (!progressed.fulfilled) throw progressed.cause;
					expect(
						await b.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: b.controllerId }),
					).toEqual(before.config);
					caseLifetime.assertLive();
					expect(b.runtime.readDiagnostics(b.controllerId)?.configuration_revision).toBeGreaterThan(0);
				} catch (cause) {
					failure = { cause };
				} finally {
					release.open();
					bRelease.open();
					if (inspection !== undefined) {
						const pending = inspection;
						await attemptAsync(() => pending);
					}
					if (read !== undefined) {
						const pending = read;
						await attemptAsync(() => pending);
					}
					if (resumed !== undefined) {
						const pending = resumed;
						await attemptAsync(() => pending);
					}
					attempt(() => body.cleanup());
					attempt(() => caseLifetime.cleanup());
					attempt(() => {
						const index = a.database.subscribers.indexOf(observer);
						if (index >= 0) a.database.subscribers.splice(index, 1);
					});
					// This row owns the deliberate foreign descriptor; undo ONLY that exact descriptor after proving Q left it intact.
					if (originalDescriptor !== undefined && foreignDescriptor !== undefined) {
						const installed = originalDescriptor,
							foreign = foreignDescriptor;
						attempt(() => restoreOriginalEntry(a.runtime, 'loadDecisionCommands', foreign, installed));
					}
					if (b !== undefined && bObserver !== undefined) {
						const source = b.database,
							ownedObserver = bObserver;
						attempt(() => {
							const index = source.subscribers.indexOf(ownedObserver);
							if (index >= 0) source.subscribers.splice(index, 1);
						});
					}
					for (const backstop of a.observers) attempt(() => backstop.cleanup());
					if (a.database.isInitialized) await attemptAsync(() => closeRuntimeFixture(a));
					if (b !== undefined && !bAdopted) {
						const unadopted = b;
						await attemptAsync(() => closeRuntimeFixture(unadopted));
					}
				}
				if (failure !== undefined) throw failure.cause;
			},
		);
	});

	describe('read-only member observation diagnostics', () => {
		it('uses the original physical boolean sample and withdraws it at expiry without evaluation or renewed evidence', async () => {
			await settle();
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			const physical = fixtureState.samples.get(relayId),
				original = physical.sampledAt.toISOString(),
				sent = fixtureState.sends.length;
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
			expect(fixtureState.samples.get(relayId)).toBe(physical);
			expect(fixtureState.sends).toHaveLength(sent);
			expect(liveRead).toHaveBeenCalledTimes(liveReads);
			jest.useRealTimers();
		});
		it('withdraws qualification and activity when target source lease or graph scope is revoked', async () => {
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches[0].qualification_ready).toBe(true);
			fixtureState.providerCurrent = false;
			expect(runtime.readDiagnostics(controllerId).branches[0]).toMatchObject({
				qualification_ready: null,
				activity: 'unknown',
				activity_sampled_at: null,
				activity_expires_at: null,
			});
			fixtureState.providerCurrent = true;
			fixtureState.graphValidated = false;
			fixtureState.graphGeneration++;
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
				const physical = fixtureState.samples.get(relayId);
				if (fault === 'quality') fixtureState.samples.set(relayId, { ...physical, quality: 'degraded' });
				if (fault === 'type') fixtureState.samples.set(relayId, { ...physical, value: 'false' });
				if (fault === 'identity') fixtureState.samples.set(relayId, { ...physical, propertyId: sensorId });
				if (fault === 'missing') fixtureState.samples.delete(relayId);
				if (fault === 'cached')
					fixtureState.samples.set(relayId, {
						...physical,
						provenance: 'cached',
					} as unknown as QualifiedPropertySample);
				if (fault === 'future')
					fixtureState.samples.set(relayId, {
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
				const physical = fixtureState.samples.get(relayId);
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
				fixtureState.samples.set(relayId, { ...physical, value: true, sampledAt: at, receivedAt: at });
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
		const issuedWork = captureFixtureWorkOwner();
		await settle();
		await configureComfort(undefined, issuedWork);
		const throwing = () => {
			throw new Error('post-commit listener');
		};
		events.prependListener('devices-virtual.thermostat.config.changed', throwing);
		const result = await comfort.select(controllerId, await comfortFence(undefined, issuedWork), 'comfort', false);
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
		expect(fixtureState.sends).toContain(true);
	});

	it('inhibits a lower-demand override on observable rollback instead of resuming a higher baseline', async () => {
		const owned = captureFixtureBodyOwner(fixtureOwner);
		try {
			await settle(owned);
			owned.assertLive();
			owned.state.packetTick = useThermostatPacketClock();
			await configureComfort(owned);
			await settle(owned);
			owned.assertLive();
			const wall = Date.now();
			owned.assertLive();
			jest.setSystemTime(wall);
			owned.assertLive();
			const originalComfort: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> = owned.comfort;
			const override = originalComfort.override;
			const fence = await comfortFence(owned);
			owned.assertLive();
			await override.call(
				owned.comfort,
				owned.controllerId,
				fence,
				{
					preset: null,
					setpoints: { heating_setpoint: 17, cooling_setpoint: null },
					expires_at: new Date(wall + 60_000).toISOString(),
				},
				'operator',
			);
			owned.sample(owned.sensorId, 18);
			owned.assertLive();
			owned.runtime.request(owned.controllerId);
			await settle(owned);
			expect(owned.state.sends).not.toContain(true);
			owned.assertLive();
			jest.setSystemTime(wall - 1);
			owned.assertLive();
			owned.runtime.request(owned.controllerId);
			await settle(owned);
			expect(owned.runtime.readDiagnostics(owned.controllerId)).toMatchObject({
				effective_comfort: { source: 'override', heating_setpoint: 17 },
			});
			expect(owned.runtime.readDiagnostics(owned.controllerId).reasons).toContain('comfort_clock_uncertain');
			expect(owned.state.sends).not.toContain(true);
		} finally {
			owned.cleanup();
		}
	});

	it('uses effective preset demand without changing requested settings or bypassing a final ambient guard', async () => {
		const issuedWork = captureFixtureWorkOwner();
		await settle();
		await configureComfort(undefined, issuedWork);
		let releaseOn: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			releaseOn = resolve;
		});
		await comfort.select(controllerId, await comfortFence(undefined, issuedWork), 'comfort', false);
		await waitForOnJournal(issuedWork);
		expect(runtime.readDiagnostics(controllerId)).toMatchObject({
			requested_mode: 'heat',
			heating_setpoint: 20,
			effective_comfort: { source: 'preset', preset: 'comfort', heating_setpoint: 24 },
		});
		fixtureState.samples.delete(sensorId);
		releaseOn();
		await settle();
		expect(fixtureState.sends).not.toContain(true);
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('ambient_unavailable');
	});

	it('rejects queued ON at exact override expiry even before a poll recomputes the baseline', async () => {
		const issuedWork = captureFixtureWorkOwner();
		await settle();
		await configureComfort(undefined, issuedWork);
		let releaseOn: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			releaseOn = resolve;
		});
		const now = Date.now();
		jest.spyOn(Date, 'now').mockReturnValue(now);
		await comfort.override(
			controllerId,
			await comfortFence(undefined, issuedWork),
			{
				preset: 'comfort',
				setpoints: null,
				expires_at: new Date(now + 1000).toISOString(),
			},
			'operator',
		);
		await waitForOnJournal(issuedWork);
		jest.spyOn(Date, 'now').mockReturnValue(now + 1000);
		releaseOn();
		await settle();
		expect(fixtureState.sends).not.toContain(true);
		expect((await comfort.get(controllerId)).configuration.temporary_override.status).toBe('expired');
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).effective_comfort).toMatchObject({
			source: 'manual',
			heating_setpoint: 20,
		});
	});

	it('fences a queued preset ON when a newer user OFF revision commits', async () => {
		const issuedWork = captureFixtureWorkOwner();
		await settle();
		await configureComfort(undefined, issuedWork);
		let releaseOn: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			releaseOn = resolve;
		});
		await comfort.select(controllerId, await comfortFence(undefined, issuedWork), 'comfort', false);
		await waitForOnJournal(issuedWork);
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.requestedMode = 'off';
		config.comfort.user_off = true;
		config.revision++;
		await database.manager.save(config);
		events.emit('devices-virtual.thermostat.config.changed', controllerId);
		releaseOn();
		await settle();
		expect(fixtureState.sends).not.toContain(true);
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
			fixtureOwner.runtime = runtime = makeRuntime();
			await runtime.onApplicationBootstrap();
			await settle();
			fixtureState.onOutcome = 'refused';
			sample(sensorId, 18);
			runtime.request(controllerId);
			await settle();
			const onCommands = () => database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(await onCommands()).toEqual([expect.objectContaining({ status: 'cancelled', fault: 'known_no_send' })]);
			expect(fixtureState.sends).not.toContain(true);
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
			expect(fixtureState.actuationAttempts.filter(Boolean)).toHaveLength(2);
			fixtureState.onOutcome = 'accepted';
			sample(sensorId, 18);
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: sensorId });
			await settle();
			expect(await onCommands()).toHaveLength(3);
			expect((await onCommands()).filter((command) => command.status === 'accepted')).toHaveLength(1);
			expect(fixtureState.sends.filter(Boolean)).toEqual([true]);
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
		fixtureState.onOutcome = 'unknown';
		fixtureState.proofAllowed = () => false;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		expect(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' })).toEqual([
			expect.objectContaining({ status: 'unknown', fault: 'command_execution_unknown' }),
		]);
		expect(fixtureState.sends).toEqual([false, true, false]);
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
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		fixtureState.offOutcome = 'refused';
		fixtureState.proofAllowed = () => false;
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
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.branches[0]).toMatchObject({
			release_pending: true,
			release_proven: false,
		});
		expect(fixtureState.actuationAttempts).toEqual([false, true, false]);
	});

	type DecisionWitnessFact = Readonly<{
		id: string;
		controllerId: string;
		claimId: string;
		action: string;
		status: string;
		preparedAt: number;
		decisionRevision: number;
		dispatchedAt: number | null;
		fault: string | null;
	}>;
	const decisionWitnessFact = (row: VirtualThermostatCommandEntity): DecisionWitnessFact =>
		Object.freeze({
			id: row.id,
			controllerId: row.controllerId,
			claimId: row.claimId,
			action: row.action,
			status: row.status,
			preparedAt: row.preparedAt.getTime(),
			decisionRevision: row.decisionRevision,
			dispatchedAt: row.dispatchedAt === null ? null : row.dispatchedAt.getTime(),
			fault: row.fault,
		});
	const assertSemanticDecisionWitnesses = (
		actual: readonly VirtualThermostatCommandEntity[],
		knownBeforeEntry: readonly DecisionWitnessFact[],
		originalController: string,
		originalClaims: readonly string[],
	): void => {
		const ids = actual.map((row) => row.id);
		expect(new Set(ids).size).toBe(actual.length); // Detect duplicates BEFORE any ID deduplication.
		let semanticBound = 0;
		for (const claimId of originalClaims) {
			const candidates = knownBeforeEntry.filter(
				(row) => row.controllerId === originalController && row.claimId === claimId,
			);
			const pending = candidates.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled');
			const byLatest = [...candidates.filter((row) => row.action === 'on' && row.status !== 'cancelled')].sort(
				(a, b) =>
					b.preparedAt - a.preparedAt ||
					b.decisionRevision - a.decisionRevision ||
					(a.id < b.id ? 1 : a.id === b.id ? 0 : -1),
			);
			const byDispatch = [...pending.filter((row) => row.action === 'on' && row.dispatchedAt !== null)].sort(
				(a, b) => (b.dispatchedAt ?? 0) - (a.dispatchedAt ?? 0) || (a.id < b.id ? 1 : a.id === b.id ? 0 : -1),
			);
			// Unordered predicates require a genuine member, not an arbitrarily chosen seed ID.
			const predicates = [
				byLatest.slice(0, 1),
				pending.filter((row) => row.action === 'on'),
				pending.filter((row) => row.action === 'off'),
				pending.filter((row) => row.action === 'on' && row.status === 'unknown'),
				byDispatch.slice(0, 1),
				pending.filter((row) => row.fault !== null && row.fault !== ''),
			];
			const required = predicates.filter((rows) => rows.length > 0);
			semanticBound += required.length;
			for (const universe of required)
				expect(actual.some((row) => universe.some((known) => known.id === row.id))).toBe(true);
			for (const row of actual.filter((row) => row.claimId === claimId)) {
				const fact = decisionWitnessFact(row);
				expect(fact.controllerId).toBe(originalController);
				expect(required.some((universe) => universe.some((known) => known.id === fact.id))).toBe(true);
				expect(fact).toEqual(candidates.find((known) => known.id === fact.id));
			}
		}
		expect(actual.every((row) => originalClaims.includes(row.claimId) && row.controllerId === originalController)).toBe(
			true,
		);
		expect(actual.length).toBeLessThanOrEqual(semanticBound);
	};
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
		const baseline = Object.freeze(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map(decisionWitnessFact),
		);
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
		fixtureState.proofAllowed = () => false;
		const expectedWitnesses = Object.freeze([
			...baseline,
			...[...settled, latest, tied, cancelled, otherLatest, ...pending].map(decisionWitnessFact),
		]);
		const loaded = await entry.read();
		expect(loaded).toHaveLength(4);
		assertSemanticDecisionWitnesses(loaded, expectedWitnesses, controllerId, [claim.id, otherClaim.id]);
		expect(loaded.map((row) => row.id)).toEqual(expect.arrayContaining([latest.id, otherLatest.id, pending[1].id]));
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
		const baseline = Object.freeze(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map(decisionWitnessFact),
		);
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
		const latestPreparedAt = new Date();
		accepted[4999].preparedAt = latestPreparedAt;
		await database.manager.update(
			VirtualThermostatCommandEntity,
			{ id: accepted[4999].id },
			{ preparedAt: latestPreparedAt },
		);
		sample(sensorId, 18);
		sample(relayId, true);
		const firstExpected = Object.freeze([...baseline, ...accepted.map(decisionWitnessFact)]);
		await entry.read();
		expect(fullLoad).not.toHaveBeenCalled();
		assertSemanticDecisionWitnesses(await entry.last(), firstExpected, controllerId, [claim.id]);
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
		fixtureState.offGate = new Promise<void>((resolve) => (releaseOff = resolve));
		// Retain original first-evaluation command objects BEFORE the next public decision.
		// These are independent pre-entry records, never the next decision result as its own expectation.
		const previousContext = runtime['contexts'].get(controllerId);
		if (previousContext === undefined) throw new Error('Original first decision context missing');
		const priorIssued = previousContext.commands.map(decisionWitnessFact);
		const priorById = new Map<string, DecisionWitnessFact>();
		for (const row of [
			...baseline,
			...accepted.map(decisionWitnessFact),
			...priorIssued,
			...[unknown, pendingOff, newest, lastDispatched].map(decisionWitnessFact),
		])
			priorById.set(row.id, row);
		const secondExpected = Object.freeze([...priorById.values()]);
		const witnesses = await entry.read();
		assertSemanticDecisionWitnesses(witnesses, secondExpected, controllerId, [claim.id]);
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
		fixtureState.offGate = null;
		await settle();
		expect(fullLoad).toHaveBeenCalled();
		const drained = new Set(fixtureState.reconciledCommandIds.flat());
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
		fixtureState.beforeProof = async () => {
			await database.manager.insert(VirtualThermostatCommandEntity, unseen);
		};
		await entry.start(claim);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: first.id })).status).toBe(
			'accepted',
		);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: unseen.id })).status).toBe(
			'accepted',
		);
		fixtureState.beforeProof = null;
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
			expect(fixtureState.sends.filter(Boolean)).toHaveLength(0);
			now++;
			await runtime.inspect(controllerId);
			await settle();
			expect(fixtureState.sends.filter(Boolean)).toHaveLength(1);
		} finally {
			clock.mockRestore();
		}
	});

	it('cancels ON on an accepted sample between preparation and dispatch then sends ON from a fresh evaluation', async () => {
		const owned = fixtureOwner,
			body = captureFixtureBodyOwner(owned);
		const { runtime, database, controllerId, sensorId, events, sample, state: fixtureState } = owned;
		await body.work.observe(body.work.issue(() => settle(body)));
		body.assertLive();
		const commands = runtime['inFlightCommands'];
		const methods: OriginalFunctions<typeof commands> = commands;
		const set = methods.set;
		const original = Object.getOwnPropertyDescriptor(commands, 'set');
		let cancelledId: string | null = null,
			retired = false,
			restored = false,
			installedOwned = false;
		let observationFailure: { cause: unknown } | undefined;
		const setting = function (this: typeof commands, ...args: Parameters<typeof set>): ReturnType<typeof set> {
			const result = set.call(this, ...args); // Original call/throw/receiver/arguments/return ONCE.
			if (!retired && this === commands && args[1].action === 'on' && cancelledId === null) {
				try {
					body.assertLive();
					cancelledId = args[1].id; // Exact original supplied entity, after prepare ACK and BEFORE original dispatch.
					sample(sensorId, 18);
					events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: sensorId });
				} catch (cause) {
					observationFailure ??= { cause };
				}
			}
			return result;
		};
		const installed = { configurable: true, enumerable: original?.enumerable ?? false, writable: true, value: setting };
		let cleanup: Promise<void> | undefined;
		const backstop = {
			retire: (): void => {
				retired = true;
				body.retire();
			},
			cleanup: (): Promise<void> => {
				if (cleanup !== undefined) return cleanup;
				let resolve: () => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				cleanup = new Promise<void>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				backstop.retire();
				const issued = [...runtime['queues'].values(), ...runtime['inFlight'].values()];
				let stoppingFailure: { cause: unknown } | undefined;
				try {
					runtime.onModuleDestroy();
				} catch (cause) {
					stoppingFailure = { cause };
				}
				const finish = async (): Promise<void> => {
					let failure = stoppingFailure;
					for (const pending of issued) {
						try {
							await pending;
						} catch (cause) {
							failure ??= { cause };
						}
					}
					try {
						await body.work.joinIssued();
					} catch (cause) {
						failure ??= { cause };
					}
					try {
						if (installedOwned && !restored) restoreOriginalEntry(commands, 'set', installed, original);
						restored = true;
					} catch (cause) {
						failure ??= { cause };
					}
					unregisterCompletionObserver(backstop);
					if (failure !== undefined) throw failure.cause;
				};
				void finish().then(resolve, reject);
				return cleanup;
			},
		};
		registerCompletionObserver(backstop); // Before exact collection shadow installation.
		Object.defineProperty(commands, 'set', installed);
		installedOwned = true;
		let primary: { cause: unknown } | undefined, q: { cause: unknown } | undefined;
		try {
			sample(sensorId, 18);
			runtime.request(controllerId);
			await body.work.observe(body.work.issue(() => settle(body)));
			body.assertLive();
			if (observationFailure !== undefined) throw observationFailure.cause;
			expect(cancelledId).not.toBeNull();
			const cancelled = await body.work.observe(
				body.work.issue(() => database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: cancelledId })),
			);
			body.assertLive();
			expect(cancelled.status).toBe('cancelled');
			expect(cancelled.dispatchedAt).toBeNull();
			const journal = await body.work.observe(
				body.work.issue(() => database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })),
			);
			body.assertLive();
			expect(journal.some((row) => row.id !== cancelledId && row.action === 'on' && row.status === 'accepted')).toBe(
				true,
			);
			expect(fixtureState.sends.filter(Boolean)).toHaveLength(1);
		} catch (cause) {
			primary = { cause };
		}
		try {
			await backstop.cleanup();
		} catch (cause) {
			q = { cause };
		}
		if (primary !== undefined) throw primary.cause;
		if (q !== undefined) throw q.cause;
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
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await runtime.inspect(controllerId);
		await settle();
		expect(fixtureState.sends.filter(Boolean)).toHaveLength(1);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].activity).toBe('on');
	});

	it('closes local output and diagnostic authority until a fresh evaluation after graph validation retry', async () => {
		const outputId = await createTemperatureOutput();
		await runtime.inspect(controllerId);
		expect(producers.read(outputId)?.value).toBe(21);
		fixtureState.graphValidated = false;
		fixtureState.graphGeneration++;
		expect(producers.read(outputId)?.producer.reasons).toEqual(['graph_validation_pending']);
		expect(runtime.readDiagnostics(controllerId)?.current_temperature).toBeNull();
		fixtureState.graphValidated = true;
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
			if (fixtureState.publicationGate === originalGate) fixtureState.publicationGate = null;
			unregisterCompletionObserver(backstop);
			restoreRequest();
		};
		const backstop = { retire, cleanup };
		registerCompletionObserver(backstop);
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
			fixtureState.publicationGate = originalGate;
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
			fixtureState.graphValidated = false;
			fixtureState.graphGeneration++;
			fixtureState.graphValidated = true;
			release();
			await inspection;
			assertLive();
			expect(registry.read(outputId)?.producer.quality).toBe('unavailable');
			expect(owner.readDiagnostics(controllerId)?.readiness).toBe('unavailable');
			if (fixtureState.publicationGate === originalGate) fixtureState.publicationGate = null;
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
		fixtureState.graphValidated = false;
		fixtureState.graphGeneration++;
		sample(sensorId, 18);
		await runtime.inspect(controllerId);
		await runtime.inspect(controllerId);
		expect(fixtureState.sentTargets.some((target) => target.on)).toBe(false);
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
		fixtureState.installedQualifications.set(
			claim.physicalIdentity,
			Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
		);
		fixtureState.proofAllowed = () => false;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		fixtureState.proofAllowed = () => true;
		await finishRestartReconciliation();
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(true);
	});
	it('revokes a queued ON after qualification replacement and retains its reservation', async () => {
		let resume: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		fixtureState.installedQualifications.set(
			claim.physicalIdentity,
			Object.freeze({ physicalIdentity: claim.physicalIdentity }) as ThermostatInstalledQualification,
		);
		fixtureState.proofAllowed = () => false;
		resume();
		await finishRestartReconciliation();
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
		).toBe(1);
	});
	it('revokes the stored release barrier when its stable provider connection lease changes', async () => {
		await finishRestartReconciliation();
		fixtureState.providerCurrent = false;
		fixtureState.proofAllowed = () => false;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
	});

	it('accepts a newly admitted provider OFF sample instead of reusing pre-reconciliation timestamps', async () => {
		runtime.onModuleDestroy();
		const old = fixtureState.samples.get(relayId);
		const at = new Date(Date.now() - 5000);
		fixtureState.samples.set(relayId, { ...old, sampledAt: at, receivedAt: at });
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await finishRestartReconciliation();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
		expect(fixtureState.samples.get(relayId).receivedAt.getTime()).toBeGreaterThan(at.getTime());
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
			fixtureOwner.runtime = runtime = makeRuntime();
			const structure = (runtime as unknown as { structure: DeviceStructureLockService }).structure;
			const exclusive = structure.runExclusive.bind(structure) as DeviceStructureLockService['runExclusive'];
			let proofReady = false;
			fixtureState.proofMutation = (proof) => {
				proofReady = true;
				return proof;
			};
			jest.spyOn(structure, 'runExclusive').mockImplementation(async (operation) => {
				if (proofReady) {
					proofReady = false;
					fixtureState.proofAllowed = () => false;
					if (mode === 'source') fixtureState.providerCurrent = false;
					else if (mode === 'qualification')
						fixtureState.installedQualifications.set(claim.physicalIdentity, {
							...fixtureState.installedQualifications.get(claim.physicalIdentity),
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
			expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
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
		const qualification = fixtureState.installedQualifications.get(claim.physicalIdentity);
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
		fixtureState.proofMutation = (proof) => {
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
						fixtureState.proofAllowed = () => false;
						if (mode === 'source') fixtureState.providerCurrent = false;
						else if (mode === 'qualification')
							fixtureState.installedQualifications.set(claim.physicalIdentity, { ...qualification });
						else sample(relayId, true);
					}
					return result;
				});
			}
			return runner;
		});
		try {
			fixtureOwner.runtime = runtime = makeRuntime();
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
		fixtureState.providerCurrent = true;
		fixtureState.installedQualifications.set(claim.physicalIdentity, qualification);
		sample(relayId, false);
		fixtureState.proofAllowed = () => true;
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
			fixtureState.proofCalls = 0;
			fixtureState.proofMutation = (proof) => {
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
			fixtureOwner.runtime = runtime = makeRuntime();
			await runtime.onApplicationBootstrap();
			await finishRestartReconciliation();
			expect(fixtureState.proofCalls).toBeGreaterThan(0);
			expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
			expect(
				await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
			).toBe(1);
			expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		},
	);

	it('restarts a prepared ON before transport as unresolved and refuses energizing without drainage proof', async () => {
		fixtureState.onGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		const pending = await waitForOnJournal();
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		runtime.onModuleDestroy();
		fixtureState.proofAllowed = () => false;
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		const restored = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: pending.id });
		expect(restored.status).toBe('unknown');
		expect(runtime.readDiagnostics(controllerId)?.branches[0].pending_on).toBe(true);
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: 'reserved' }),
		).toBe(1);
	});

	it('restarts after physical ON acceptance but before journal settlement without treating OFF as drainage', async () => {
		fixtureState.afterOnGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		const pending = await waitForOnJournal();
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		runtime.onModuleDestroy();
		fixtureState.proofAllowed = () => false;
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		const restored = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: pending.id });
		expect(restored.status).toBe('unknown');
		expect(runtime.readDiagnostics(controllerId)?.branches[0].pending_on).toBe(true);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
	});

	it('revokes a queued ON when its ambient source disappears during transport authentication', async () => {
		let resumeOn: () => void = () => undefined;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal();
		fixtureState.samples.delete(sensorId);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
	});

	const addMandatoryMember = async (
		role: 'heating' | 'cooling' = 'heating',
		mac = 'A8032ABE5099',
		owner?: RealGuardOwner,
	): Promise<string> => {
		const originalOwner = owner ?? captureRealGuardOwner();
		originalOwner.assertLive();
		const owned = originalOwner.owned;
		const work = captureFixtureWorkOwner(owned, originalOwner.setup);
		const { database, controllerId, state: fixtureState, sample, runtime } = owned;
		const issue = work.issue;
		const deviceId = uuid(),
			channelId = uuid(),
			propertyId = uuid();
		await work.observe(
			issue(() =>
				database.manager.insert(ShellyNgDeviceEntity, {
					id: deviceId,
					name: 'Cooling relay',
					identifier: 'shellyplus1pm-' + mac.toLowerCase(),
					category: DeviceCategory.SWITCHER,
					enabled: true,
					canonicalMac: mac,
				}),
			),
		);
		work.assertLive();
		await work.observe(
			issue(() =>
				database.manager.insert(ShellyNgChannelEntity, {
					id: channelId,
					device: deviceId,
					name: 'Switch',
					identifier: 'switch:0',
					category: ChannelCategory.SWITCHER,
				} as never),
			),
		);
		work.assertLive();
		await work.observe(
			issue(() =>
				database.manager.insert(ShellyNgChannelPropertyEntity, {
					id: propertyId,
					channel: channelId,
					identifier: 'output',
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
				} as never),
			),
		);
		work.assertLive();
		const property = await work.observe(
			issue(() =>
				database.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: propertyId },
					relations: ['channel', 'channel.device'],
				}),
			),
		);
		work.assertLive();
		const channel = property.channel as ChannelEntity;
		await work.observe(
			issue(() =>
				database.manager.insert(VirtualThermostatActuatorClaimEntity, {
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
				}),
			),
		);
		work.assertLive();
		sample(propertyId, false);
		if (role === 'heating') {
			const config = await work.observe(
				issue(() => database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })),
			);
			work.assertLive();
			config.policy.floor = { limit: 30, recoveryHysteresis: 2 };
			await work.observe(issue(() => database.manager.save(config)));
			work.assertLive();
			const members = await work.observe(
				issue(() =>
					database.manager.findBy(VirtualThermostatActuatorClaimEntity, {
						controllerId,
						role: 'heating',
					}),
				),
			);
			work.assertLive();
			for (const member of members) {
				const existing = await work.observe(
					issue(() => database.manager.findOneBy(ThermostatMemberProtectionEntity, { claimId: member.id })),
				);
				work.assertLive();
				if (existing) continue;
				const probe = await work.observe(issue(() => createProtectionProbe(database, member.sourcePropertyId)));
				work.assertLive();
				const source = await work.observe(
					issue(() => resolveThermostatProtectionSource(database.manager, probe.sourceId, member.physicalIdentity)),
				);
				work.assertLive();
				fixtureState.protectionProbes.add(probe.sourceId);
				await work.observe(
					issue(() =>
						database.manager.insert(ThermostatMemberProtectionEntity, {
							claimId: member.id,
							schemaVersion: 1,
							kind: 'local_floor',
							revision: 1,
							sourcePropertyId: probe.sourceId,
							sourcePropertyIdentity: probe.sourceId,
							physicalPropertyIdentity: probe.physicalId,
							contractFingerprint: source.fingerprint,
							maximumAgeSeconds: 5,
						}),
					),
				);
				work.assertLive();
			}
			for (const member of members) {
				const binding = await work.observe(
					issue(() => new ThermostatInstallationBindingsService().resolve(database.manager, member.id)),
				);
				work.assertLive();
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
				await work.observe(issue(() => database.manager.save(row)));
				work.assertLive();
			}
			const protection = (runtime as unknown as { memberProtection: ThermostatMemberProtectionService })
				.memberProtection;
			const loaded = await work.observe(issue(() => protection.load(config, members)));
			work.assertLive();
			protection.read(loaded, Date.now() - 1);
			for (const probe of fixtureState.protectionProbes) sample(probe, 20);
		}
		work.assertLive();
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
	type RealGuardFixture = Awaited<ReturnType<typeof realThermostatGuardFixture>>;
	// Ownership bookkeeping only: these associations never confer native/currentness authority.
	type RealGuardOwner = Readonly<{
		owned: RuntimeFixtureOwner;
		setup: FixtureSetupLease;
		caseOwner: FixtureCaseLease;
		assertLive: () => void;
		issue: <T>(invoke: () => Promise<T>) => Promise<T>;
		construct: (invoke: () => Promise<RealGuardFixture>) => Promise<RealGuardFixture>;
	}>;
	type RealGuardAssociation = Readonly<{ owner: RealGuardOwner }>;
	const realGuardAssociations = new WeakMap<RealGuardFixture, RealGuardAssociation>();
	const realGuardCloses = new WeakMap<RealGuardFixture, Promise<void>>();
	const closeRecordedRealGuard = (fixture: RealGuardFixture): Promise<void> => {
		const closing = realGuardCloses.get(fixture);
		if (closing !== undefined) return closing;
		let resolve: () => void = () => undefined;
		let reject: (cause: unknown) => void = () => undefined;
		const completion = new Promise<void>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		realGuardCloses.set(fixture, completion); // Publish BEFORE revoke/flush/close callbacks or reentry.
		void completion.catch(() => undefined);
		const originalMethods: OriginalFunctions<Pick<RealGuardFixture, 'revoke' | 'flushTelemetry' | 'close'>> = fixture;
		const revoke = originalMethods.revoke,
			flush = originalMethods.flushTelemetry,
			close = originalMethods.close;
		let primary: { cause: unknown } | undefined;
		try {
			revoke.call(fixture);
		} catch (cause) {
			primary = { cause };
		} // Synchronous BEFORE any cleanup await.
		const finish = async (): Promise<void> => {
			let secondary: { cause: unknown } | undefined;
			try {
				await flush.call(fixture);
			} catch (cause) {
				secondary = { cause };
			}
			try {
				await close.call(fixture);
			} catch (cause) {
				secondary ??= { cause };
			}
			if (primary !== undefined) reject(primary.cause);
			else if (secondary !== undefined) reject(secondary.cause);
			else resolve();
		};
		void finish();
		return completion; // Test cleanup completion; original functions/receivers/arguments and failures retained.
	};
	const captureRealGuardOwner = (owned = fixtureOwner, setup = requireFixtureSetup()): RealGuardOwner => {
		const caseOwner = setup.caseOwner,
			fixtures = owned.realGuardFixtures;
		const assertLive = (): void => {
			setup.assertLive();
			if (setup.adopted !== owned || fixtureOwner !== owned || owned.lifetime.retired || owned.state.retired)
				throw new Error('Original real guard owner retired');
		};
		const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
			assertLive();
			const pending = invoke(); // Original invocation/receiver/arguments/Promise, once.
			owned.issued.add(pending);
			setup.issued.add(pending);
			return pending;
		};
		const construct = (invoke: () => Promise<RealGuardFixture>): Promise<RealGuardFixture> => {
			assertLive();
			let resolve: (fixture: RealGuardFixture) => void = () => undefined;
			let reject: (cause: unknown) => void = () => undefined;
			const completion = new Promise<RealGuardFixture>((yes, no) => {
				resolve = yes;
				reject = no;
			});
			// Join the original result's registration/orphan cleanup, not just construction.
			owned.issued.add(completion);
			setup.issued.add(completion);
			void completion.catch(() => undefined);
			const finish = async (): Promise<void> => {
				let fixture: RealGuardFixture | undefined, failure: { cause: unknown } | undefined;
				try {
					fixture = await issue(invoke);
					fixtures.push(fixture); // A owns the result BEFORE checking retirement.
					realGuardAssociations.set(fixture, { owner });
					assertLive();
				} catch (cause) {
					failure = { cause };
				}
				if (failure !== undefined && fixture !== undefined) {
					try {
						await closeRecordedRealGuard(fixture);
					} catch (cause) {
						setup.cleanupFailure ??= { cause };
					}
				}
				if (failure !== undefined) reject(failure.cause);
				else if (fixture === undefined) reject(new Error('Original real guard result missing'));
				else resolve(fixture);
			};
			void finish().catch(reject);
			return completion; // Test ownership completion, never substituted into a product port.
		};
		const owner: RealGuardOwner = Object.freeze({ owned, setup, caseOwner, assertLive, issue, construct });
		assertLive();
		return owner;
	};
	const publishRealGuardRuntime = (owner: RealGuardOwner, replacement: VirtualThermostatRuntimeService): void => {
		owner.assertLive();
		if (owner.owned.runtime !== replacement) throw new Error('Original real guard runtime publication mismatched');
		runtime = replacement;
	};
	const settleReal = async (fixture: RealGuardFixture) => {
		const association = realGuardAssociations.get(fixture);
		if (association === undefined) throw new Error('Real guard fixture has no original owner');
		const owner = association.owner;
		owner.assertLive(); // In particular, stale A cannot flush A and request current B.
		const owned = owner.owned,
			body = captureFixtureBodyOwner(owned);
		// Capture the SAME live owner's CURRENT runtime here: a prior deliberate restart is valid.
		for (let phase = 0; phase < 5; phase++) {
			owner.assertLive();
			body.assertLive();
			await owner.issue(() => fixture.flushTelemetry());
			owner.assertLive();
			body.assertLive();
			await settle(body, owner.issue);
			owner.assertLive();
			body.assertLive();
		}
		owner.assertLive();
		body.assertLive();
		owned.runtime.request(owned.controllerId, false); // SAME original final request.
		await owner.issue(() => fixture.flushTelemetry());
		owner.assertLive();
		body.assertLive();
		await settle(body, owner.issue);
		owner.assertLive();
		body.assertLive();
	};
	const expectAllMembersOn = (owner?: RealGuardOwner) => {
		owner?.assertLive();
		const diagnostic =
			owner === undefined
				? runtime.readDiagnostics(controllerId)
				: owner.owned.runtime.readDiagnostics(owner.owned.controllerId);
		expect(diagnostic.branches.every((branch) => branch.activity === 'on') ? true : diagnostic).toBe(true);
	};
	const useRealGuard = async (owner: RealGuardOwner) => {
		owner.assertLive();
		const { owned } = owner;
		const { database, events, producers, state, makeRuntime } = owned;
		owned.runtime.onModuleDestroy();
		const fixture = await owner.construct(() =>
			realThermostatGuardFixture(database, events, producers, state.installedQualifications),
		);
		owner.assertLive();
		for (const [id, sample] of state.samples) {
			await owner.issue(() => fixture.report(id, sample.value as number | boolean));
			owner.assertLive();
		}
		owned.runtimePorts.values = values = fixture.values;
		owned.runtime = runtime = makeRuntime(undefined, undefined, fixture.transport);
		await owner.issue(() => owned.runtime.onApplicationBootstrap());
		owner.assertLive();
		return fixture;
	};

	it.each(['closed', 'unmanaged'] as const)(
		'keeps actual %s delegate sessions closed without an original managed runtime admission',
		async (mode) => {
			const owner = captureRealGuardOwner();
			const { database, events, producers, relayId, state: fixtureState, runtime: originalRuntime } = owner.owned;
			owner.assertLive();
			originalRuntime.onModuleDestroy();
			const fixture = await owner.construct(() =>
				realThermostatGuardFixture(database, events, producers, fixtureState.installedQualifications, mode),
			);
			owner.assertLive();
			expect(fixture.captureSession(relayId)).toBeNull();
			owner.assertLive();
			expect(fixture.controls.fences).toEqual([]);
			owner.assertLive();
			expect(fixture.controls.sends).toEqual([]);
			owner.assertLive();
			expect(fixture.controls.errors).toEqual([]);
		},
	);

	it('requires an actual stopped-to-managed start and permanently revokes its original session at stop entry', async () => {
		const owner = captureRealGuardOwner();
		const { database, events, producers, relayId, state: fixtureState, runtime: originalRuntime } = owner.owned;
		owner.assertLive();
		originalRuntime.onModuleDestroy();
		const fixture = await owner.construct(() =>
			realThermostatGuardFixture(database, events, producers, fixtureState.installedQualifications, 'unmanaged'),
		);
		owner.assertLive();
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await owner.issue(() => fixture.startManaged())).toBe(false); // A managed call cannot rescue an already unmanaged start.
		owner.assertLive();
		expect(fixture.captureSession(relayId)).toBeNull();
		expect(await owner.issue(() => fixture.stopManaged())).toBe(true);
		expect(await owner.issue(() => fixture.startManaged())).toBe(true);
		await owner.issue(() => fixture.insert());
		owner.assertLive();
		const original = fixture.captureSession(relayId);
		expect(original).not.toBeNull();
		if (!original) throw new Error('Expected original real managed session');
		owner.assertLive();
		expect(original.isCurrent()).toBe(true);
		const stopping = owner.issue(() => fixture.stopManaged());
		owner.assertLive();
		expect(original.isCurrent()).toBe(false); // Before the stop lifecycle lock/drain can await.
		await stopping;
		expect(await owner.issue(() => fixture.startManaged())).toBe(true);
		await owner.issue(() => fixture.insert());
		owner.assertLive();
		const fresh = fixture.captureSession(relayId);
		expect(fresh).not.toBeNull();
		owner.assertLive();
		expect(fresh?.isCurrent()).toBe(true);
		owner.assertLive();
		expect(original.isCurrent()).toBe(false);
		owner.assertLive();
		expect(fixture.controls.fences).toEqual([]);
		owner.assertLive();
		expect(fixture.controls.sends).toEqual([]); // Lifecycle and capture never replay protective actuation.
		owner.assertLive();
		expect(fixture.controls.errors).toEqual([]);
	});

	it('recovers startup, trip and restart through real guard-session OFF admission events including unchanged OFF', async () => {
		const owner = captureRealGuardOwner();
		const { database, events, controllerId, relayId, sensorId, state: fixtureState, makeRuntime } = owner.owned;
		const sibling = await addMandatoryMember('heating', 'A8032ABE5099', owner);
		owner.assertLive();
		const accepted = jest.fn<void, [{ propertyId: string; sample: QualifiedPropertySample }]>();
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, accepted);
		const fixture = await useRealGuard(owner);
		owner.assertLive();
		let runtime = owner.owned.runtime;
		await settleReal(fixture);
		owner.assertLive();
		expect(fixture.controls.errors).toEqual([]);
		expect(fixture.controls.fences.length).toBeGreaterThanOrEqual(2);
		expect(
			accepted.mock.calls.filter(([event]) => event.propertyId === relayId && event.sample.value === false).length,
		).toBeGreaterThanOrEqual(2);
		const settledFences = fixture.controls.fences.length;
		runtime.request(controllerId);
		await settleReal(fixture);
		owner.assertLive();
		expect(fixture.controls.fences).toHaveLength(settledFences); // No self-sustaining unchanged-OFF loop.
		for (const probe of fixtureState.protectionProbes) await owner.issue(() => fixture.report(probe, 20));
		owner.assertLive();
		await owner.issue(() => fixture.report(sensorId, 18));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expectAllMembersOn(owner);
		const [probe] = [...fixtureState.protectionProbes];
		const beforeTrip = fixture.controls.fences.length;
		await owner.issue(() => fixture.report(probe, 30));
		owner.assertLive();
		await owner.issue(() => fixture.report(probe, 20));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expect(fixture.controls.fences.length).toBeGreaterThan(beforeTrip);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.protection.latched)).toBe(true);
		for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expectAllMembersOn(owner);
		const original = await owner.issue(() =>
			database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' }),
		);
		owner.assertLive();
		runtime.onModuleDestroy();
		// Restart cannot use historical clear latches or ordinary OFF feedback as drainage proof.
		await owner.issue(() => fixture.report(relayId, false));
		owner.assertLive();
		await owner.issue(() => fixture.report(sibling, false));
		owner.assertLive();
		owner.owned.runtime = runtime = makeRuntime(undefined, undefined, fixture.transport);
		publishRealGuardRuntime(owner, runtime);
		await owner.issue(() => runtime.onApplicationBootstrap());
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expectAllMembersOn(owner);
		const retained = await owner.issue(() =>
			database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' }),
		);
		owner.assertLive();
		expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
		fixture.reports.onModuleDestroy();
	});

	it('withholds real guard-session recovery without a fence feedback loop while graph validation is unavailable', async () => {
		const owner = captureRealGuardOwner();
		const { controllerId, sensorId, state: fixtureState } = owner.owned;
		await addMandatoryMember('heating', 'A8032ABE5099', owner);
		owner.assertLive();
		const fixture = await useRealGuard(owner);
		owner.assertLive();
		const runtime = owner.owned.runtime;
		await settleReal(fixture);
		owner.assertLive();
		for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		const before = fixture.controls.fences.length;
		fixtureState.graphGeneration++;
		fixtureState.graphValidated = false;
		runtime.request(controllerId);
		await owner.issue(() => fixture.report([...fixtureState.protectionProbes][0], 30));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expect(fixture.controls.fences).toHaveLength(before);
		expect(fixture.controls.sends).toHaveLength(0);
		expect(runtime.readDiagnostics(controllerId).readiness).toBe('unavailable');
		fixtureState.graphValidated = true;
		runtime.request(controllerId);
		await settleReal(fixture);
		owner.assertLive();
		expect(fixture.controls.fences.length).toBeGreaterThan(before);
		expect(fixture.controls.sends).toHaveLength(0);
		for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
		owner.assertLive();
		await owner.issue(() => fixture.report(sensorId, 18));
		owner.assertLive();
		await settleReal(fixture);
		owner.assertLive();
		expectAllMembersOn(owner);
		fixture.reports.onModuleDestroy();
	});

	it.each(['queued', 'late'] as const)(
		'retains real guard-session %s ON until all-leaf post-trip drain and new recovery',
		async (delivery) => {
			const owner = captureRealGuardOwner();
			const { database, controllerId, relayId, sensorId, state: fixtureState } = owner.owned;
			await addMandatoryMember('heating', 'A8032ABE5099', owner);
			owner.assertLive();
			const fixture = await useRealGuard(owner);
			owner.assertLive();
			const runtime = owner.owned.runtime;
			await settleReal(fixture);
			owner.assertLive();
			let release!: () => void, entered!: () => void;
			const gate = new Promise<void>((resolve) => (release = resolve));
			const started = new Promise<void>((resolve) => (entered = resolve));
			const gateBackstop = {
				retire: (): void => release(),
				cleanup: (): void => {
					release();
					removeOwnedFixtureObserver(owner.owned, gateBackstop);
					unregisterCompletionObserver(gateBackstop);
				},
			};
			registerCompletionObserver(gateBackstop);
			registerOwnedFixtureObserver(owner.owned, gateBackstop);
			fixture.controls[delivery === 'queued' ? 'beforeOn' : 'afterOn'] = async (property) => {
				if (property !== relayId) return;
				entered();
				await gate;
				owner.assertLive();
			};
			for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
			owner.assertLive();
			await owner.issue(() => fixture.report(sensorId, 18));
			owner.assertLive();
			await started;
			owner.assertLive();
			await owner.issue(() => runtime.flush());
			owner.assertLive();
			const original = await owner.issue(() =>
				database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' }),
			);
			owner.assertLive();
			const [probe] = [...fixtureState.protectionProbes];
			await owner.issue(() => fixture.report(probe, 30));
			owner.assertLive();
			await owner.issue(() => fixture.report(probe, 20));
			owner.assertLive();
			await owner.issue(() => runtime.flush());
			owner.assertLive();
			expect(
				(
					await owner.issue(() =>
						database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' }),
					)
				).some((row) => row.status === 'dispatching'),
			).toBe(true);
			release();
			await settle(captureFixtureBodyOwner(owner.owned), owner.issue);
			owner.assertLive();
			await owner.issue(() => fixture.flushTelemetry());
			owner.assertLive();
			await settleReal(fixture);
			owner.assertLive();
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
				owner.assertLive();
			}
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.protection.latched)).toBe(true);
			if (delivery === 'queued') expect(fixture.controls.sends.some((send) => send.property === relayId)).toBe(false);
			else expect(fixture.controls.sends.some((send) => send.property === relayId)).toBe(true);
			const retained = await owner.issue(() =>
				database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' }),
			);
			owner.assertLive();
			expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
			for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
			owner.assertLive();
			await settleReal(fixture);
			owner.assertLive();
			expectAllMembersOn(owner);
			fixture.reports.onModuleDestroy();
		},
	);

	it.each(['temperature', 'configuration', 'graph', 'claim'] as const)(
		'rejects stale scope after external %s mutation while real guard-session proof awaits',
		async (mutation) => {
			const owner = captureRealGuardOwner();
			const { database, events, controllerId, relayId, sensorId, state: fixtureState } = owner.owned;
			await addMandatoryMember('heating', 'A8032ABE5099', owner);
			owner.assertLive();
			const fixture = await useRealGuard(owner);
			owner.assertLive();
			const runtime = owner.owned.runtime;
			await settleReal(fixture);
			owner.assertLive();
			for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
			owner.assertLive();
			await settleReal(fixture);
			owner.assertLive();
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.ready)).toBe(true);
			let release!: () => void, entered!: () => void;
			const gate = new Promise<void>((resolve) => (release = resolve));
			const started = new Promise<void>((resolve) => (entered = resolve));
			const gateBackstop = {
				retire: (): void => release(),
				cleanup: (): void => {
					release();
					removeOwnedFixtureObserver(owner.owned, gateBackstop);
					unregisterCompletionObserver(gateBackstop);
				},
			};
			registerCompletionObserver(gateBackstop);
			registerOwnedFixtureObserver(owner.owned, gateBackstop);
			let held = false;
			fixture.controls.beforeFence = async (property) => {
				if (property !== relayId || held) throw new Error('subsequent proof deliberately withheld');
				held = true;
				entered();
				await gate;
				owner.assertLive();
			};
			const [probe] = [...fixtureState.protectionProbes];
			await owner.issue(() => fixture.report(probe, 30));
			owner.assertLive();
			await started;
			owner.assertLive();
			if (mutation === 'temperature') {
				await owner.issue(() => fixture.report(probe, 31));
				owner.assertLive();
				await owner.issue(() => fixture.report(sensorId, 18));
				owner.assertLive();
			} else if (mutation === 'configuration') {
				await owner.issue(() =>
					database.manager.increment(VirtualThermostatConfigEntity, { controllerId }, 'revision', 1),
				);
				owner.assertLive();
				events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			} else if (mutation === 'claim') {
				await owner.issue(() =>
					database.manager.increment(
						VirtualThermostatActuatorClaimEntity,
						{ sourcePropertyId: relayId },
						'revision',
						1,
					),
				);
				owner.assertLive();
				events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
			} else {
				fixtureState.graphGeneration++;
				fixtureState.graphValidated = false;
				runtime.request(controllerId);
			}
			for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
			owner.assertLive();
			release();
			await settleReal(fixture);
			owner.assertLive();
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
			fixtureState.graphValidated = true;
			runtime.request(controllerId);
			await settleReal(fixture);
			owner.assertLive();
			expect(fixture.controls.sends).toHaveLength(0); // Pre-proof safe reports never authorize recovery.
			for (const source of fixtureState.protectionProbes) await owner.issue(() => fixture.report(source, 20));
			owner.assertLive();
			await owner.issue(() => fixture.report(sensorId, 18));
			owner.assertLive();
			await settleReal(fixture);
			owner.assertLive();
			expectAllMembersOn(owner);
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
			fixtureState.sentTargets
				.filter((send) => send.on)
				.map((send) => send.propertyId)
				.sort(),
		).toEqual([relayId, sibling].sort());
		const [probe] = [...fixtureState.protectionProbes];
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
		fixtureState.packetTick = useThermostatPacketClock();
		await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		const [probe] = [...fixtureState.protectionProbes];
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
			const issuedWork = captureFixtureWorkOwner();
			fixtureState.packetTick = useThermostatPacketClock();
			const sibling = await addMandatoryMember(undefined, undefined, issuedWork.owner);
			runtime.request(controllerId);
			await settle();
			let resumeOn!: () => void;
			fixtureState.onGate = new Promise<void>((resolve) => (resumeOn = resolve));
			sample(sensorId, 18);
			runtime.request(controllerId);
			await waitForOnJournal(issuedWork);
			await runtime.flush();
			expect(fixtureState.sentTargets.some((send) => send.propertyId === sibling && send.on)).toBe(true);
			expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			const original = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(original).toHaveLength(2);
			const boundary = fixtureState.sentTargets.length;
			fixtureState.proofAllowed = (id) => id !== sibling;
			const [probe] = [...fixtureState.protectionProbes];
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
			expect(fixtureState.sentTargets.slice(boundary)).toContainEqual({ propertyId: sibling, on: false });
			expect(fixtureState.sentTargets.slice(boundary).some((send) => send.on)).toBe(false);
			expect(
				runtime
					.readDiagnostics(controllerId)
					.reasons.some((reason) => reason.startsWith('member_floor_release_required:')),
			).toBe(true);
			const retained = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(original.every((command) => retained.some((row) => row.id === command.id))).toBe(true);
			expect(retained.some((command) => command.status !== 'confirmed' && command.status !== 'cancelled')).toBe(true);
			// One leaf's proof cannot discharge the barrier for the whole branch.
			fixtureState.proofAllowed = () => true;
			runtime.request(controllerId);
			await settle();
			runtime.request(controllerId);
			await settle();
			expect(fixtureState.sentTargets.slice(boundary).some((send) => send.on)).toBe(false);
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
			// Pre-drain recovery reports remain unusable. Only a new post-drain report clears the latch.
			await afterMemberDrain();
			for (const source of fixtureState.protectionProbes) sample(source, 20);
			runtime.request(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
		},
	);

	it.each(['trip', 'missing', 'degraded'] as const)(
		'rechecks every member protection at final queued ON after %s without a new evaluation request',
		async (failure) => {
			const issuedWork = captureFixtureWorkOwner();
			await addMandatoryMember(undefined, undefined, issuedWork.owner);
			runtime.request(controllerId);
			await settle();
			let resume: () => void = () => undefined;
			fixtureState.onGate = new Promise<void>((resolve) => {
				resume = resolve;
			});
			sample(sensorId, 18);
			runtime.request(controllerId);
			await waitForOnJournal(issuedWork);
			const [probe] = [...fixtureState.protectionProbes];
			if (failure === 'trip') sample(probe, 30);
			else if (failure === 'missing') fixtureState.samples.delete(probe);
			else fixtureState.samples.set(probe, { ...fixtureState.samples.get(probe), quality: 'degraded' });
			resume();
			await settle();
			expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
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
			fixtureState.sentTargets
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
			if (failure === 'offline') fixtureState.unavailableMembers.add(sibling);
			else
				await database.manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ sourcePropertyId: sibling },
					{ sourcePropertyId: null, state: 'missing', revision: 2 },
				);
			runtime.request(controllerId);
			await settle();
			expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
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
			const issuedWork = captureFixtureWorkOwner();
			const sibling = await addMandatoryMember(undefined, undefined, issuedWork.owner);
			fixtureState.packetTick = useThermostatPacketClock();
			// Every evaluation boundary below is explicit. A real poll during SQLite I/O can drain the
			// energized sibling before the mutation whose queued-ON fence this fixture is testing.
			clearInterval((runtime as unknown as { timer: NodeJS.Timeout }).timer);
			const commandTarget =
				change === 'override expiry'
					? null
					: await registeredHeatingCommand(change === 'explicit OFF' ? 'heating_enabled' : 'heating_setpoint');
			runtime.request(controllerId);
			await settle();
			await configureComfort(undefined, issuedWork);
			sample(sensorId, 22);
			let resumeOn!: () => void;
			fixtureState.onGate = new Promise<void>((resolve) => {
				resumeOn = resolve;
			});
			const relayQueued = new Promise<void>((resolve) => {
				fixtureState.onQueued = resolve;
			});
			const siblingEnergized = new Promise<void>((resolve) => {
				fixtureState.onSent = (propertyId) => {
					if (propertyId === sibling) resolve();
				};
			});
			const now = Date.now();
			jest.setSystemTime(now);
			if (change === 'manual configuration') {
				await comfort.select(controllerId, await comfortFence(undefined, issuedWork), 'comfort', false);
			} else {
				await comfort.override(
					controllerId,
					await comfortFence(undefined, issuedWork),
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
			for (const probe of fixtureState.protectionProbes) sample(probe, 20);
			runtime.request(controllerId);
			await waitForOnJournal(issuedWork);
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
			expect(fixtureState.samples.get(sibling)?.value).toBe(true);
			expect(fixtureState.sentTargets.filter((send) => send.propertyId === sibling).at(-1)).toEqual({
				propertyId: sibling,
				on: true,
			});
			expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			const mutationBoundary = fixtureState.sentTargets.length;
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
			fixtureState.onGate = null;
			await settle();
			// Expiry persists a new configuration revision; poll again for release proof bound to that revision.
			runtime.request(controllerId);
			await settle();
			expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
			expect(fixtureState.sentTargets.slice(mutationBoundary)).toContainEqual({ propertyId: sibling, on: false });
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
		const issuedWork = captureFixtureWorkOwner();
		const sibling = await addMandatoryMember(undefined, undefined, issuedWork.owner);
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		fixtureState.allowLateOn = true;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal(issuedWork);
		await runtime.flush();
		fixtureState.proofAllowed = (id) => id !== relayId;
		fixtureState.samples.delete(sibling);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		fixtureState.onGate = null;
		await settle();
		const pending = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(pending.some((command) => command.status !== 'cancelled' && command.status !== 'confirmed')).toBe(true);
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(diagnostics.branches).toHaveLength(2);
		expect(diagnostics.branches.some((branch) => branch.pending_on)).toBe(true);
		expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
	});

	it('waits for every opposed member to drain and measures changeover from the last qualified OFF', async () => {
		const issuedWork = captureFixtureWorkOwner();
		const sibling = await addMandatoryMember(undefined, undefined, issuedWork.owner);
		const cooling = await addMandatoryMember('cooling', 'A8032ABE5098', issuedWork.owner);
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		config.policy.coolingSetpoint = 24;
		config.requestedMode = 'auto';
		config.policy.changeoverMs = 60_000;
		await database.manager.save(config);
		runtime.request(controllerId);
		await settle();
		fixtureState.proofAllowed = (id) => id !== sibling;
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
		expect(fixtureState.sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		fixtureState.proofAllowed = () => true;
		for (let phase = 0; phase < 3; phase++) {
			runtime.request(controllerId, false);
			await settle();
		}
		expect(fixtureState.sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(false);
		expect(runtime.readDiagnostics(controllerId).reasons).toContain('cooling_changeover_wait');
		const rows = await database.manager.find(VirtualThermostatBranchRuntimeEntity);
		for (const row of rows) {
			row.lastVerifiedOffAt = new Date(Date.now() - 120_000);
			await database.manager.save(row);
		}
		runtime.request(controllerId);
		await settle();
		expect(fixtureState.sentTargets.some((send) => send.propertyId === cooling && send.on)).toBe(true);
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
		fixtureState.proofAllowed = (id) => id !== sibling;
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await settle();
		const pending = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
		expect(pending).toHaveLength(original.length);
		expect(pending.some((command) => command.status === 'confirmed')).toBe(true);
		expect(pending.some((command) => command.status !== 'confirmed' && command.status !== 'cancelled')).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
		fixtureState.proofAllowed = () => true;
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.protection.latched)).toBe(true);
		for (const probe of fixtureState.protectionProbes) sample(probe, 20);
		for (let phase = 0; phase < 3; phase++) {
			runtime.request(controllerId, false);
			await settle();
		}
		expect(original.every((command) => pending.some((row) => row.id === command.id))).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'off')).toBe(true);
		await afterMemberDrain();
		for (const probe of fixtureState.protectionProbes) sample(probe, 20);
		runtime.request(controllerId);
		await settle();
		expect(runtime.readDiagnostics(controllerId).branches.every((branch) => branch.activity === 'on')).toBe(true);
	});

	it('rechecks a parallel member generation before final send and cancels its stale queued ON', async () => {
		const issuedWork = captureFixtureWorkOwner();
		await addMandatoryMember(undefined, undefined, issuedWork.owner);
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		const command = await waitForOnJournal(issuedWork);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: command.claimId });
		await database.manager.update(
			VirtualThermostatActuatorClaimEntity,
			{ id: claim.id },
			{ revision: claim.revision + 1, qualificationGeneration: 'restored-generation', state: 'releasing' },
		);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		fixtureState.onGate = null;
		await settle();
		expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(false);
		expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
			'cancelled',
		);
		expect(runtime.readDiagnostics(controllerId).branches).toHaveLength(2);
	});

	it('treats an accepted but unobserved parallel member as incomplete capacity and releases its siblings', async () => {
		const sibling = await addMandatoryMember();
		runtime.request(controllerId);
		await settle();
		fixtureState.acceptedWithoutFeedback = sibling;
		fixtureState.proofAllowed = (id) => id !== sibling;
		sample(sensorId, 18);
		runtime.request(controllerId);
		await settle();
		expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && send.on)).toBe(true);
		expect(fixtureState.sentTargets.some((send) => send.propertyId === relayId && !send.on)).toBe(true);
		const diagnostics = runtime.readDiagnostics(controllerId);
		expect(diagnostics.branches.find((branch) => branch.pending_on)).toBeDefined();
		expect(diagnostics.reasons).toContain('heating_not_ready');
	});

	it('fences a mandatory refusal across a newly loaded context and releases the already-running sibling', async () => {
		const issuedWork = captureFixtureWorkOwner();
		const sibling = await addMandatoryMember(undefined, undefined, issuedWork.owner);
		runtime.request(controllerId);
		await settle();
		let resumeOn!: () => void;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		runtime.request(controllerId);
		const blocked = await waitForOnJournal(issuedWork);
		await runtime.flush();
		const inFlight = (runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight;
		await Promise.all([...inFlight].filter(([id]) => id !== blocked.id).map(([, operation]) => operation));
		expect(fixtureState.sentTargets.some((send) => send.propertyId === sibling && send.on)).toBe(true);
		await runtime.inspect(controllerId);
		fixtureState.onOutcome = 'refused';
		fixtureState.proofAllowed = (id) => id !== relayId;
		resumeOn();
		fixtureState.onGate = null;
		await settle();
		runtime.request(controllerId, false);
		await settle();
		expect(fixtureState.sentTargets.filter((send) => send.on)).toEqual([{ propertyId: sibling, on: true }]);
		expect(fixtureState.sentTargets.some((send) => send.propertyId === sibling && !send.on)).toBe(true);
		expect(runtime.readDiagnostics(controllerId).branches.some((branch) => branch.fault === 'known_no_send')).toBe(
			true,
		);
	});

	it('blocks an opposed cooling branch across restart until the pending heating ON is drained', async () => {
		const issuedWork = captureFixtureWorkOwner();
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
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();

		fixtureState.afterOnGate = new Promise<void>(() => undefined);
		sample(sensorId, 18);
		runtime.request(controllerId);
		await waitForOnJournal(issuedWork);
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		runtime.onModuleDestroy();
		fixtureState.proofAllowed = (id) => id !== relayId;
		sample(sensorId, 27);
		fixtureOwner.runtime = runtime = makeRuntime();
		await runtime.onApplicationBootstrap();
		await runtime.inspect(controllerId);
		expect(
			runtime.readDiagnostics(controllerId)?.branches.find((branch) => branch.role === 'heating')?.pending_on,
		).toBe(true);
		expect(fixtureState.sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)).toBe(false);

		fixtureState.proofAllowed = () => true;
		for (let attempt = 0; attempt < 5; attempt++) {
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (fixtureState.sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)) break;
		}
		expect(fixtureState.sentTargets.some((send) => send.propertyId === coolingPropertyId && send.on)).toBe(true);
	});

	it('retains a disabled controller claim and its pending ON until qualified release evidence exists', async () => {
		sample(sensorId, 18);
		runtime.request(controllerId);
		await runtime.inspect(controllerId);
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.flush();
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		}
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		const claims = (runtime as unknown as { claims: VirtualThermostatClaimsService }).claims;
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		fixtureState.proofAllowed = () => false;
		await database.manager.update(DeviceEntity, { id: controllerId }, { enabled: false });
		runtime.request(controllerId);
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		expect(claim.state).toBe('releasing');
		expect(config.requestedMode).toBe('off');
		expect(fixtureState.samples.get(relayId)?.value).toBe(false);
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
		expect(fixtureState.sentTargets.filter((send) => send.on)).toHaveLength(1);
		fixtureState.proofAllowed = () => false;
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, { device: { id: controllerId } });
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(fixtureState.sentTargets.filter((send) => send.on)).toHaveLength(1);
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('release_ordering_unreconciled');
		fixtureState.proofAllowed = () => true;
		for (let attempt = 0; attempt < 5; attempt++) {
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
			if (fixtureState.sentTargets.filter((send) => send.on).length > 1) break;
		}
		expect(fixtureState.sentTargets.filter((send) => send.on)).toHaveLength(2);
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
		expect(fixtureState.sends).toEqual([false, true]);
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
		expect(fixtureState.sends).toEqual([false, true, false]);
		expect(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).every(
				(command) => command.status === 'confirmed',
			),
		).toBe(true);
	});

	it('retains pending ON and withholds release proof when a delayed ON arrives after OFF', async () => {
		let resumeOn: () => void = () => undefined;
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		fixtureState.allowLateOn = true;
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
		expect(fixtureState.samples.get(relayId)?.value).toBe(true);
		expect(late?.branches[0].pending_on).toBe(true);
		expect(late?.branches[0].release_proven).toBe(false);
	});

	it('keeps idle SQLite claim retries closed through a recovery fence and revokes earlier admission', async () => {
		const source = database,
			caseOwner = currentFixtureCase,
			setup = requireFixtureSetup();
		const retryResources: {
			claimsOwner?: VirtualThermostatClaimsService;
			restoreFind?: () => void;
		} = {};
		let inFlight: Promise<void> | undefined, cleanup: Promise<void> | undefined;
		let retired = false;
		const pendingCalls = new Set<Promise<void>>();
		const issue = (invoke: () => Promise<void>): Promise<void> => {
			setup.assertLive();
			const original = invoke();
			pendingCalls.add(original);
			return original;
		};
		const backstop = {
			retire: (): void => {
				if (retired) return;
				retired = true;
				inFlight = retryResources.claimsOwner?.['refreshInFlight']; // Exact already-issued native reload, never another refresh.
				retryResources.claimsOwner?.onModuleDestroy();
			},
			cleanup: (): Promise<void> => {
				if (cleanup !== undefined) return cleanup;
				let resolve: () => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				cleanup = new Promise<void>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				let q: { cause: unknown } | undefined;
				try {
					backstop.retire();
				} catch (cause) {
					q = { cause };
				}
				const finish = async (): Promise<void> => {
					if (inFlight !== undefined) {
						try {
							await inFlight;
						} catch (cause) {
							q ??= { cause };
						}
					}
					for (const original of pendingCalls) {
						try {
							await original;
						} catch (cause) {
							q ??= { cause };
						}
					}
					try {
						const restoreFind = retryResources.restoreFind;
						restoreFind?.();
					} catch (cause) {
						q ??= { cause };
					}
					if (currentFixtureCase === caseOwner) {
						try {
							jest.useRealTimers();
						} catch (cause) {
							q ??= { cause };
						}
					}
					unregisterCompletionObserver(backstop);
					if (q !== undefined) throw q.cause;
				};
				void finish().then(resolve, reject);
				return cleanup;
			},
		};
		registerCompletionObserver(backstop); // Before find shadow, consumer construction or first await.
		runtime.onModuleDestroy();
		const originalMethods: OriginalFunctions<typeof source.manager> = source.manager;
		const originalFind: Readonly<{
			call: <Entity extends import('typeorm').ObjectLiteral>(
				receiver: typeof source.manager,
				target: import('typeorm').EntityTarget<Entity>,
				options?: import('typeorm').FindManyOptions<Entity>,
			) => Promise<Entity[]>;
		}> = originalMethods.find;
		const primary = new Error('temporary SQLite read failure');
		let failNext = false;
		const findBefore = Object.getOwnPropertyDescriptor(source.manager, 'find');
		const find = jest.spyOn(source.manager, 'find').mockImplementation(function <
			Entity extends import('typeorm').ObjectLiteral,
		>(
			target: import('typeorm').EntityTarget<Entity>,
			options?: import('typeorm').FindManyOptions<Entity>,
		): Promise<Entity[]> {
			if (failNext && target === VirtualThermostatActuatorClaimEntity) {
				failNext = false;
				return Promise.reject(primary);
			}
			return originalFind.call(source.manager, target, options);
		});
		const installedFind = Object.getOwnPropertyDescriptor(source.manager, 'find');
		retryResources.restoreFind = (): void => {
			if (installedFind === undefined) throw new Error('Original find observer descriptor missing');
			restoreOriginalEntry(source.manager, 'find', installedFind, findBefore);
			find.mockRestore();
		};
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const claims = new VirtualThermostatClaimsService(
			source,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(source),
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
			new ConfigService({ FB_CLI: 'off' }),
		);
		retryResources.claimsOwner = claims;
		let bodyP: { cause: unknown } | undefined, cleanupQ: { cause: unknown } | undefined;
		try {
			const starting = issue(() => claims.onApplicationBootstrap());
			await starting;
			pendingCalls.delete(starting);
			setup.assertLive();
			const beforeRecovery = claims.capture();
			expect(beforeRecovery.isCurrent()).toBe(true);
			const release = claims.holdRecoveryFence();
			const beforeFailureCalls = find.mock.calls.length;
			failNext = true;
			const failedRefresh = issue(() => claims.refresh());
			await expect(failedRefresh).rejects.toThrow('temporary SQLite read failure');
			pendingCalls.delete(failedRefresh);
			expect(claims.capture().isCurrent()).toBe(false);
			expect(jest.getTimerCount()).toBe(1);
			setup.assertLive();
			await jest.advanceTimersByTimeAsync(1000);
			setup.assertLive();
			expect(find.mock.calls.length).toBeGreaterThanOrEqual(2);
			expect(find.mock.calls.length).toBeGreaterThan(beforeFailureCalls + 1);
			// Wait for a registry read to settle; the timer alone does not prove SQLite read completion.
			const recovered = issue(() => claims.refresh());
			await recovered;
			pendingCalls.delete(recovered);
			setup.assertLive();
			expect(jest.getTimerCount()).toBe(0);
			const whileHeld = claims.capture();
			expect(whileHeld.isCurrent()).toBe(false);
			expect(whileHeld.isRequestCurrent?.()).toBe(true);
			expect(beforeRecovery.isCurrent()).toBe(false);
			release();
			expect(claims.capture().isCurrent()).toBe(false);
			const released = issue(() => claims.refresh());
			await released;
			pendingCalls.delete(released);
			setup.assertLive();
			expect(claims.capture().isCurrent()).toBe(true);
			expect(whileHeld.isCurrent()).toBe(false);
			expect(beforeRecovery.isCurrent()).toBe(false);
		} catch (cause) {
			bodyP = { cause };
		}
		try {
			await backstop.cleanup();
		} catch (cause) {
			cleanupQ = { cause };
		}
		if (bodyP !== undefined) throw bodyP.cause;
		if (cleanupQ !== undefined) throw cleanupQ.cause;
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
					property.id === relayId
						? (fixtureState.samples.get(relayId) ?? null)
						: readQualifiedSample(property, maximumAgeMs, now),
				);
			fixtureOwner.runtimePorts.values = values = realValues;
			fixtureOwner.runtime = runtime = makeRuntime(graph, aggregate);
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
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);
			await report(sources[1], null);
			await settle();
			expect(producers.read(output.id).producer.quality).toBe('unavailable');
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
			await report(sources[1], 18);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);
			await report(floor, 28);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
			await report(floor, 27);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			await report(floor, 26.9);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);
			jest.setSystemTime(startedAt + 11_000);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('floor_unavailable');
			await report(floor, 26);
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);
			jest.setSystemTime(startedAt + 22_000);
			await report(floor, 26.9);
			await settle();
			expect(realValues.readQualifiedSample(floor, 10_000)?.value).toBe(26.9);
			expect(realValues.readQualifiedSample(output, 10_000)).toBeNull();
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('ambient_unavailable');
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			for (const [index, property] of sources.entries()) await report(property, 17 + index);
			await settle();
			expect(producers.read(output.id).value).toBe(18);
			expect(runtime.readDiagnostics(controllerId)?.current_temperature).toBe(18);
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);
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
		expect(fixtureState.sends).not.toContain(true);

		sample(floorPropertyId, 27);
		runtime.request(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(true);
		expect(fixtureState.sends).not.toContain(true);

		sample(floorPropertyId, 26.9);
		runtime.request(controllerId);
		await runtime.flush();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.floor_latched).toBe(false);
		expect(fixtureState.sends).toContain(true);
	});

	it('revokes a queued ON when the floor reaches its boundary during transport authentication', async () => {
		const issuedWork = captureFixtureWorkOwner();
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
		fixtureState.onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		sample(sensorId, 18);
		sample(floorPropertyId, 27);
		runtime.request(controllerId);
		await waitForOnJournal(issuedWork);
		sample(floorPropertyId, 28);
		runtime.request(controllerId);
		await runtime.flush();
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		expect(fixtureState.sentTargets.some((send) => send.on)).toBe(false);
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
			expect(fixtureState.sends).not.toContain(true);

			jest.setSystemTime(startedAt + 99);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(fixtureState.sends).not.toContain(true);

			jest.setSystemTime(startedAt + 100);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(fixtureState.sends).toContain(true);
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);

			config.contactClosingMs = 250;
			config.revision++;
			await database.manager.save(config);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 349);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 350);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('contact_unknown');
			expect(fixtureState.samples.get(relayId)?.value).toBe(true);

			jest.setSystemTime(startedAt + 351);
			sample(contactPropertyId, false);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('window_open');
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);

			jest.setSystemTime(startedAt + 352);
			fixtureState.samples.delete(contactPropertyId);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			expect(runtime.readDiagnostics(controllerId)?.reasons).toContain('contact_unknown');
			await settle();
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);

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
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
			jest.setSystemTime(startedAt + 602);
			runtime.request(controllerId);
			await runtime.inspect(controllerId);
			await settle();
			expect(runtime.readDiagnostics(controllerId)?.requested_mode).toBe('off');
			expect(runtime.readDiagnostics(controllerId)?.heating_setpoint).toBe(22);
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('window_open');
			expect(runtime.readDiagnostics(controllerId)?.reasons).not.toContain('contact_unknown');
			expect(fixtureState.samples.get(relayId)?.value).toBe(false);
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
		const degraded = fixtureState.samples.get(sensorId);
		if (!degraded) throw new Error('Missing ambient sample');
		fixtureState.samples.set(sensorId, { ...degraded, quality: 'degraded' });
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
		fixtureOwner.runtime = runtime = makeRuntime();
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
		expect(fixtureState.samples.get(relayId)?.value).toBe(false);
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
			const owned = fixtureOwner,
				setup = requireFixtureSetup();
			const realOwner = captureRealGuardOwner(owned, setup);
			const {
				database,
				events,
				producers,
				mutationValues,
				mutationPipeline,
				controllerId,
				state: fixtureState,
			} = owned;
			let localRuntime = owned.runtime,
				localProvider = owned.mutationProvider,
				localComfort = owned.comfort;
			const localClaims = owned.mutationClaims;
			let localRegistry = owned.mutationRegistry;
			void owned.mutationWriter; // Retain the original pre-await lookup; its value was never consumed.
			void owned.values; // Retain the original pre-await lookup; its value was never consumed.
			void owned.configs; // Retain the original pre-await lookup; its value was never consumed.
			const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
				setup.assertLive();
				const pending = invoke();
				owned.issued.add(pending);
				return pending;
			};
			setup.assertLive();
			localRuntime.onModuleDestroy(); // close the legacy stand-in localRuntime; it is NOT the admission proof
			const preparedStructure = new DeviceStructureLockService();
			localProvider.onModuleDestroy();
			localComfort.onModuleDestroy();
			localClaims.onModuleDestroy();
			localRegistry.onModuleDestroy();
			owned.mutationRegistry = localRegistry = new ClimateAutomationRegistryService();
			const localWriter = (owned.mutationWriter = new ClimateAutomationWriterService(
				database,
				preparedStructure,
				localRegistry,
				new ConfigService({ FB_CLI: 'off' }),
			));
			const preparedGraph = new VirtualDependencyGraphService(
				database,
				new ConfigService({ FB_CLI: 'off' }),
				localWriter,
			);
			owned.mutationStructure = preparedStructure;
			owned.mutationGraph = preparedGraph;
			await issue(() => preparedGraph.onApplicationBootstrap());
			setup.assertLive();
			const preparedClaims = new VirtualThermostatClaimsService(
				database,
				preparedStructure,
				preparedGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
				new ConfigService({ FB_CLI: 'off' }),
			);
			owned.mutationClaims = preparedClaims;
			await issue(() => preparedClaims.onApplicationBootstrap());
			setup.assertLive();
			const preparedFixture = await realOwner.construct(() =>
				realThermostatGuardFixture(database, events, producers, fixtureState.installedQualifications, 'managed', {
					values: mutationValues,
					sources: mutationPipeline.get(PropertyValueSourceRegistryService),
				}),
			);
			setup.assertLive();
			// Reuse ONLY the helper's existing explicitly synthetic qualification boundary. No new fields or private map forcing.
			for (const evidence of fixtureState.installedQualifications.values())
				preparedClaims.recordQualification(evidence);
			const localValues = (owned.runtimePorts.values = preparedFixture.values);
			owned.comfort =
				owned.runtimePorts.comfort =
				localComfort =
					new VirtualThermostatComfortService(
						database,
						preparedStructure,
						preparedGraph,
						preparedClaims,
						events,
						localWriter,
					);
			const localConfigs = (owned.configs = new VirtualThermostatConfigService(
				database,
				preparedStructure,
				preparedGraph,
				preparedClaims,
				events,
				localValues,
				undefined,
				localWriter,
			));
			owned.mutationProvider = localProvider = new VirtualThermostatAutomationService(
				localWriter,
				localRegistry,
				preparedGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				localConfigs,
				localComfort,
			);
			localProvider.onModuleInit();
			const row = await issue(() => database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }));
			setup.assertLive();
			const comfortMethods: OriginalFunctions<Pick<VirtualThermostatComfortService, 'configure'>> = localComfort;
			const configure = comfortMethods.configure;
			const graphRevision = await issue(() => preparedGraph.revision());
			setup.assertLive();
			await issue(() =>
				configure.call(
					localComfort,
					controllerId,
					{ expected_revision: row.revision, expected_graph_revision: graphRevision },
					{
						heating_range: { minimum: 10, maximum: 30 },
						cooling_range: null,
						presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
					},
				),
			);
			setup.assertLive();
			for (const [id, sample] of fixtureState.samples) {
				if (typeof sample.value !== 'number' && typeof sample.value !== 'boolean')
					throw new Error('Unexpected synthetic sample');
				const originalValue = sample.value;
				await issue(() => preparedFixture.report(id, originalValue));
				setup.assertLive();
			}
			await issue(() => preparedClaims.refresh());
			setup.assertLive();
			owned.runtime = localRuntime = new VirtualThermostatRuntimeService(
				database,
				preparedStructure,
				preparedClaims,
				new VirtualThermostatInputsService(database, localValues),
				preparedFixture.transport,
				localValues,
				producers,
				events,
				preparedGraph,
				localComfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
			setup.assertLive();
			owned.values = localValues;
			actualStructure = preparedStructure;
			actualGraph = preparedGraph;
			actualClaims = preparedClaims;
			fixture = preparedFixture;
			runtime = localRuntime;
			mutationRegistry = localRegistry;
			mutationWriter = localWriter;
			mutationProvider = localProvider;
			comfort = localComfort;
			configs = localConfigs;
			values = localValues;
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
		afterEach(async () => {
			const caseOwner = currentFixtureCase,
				owner = runtime,
				claimsOwner = actualClaims,
				fixtureAtEntry = fixture;
			const issued = [...owner['queues'].values(), ...owner['inFlight'].values(), ...fixtureOwner.issued];
			if (caseOwner !== undefined) {
				caseOwner.retired = true;
				if (caseOwner.setup !== undefined) caseOwner.setup.retired = true;
			}
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
				owner.onModuleDestroy();
			} catch (cause) {
				failure ??= { cause };
			}
			try {
				claimsOwner?.onModuleDestroy();
			} catch (cause) {
				failure ??= { cause };
			}
			try {
				fixtureAtEntry?.revoke();
			} catch (cause) {
				failure ??= { cause };
			}
			// All original issued consumers settle before any owned descriptor is restored.
			for (const pending of issued) {
				try {
					await pending;
				} catch (cause) {
					failure ??= { cause };
				}
			}
			// Remove H before the outer resource hook asks Jest to restore the underlying owned spy S.
			for (const observer of observers) {
				try {
					await observer.cleanup();
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
			for (const evidence of fixtureState.installedQualifications.values()) actualClaims.recordQualification(evidence);
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
				const owned = fixtureOwner,
					setup = requireFixtureSetup();
				const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
					setup.assertLive();
					const original = invoke();
					owned.issued.add(original);
					return original;
				};
				await prepare();
				setup.assertLive();
				const row = await issue(() =>
					owned.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: owned.controllerId }),
				);
				setup.assertLive();
				const originalComfort = owned.comfort;
				const methods: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> = originalComfort;
				const override = methods.override;
				const revision = await issue(() => owned.mutationGraph.revision());
				setup.assertLive();
				await issue(() =>
					override.call(
						originalComfort,
						owned.controllerId,
						{ expected_revision: row.revision, expected_graph_revision: revision },
						{ preset: 'eco', setpoints: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
						'R21-original',
					),
				);
				setup.assertLive();
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
					unregisterCompletionObserver(backstop);
					if (failure) throw failure.cause;
				};
				const backstop = { retire, cleanup: (): void => cleanup(true) };
				registerCompletionObserver(backstop);
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
			const startR53WithCeiling = async (
				maximum: number,
				completion: R53OffBoundary,
				issuedWork?: FixtureWorkOwner,
			): Promise<R53OffReceipt> => {
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
				const starting =
					issuedWork === undefined
						? runtime.onApplicationBootstrap()
						: issuedWork.issue(() => runtime.onApplicationBootstrap());
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
						await (issuedWork === undefined ? starting : issuedWork.observe(starting));
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
					unregisterCompletionObserver(backstop);
					if (failure) throw failure.cause;
				};
				const backstop = { retire, cleanup };
				registerCompletionObserver(backstop);
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
				for (const probe of fixtureState.protectionProbes) await owned.report(probe, 20);
				// A conservative, future-dated observation creates unavailable A debt; it grants no authority and changes no clock/timeout.
				protection.read([first], Date.now() + 10_000);
				protection.read([second], Date.now());
				runtime.onModuleDestroy();
				fixtureOwner.runtime = runtime = new VirtualThermostatRuntimeService(
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
				for (const probe of fixtureState.protectionProbes) await owned.report(probe, 20);
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
				fixtureOwner.runtime = runtime = new VirtualThermostatRuntimeService(
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
									unregisterCompletionObserver(backstop);
								},
							};
							pollBackstop = backstop;
							registerCompletionObserver(backstop);
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
				const setup = requireFixtureSetup(),
					work = captureFixtureWorkOwner(fixtureOwner, setup),
					completion = observeR53OffTerminal();
				await active();
				setup.assertLive();
				work.assertLive();
				if (!fixture) throw new Error('Managed fixture missing');
				const owned = fixture,
					owner = work.owned.runtime,
					entered = gate();
				let selectedOn: VirtualThermostatCommandEntity | undefined;
				const resources = work.owned;
				const association = realGuardAssociations.get(owned);
				if (association === undefined || association.owner.owned !== resources || association.owner.setup !== setup)
					throw new Error('Original ON telemetry fixture belongs to another setup');
				const originalValues = resources.runtimePorts.values,
					originalEvents = resources.events;
				const originalId = resources.controllerId,
					originalSensor = resources.sensorId,
					claimsOwner = resources.mutationClaims;
				const requestBefore = Object.getOwnPropertyDescriptor(owner, 'request');
				const request = jest.spyOn(owner, 'request');
				const requestInstalled = Object.getOwnPropertyDescriptor(owner, 'request');
				completion.bind(owner, owned);
				const receipt = await startR53WithCeiling(2, completion.boundary, work);
				if (!receipt.operation.fulfilled) throw receipt.operation.cause;
				if (receipt.failure !== undefined) throw receipt.failure.cause;
				if (!receipt.service.fulfilled) throw receipt.service.cause;
				expect(receipt.terminal).toBe(true);
				expect(receipt.outputSaved).toBe(true);
				expect(receipt.childState).toBe('OFF_REPORTED');
				const originalLifecycle = owner['lifecycle'];
				if (originalLifecycle === undefined) throw new Error('Original runtime bootstrap lifecycle missing');
				owned.controls.beforeOn = () => {
					const originals = [...owner['inFlightCommands'].values()].filter(
						(command) => command.action === 'on' && command.controllerId === originalId,
					);
					if (selectedOn === undefined && originals.length === 1 && owner['lifecycle'] === originalLifecycle)
						selectedOn = originals[0];
					entered.open();
					return Promise.resolve();
				};
				let actualOnReports = 0;
				const wrong: object[] = [];
				const observe = (event: Readonly<{ sample: QualifiedPropertySample }>): void => {
					if (event.sample.value === true) {
						actualOnReports++;
						if (originalValues.captureOwnedFeedbackDelivery(event)) wrong.push(event);
					}
				};
				originalEvents.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe);
				let primary: { cause: unknown } | undefined, q: { cause: unknown } | undefined;
				try {
					await work.observe(work.issue(() => owned.report(originalSensor, 10)));
					work.assertLive();
					await entered.promise;
					work.assertLive();
					const pending = selectedOn === undefined ? undefined : owner['inFlight'].get(selectedOn.id);
					const on =
						selectedOn !== undefined &&
						pending !== undefined &&
						owner['inFlightCommands'].get(selectedOn.id) === selectedOn
							? { action: selectedOn.action, pending }
							: undefined;
					expect(on).toBeDefined();
					if (!on) throw new Error('Genuine original ON operation not entered');
					await work.observe(work.issue(() => on.pending));
					work.assertLive();
					await work.observe(work.issue(() => owned.flushTelemetry()));
					work.assertLive();
					await work.observe(work.issue(() => owner.flush()));
					work.assertLive();
					expect(owned.controls.sends.filter((send) => send.on).length).toBeGreaterThan(0);
					expect(actualOnReports).toBeGreaterThan(0);
					expect(wrong).toEqual([]);
					const before = request.mock.calls.length;
					originalEvents.emit(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, { id: originalSensor });
					expect(request.mock.calls.length).toBe(before + 1);
					const original = claimsOwner.capture();
					owner.request(originalId, false);
					await work.observe(work.issue(() => owner.flush()));
					work.assertLive();
					expect(original.isCurrent()).toBe(false);
				} catch (cause) {
					primary = { cause };
				}
				const attempt = (action: () => void): void => {
					try {
						action();
					} catch (cause) {
						q ??= { cause };
					}
				};
				const issued = [...owner['queues'].values(), ...owner['inFlight'].values()];
				work.retire();
				attempt(() => owner.onModuleDestroy());
				attempt(() => owned.revoke());
				owned.controls.beforeOn = null;
				for (const pending of issued) {
					try {
						await pending;
					} catch (cause) {
						q ??= { cause };
					}
				}
				try {
					await work.joinIssued();
				} catch (cause) {
					q ??= { cause };
				}
				attempt(() => originalEvents.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, observe));
				attempt(() => {
					if (requestInstalled === undefined) throw new Error('Original request observer missing');
					restoreOriginalEntry(owner, 'request', requestInstalled, requestBefore);
					request.mockRestore();
				});
				attempt(() => completion.cleanup());
				if (primary !== undefined) throw primary.cause;
				if (q !== undefined) throw q.cause;
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
			const owned = fixtureOwner,
				setup = requireFixtureSetup();
			const realOwner = captureRealGuardOwner(owned, setup);
			const {
				database,
				events,
				producers,
				mutationValues,
				mutationPipeline,
				controllerId,
				state: fixtureState,
			} = owned;
			let localRuntime = owned.runtime,
				localProvider = owned.mutationProvider,
				localComfort = owned.comfort;
			const localClaims = owned.mutationClaims;
			let localRegistry = owned.mutationRegistry;
			void owned.mutationWriter; // Retain the original pre-await lookup; its value was never consumed.
			void owned.values; // Retain the original pre-await lookup; its value was never consumed.
			void owned.configs; // Retain the original pre-await lookup; its value was never consumed.
			const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
				setup.assertLive();
				const pending = invoke();
				owned.issued.add(pending);
				return pending;
			};
			setup.assertLive();
			localRuntime.onModuleDestroy(); // close the legacy stand-in localRuntime; it is NOT the admission proof
			const preparedStructure = new DeviceStructureLockService();
			localProvider.onModuleDestroy();
			localComfort.onModuleDestroy();
			localClaims.onModuleDestroy();
			localRegistry.onModuleDestroy();
			owned.mutationRegistry = localRegistry = new ClimateAutomationRegistryService();
			const localWriter = (owned.mutationWriter = new ClimateAutomationWriterService(
				database,
				preparedStructure,
				localRegistry,
				new ConfigService({ FB_CLI: 'off' }),
			));
			const preparedGraph = new VirtualDependencyGraphService(
				database,
				new ConfigService({ FB_CLI: 'off' }),
				localWriter,
			);
			owned.mutationStructure = preparedStructure;
			owned.mutationGraph = preparedGraph;
			await issue(() => preparedGraph.onApplicationBootstrap());
			setup.assertLive();
			const preparedClaims = new VirtualThermostatClaimsService(
				database,
				preparedStructure,
				preparedGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
				new ConfigService({ FB_CLI: 'off' }),
			);
			owned.mutationClaims = preparedClaims;
			await issue(() => preparedClaims.onApplicationBootstrap());
			setup.assertLive();
			const preparedFixture = await realOwner.construct(() =>
				realThermostatGuardFixture(database, events, producers, fixtureState.installedQualifications, 'managed', {
					values: mutationValues,
					sources: mutationPipeline.get(PropertyValueSourceRegistryService),
				}),
			);
			setup.assertLive();
			// Reuse ONLY the helper's existing explicitly synthetic qualification boundary. No new fields or private map forcing.
			for (const evidence of fixtureState.installedQualifications.values())
				preparedClaims.recordQualification(evidence);
			const localValues = (owned.runtimePorts.values = preparedFixture.values);
			owned.comfort =
				owned.runtimePorts.comfort =
				localComfort =
					new VirtualThermostatComfortService(
						database,
						preparedStructure,
						preparedGraph,
						preparedClaims,
						events,
						localWriter,
					);
			const localConfigs = (owned.configs = new VirtualThermostatConfigService(
				database,
				preparedStructure,
				preparedGraph,
				preparedClaims,
				events,
				localValues,
				undefined,
				localWriter,
			));
			owned.mutationProvider = localProvider = new VirtualThermostatAutomationService(
				localWriter,
				localRegistry,
				preparedGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				localConfigs,
				localComfort,
			);
			localProvider.onModuleInit();
			const row = await issue(() => database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId }));
			setup.assertLive();
			const comfortMethods: OriginalFunctions<Pick<VirtualThermostatComfortService, 'configure'>> = localComfort;
			const configure = comfortMethods.configure;
			const graphRevision = await issue(() => preparedGraph.revision());
			setup.assertLive();
			await issue(() =>
				configure.call(
					localComfort,
					controllerId,
					{ expected_revision: row.revision, expected_graph_revision: graphRevision },
					{
						heating_range: { minimum: 10, maximum: 30 },
						cooling_range: null,
						presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
					},
				),
			);
			setup.assertLive();
			for (const [id, sample] of fixtureState.samples) {
				if (typeof sample.value !== 'number' && typeof sample.value !== 'boolean')
					throw new Error('Unexpected synthetic sample');
				const originalValue = sample.value;
				await issue(() => preparedFixture.report(id, originalValue));
				setup.assertLive();
			}
			await issue(() => preparedClaims.refresh());
			setup.assertLive();
			owned.runtime = localRuntime = new VirtualThermostatRuntimeService(
				database,
				preparedStructure,
				preparedClaims,
				new VirtualThermostatInputsService(database, localValues),
				preparedFixture.transport,
				localValues,
				producers,
				events,
				preparedGraph,
				localComfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
			setup.assertLive();
			owned.values = localValues;
			actualStructure = preparedStructure;
			actualGraph = preparedGraph;
			actualClaims = preparedClaims;
			fixture = preparedFixture;
			runtime = localRuntime;
			mutationRegistry = localRegistry;
			mutationWriter = localWriter;
			mutationProvider = localProvider;
			comfort = localComfort;
			configs = localConfigs;
			values = localValues;

			await issue(() => localRuntime.onApplicationBootstrap());
			setup.assertLive();
			await settleReal(preparedFixture);
			setup.assertLive();
			expect(preparedClaims.capture().isCurrent()).toBe(true);
			expect(localRuntime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(true);
			expect(preparedFixture.controls.sends).toEqual([]); // SAME initial ambient21 vs manual20 oracle.
		});
		afterEach(() => {
			// Preserve exact original issued work BEFORE synchronous revocation clears the maps.
			const owner = runtime,
				resources = fixtureOwner;
			for (const pending of [...owner['queues'].values(), ...owner['inFlight'].values()]) resources.issued.add(pending);
			// Synchronous source/core revocation before outer teardown awaits or restores SDK/HTTP mocks.
			owner.onModuleDestroy();
			actualClaims?.onModuleDestroy();
			fixture?.revoke();
		});

		// BEGIN R132 closed predecessor real managed drafts — UNRUN; old bodies below are untouched.
		type R132Held = Readonly<{
			owner: VirtualThermostatRuntimeService;
			source: SqliteDataSource;
			id: string;
			real: typeof fixture;
			comfort: VirtualThermostatComfortService;
			assertLive: () => void;
			command: VirtualThermostatCommandEntity;
			operation: Promise<void>;
			mutation: ReturnType<VirtualThermostatComfortService['select']>;
			readEntered: ReturnType<typeof barrier>;
			readResume: ReturnType<typeof barrier>;
			nativeResume: ReturnType<typeof barrier>;
			resultObserved: ReturnType<typeof barrier>;
			nativeResult: () => Awaited<ReturnType<ThermostatActuationAdapter['send']>>;
		}>;
		const withR132Held = async (
			body: (held: R132Held) => Promise<void>,
			beforeEntry?: (owner: VirtualThermostatRuntimeService, id: string, real: typeof fixture) => void,
			boundary: 'beforeOn' | 'afterOn' = 'beforeOn',
			freshBOriginalOff = false,
		): Promise<void> => {
			const setup = requireFixtureSetup(),
				owner = runtime,
				source = database,
				real = fixture,
				id = controllerId,
				relay = relayId,
				sensor = sensorId,
				publicComfort = comfort;
			const caseOwner = setup.caseOwner;
			const freshOff = Object.freeze({ enabled: freshBOriginalOff, caseOwner, setup });
			const originalWriter = mutationWriter;
			const originalWriterContext = originalWriter['context'];
			const originalWriterTurns = originalWriter['turns'];
			const originalFlushTelemetry: OriginalFunction<typeof real, typeof real.flushTelemetry> = real.flushTelemetry;
			const nativeEntered = barrier(),
				nativeResume = barrier(),
				resultObserved = barrier(),
				readEntered = barrier(),
				readResume = barrier();
			let cleanupCompletion: Promise<void> | undefined;
			let retired = false,
				first = true,
				firstRead = true;
			let packet: Parameters<ThermostatActuationAdapter['send']>[4];
			let nativeResult: Awaited<ReturnType<ThermostatActuationAdapter['send']>> | undefined;
			let nativeFailure: { cause: unknown } | undefined, primary: { cause: unknown } | undefined;
			let mutation: ReturnType<VirtualThermostatComfortService['select']> | undefined,
				operation: Promise<void> | undefined;
			const oldHook = Object.getOwnPropertyDescriptor(real.controls, boundary);
			const hook = async (property: string): Promise<void> => {
				if (retired || property !== relay || !first) return;
				first = false;
				nativeEntered.open();
				await nativeResume.promise;
			};
			const same = (a: PropertyDescriptor | undefined, b: PropertyDescriptor | undefined): boolean =>
				!!a &&
				!!b &&
				a.value === b.value &&
				a.get === b.get &&
				a.set === b.set &&
				a.configurable === b.configurable &&
				a.enumerable === b.enumerable &&
				a.writable === b.writable;
			const subscriber: import('typeorm').EntitySubscriberInterface = {
				beforeQuery: async (event) => {
					const context = originalWriterContext.getStore();
					const turn = context?.turn;
					const phase = turn === undefined ? undefined : originalWriterTurns.get(turn);
					const operation = context?.operation;
					const input = phase?.existingInput;
					if (
						retired ||
						caseOwner.retired ||
						setup.retired ||
						caseOwner.setup !== setup ||
						context === undefined ||
						context.internal !== true ||
						operation === undefined ||
						phase === undefined ||
						phase.operation !== operation ||
						operation.phase !== 'BODY_OPEN' ||
						operation.existingReadonlyProbe !== true ||
						operation.failure !== undefined ||
						phase.phase !== 'READ_BEFORE' ||
						operation.manager !== event.manager ||
						operation.runner !== event.queryRunner ||
						input === undefined ||
						input.kind !== 'preset:v1' ||
						input.controllerId !== id ||
						!firstRead ||
						!event.query.startsWith('SELECT') ||
						!event.query.includes('devices_virtual_thermostat_configs')
					)
						return;
					firstRead = false;
					readEntered.open();
					await readResume.promise;
				},
			};
			const installedCleanups: (() => void | Promise<void>)[] = [];
			const backstop = {
				retire: (): void => {
					retired = true;
					let failure: { cause: unknown } | undefined;
					for (const close of [
						() => owner.onModuleDestroy(),
						() => real.revoke(),
						() => readResume.open(),
						() => nativeResume.open(),
					]) {
						try {
							close();
						} catch (cause) {
							failure ??= { cause };
						}
					}
					if (failure) throw failure.cause;
				},
				cleanup: (): Promise<void> => {
					if (cleanupCompletion !== undefined) return cleanupCompletion;
					let resolveCompletion: () => void = () => undefined;
					let rejectCompletion: (cause: unknown) => void = () => undefined;
					const completion = new Promise<void>((resolve, reject) => {
						resolveCompletion = resolve;
						rejectCompletion = reject;
					});
					// Publish before retirement can synchronously reenter this exact cleanup.
					cleanupCompletion = completion;
					let failure: { cause: unknown } | undefined;
					try {
						backstop.retire();
					} catch (cause) {
						failure = { cause };
					}
					void (async (): Promise<void> => {
						for (const cleanup of [
							async () => {
								if (mutation !== undefined) await mutation.catch(() => undefined);
							},
							async () => {
								if (operation !== undefined) await operation.catch(() => undefined);
							},
							() => originalFlushTelemetry.call(real),
							...installedCleanups,
						]) {
							try {
								await cleanup();
							} catch (cause) {
								failure ??= { cause };
							}
						}
						try {
							unregisterCompletionObserver(backstop);
						} catch (cause) {
							failure ??= { cause };
						}
						if (failure !== undefined) throw failure.cause;
					})().then(resolveCompletion, rejectCompletion);
					return completion;
				},
			};
			registerCompletionObserver(backstop);
			try {
				real.controls[boundary] = hook;
				const installedHook = Object.getOwnPropertyDescriptor(real.controls, boundary);
				installedCleanups.push(() => {
					if (!same(Object.getOwnPropertyDescriptor(real.controls, boundary), installedHook))
						throw new Error('Foreign R132 gate descriptor retained');
					if (oldHook) Object.defineProperty(real.controls, boundary, oldHook);
					else Reflect.deleteProperty(real.controls, boundary);
				});
				const original: Readonly<{
					get: OriginalFunction<VirtualThermostatTransportService, VirtualThermostatTransportService['get']>;
				}> = real.transport;
				const get = original.get;
				const spy = jest.spyOn(real.transport, 'get').mockImplementation((...args) => {
					const adapter = get.call(real.transport, ...args);
					if (!adapter) return null;
					if (
						freshOff.enabled &&
						freshOff.caseOwner === caseOwner &&
						freshOff.setup === setup &&
						!retired &&
						!caseOwner.retired &&
						!setup.retired &&
						caseOwner.setup === setup &&
						currentFixtureCase === caseOwner &&
						args[0].value === false
					)
						return adapter; // Fresh B only: preserve the original OFF adapter/work identity.
					const methods: Readonly<{
						send: OriginalFunction<ThermostatActuationAdapter, ThermostatActuationAdapter['send']>;
					}> = adapter;
					const send = methods.send;
					return {
						...adapter,
						send: (...sendArgs: Parameters<ThermostatActuationAdapter['send']>) => {
							if (!retired && packet === undefined && sendArgs[0].property.id === relay && sendArgs[0].value === true)
								packet = sendArgs[4];
							const pending = send.call(adapter, ...sendArgs);
							void pending.then(
								(result) => {
									if (packet && sendArgs[4] === packet) {
										nativeResult = result;
										resultObserved.open();
									}
								},
								(cause: unknown) => {
									if (packet && sendArgs[4] === packet) {
										nativeFailure = { cause };
										resultObserved.open();
									}
								},
							);
							return pending; // SAME original native Promise, not a timing wrapper.
						},
					};
				});
				const installedGet = Object.getOwnPropertyDescriptor(real.transport, 'get');
				installedCleanups.unshift(() => {
					if (!same(Object.getOwnPropertyDescriptor(real.transport, 'get'), installedGet))
						throw new Error('Foreign R132 get descriptor retained');
					spy.mockRestore();
				});
				source.subscribers.push(subscriber);
				installedCleanups.unshift(() => {
					const index = source.subscribers.indexOf(subscriber);
					if (index >= 0) source.subscribers.splice(index, 1);
				});
				const current = await publicComfort.get(id);
				setup.assertLive();
				const expected = { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
				await real.report(sensor, 18);
				setup.assertLive();
				await nativeEntered.promise;
				setup.assertLive();
				const selected = [...owner['inFlightCommands'].values()].filter(
					(command) => command.controllerId === id && command.action === 'on',
				);
				expect(selected).toHaveLength(1);
				const command = selected[0];
				if (!packet || packet.commandId !== command.id) throw new Error('Nonunique original native packet');
				operation = owner['inFlight'].get(command.id);
				if (operation === undefined) throw new Error('Missing original intrinsic O');
				beforeEntry?.(owner, id, real);
				mutation = publicComfort.select(id, expected, 'eco', false);
				void mutation.catch(() => undefined);
				await body({
					owner,
					source,
					id,
					real,
					comfort: publicComfort,
					assertLive: () => setup.assertLive(),
					command,
					operation,
					mutation,
					readEntered,
					readResume,
					nativeResume,
					resultObserved,
					nativeResult: () => {
						if (nativeFailure) throw nativeFailure.cause;
						if (!nativeResult) throw new Error('Missing native result');
						return nativeResult;
					},
				});
			} catch (cause) {
				primary = { cause };
			}
			try {
				await backstop.cleanup();
			} catch (cause) {
				if (!primary) primary = { cause };
			}
			if (primary) throw primary.cause;
		};
		it.each(['beforeOn', 'afterOn'] satisfies readonly ('beforeOn' | 'afterOn')[])(
			'R132 reaches the original first read before O and admits only its real %s acknowledged postimage',
			async (boundary) => {
				await withR132Held(
					async (held) => {
						await held.readEntered.promise;
						held.assertLive();
						expect(held.owner['inFlight'].get(held.command.id)).toBe(held.operation);
						held.nativeResume.open();
						await held.resultObserved.promise;
						expect(held.nativeResult()).toMatchObject(
							boundary === 'beforeOn'
								? { outcome: 'refused' }
								: { outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false },
						);
						held.owner.onModuleDestroy();
						held.readResume.open();
						await held.mutation;
						await held.operation;
						expect(
							(await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: held.command.id }))
								.status,
						).toBe(boundary === 'beforeOn' ? 'cancelled' : 'unknown');
						expect(held.real.controls.sends.filter((send) => send.on)).toHaveLength(boundary === 'beforeOn' ? 0 : 1);
					},
					undefined,
					boundary,
				);
			},
			30_000,
		);
		it.each([undefined, null, false, 'first native save P', new Error('first native save P')])(
			'R132 keeps first outcome-save %p primary even if original catch saves and O fulfills',
			async (primary: unknown) => {
				await withR132Held(async (held) => {
					await held.readEntered.promise;
					held.assertLive();
					let injected = false;
					const subscriber: import('typeorm').EntitySubscriberInterface = {
						beforeQuery: (event) => {
							if (
								!injected &&
								event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
								event.parameters?.includes(held.command.id) &&
								event.parameters.includes('cancelled')
							) {
								injected = true;
								throw primary;
							}
						},
					};
					held.source.subscribers.push(subscriber);
					try {
						held.nativeResume.open();
						await held.resultObserved.promise;
						held.owner.onModuleDestroy();
						held.readResume.open();
						await expect(held.mutation).rejects.toBe(primary);
						await held.operation;
						expect(injected).toBe(true);
						expect(
							(await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: held.command.id }))
								.status,
						).toBe('cancelled');
					} finally {
						const index = held.source.subscribers.indexOf(subscriber);
						if (index >= 0) held.source.subscribers.splice(index, 1);
					}
				});
			},
			30_000,
		);
		it.each([
			'journal-same-value',
			'slot-same-value',
			'config-same-value',
			'claim-same-value',
			'graph',
			'missing-row',
			'foreign-fault',
		])(
			'R132 rejects genuine %s during the released seed gap without filtering full facts',
			async (effect) => {
				await withR132Held(async (held) => {
					await held.readEntered.promise;
					held.assertLive();
					const statements: Readonly<Record<string, readonly [string, readonly unknown[]]>> = {
						'journal-same-value': [
							'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = "status" WHERE "id" = ?',
							[held.command.id],
						],
						'slot-same-value': [
							'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" WHERE "controllerId" = ?',
							[held.id],
						],
						'config-same-value': [
							'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" WHERE "controllerId" = ?',
							[held.id],
						],
						'claim-same-value': [
							'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = "revision" WHERE "id" = ?',
							[held.command.claimId],
						],
						graph: ['UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1', []],
						'missing-row': [
							'DELETE FROM "devices_virtual_thermostat_command_journal" WHERE "id" = ?',
							[held.command.id],
						],
						'foreign-fault': [
							'UPDATE "devices_virtual_thermostat_command_journal" SET "fault" = ? WHERE "id" = ?',
							['foreign outcome', held.command.id],
						],
					};
					const [sql, bindings] = statements[effect];
					const foreign = held.source.manager.query(sql, [...bindings]);
					void foreign.catch(() => undefined);
					held.readResume.open();
					await foreign;
					held.nativeResume.open();
					await held.resultObserved.promise;
					held.owner.onModuleDestroy();
					await expect(held.mutation).rejects.toBeDefined();
					await held.operation;
					expect(held.real.controls.sends.filter((send) => send.on)).toEqual([]);
				});
			},
			30_000,
		);
		it('R132 rejects actual same-runner replay of the identical original UPDATE despite identical final bytes', async () => {
			await withR132Held(async (held) => {
				await held.readEntered.promise;
				held.assertLive();
				let replayed = false;
				const subscriber: import('typeorm').EntitySubscriberInterface = {
					beforeQuery: async (event) => {
						if (
							!replayed &&
							event.query.startsWith('UPDATE "devices_virtual_thermostat_command_journal"') &&
							event.parameters?.includes(held.command.id) &&
							event.parameters.includes('cancelled')
						) {
							replayed = true;
							await event.queryRunner.query(event.query, event.parameters);
						}
					},
				};
				held.source.subscribers.push(subscriber);
				try {
					held.nativeResume.open();
					await held.resultObserved.promise;
					held.owner.onModuleDestroy();
					held.readResume.open();
					await expect(held.mutation).rejects.toBeDefined();
					await held.operation;
					expect(replayed).toBe(true);
					expect(
						(await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: held.command.id })).status,
					).toBe('cancelled');
				} finally {
					const index = held.source.subscribers.indexOf(subscriber);
					if (index >= 0) held.source.subscribers.splice(index, 1);
				}
			});
		}, 30_000);
		it.each(['fresh-instance', 'same-instance'])(
			'R132 cannot use A history as %s B admission or wait on B while native A is held',
			async (restart) => {
				await withR132Held(
					async (held) => {
						await held.readEntered.promise;
						held.assertLive();
						held.owner.onModuleDestroy();
						held.readResume.open();
						held.assertLive();
						const b = restart === 'same-instance' ? held.owner : makeActualRuntime();
						if (restart === 'fresh-instance') {
							// Permanent FIRST isolation: accepted native receipt or known unsent, never A/later-work authority.
							const caseOwner = currentFixtureCase,
								setup = caseOwner?.setup;
							if (!caseOwner || !setup || caseOwner.retired || setup.retired || caseOwner.setup !== setup)
								throw new Error('Original fresh B case/setup unavailable');
							type Evaluation = (typeof b)['evaluate'];
							type Context = Parameters<(typeof b)['reconcile']>[0];
							type Completion = NonNullable<ReturnType<(typeof b)['evaluationCompletions']['get']>>;
							type Child = Parameters<(typeof b)['serviceFeedback']>[0];
							type Job = NonNullable<ReturnType<(typeof b)['offJobs']['get']>>;
							type Outcome = { fulfilled: true } | { fulfilled: false; cause: unknown };
							type Frame = {
								readonly lifecycle: object;
								ordinal: number;
								origin: 'QUEUE' | 'FEEDBACK';
								owned: boolean;
								pending?: Promise<void>;
								outcome?: Outcome;
								context?: Context;
								completion?: Completion;
							};
							type OnRecord = NonNullable<ReturnType<(typeof b)['originalCommandCompletions']['get']>>;
							type Work = {
								kind: 'FIRST_OFF' | 'OFF_O' | 'ON_O' | 'CHILD_WAITING' | 'FALLBACK_RESERVED' | 'FALLBACK_WAITING';
								readonly context: Context;
								readonly evaluation: Completion;
								readonly episode: Completion['episode'];
								readonly command?: VirtualThermostatCommandEntity;
								readonly job?: Job;
								readonly on?: OnRecord;
								operation?: Promise<void>;
								operationOwner?: Work;
								operationObserved?: boolean;
								outcome?: Outcome;
								failureInspected?: boolean;
								child?: Child;
								work?: Child['work'];
								queue?: Promise<void>;
								issued: boolean;
								consumed: boolean;
								queueCovered: boolean;
							};
							type Service = {
								readonly child: Child;
								readonly record: Work;
								readonly authenticated: boolean;
								readonly retired: boolean;
								pending?: Promise<void>;
								outcome?: Outcome;
							};
							type Off = Work & {
								readonly job: Job;
								readonly claim: Context['claims'][number];
								readonly operation: Promise<void>;
								readonly admission: Context['admission'];
								readonly admissionCurrent: Context['admission']['isCurrent'];
								readonly publishGuard: Context['publishGuard'];
								readonly intent: Context['intent'];
								readonly intentCurrent: NonNullable<Context['intent']>['isCurrent'] | undefined;
								readonly claims: Context['claims'];
								child?: Child;
								work?: Child['work'];
								outcome?: Outcome;
								terminal?: Readonly<{
									result: Job['result'];
									failure: Job['failure'];
									outputSaved: boolean;
									terminal: boolean;
									sampleSeen: boolean;
									state: Child['state'] | undefined;
								}>;
							};
							type Endpoint = {
								readonly context: Context;
								readonly completion: Completion;
								readonly ordinal: number;
								readonly admission: Context['admission'];
								readonly admissionCurrent: Context['admission']['isCurrent'];
								readonly publishGuard: Context['publishGuard'];
								readonly intent: Context['intent'];
								readonly claims: Context['claims'];
							};
							type Publication = {
								readonly frame: Frame;
								readonly context: Context;
								readonly predecessor: Context | undefined;
								setReturned: boolean;
								completion?: Completion;
							};
							type Creation = Work;
							const publicMethods: Readonly<{
								request: OriginalFunction<typeof b, (typeof b)['request']>;
								onApplicationBootstrap: OriginalFunction<typeof b, (typeof b)['onApplicationBootstrap']>;
								onModuleDestroy: OriginalFunction<typeof b, (typeof b)['onModuleDestroy']>;
							}> = b;
							const originalRequest = publicMethods.request,
								originalBootstrap = publicMethods.onApplicationBootstrap,
								originalDestroy = publicMethods.onModuleDestroy;
							const originalEvaluate: OriginalFunction<typeof b, Evaluation> = b['evaluate'];
							const originalService: OriginalFunction<typeof b, (typeof b)['serviceFeedback']> = b['serviceFeedback'];
							const originalFeedback: OriginalFunction<typeof b, (typeof b)['requestFeedback']> = b['requestFeedback'];
							const contexts = b['contexts'],
								completions = b['evaluationCompletions'],
								inFlight = b['inFlight'],
								children = b['feedbackChildren'],
								queues = b['queues'];
							const contextMethods: OriginalFunctions<typeof contexts> = contexts;
							const completionMethods: OriginalFunctions<typeof completions> = completions;
							const flightMethods: OriginalFunctions<typeof inFlight> = inFlight;
							const childMethods: OriginalFunctions<typeof children> = children;
							const originalContextSet = contextMethods.set,
								originalContextDelete = contextMethods.delete,
								originalContextClear = contextMethods.clear,
								originalCompletionSet = completionMethods.set,
								originalFlightSet = flightMethods.set,
								originalChildSet = childMethods.set;
							// Thirteen fixed mutable/owner slots; no per-evaluation or child history collection.
							const owner = Object.freeze({ runtime: b, caseOwner, setup, controllerId: held.id, source: held.source });
							const first: { evaluation?: Frame } = {};
							const release: { value?: Off } = {};
							const firstService: { ready: ReturnType<typeof barrier>; value?: Service } = { ready: barrier() };
							const activeEvaluation: { value?: Frame } = {};
							const activeService: { value?: Service } = {};
							const endpoint: { value?: Endpoint } = {};
							const publication: { value?: Publication } = {};
							const creation: { value?: Creation } = {};
							const state: {
								closed: boolean;
								retired: boolean;
								invalid: boolean;
								fault: boolean;
								foreign: boolean;
								credits: number;
								omitted: number;
								evaluations: number;
								transitions: number;
								sFulfilled: boolean;
								sawTarget: boolean;
								retirementComplete: boolean;
								ownedFenceWork: number;
								ownedOnWork: number;
								starting?: Promise<void>;
								lifecycle?: object;
								bootstrap?: (typeof b)['bootstrapAttempt'];
							} = {
								closed: false,
								retired: false,
								invalid: false,
								fault: false,
								foreign: false,
								credits: 0,
								omitted: 0,
								evaluations: 0,
								transitions: 0,
								sFulfilled: false,
								sawTarget: false,
								retirementComplete: false,
								ownedFenceWork: 0,
								ownedOnWork: 0,
							};
							const errors: { application?: { cause: unknown }; body?: { cause: unknown } } = {};
							const cleanupFailure: { value?: { cause: unknown } } = {};
							const cleanupCompletion: {
								value?: Promise<void>;
								resolve: () => void;
								reject: (cause: unknown) => void;
								issued: Set<Promise<void>>;
								jobs: Job[];
								onRecords: OnRecord[];
								joining: boolean;
							} = {
								resolve: () => undefined,
								reject: () => undefined,
								issued: new Set(),
								jobs: [],
								onRecords: [],
								joining: false,
							};
							const observe = (action: () => void): void => {
								try {
									const lifecycleField = Object.getOwnPropertyDescriptor(b, 'lifecycle');
									const lifecycle: unknown = lifecycleField?.value;
									if (lifecycleField?.get !== undefined || lifecycleField?.set !== undefined) state.invalid = true;
									if (state.lifecycle !== undefined && lifecycle !== undefined && lifecycle !== state.lifecycle)
										state.foreign = state.invalid = true;
									action();
								} catch {
									state.fault = true;
								}
							};
							const originalFailure = (cause: unknown): void => {
								errors.application ??= { cause };
							};
							const sameDescriptor = (a: PropertyDescriptor | undefined, c: PropertyDescriptor): boolean =>
								a !== undefined &&
								a.value === c.value &&
								a.get === c.get &&
								a.set === c.set &&
								a.configurable === c.configurable &&
								a.enumerable === c.enumerable &&
								a.writable === c.writable;
							const live = (): boolean =>
								!state.closed &&
								!caseOwner.retired &&
								!setup.retired &&
								currentFixtureCase === caseOwner &&
								caseOwner.setup === setup &&
								b['active'] &&
								state.lifecycle !== undefined &&
								b['lifecycle'] === state.lifecycle &&
								b['contexts'] === contexts &&
								b['evaluationCompletions'] === completions &&
								b['inFlight'] === inFlight &&
								b['feedbackChildren'] === children &&
								b['queues'] === queues &&
								pinsCurrent();
							const increment = (value: number): number => {
								if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
									state.invalid = true;
									return value;
								}
								return value + 1;
							};
							const certify = (): void => {
								if (state.closed || state.invalid || state.fault || publication.value === undefined) return;
								const pair = publication.value,
									completion = pair.completion;
								// This runs AFTER the original 4096/4107/4108 synchronous continuation, not in completion-set entry.
								if (
									!live() ||
									!pair.setReturned ||
									completion === undefined ||
									activeEvaluation.value !== pair.frame ||
									pair.predecessor !== endpoint.value?.context ||
									pair.frame.context !== pair.context ||
									pair.frame.completion !== completion ||
									completions.get(pair.context) !== completion ||
									contexts.get(held.id) !== pair.context ||
									b['contextLifecycles'].get(pair.context) !== state.lifecycle ||
									b['feedbackEpisodes'].get(held.id) !== completion.episode ||
									b['feedbackContexts'].get(pair.context) !== completion.episode ||
									completion.context !== pair.context ||
									completion.lifecycle !== state.lifecycle ||
									completion.episode.context !== pair.context ||
									completion.episode.retired
								) {
									state.invalid = true;
									return;
								}
								const admissionView: Readonly<{
									isCurrent: OriginalFunction<Context['admission'], Context['admission']['isCurrent']>;
								}> = pair.context.admission;
								state.transitions = increment(state.transitions);
								endpoint.value = {
									context: pair.context,
									completion,
									ordinal: state.transitions,
									admission: pair.context.admission,
									admissionCurrent: admissionView.isCurrent,
									publishGuard: pair.context.publishGuard,
									intent: pair.context.intent,
									claims: pair.context.claims,
								};
								publication.value = undefined;
							};
							const terminal = (): void => {
								const off = release.value;
								if (off === undefined) return;
								if (off.job.failure !== undefined) originalFailure(off.job.failure.cause);
								if (off.terminal !== undefined) return;
								if (!off.job.terminal) {
									state.invalid = true;
									return;
								}
								off.terminal = Object.freeze({
									result: off.job.result,
									failure: off.job.failure,
									outputSaved: off.job.outputSaved,
									terminal: off.job.terminal,
									sampleSeen: off.child?.sampleSeen === true,
									state: off.child?.state,
								});
							};
							const inspectWork = (record: Work): boolean => {
								if (record.job?.failure !== undefined) originalFailure(record.job.failure.cause);
								if (record.on?.failure !== undefined) originalFailure(record.on.failure.cause);
								if (
									(record.job !== undefined &&
										(record.job.context !== record.context ||
											record.job.evaluation !== record.evaluation ||
											record.job.command !== record.command ||
											record.job.operation !== record.operation)) ||
									(record.on !== undefined &&
										(record.on.context !== record.context ||
											record.on.command !== record.command ||
											record.on.lifecycle !== state.lifecycle ||
											record.on.operation !== record.operation ||
											record.on.invalid))
								) {
									state.invalid = true;
									return false;
								}
								const outcome = record.operationOwner?.outcome ?? record.outcome;
								if (record.operation !== undefined) {
									if (record.operationOwner !== undefined && record.operationOwner.operation !== record.operation) {
										state.invalid = true;
										return false;
									}
									if (
										outcome === undefined ||
										(record.job !== undefined && !record.job.terminal) ||
										(record.on !== undefined && record.on.phase !== 'TERMINAL')
									)
										return false;
								} else if (record.job !== undefined || record.on !== undefined) return false;
								record.failureInspected = true;
								return true;
							};
							const finishActiveService = (queuedSuccessor: boolean): void => {
								const service = activeService.value;
								if (service === undefined || service.outcome === undefined) return;
								if (queuedSuccessor) service.record.queueCovered = true;
								if (service.record.queueCovered && inspectWork(service.record)) activeService.value = undefined;
							};
							const observeOperation = (record: Work): void => {
								const pending = record.operation;
								if (pending === undefined || record.operationObserved || record.operationOwner !== undefined) return;
								record.operationObserved = true;
								void pending.then(
									() =>
										observe(() => {
											record.outcome = { fulfilled: true };
											inspectWork(record);
											if (release.value === record) terminal();
											finishActiveService(false);
										}),
									(cause: unknown) => {
										originalFailure(cause);
										observe(() => {
											record.outcome = { fulfilled: false, cause };
											inspectWork(record);
											if (release.value === record) terminal();
											finishActiveService(false);
										});
									},
								);
							};
							const retireUnissued = (): void => {
								const record = creation.value;
								if (record === undefined || record.issued) return;
								if (record.child !== undefined) {
									if (!record.child.episode.retired || record.child.queued) return;
								} else if (record.operation === undefined) return;
								if (inspectWork(record)) creation.value = undefined;
							};
							const evaluating = function (
								this: VirtualThermostatRuntimeService,
								...args: Parameters<Evaluation>
							): ReturnType<Evaluation> {
								const originalEpoch =
									this === b && args[0] === held.id && state.lifecycle !== undefined && args[1] === state.lifecycle;
								const firstOpportunity = originalEpoch && !state.closed && !state.sawTarget;
								if (originalEpoch && !state.closed) state.sawTarget = true; // Consume the FIRST opportunity even if metadata is invalid.
								let frame: Frame | undefined = firstOpportunity
									? { lifecycle: args[1], ordinal: 0, origin: 'QUEUE', owned: false }
									: undefined;
								if (frame !== undefined) first.evaluation = frame;
								observe(() => {
									if (state.closed) return;
									certify();
									if (
										state.invalid ||
										state.fault ||
										this !== b ||
										args[0] !== held.id ||
										!live() ||
										args[1] !== state.lifecycle ||
										activeEvaluation.value !== undefined ||
										publication.value !== undefined
									) {
										state.invalid = true;
										return;
									}
									const queued = args.length === 2;
									if (queued && state.credits > 0) finishActiveService(true);
									const service = activeService.value;
									if (
										queued
											? state.credits === 0
											: service === undefined ||
												service.outcome !== undefined ||
												!service.authenticated ||
												service.retired ||
												firstOpportunity ||
												(args.length !== 3 && args.length !== 4) ||
												(args[2] !== undefined && args[2] !== service.child.episode) ||
												(args.length === 4 && (args[3] !== true || args[2] !== service.child.episode))
									) {
										state.invalid = true;
										return;
									}
									if (queued) state.credits--;
									state.evaluations = increment(state.evaluations);
									if (frame === undefined)
										frame = {
											lifecycle: args[1],
											ordinal: state.evaluations,
											origin: queued ? 'QUEUE' : 'FEEDBACK',
											owned: true,
										};
									else {
										frame.ordinal = state.evaluations;
										frame.owned = true;
									}
									activeEvaluation.value = frame;
								});
								let pending: ReturnType<Evaluation>;
								try {
									pending = originalEvaluate.call(this, ...args);
								} catch (cause) {
									if (originalEpoch) originalFailure(cause);
									else cleanupFailure.value ??= { cause };
									observe(() => {
										if (frame !== undefined) frame.outcome = { fulfilled: false, cause };
									});
									throw cause;
								}
								if (frame !== undefined) {
									const captured = frame;
									observe(() => {
										captured.pending = pending;
										void pending.then(
											() => {
												observe(() => {
													if (!state.closed) certify();
													captured.outcome = { fulfilled: true };
													if (activeEvaluation.value === captured) activeEvaluation.value = undefined;
												});
											},
											(cause: unknown) => {
												originalFailure(cause);
												observe(() => {
													captured.outcome = { fulfilled: false, cause };
													if (activeEvaluation.value === captured) activeEvaluation.value = undefined;
												});
											},
										);
									});
								}
								return pending;
							};
							const requesting = function (
								this: VirtualThermostatRuntimeService,
								...args: Parameters<typeof originalRequest>
							): ReturnType<typeof originalRequest> {
								let before: Promise<void> | undefined;
								let eligible = false;
								observe(() => {
									if (state.closed) return;
									certify();
									eligible =
										this === b &&
										args[0] === held.id &&
										live() &&
										state.starting !== undefined &&
										(args.length === 1 ||
											(args.length === 2 && (args[1] === undefined || typeof args[1] === 'boolean')));
									if (!eligible) state.invalid = true;
									before = queues.get(args[0]);
								});
								let result: ReturnType<typeof originalRequest>;
								try {
									result = originalRequest.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
								observe(() => {
									if (!eligible || state.closed) return;
									if (queues.get(args[0]) === before) {
										state.invalid = true;
										return;
									}
									// Closed fixture: one bootstrap request before S; later original configuration/poll requests are scoped B work.
									if (args[1] === undefined && !state.sFulfilled) {
										state.omitted = increment(state.omitted);
										if (state.omitted !== 1) state.invalid = true;
									}
									state.credits = increment(state.credits);
								});
								return result;
							};
							const settingContext = function (
								this: typeof contexts,
								...args: Parameters<typeof originalContextSet>
							): ReturnType<typeof originalContextSet> {
								let pair: Publication | undefined;
								observe(() => {
									if (state.closed) return;
									certify();
									const frame = activeEvaluation.value;
									if (
										this !== contexts ||
										!live() ||
										args[0] !== held.id ||
										frame === undefined ||
										publication.value !== undefined ||
										frame.context !== undefined ||
										contexts.get(held.id) !== endpoint.value?.context ||
										args[1].config.controllerId !== held.id ||
										b['contextLifecycles'].get(args[1]) !== state.lifecycle
									) {
										state.invalid = true;
										return;
									}
									pair = { frame, context: args[1], predecessor: endpoint.value?.context, setReturned: false };
									publication.value = pair;
								});
								let result: ReturnType<typeof originalContextSet>;
								try {
									result = originalContextSet.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
								observe(() => {
									if (pair !== undefined) pair.setReturned = true;
								});
								return result;
							};
							const deletingContext = function (
								this: typeof contexts,
								...args: Parameters<typeof originalContextDelete>
							): ReturnType<typeof originalContextDelete> {
								observe(() => {
									if (!state.closed) state.invalid = true;
								});
								try {
									return originalContextDelete.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
							};
							const clearingContexts = function (
								this: typeof contexts,
								...args: Parameters<typeof originalContextClear>
							): ReturnType<typeof originalContextClear> {
								observe(() => {
									if (!state.closed) state.invalid = true;
								});
								try {
									return originalContextClear.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
							};
							const settingCompletion = function (
								this: typeof completions,
								...args: Parameters<typeof originalCompletionSet>
							): ReturnType<typeof originalCompletionSet> {
								// feedbackContexts(newContext) does NOT exist yet at this source point.
								let pair: Publication | undefined;
								observe(() => {
									if (state.closed) return;
									const candidate = publication.value,
										completion = args[1];
									if (
										this !== completions ||
										!live() ||
										candidate === undefined ||
										!candidate.setReturned ||
										activeEvaluation.value !== candidate.frame ||
										!candidate.frame.owned ||
										candidate.completion !== undefined ||
										args[0] !== candidate.context ||
										completion.context !== candidate.context ||
										completion.lifecycle !== state.lifecycle ||
										completion.episode.lifecycle !== state.lifecycle ||
										completion.episode.controllerId !== held.id ||
										completion.status !== 'OPEN' ||
										typeof completion.identity !== 'object' ||
										completion.identity === null ||
										completion.identity === endpoint.value?.completion.identity ||
										completion.episode.retired ||
										b['feedbackEpisodes'].get(held.id) !== completion.episode ||
										b['contextLifecycles'].get(candidate.context) !== state.lifecycle
									) {
										state.invalid = true;
										return;
									}
									pair = candidate;
								});
								let result: ReturnType<typeof originalCompletionSet>;
								try {
									result = originalCompletionSet.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
								observe(() => {
									if (pair === undefined || state.closed) return;
									pair.completion = args[1];
									pair.frame.context = args[0];
									pair.frame.completion = args[1];
									// Keep ONE pending pair until the original feedbackContexts.set continuation has run.
								});
								return result;
							};
							const settingFlight = function (
								this: typeof inFlight,
								...args: Parameters<typeof originalFlightSet>
							): ReturnType<typeof originalFlightSet> {
								let result: ReturnType<typeof originalFlightSet>;
								try {
									result = originalFlightSet.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
								observe(() => {
									if (state.closed) return;
									certify();
									const frame = activeEvaluation.value,
										command = b['inFlightCommands'].get(args[0]);
									if (
										state.invalid ||
										state.fault ||
										this !== inFlight ||
										!live() ||
										command === undefined ||
										frame === undefined ||
										!frame.owned ||
										frame.context === undefined ||
										frame.completion === undefined ||
										command.controllerId !== held.id ||
										command === held.command ||
										command.id === held.command.id ||
										args[1] === held.operation ||
										frame.lifecycle !== state.lifecycle
									) {
										state.invalid = true;
										return;
									}
									const context = frame.context,
										claim = context.claims[0],
										job = b['offJobs'].get(command);
									if (
										context.claims.length !== 1 ||
										claim === undefined ||
										claim.role !== 'heating' ||
										command.claimId !== claim.id ||
										command.claimRevision !== claim.revision
									) {
										state.invalid = true;
										return;
									}
									if (command.action === 'off') {
										if (
											job === undefined ||
											job.context !== context ||
											job.command !== command ||
											job.evaluation !== frame.completion ||
											job.operation !== args[1]
										) {
											state.invalid = true;
											return;
										}
										if (frame === first.evaluation && release.value === undefined) {
											if (claim.id !== held.command.claimId || claim.revision !== held.command.claimRevision) {
												state.invalid = true;
												return;
											}
											const admissionView: Readonly<{
												isCurrent: OriginalFunction<Context['admission'], Context['admission']['isCurrent']>;
											}> = context.admission;
											const intentView:
												| Readonly<{
														isCurrent: OriginalFunction<
															NonNullable<Context['intent']>,
															NonNullable<Context['intent']>['isCurrent']
														>;
												  }>
												| undefined = context.intent;
											const off: Off = {
												kind: 'FIRST_OFF',
												context,
												evaluation: frame.completion,
												episode: frame.completion.episode,
												command,
												job,
												claim,
												operation: args[1],
												issued: false,
												consumed: false,
												queueCovered: false,
												admission: context.admission,
												admissionCurrent: admissionView.isCurrent,
												publishGuard: context.publishGuard,
												intent: context.intent,
												intentCurrent: intentView?.isCurrent,
												claims: context.claims,
											};
											release.value = off;
											const pending = creation.value;
											if (pending?.job === job) {
												pending.operation = args[1];
												pending.operationOwner = off;
											}
											observeOperation(off);
											return;
										}
										if (release.value?.job === job) {
											state.invalid = true;
											return;
										}
										retireUnissued();
										let record = creation.value;
										if (record !== undefined && record.job !== job) {
											state.invalid = true;
											return;
										}
										if (record === undefined) {
											record = {
												kind: 'OFF_O',
												context,
												evaluation: frame.completion,
												episode: frame.completion.episode,
												command,
												job,
												issued: false,
												consumed: false,
												queueCovered: false,
											};
											creation.value = record;
										}
										if (record.operation !== undefined && record.operation !== args[1]) {
											state.invalid = true;
											return;
										}
										record.operation = args[1];
										observeOperation(record);
									} else if (command.action === 'on') {
										const on = b['originalCommandCompletions'].get(command);
										if (
											on === undefined ||
											on.command !== command ||
											on.context !== context ||
											on.lifecycle !== state.lifecycle ||
											on.operation !== args[1] ||
											on.invalid
										) {
											state.invalid = true;
											return;
										}
										retireUnissued();
										if (creation.value !== undefined) {
											state.invalid = true;
											return;
										}
										const record: Work = {
											kind: 'ON_O',
											context,
											evaluation: frame.completion,
											episode: frame.completion.episode,
											command,
											on,
											operation: args[1],
											issued: false,
											consumed: false,
											queueCovered: false,
										};
										creation.value = record;
										state.ownedOnWork = increment(state.ownedOnWork);
										observeOperation(record);
									} else state.invalid = true;
								});
								return result;
							};
							const settingChild = function (
								this: typeof children,
								...args: Parameters<typeof originalChildSet>
							): ReturnType<typeof originalChildSet> {
								let result: ReturnType<typeof originalChildSet>;
								try {
									result = originalChildSet.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									throw cause;
								}
								observe(() => {
									if (state.closed) return;
									certify();
									const child = args[1],
										off = release.value;
									if (
										this !== children ||
										!live() ||
										child.work === undefined ||
										child.work !== args[0] ||
										child.purpose === 'OFF_COMMAND_COMPLETION' ||
										child.episode.controllerId !== held.id ||
										child.episode.lifecycle !== state.lifecycle ||
										child.episode.retired ||
										b['contextLifecycles'].get(child.context) !== state.lifecycle ||
										completions.get(child.context) !== child.evaluation ||
										child.evaluation.context !== child.context ||
										child.evaluation.episode !== child.episode ||
										b['feedbackContexts'].get(child.context) !== child.episode
									) {
										state.invalid = true;
										return;
									}
									if (off !== undefined && child.job === off.job) {
										if (
											off.child !== undefined ||
											child.purpose !== 'GUARDED_OFF_DISPATCH' ||
											child.context !== off.context ||
											child.evaluation !== off.evaluation ||
											off.job.child !== child
										) {
											state.invalid = true;
											return;
										}
										off.child = child;
										off.work = args[0];
									} else {
										retireUnissued();
										let record = creation.value;
										if (
											record !== undefined &&
											(record.job === undefined || record.job !== child.job || record.child !== undefined)
										) {
											state.invalid = true;
											return;
										}
										if (record === undefined) {
											const frame = activeEvaluation.value;
											if (
												child.job !== undefined ||
												frame?.owned !== true ||
												frame.context !== child.context ||
												frame.completion !== child.evaluation
											) {
												state.invalid = true;
												return;
											}
											record = {
												kind: 'CHILD_WAITING',
												context: child.context,
												evaluation: child.evaluation,
												episode: child.episode,
												issued: false,
												consumed: false,
												queueCovered: false,
											};
											creation.value = record;
										}
										record.child = child;
										record.work = args[0];
										record.kind = 'CHILD_WAITING';
									}
									state.ownedFenceWork = increment(state.ownedFenceWork);
								});
								return result;
							};
							const requestingFeedback = function (
								this: VirtualThermostatRuntimeService,
								...args: Parameters<typeof originalFeedback>
							): ReturnType<typeof originalFeedback> {
								let record: Work | undefined;
								let before: Promise<void> | undefined;
								let queuedBefore: boolean | undefined;
								let noOp = false;
								let originalEpoch = false;
								observe(() => {
									const child = args[0];
									originalEpoch =
										this === b && state.lifecycle !== undefined && child.episode.lifecycle === state.lifecycle;
									if (state.closed) return;
									certify();
									if (
										this !== b ||
										!live() ||
										child.episode.controllerId !== held.id ||
										child.episode.lifecycle !== state.lifecycle
									) {
										state.invalid = true;
										return;
									}
									before = queues.get(held.id);
									queuedBefore = child.queued;
									if (child.queued || child.episode.retired) {
										noOp = true;
										return;
									}
									if (child.purpose === 'OFF_COMMAND_COMPLETION') {
										if (
											child.work !== undefined ||
											child.job !== undefined ||
											child.state !== 'FAILED' ||
											child.evaluation.context !== child.context ||
											child.evaluation.episode !== child.episode ||
											b['contextLifecycles'].get(child.context) !== state.lifecycle ||
											completions.get(child.context) !== child.evaluation
										) {
											state.invalid = true;
											return;
										}
										let job: Job | undefined;
										for (const command of b['inFlightCommands'].values()) {
											if (command.action !== 'off' || command.controllerId !== held.id) continue;
											const candidate = b['offJobs'].get(command);
											if (
												candidate === undefined ||
												candidate.context !== child.context ||
												candidate.evaluation !== child.evaluation
											)
												continue;
											if (
												job !== undefined ||
												candidate.command !== command ||
												candidate.child !== undefined ||
												child.context.claims.length !== 1 ||
												child.context.claims[0]?.role !== 'heating' ||
												command === held.command ||
												command.id === held.command.id ||
												command.claimId !== child.context.claims[0]?.id ||
												command.claimRevision !== child.context.claims[0]?.revision
											) {
												state.invalid = true;
												return;
											}
											job = candidate;
										}
										if (job === undefined) {
											state.invalid = true;
											return;
										}
										retireUnissued();
										record = creation.value;
										if (record !== undefined && (record.job !== job || record.child !== undefined)) {
											state.invalid = true;
											return;
										}
										if (record === undefined) {
											record = {
												kind: 'FALLBACK_RESERVED',
												context: child.context,
												evaluation: child.evaluation,
												episode: child.episode,
												command: job.command,
												job,
												operation: job.operation,
												issued: false,
												consumed: false,
												queueCovered: false,
											};
											const off = release.value;
											if (off?.job === job) record.operationOwner = off;
											creation.value = record;
										}
										record.child = child;
										record.kind = 'FALLBACK_RESERVED';
									} else {
										record =
											release.value?.child === child
												? release.value
												: creation.value?.child === child
													? creation.value
													: undefined;
										if (record === undefined || record.work !== child.work) {
											state.invalid = true;
											return;
										}
									}
									if (record.issued || record.consumed) state.invalid = true;
								});
								let result: ReturnType<typeof originalFeedback>;
								try {
									result = originalFeedback.call(this, ...args);
								} catch (cause) {
									if (originalEpoch) originalFailure(cause);
									else cleanupFailure.value ??= { cause };
									observe(() => {
										if (record !== undefined && args[0] === record.child) {
											const after = queues.get(held.id);
											if (after !== before) record.queue = after;
										}
										state.invalid = true; // A partial throw cannot mint a positive issuance token.
									});
									throw cause;
								}
								observe(() => {
									if (state.closed || this !== b) return;
									const child = args[0],
										after = queues.get(held.id);
									if (noOp) {
										if (after !== before || child.queued !== queuedBefore) state.invalid = true;
										return; // Already queued cannot rearm or overwrite an exact earlier obligation.
									}
									if (
										record === undefined ||
										record.child !== child ||
										queuedBefore !== false ||
										child.queued !== true ||
										after === undefined ||
										after === before ||
										!live() ||
										record.issued ||
										record.consumed ||
										child.context !== record.context ||
										child.evaluation !== record.evaluation ||
										child.episode !== record.episode
									) {
										state.invalid = true;
										return;
									}
									record.queue = after;
									record.issued = true;
									if (child.purpose === 'OFF_COMMAND_COMPLETION') record.kind = 'FALLBACK_WAITING';
								});
								return result;
							};
							const servicing = function (
								this: VirtualThermostatRuntimeService,
								...args: Parameters<typeof originalService>
							): ReturnType<typeof originalService> {
								let frame: Service | undefined;
								observe(() => {
									const child = args[0];
									const record =
										release.value?.child === child
											? release.value
											: creation.value?.child === child
												? creation.value
												: undefined;
									if (
										record === undefined ||
										record.consumed ||
										!record.issued ||
										record.queue === undefined ||
										this !== b ||
										child.context !== record.context ||
										child.evaluation !== record.evaluation ||
										child.episode !== record.episode ||
										child.queued !== true ||
										child.evaluation.status !== 'COMPLETE' ||
										child.evaluation.context !== child.context ||
										b['contextLifecycles'].get(child.context) !== state.lifecycle ||
										completions.get(child.context) !== child.evaluation ||
										b['feedbackContexts'].get(child.context) !== record.episode ||
										child.evaluation.episode !== child.episode ||
										child.episode.controllerId !== held.id ||
										child.episode.lifecycle !== state.lifecycle ||
										(record.job !== undefined &&
											(record.operation === undefined || record.job.operation !== record.operation))
									) {
										state.invalid = true;
										return;
									}
									if (state.closed) {
										if (
											!state.retired ||
											state.foreign ||
											!pinsCurrent() ||
											(b['lifecycle'] !== undefined && b['lifecycle'] !== state.lifecycle)
										) {
											state.invalid = true;
											return;
										}
									} else {
										if (!live()) {
											state.invalid = true;
											return;
										}
									}
									finishActiveService(true); // Exact issued queued entry, including retired cleanup, certifies predecessor Q.
									if (activeService.value !== undefined) {
										state.invalid = true;
										return;
									}
									const current =
										!state.closed &&
										contexts.get(held.id) === child.context &&
										b['contextLifecycles'].get(child.context) === state.lifecycle &&
										completions.get(child.context) === child.evaluation &&
										b['feedbackEpisodes'].get(held.id) === child.episode &&
										b['feedbackContexts'].get(child.context) === child.episode &&
										!child.episode.retired;
									const retired =
										state.closed ||
										(endpoint.value !== undefined &&
											endpoint.value.context !== child.context &&
											endpoint.value.completion.lifecycle === state.lifecycle &&
											contexts.get(held.id) === endpoint.value.context &&
											child.episode.retired);
									if (!current && !retired) {
										state.invalid = true;
										return;
									}
									if (child.purpose === 'GUARDED_OFF_DISPATCH') {
										if (child.work !== record.work || child.job !== record.job || record.job?.child !== child) {
											state.invalid = true;
											return;
										}
									} else if (child.purpose === 'OFF_COMMAND_COMPLETION') {
										if (
											record.kind !== 'FALLBACK_WAITING' ||
											child.work !== undefined ||
											child.job !== undefined ||
											record.job === undefined ||
											record.job.child !== undefined
										) {
											state.invalid = true;
											return;
										}
									} else if (child.purpose !== 'RECONCILIATION_OFF' || child.work !== record.work) {
										state.invalid = true;
										return;
									}
									record.consumed = true;
									frame = { child, record, authenticated: current, retired };
									activeService.value = frame; // Transfer complete F/Q/job/O/P BEFORE freeing the rolling cell.
									if (creation.value === record) creation.value = undefined;
									if (release.value === record) {
										if (firstService.value !== undefined) state.invalid = true;
										else {
											firstService.value = frame;
											firstService.ready.open();
										}
									}
									if (child.episode.failure.primary !== undefined) originalFailure(child.episode.failure.primary.cause);
								});
								let pending: ReturnType<typeof originalService>;
								try {
									pending = originalService.call(this, ...args);
								} catch (cause) {
									originalFailure(cause);
									observe(() => {
										if (frame !== undefined) frame.outcome = { fulfilled: false, cause };
									});
									throw cause;
								}
								if (frame !== undefined) {
									const captured = frame;
									captured.pending = pending;
									void pending.then(
										() =>
											observe(() => {
												if (!state.closed) certify();
												captured.outcome = { fulfilled: true };
												if (captured.child.episode.failure.primary !== undefined)
													originalFailure(captured.child.episode.failure.primary.cause);
												inspectWork(captured.record);
												// Q is not done merely because L fulfilled; queued successor or retirement join owns Q closure.
											}),
										(cause: unknown) => {
											originalFailure(cause);
											observe(() => {
												captured.outcome = { fulfilled: false, cause };
												inspectWork(captured.record);
											});
										},
									);
								}
								return pending;
							};
							const shadows = [
								{ receiver: b, key: 'evaluate', original: originalEvaluate, value: evaluating },
								{ receiver: b, key: 'request', original: originalRequest, value: requesting },
								{ receiver: b, key: 'serviceFeedback', original: originalService, value: servicing },
								{ receiver: b, key: 'requestFeedback', original: originalFeedback, value: requestingFeedback },
								{ receiver: contexts, key: 'set', original: originalContextSet, value: settingContext },
								{ receiver: contexts, key: 'delete', original: originalContextDelete, value: deletingContext },
								{ receiver: contexts, key: 'clear', original: originalContextClear, value: clearingContexts },
								{ receiver: completions, key: 'set', original: originalCompletionSet, value: settingCompletion },
								{ receiver: inFlight, key: 'set', original: originalFlightSet, value: settingFlight },
								{ receiver: children, key: 'set', original: originalChildSet, value: settingChild },
							].map((entry) => ({
								...entry,
								before: Object.getOwnPropertyDescriptor(entry.receiver, entry.key),
								installed: {
									configurable: true,
									enumerable: Object.getOwnPropertyDescriptor(entry.receiver, entry.key)?.enumerable ?? false,
									writable: true,
									value: entry.value,
								},
								owned: false,
							}));
							const pinsCurrent = (): boolean =>
								shadows.every(
									(entry) =>
										entry.owned &&
										sameDescriptor(Object.getOwnPropertyDescriptor(entry.receiver, entry.key), entry.installed),
								);
							const requireEvidence = (condition: boolean, message: string): void => {
								if (errors.application !== undefined) throw errors.application.cause;
								if (!condition) throw new Error(message);
							};
							const attemptCleanup = (action: () => void): void => {
								try {
									action();
								} catch (cause) {
									cleanupFailure.value ??= { cause };
								}
							};
							const observer = {
								retire: (): void => {
									if (state.retired) return;
									if (cleanupCompletion.value === undefined) {
										cleanupCompletion.value = new Promise<void>((resolve, reject) => {
											cleanupCompletion.resolve = resolve;
											cleanupCompletion.reject = reject;
										}); // Publish before ANY original retirement call or reentry, including outer before-cleanup retirement.
									}
									state.closed = state.retired = true;
									attemptCleanup(() => {
										for (const pending of [
											state.starting,
											first.evaluation?.owned ? first.evaluation.pending : undefined,
											release.value?.operation,
											firstService.value?.pending,
											activeEvaluation.value?.pending,
											activeService.value?.pending,
											release.value?.queue,
											creation.value?.queue,
											creation.value?.operation,
											activeService.value?.record.queue,
											activeService.value?.record.operation,
										])
											if (pending !== undefined) cleanupCompletion.issued.add(pending);
										if (!state.foreign && state.lifecycle !== undefined && b['lifecycle'] === state.lifecycle) {
											for (const pending of b['queues'].values()) cleanupCompletion.issued.add(pending);
											for (const pending of inFlight.values()) cleanupCompletion.issued.add(pending);
											for (const command of b['inFlightCommands'].values()) {
												const job = b['offJobs'].get(command);
												if (job !== undefined) cleanupCompletion.jobs.push(job);
												const on = b['originalCommandCompletions'].get(command);
												if (on !== undefined) cleanupCompletion.onRecords.push(on);
											}
										}
									}); // Snapshot BEFORE original destroy clears queues; no growing invocation history.
									attemptCleanup(() => firstService.ready.open());
									attemptCleanup(() => {
										if (b['active'] || b['lifecycle'] !== undefined) {
											if (state.lifecycle === undefined || b['lifecycle'] !== state.lifecycle) {
												state.foreign = state.invalid = true;
												cleanupFailure.value ??= { cause: new Error('Foreign fresh B lifecycle retained') };
											} else originalDestroy.call(b);
										}
									});
									attemptCleanup(() => held.readResume.open());
									attemptCleanup(() => held.nativeResume.open());
									state.retirementComplete = true;
								},
								cleanup: (): Promise<void> => {
									observer.retire();
									const completion = cleanupCompletion.value;
									if (completion === undefined) throw new Error('Missing original B cleanup completion');
									if (!state.retirementComplete || cleanupCompletion.joining) return completion;
									cleanupCompletion.joining = true;
									void (async (): Promise<void> => {
										for (const pending of cleanupCompletion.issued) {
											try {
												await pending;
											} catch (cause) {
												originalFailure(cause);
											}
										}
										observe(() => {
											for (const job of cleanupCompletion.jobs)
												if (job.failure !== undefined) originalFailure(job.failure.cause);
											for (const on of cleanupCompletion.onRecords)
												if (on.failure !== undefined) originalFailure(on.failure.cause);
											for (const record of [
												release.value,
												creation.value,
												activeService.value?.record,
												firstService.value?.record,
											])
												if (record !== undefined) {
													if (!inspectWork(record)) state.invalid = true;
													if (record.issued && !record.consumed) state.invalid = true;
													record.queueCovered = true;
												}
										});
										for (const entry of [...shadows].reverse())
											attemptCleanup(() => {
												if (!entry.owned) return;
												if (
													state.foreign ||
													b['active'] ||
													b['lifecycle'] !== undefined ||
													b['runtimeSettlementConsumer'] !== undefined ||
													b['runtimeFeedbackConsumer'] !== undefined ||
													!sameDescriptor(Object.getOwnPropertyDescriptor(entry.receiver, entry.key), entry.installed)
												)
													throw new Error('Foreign or live fresh B descriptor retained');
												if (entry.before !== undefined) Object.defineProperty(entry.receiver, entry.key, entry.before);
												else if (!Reflect.deleteProperty(entry.receiver, entry.key))
													throw new Error('Owned B shadow removal failed');
												entry.owned = false;
											});
										attemptCleanup(() => unregisterCompletionObserver(observer));
										if (errors.application !== undefined) throw errors.application.cause;
										if (cleanupFailure.value !== undefined) throw cleanupFailure.value.cause;
										if (state.invalid || state.fault)
											throw new Error('Original B ownership/error obligation unavailable');
									})().then(cleanupCompletion.resolve, cleanupCompletion.reject);
									return completion;
								},
							};
							try {
								registerCompletionObserver(observer); // Exact original case/setup, BEFORE any shadow/bootstrap.
								if (
									owner.runtime !== b ||
									owner.source !== b['dataSource'] ||
									b['active'] ||
									b['lifecycle'] !== undefined ||
									b['claims'] !== actualClaims ||
									b['structure'] !== actualStructure ||
									b['comfort'] !== held.comfort ||
									originalEvaluate !== VirtualThermostatRuntimeService.prototype['evaluate'] ||
									originalService !== VirtualThermostatRuntimeService.prototype['serviceFeedback'] ||
									originalRequest !== VirtualThermostatRuntimeService.prototype.request ||
									originalFeedback !== VirtualThermostatRuntimeService.prototype['requestFeedback']
								)
									throw new Error('Original inactive B source/methods unavailable');
								for (const entry of shadows) {
									if (
										entry.before !== undefined &&
										(entry.before.get !== undefined ||
											entry.before.set !== undefined ||
											entry.before.value !== entry.original)
									)
										throw new Error('Original B DATA descriptor unavailable');
									Object.defineProperty(entry.receiver, entry.key, entry.installed);
									entry.owned = true;
								}
								const fences = held.real.controls.fences.length,
									sends = held.real.controls.sends.length;
								const originalFences = held.real.controls.fences,
									originalSends = held.real.controls.sends;
								state.starting = originalBootstrap.call(b);
								const bootstrap = b['bootstrapAttempt'];
								if (bootstrap === undefined || bootstrap.promise !== state.starting) state.invalid = true;
								else {
									state.bootstrap = bootstrap;
									state.lifecycle = bootstrap.lifecycle;
								}
								await state.starting;
								state.sFulfilled = true;
								expect(b['lifecycle']).toBeDefined();
								const firstFrame = first.evaluation;
								requireEvidence(firstFrame !== undefined && firstFrame.owned, 'Missing FIRST original B evaluation');
								if (firstFrame === undefined || !firstFrame.owned || firstFrame.pending === undefined)
									throw new Error('Missing original E Promise');
								await firstFrame.pending;
								observe(certify);
								const off = release.value;
								requireEvidence(off !== undefined, 'Missing FIRST B own OFF operation');
								if (off === undefined) throw new Error('Missing original B O');
								await off.operation;
								observe(terminal);
								if (errors.application !== undefined) throw errors.application.cause;
								const context = firstFrame.context,
									claim = context?.claims[0],
									observed = off.terminal;
								const baseEvidence =
									!state.closed &&
									!state.invalid &&
									!state.fault &&
									!state.foreign &&
									live() &&
									pinsCurrent() &&
									publication.value === undefined &&
									state.omitted === 1 &&
									state.sFulfilled &&
									state.bootstrap?.promise === state.starting &&
									b['timer'] !== undefined &&
									firstFrame.outcome?.fulfilled === true &&
									firstFrame.completion?.status === 'COMPLETE' &&
									context !== undefined &&
									context.claims.length === 1 &&
									claim === off.claim &&
									context.config.controllerId === held.id &&
									claim?.role === 'heating' &&
									off.outcome?.fulfilled === true &&
									observed !== undefined &&
									observed.failure === undefined &&
									observed.terminal;
								const counterEvidence =
									held.real.controls.fences === originalFences &&
									held.real.controls.sends === originalSends &&
									originalFences.length >= fences &&
									originalSends.length >= sends &&
									originalFences.every((property) => property === off.claim.sourcePropertyId) &&
									originalSends.every((send) => send.property === off.claim.sourcePropertyId && send.on === true) &&
									(originalFences.length === fences || state.ownedFenceWork > 0) &&
									(originalSends.length === sends || state.ownedOnWork > 0);
								const knownUnsent =
									baseEvidence &&
									counterEvidence &&
									observed !== undefined &&
									off.job.command.status === 'cancelled' &&
									off.job.result === undefined &&
									off.job.failure === undefined &&
									off.job.outputSaved === false &&
									off.job.terminal === true &&
									off.job.child === undefined &&
									off.child === undefined &&
									off.work === undefined &&
									observed.result === undefined &&
									observed.outputSaved === false;
								let firstOutcome: 'KNOWN_UNSENT_FIRST_OFF' | 'GENUINE_ACCEPTED_FIRST_OFF' | 'UNKNOWN' = knownUnsent
									? 'KNOWN_UNSENT_FIRST_OFF'
									: 'UNKNOWN';
								if (!knownUnsent) {
									requireEvidence(
										baseEvidence &&
											observed?.result === 'accepted' &&
											observed.outputSaved &&
											observed.sampleSeen &&
											observed.state === 'OFF_REPORTED' &&
											off.job.result === 'accepted' &&
											off.job.outputSaved &&
											off.job.failure === undefined &&
											off.child !== undefined &&
											off.work !== undefined &&
											off.job.child === off.child &&
											off.child.work === off.work &&
											off.child.purpose === 'GUARDED_OFF_DISPATCH',
										'Original FIRST B outcome unavailable',
									);
									await firstService.ready.promise;
									const feedback = firstService.value;
									requireEvidence(
										feedback !== undefined && feedback.pending !== undefined,
										'Missing matching original B L',
									);
									if (feedback === undefined || feedback.pending === undefined)
										throw new Error('Missing original L Promise');
									await feedback.pending;
									observe(certify);
									requireEvidence(
										feedback.authenticated &&
											!feedback.retired &&
											feedback.outcome?.fulfilled === true &&
											feedback.child === off.child &&
											off.consumed &&
											off.issued &&
											!state.invalid &&
											!state.fault &&
											counterEvidence,
										'Original first B release receipt unavailable',
									);
									expect(held.real.controls.fences.length).toBeGreaterThan(fences);
									firstOutcome = 'GENUINE_ACCEPTED_FIRST_OFF';
								}
								requireEvidence(
									firstOutcome !== 'UNKNOWN' && !state.invalid && !state.fault,
									'Original FIRST B isolation outcome unavailable',
								);
								expect(held.owner['inFlight'].get(held.command.id)).toBe(held.operation);
								const bContext = b['contexts'].get(held.id);
								const anchor = endpoint.value;
								requireEvidence(anchor !== undefined && bContext === anchor.context, 'Original B anchor unavailable');
								if (anchor === undefined) throw new Error('Missing authenticated B anchor');
								held.nativeResume.open();
								await held.resultObserved.promise;
								await held.operation;
								await expect(held.mutation).rejects.toBeDefined();
								observe(certify);
								const finalContext = b['contexts'].get(held.id),
									end = endpoint.value;
								const intentView:
									| Readonly<{
											isCurrent: OriginalFunction<
												NonNullable<Context['intent']>,
												NonNullable<Context['intent']>['isCurrent']
											>;
									  }>
									| undefined = context?.intent;
								const identitiesIntact =
									context !== undefined &&
									context.admission === off.admission &&
									context.admission.isCurrent === off.admissionCurrent &&
									context.publishGuard === off.publishGuard &&
									context.intent === off.intent &&
									intentView?.isCurrent === off.intentCurrent &&
									context.claims === off.claims &&
									off.job.context === context &&
									off.job.evaluation === firstFrame.completion &&
									off.job.command !== held.command &&
									off.job.operation === off.operation &&
									(firstOutcome === 'KNOWN_UNSENT_FIRST_OFF'
										? off.job.child === undefined && off.child === undefined && off.work === undefined
										: off.child?.work === off.work && off.child?.job === off.job);
								const valid =
									!state.closed &&
									!state.invalid &&
									!state.fault &&
									!state.foreign &&
									live() &&
									pinsCurrent() &&
									publication.value === undefined &&
									identitiesIntact &&
									anchor.context.admission === anchor.admission &&
									anchor.admission.isCurrent === anchor.admissionCurrent &&
									anchor.context.publishGuard === anchor.publishGuard &&
									anchor.context.intent === anchor.intent &&
									anchor.context.claims === anchor.claims &&
									end !== undefined &&
									finalContext === end.context &&
									end.completion.context === end.context &&
									end.completion.lifecycle === state.lifecycle &&
									b['contextLifecycles'].get(end.context) === state.lifecycle &&
									completions.get(end.context) === end.completion &&
									b['feedbackContexts'].get(end.context) === end.completion.episode;
								const ownership =
									!valid || end === undefined
										? 'UNKNOWN'
										: end.context === bContext && end.ordinal === anchor.ordinal
											? 'SAME_ANCHOR'
											: end.ordinal > anchor.ordinal
												? 'AUTHENTICATED_B_TRANSITIONS'
												: 'UNKNOWN';
								requireEvidence(true, 'Original B application failure'); // Preserve an observed original P before the ownership matcher.
								expect(['SAME_ANCHOR', 'AUTHENTICATED_B_TRANSITIONS']).toContain(ownership);
							} catch (cause) {
								errors.body = { cause };
							}
							try {
								await observer.cleanup();
							} catch (cause) {
								if (errors.body === undefined) errors.body = { cause };
							}
							if (errors.body !== undefined) throw errors.body.cause;
							return; // Fresh only. The entire original same-instance block below remains RAW.
						}
						try {
							const fences = held.real.controls.fences.length;
							await b.onApplicationBootstrap();
							expect(b['lifecycle']).toBeDefined();
							expect(held.real.controls.fences.length).toBeGreaterThan(fences);
							expect(held.owner['inFlight'].get(held.command.id)).toBe(held.operation);
							const bContext = b['contexts'].get(held.id);
							held.nativeResume.open();
							await held.resultObserved.promise;
							await held.operation;
							await expect(held.mutation).rejects.toBeDefined();
							expect(b['contexts'].get(held.id)).toBe(bContext);
						} finally {
							b.onModuleDestroy();
						}
					},
					undefined,
					'beforeOn',
					restart === 'fresh-instance',
				);
			},
			30_000,
		);
		it('R132 rejects an observed original transport method loss and cannot resurrect it by restoring the function', async () => {
			let old: PropertyDescriptor | undefined;
			await withR132Held(
				async (held) => {
					await expect(held.mutation).rejects.toBeDefined();
					if (!old) throw new Error('Missing original descriptor');
					Object.defineProperty(held.real.transport, 'get', old);
					held.owner.onModuleDestroy();
					held.nativeResume.open();
					await held.operation;
					expect(held.real.controls.sends.filter((send) => send.on)).toEqual([]);
				},
				(_owner, _id, real) => {
					old = Object.getOwnPropertyDescriptor(real.transport, 'get');
					Object.defineProperty(real.transport, 'get', { configurable: true, writable: true, value: () => null });
				},
			);
		}, 30_000);
		it('R132 rejects forged oversized or cloned capture identities with zero native/database calls', async () => {
			const real = fixture,
				owner = runtime,
				source = database;
			const queries = jest.spyOn(source, 'query');
			const forged = Object.freeze(
				new ClimateAutomationPredecessors(Object.freeze(Array.from({ length: 9 }, () => Object.freeze({})))),
			);
			await expect(owner['joinOriginalPredecessors'](forged)).rejects.toThrow('closed');
			expect(() => owner['originalPredecessorSize'](forged)).toThrow('closed');
			expect(queries).not.toHaveBeenCalled();
			expect(real.controls.sends.filter((send) => send.on)).toEqual([]);
		});
		it.each([undefined, null, false, 'seed read P', new Error('seed read P')])(
			'R132 releases a failed genuine seed without joining held N and retains primary %p through cleanup Q',
			async (primary: unknown) => {
				const source = database,
					real = fixture;
				let foreignHook: PropertyDescriptor | undefined, originalHook: PropertyDescriptor | undefined;
				try {
					await expect(
						withR132Held(async (held) => {
							await held.readEntered.promise;
							held.assertLive();
							const observer: import('typeorm').EntitySubscriberInterface = {
								beforeQuery: (event) => {
									if (event.query.startsWith('SELECT') && event.query.includes('devices_virtual_thermostat_configs'))
										throw primary;
								},
							};
							held.source.subscribers.push(observer);
							try {
								held.readResume.open();
								await expect(held.mutation).rejects.toBe(primary);
								expect(held.owner['inFlight'].get(held.command.id)).toBe(held.operation);
								expect(real.controls.sends.filter((send) => send.on)).toEqual([]);
								// Independent SQL completes while N is STILL held: no SQLite owner was retained by the failed seed.
								expect(await source.manager.countBy(VirtualThermostatCommandEntity, { id: held.command.id })).toBe(1);
								originalHook = Object.getOwnPropertyDescriptor(real.controls, 'beforeOn');
								if (!originalHook) throw new Error('Missing exact owned hook');
								Object.defineProperty(real.controls, 'beforeOn', {
									...originalHook,
									enumerable: !originalHook.enumerable,
								});
								foreignHook = Object.getOwnPropertyDescriptor(real.controls, 'beforeOn');
								throw primary; // Body P must survive the helper's real foreign-descriptor cleanup Q, including falsy P.
							} finally {
								const i = source.subscribers.indexOf(observer);
								if (i >= 0) source.subscribers.splice(i, 1);
							}
						}),
					).rejects.toBe(primary);
					expect(real.controls.beforeOn).toBe(foreignHook?.value);
					expect(real.controls.sends.filter((send) => send.on)).toEqual([]);
				} finally {
					const actual = Object.getOwnPropertyDescriptor(real.controls, 'beforeOn');
					if (
						originalHook &&
						foreignHook &&
						actual?.value === foreignHook.value &&
						actual?.enumerable === foreignHook.enumerable &&
						actual?.configurable === foreignHook.configurable &&
						actual?.writable === foreignHook.writable &&
						actual?.get === foreignHook.get &&
						actual?.set === foreignHook.set
					)
						Object.defineProperty(real.controls, 'beforeOn', originalHook);
				}
			},
			30_000,
		);
		it('R132 rejects a real extra native journal INSERT rather than adopting it into the captured fixed set', async () => {
			await withR132Held(async (held) => {
				await held.readEntered.promise;
				held.assertLive();
				const extra = Object.assign(new VirtualThermostatCommandEntity(), held.command, {
					id: uuid(),
					status: 'pending',
				});
				const inserted = held.source.manager.insert(VirtualThermostatCommandEntity, extra);
				void inserted.catch(() => undefined);
				held.readResume.open();
				await inserted;
				held.nativeResume.open();
				await held.resultObserved.promise;
				held.owner.onModuleDestroy();
				await expect(held.mutation).rejects.toBeDefined();
				await held.operation;
				expect(await held.source.manager.countBy(VirtualThermostatCommandEntity, { id: extra.id })).toBe(1);
				expect(held.real.controls.sends.filter((send) => send.on)).toEqual([]);
			});
		}, 30_000);
		it('R132 rejects an arbitrary later O descendant instead of lending it the closed native invocation', async () => {
			await withR132Held(async (held) => {
				await held.readEntered.promise;
				held.assertLive();
				// Registered before seed release: this is an independent descendant of O, not the original T invocation.
				const late = held.operation.then(() =>
					held.source.manager.query(
						'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = "status" WHERE "id" = ?',
						[held.command.id],
					),
				);
				void late.catch(() => undefined);
				held.nativeResume.open();
				await held.resultObserved.promise;
				held.owner.onModuleDestroy();
				held.readResume.open();
				await late;
				await held.operation;
				await expect(held.mutation).rejects.toBeDefined();
				expect(
					(await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: held.command.id })).status,
				).toBe('cancelled');
				expect(held.real.controls.sends.filter((send) => send.on)).toEqual([]);
			});
		}, 30_000);
		it.each(['slot', 'native-configuration'])(
			'R132 vetoes an actually rolled-back %s write although complete row bytes are restored',
			async (target) => {
				await withR132Held(async (held) => {
					await held.readEntered.promise;
					held.assertLive();
					const primary = new Error('foreign transaction rollback');
					const foreign = held.source.transaction(async (manager) => {
						await manager.query(
							target === 'slot'
								? 'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" + 1 WHERE "controllerId" = ?'
								: 'UPDATE "devices_virtual_thermostat_configs" SET "revision" = "revision" + 1 WHERE "controllerId" = ?',
							[held.id],
						);
						throw primary;
					});
					void foreign.catch(() => undefined);
					held.readResume.open();
					await expect(foreign).rejects.toBe(primary);
					held.nativeResume.open();
					await held.resultObserved.promise;
					held.owner.onModuleDestroy();
					await expect(held.mutation).rejects.toBeDefined();
					await held.operation;
					expect(held.real.controls.sends.filter((send) => send.on)).toEqual([]);
				});
			},
			30_000,
		);
		it('R132 does not reuse a completed A command as a live predecessor of a genuine fresh empty-set B no-op', async () => {
			await withR132Held(async (held) => {
				await held.readEntered.promise;
				held.assertLive();
				held.nativeResume.open();
				await held.resultObserved.promise;
				held.owner.onModuleDestroy();
				held.readResume.open();
				await held.mutation;
				await held.operation;
				held.assertLive();
				const b = makeActualRuntime();
				try {
					await b.onApplicationBootstrap();
					const capture = b['captureOriginalPredecessors'](held.id);
					try {
						expect(b['originalPredecessorSize'](capture)).toBe(0);
					} finally {
						b['closeOriginalPredecessors'](capture);
					}
					const before = await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
						id: held.command.id,
					});
					const current = await held.comfort.get(held.id);
					held.assertLive();
					await held.comfort.select(
						held.id,
						{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
						'eco',
						false,
					);
					expect(
						await held.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: held.command.id }),
					).toEqual(before);
				} finally {
					b.onModuleDestroy();
				}
			});
		}, 30_000);
		it('R132 rejects a clone of a genuine captured capability without borrowing its original packet or O', async () => {
			let checked = false;
			await withR132Held(
				async (held) => {
					await held.readEntered.promise;
					held.assertLive();
					expect(checked).toBe(true);
					held.nativeResume.open();
					await held.resultObserved.promise;
					held.owner.onModuleDestroy();
					held.readResume.open();
					await held.mutation;
					await held.operation;
				},
				(owner, id) => {
					const original = owner['captureOriginalPredecessors'](id);
					try {
						expect(owner['originalPredecessorSize'](original)).toBe(1);
						const clone = Object.freeze(new ClimateAutomationPredecessors(original.projections));
						expect(() => owner['originalPredecessorSize'](clone)).toThrow('closed');
						checked = true;
					} finally {
						owner['closeOriginalPredecessors'](original);
					}
				},
			);
		}, 30_000);
		// END R132 closed predecessor real managed drafts

		// BEGIN original native proof/clock integration drafts (UNRUN; existing synthetic installation boundary only)
		it('keeps counter-only effects claims-neutral and the original joined override time current without minting send authority', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const row = await scope.observeOriginal(
					scope.issue(() =>
						scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: scope.controllerId }),
					),
				);
				const originalPort1 = scope.comfort;
				const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> = originalPort1;
				await scope.observeOriginal(
					scope.forward(originalPort1, originalFunctions1.override)(
						scope.controllerId,
						{
							expected_revision: row.revision,
							expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
						},
						{
							preset: 'eco',
							setpoints: null,
							expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
						},
						'original-clock-proof',
					),
				);
				await scope.observeOriginal(settleReal(scope.fixture));
				await scope.observeOriginal(scope.issue(() => scope.actualClaims.refresh()));
				const active = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					),
					intent = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, active))),
					);
				const original = scope.sync(() => scope.actualClaims.capture());
				const cleanupPhase1 = scope.phase();
				try {
					expect(intent.isOverrideCurrent()).toBe(true);
					expect(original.isCurrent()).toBe(true);
					await scope.observeOriginal(
						scope.issue(() =>
							scope.database.query(
								'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1',
							),
						),
					);
					expect(original.isCurrent()).toBe(true);
					expect(intent.isOverrideCurrent()).toBe(true);
					expect(scope.fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.closeIntent(intent);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it.each(['clean', 'qualification-loss'] satisfies readonly ('clean' | 'qualification-loss')[])(
			'uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:%s',
			async (mode) => {
				const scope = captureActualCaller();

				let bodyFailure: { cause: unknown } | undefined;
				try {
					let actualQualifiedUpdates = 0;
					const observer = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
							if (
								!event.query.startsWith('UPDATE "devices_virtual_thermostat_actuator_claims"') ||
								!event.query.includes('releaseEvidence')
							)
								return;
							actualQualifiedUpdates++;
							if (mode === 'qualification-loss') scope.sync(() => scope.actualClaims.revokeAllQualifications());
						},
					};
					scope.sync(() => scope.database.subscribers.push(observer));
					const cleanupPhase1 = scope.phase();
					try {
						const before = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
									controllerId: scope.controllerId,
								}),
							),
						);
						await scope.observeOriginal(
							scope.issue(() => scope.configs.requestRelease(scope.controllerId, before.revision)),
						);
						await scope.observeOriginal(settleReal(scope.fixture));
						const claim = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
									controllerId: scope.controllerId,
								}),
							),
						);
						expect(actualQualifiedUpdates).toBeGreaterThan(0);
						expect(claim.state).toBe(mode === 'clean' ? 'released' : 'releasing');
						if (mode === 'clean')
							expect(claim.releaseEvidence).toMatchObject({ outputConfirmedOff: true, pendingOnDrained: true });
						else expect(claim.releaseEvidence).toBeNull();
					} catch (cause) {
						cleanupPhase1.state.primary = { cause };
					} finally {
						cleanupPhase1.attempt(() => {
							scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
						});
					}
					if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
					if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
				} catch (cause) {
					bodyFailure = { cause };
				}
				let cleanupFailure: { cause: unknown } | undefined;
				try {
					await scope.cleanup();
				} catch (cause) {
					cleanupFailure = { cause };
				}
				if (bodyFailure !== undefined) throw bodyFailure.cause;
				if (cleanupFailure !== undefined) throw cleanupFailure.cause;
			},
		);
		// END original native proof/clock integration drafts

		// BEGIN closed runtime bookkeeping and persistent TIME drafts (UNRUN; real native DB, synthetic installation boundary)
		type CallerDescriptor = {
			target: object;
			key: string;
			original: ReturnType<typeof originalEntryDescriptors.getOwnPropertyDescriptor>;
			installed?: ReturnType<typeof originalEntryDescriptors.getOwnPropertyDescriptor>;
			restore?: () => void;
			attempted: boolean;
			failure?: { cause: unknown };
		};
		type CallerModule = {
			module: TestingModule;
			originalClose: OriginalFunction<TestingModule, TestingModule['close']>;
			close?: Promise<void>;
		};
		type CallerIntent = Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>>;
		type CallerIntentRecord = {
			intent: CallerIntent;
			originalClose: OriginalFunction<CallerIntent, CallerIntent['close']>;
			closed: boolean;
			failure?: { cause: unknown };
		};
		const captureActualCaller = () => {
			const owner = captureRealGuardOwner();
			const originalFixture = fixture;
			if (realGuardAssociations.get(originalFixture)?.owner.owned !== owner.owned)
				throw new Error('Caller real fixture has a different original owner');
			const pending = new Set<Promise<unknown>>(),
				gates = new Set<() => void>();
			const descriptors = new Set<CallerDescriptor>(),
				modules = new Set<CallerModule>();
			const intents = new Set<CallerIntentRecord>();
			let retired = false,
				cleanup: Promise<void> | undefined;
			let retirementFailure: { cause: unknown } | undefined;
			const assertLive = (): void => {
				owner.assertLive();
				if (retired) throw new Error('Original actual caller retired');
			};
			const enroll = <T>(original: Promise<T>): Promise<T> => {
				pending.add(original);
				return original;
			};
			const consumed = (original: unknown): void => {
				for (const entry of pending)
					if (entry === original) {
						pending.delete(entry);
						break;
					}
			};
			const issue = <T>(invoke: () => Promise<T>): Promise<T> => {
				assertLive();
				return enroll(invoke());
			};
			// A TEST continuation, not a Promise installed on an application port. The original
			// application Promise is awaited once; rejection is never replaced by a live check.
			const observeOriginal = async <T>(original: T): Promise<Awaited<T>> => {
				try {
					return await original;
				} finally {
					consumed(original);
				}
			};
			const observe = async <T>(original: T): Promise<Awaited<T>> => {
				const value = await observeOriginal(original);
				assertLive();
				return value;
			};
			const forward =
				<Receiver, Args extends unknown[], Result>(
					receiver: Receiver,
					method: Readonly<{ call: (receiver: Receiver, ...args: Args) => Promise<Result> }>,
				): ((...args: Args) => Promise<Result>) =>
				(...args): Promise<Result> =>
					issue(() => method.call(receiver, ...args));
			const callback = <Receiver, Args extends unknown[], Result>(
				original: (this: Receiver, ...args: Args) => Promise<Result>,
			): ((this: Receiver, ...args: Args) => Promise<Result>) => {
				const method: Readonly<{ call: (receiver: Receiver, ...args: Args) => Promise<Result> }> = original;
				return function (this: Receiver, ...args: Args): Promise<Result> {
					return enroll(method.call(this, ...args)); // SAME original function/receiver/Promise, no reaction.
				};
			};
			const sync = <T>(invoke: () => T): T => {
				assertLive();
				return invoke();
			};
			const snapshot = (source: VirtualThermostatRuntimeService): void => {
				for (const original of [...source['queues'].values(), ...source['inFlight'].values()]) pending.add(original);
			};
			const retire = (): void => {
				if (retired) return;
				retired = true;
				snapshot(scope.runtime);
				for (const open of gates) {
					try {
						open();
					} catch (cause) {
						retirementFailure ??= { cause };
					}
				}
				// Transfer only already-issued operations, never the body/cleanup/entered gates.
				for (const original of pending) owner.owned.issued.add(original);
			};
			const stopRuntime = (source: VirtualThermostatRuntimeService, closing = false): void => {
				if (!closing) assertLive();
				snapshot(source);
				source.onModuleDestroy(); // Same original receiver/call, at its original body boundary.
			};
			const sameDescriptor = (
				a: ReturnType<typeof originalEntryDescriptors.getOwnPropertyDescriptor>,
				b: ReturnType<typeof originalEntryDescriptors.getOwnPropertyDescriptor>,
			): boolean =>
				a === undefined || b === undefined
					? a === b
					: a.value === b.value &&
						a.get === b.get &&
						a.set === b.set &&
						a.configurable === b.configurable &&
						a.enumerable === b.enumerable &&
						a.writable === b.writable;
			const descriptor = (target: object, key: string): CallerDescriptor => {
				assertLive();
				const record: CallerDescriptor = {
					target,
					key,
					original: originalEntryDescriptors.getOwnPropertyDescriptor(target, key),
					attempted: false,
				};
				descriptors.add(record); // Backstop exists before the original spy installation.
				return record;
			};
			const installed = (record: CallerDescriptor, restore: () => void): void => {
				record.installed = originalEntryDescriptors.getOwnPropertyDescriptor(record.target, record.key);
				record.restore = restore;
			};
			const restore = (record: CallerDescriptor): void => {
				if (record.attempted) {
					if (record.failure !== undefined) throw record.failure.cause;
					return;
				}
				record.attempted = true;
				try {
					if (record.restore === undefined) {
						if (
							!sameDescriptor(
								originalEntryDescriptors.getOwnPropertyDescriptor(record.target, record.key),
								record.original,
							)
						)
							throw new Error('Unadopted caller descriptor changed');
						return;
					}
					if (
						!sameDescriptor(
							originalEntryDescriptors.getOwnPropertyDescriptor(record.target, record.key),
							record.installed,
						)
					)
						throw new Error('Foreign caller descriptor retained');
					record.restore();
					if (
						!sameDescriptor(
							originalEntryDescriptors.getOwnPropertyDescriptor(record.target, record.key),
							record.original,
						)
					)
						throw new Error('Original caller descriptor not restored');
				} catch (cause) {
					record.failure = { cause };
					throw cause;
				}
			};
			const joinIssued = async (): Promise<void> => {
				let primary: { cause: unknown } | undefined;
				const originals = [...new Set([...pending, ...owner.owned.issued])]; // Issued A only, never a body/cleanup Promise.
				for (const original of originals) {
					try {
						await original;
					} catch (cause) {
						primary ??= { cause };
					}
					consumed(original);
				}
				if (primary !== undefined) throw primary.cause;
			};
			const quiesce = async (): Promise<void> => {
				retire();
				let primary: { cause: unknown } | undefined;
				try {
					retireRuntimeFixture(owner.owned);
				} catch (cause) {
					primary = { cause };
				}
				try {
					await joinIssued();
				} catch (cause) {
					primary ??= { cause };
				}
				if (primary !== undefined) throw primary.cause;
			};
			const closeFixture = async (original: RealGuardFixture): Promise<void> => {
				retire();
				let primary: { cause: unknown } | undefined;
				try {
					retireRuntimeFixture(owner.owned);
				} catch (cause) {
					primary = { cause };
				}
				try {
					await joinIssued();
				} catch (cause) {
					primary ??= { cause };
				}
				try {
					await closeRecordedRealGuard(original);
				} catch (cause) {
					primary ??= { cause };
				}
				if (primary !== undefined) throw primary.cause;
			};
			const closeModule = (module: TestingModule, orphan = false): Promise<void> => {
				const record = [...modules].find((entry) => entry.module === module);
				if (record === undefined) throw new Error('Module has no original caller owner');
				if (record.close !== undefined) return record.close;
				let resolve: () => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				const completion = new Promise<void>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				record.close = completion; // Before original close/reentry.
				void completion.catch(() => undefined);
				void (async (): Promise<void> => {
					let primary: { cause: unknown } | undefined;
					if (!orphan) {
						retire();
						try {
							retireRuntimeFixture(owner.owned);
						} catch (cause) {
							primary = { cause };
						}
						try {
							await joinIssued();
						} catch (cause) {
							primary ??= { cause };
						}
					}
					try {
						await record.originalClose.call(module);
					} catch (cause) {
						primary ??= { cause };
					}
					if (primary !== undefined) reject(primary.cause);
					else resolve();
				})();
				return completion;
			};
			const constructModule = (invoke: () => Promise<TestingModule>): Promise<TestingModule> => {
				assertLive();
				let resolve: (module: TestingModule) => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				const completion = new Promise<TestingModule>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				void enroll(completion); // Includes returned-result adoption/orphan close, not just compile.
				void completion.catch(() => undefined);
				void (async (): Promise<void> => {
					let module: TestingModule | undefined, primary: { cause: unknown } | undefined;
					try {
						module = await observeOriginal(issue(invoke));
						const methods: OriginalFunctions<Pick<TestingModule, 'close'>> = module;
						modules.add({ module, originalClose: methods.close }); // Exact A result/function before retirement check.
						assertLive();
					} catch (cause) {
						primary = { cause };
					}
					if (primary !== undefined && module !== undefined) {
						try {
							await closeModule(module, true);
						} catch (cause) {
							retirementFailure ??= { cause };
						}
					}
					if (primary !== undefined) reject(primary.cause);
					else if (module === undefined) reject(new Error('Original module result missing'));
					else resolve(module);
				})().catch(reject);
				return completion;
			};
			const closeIntent = (intent: CallerIntent | undefined): void => {
				if (intent === undefined) return;
				const record = [...intents].find((entry) => entry.intent === intent);
				if (record === undefined) throw new Error('Intent has no original caller owner');
				if (record.closed) {
					if (record.failure !== undefined) throw record.failure.cause;
					return;
				}
				record.closed = true;
				try {
					record.originalClose.call(intent);
				} catch (cause) {
					record.failure = { cause };
					throw cause;
				}
			};
			const ownIntent = (original: Promise<CallerIntent>): Promise<CallerIntent> => {
				let resolve: (intent: CallerIntent) => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				const completion = new Promise<CallerIntent>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				void enroll(completion); // Result/adoption or exact late-result close, not a body Promise.
				void completion.catch(() => undefined);
				void (async (): Promise<void> => {
					let intent: CallerIntent | undefined, primary: { cause: unknown } | undefined;
					try {
						intent = await observeOriginal(original);
						const methods: OriginalFunctions<Pick<CallerIntent, 'close'>> = intent;
						intents.add({ intent, originalClose: methods.close, closed: false });
						assertLive();
					} catch (cause) {
						primary = { cause };
					}
					if (primary !== undefined && intent !== undefined) {
						try {
							closeIntent(intent);
						} catch (cause) {
							retirementFailure ??= { cause };
						}
					}
					if (primary !== undefined) reject(primary.cause);
					else if (intent === undefined) reject(new Error('Original intent result missing'));
					else resolve(intent);
				})().catch(reject);
				return completion;
			};
			const phase = () => {
				const state: { primary?: { cause: unknown }; secondary?: { cause: unknown } } = {};
				const attempt = (invoke: () => void): void => {
					try {
						invoke();
					} catch (cause) {
						state.secondary ??= { cause };
					}
				};
				const attemptAsync = async (invoke: () => Promise<void>): Promise<void> => {
					try {
						await invoke();
					} catch (cause) {
						state.secondary ??= { cause };
					}
				};
				return { state, attempt, attemptAsync };
			};
			const finish = (): Promise<void> => {
				if (cleanup !== undefined) return cleanup;
				let resolve: () => void = () => undefined,
					reject: (cause: unknown) => void = () => undefined;
				const completion = new Promise<void>((yes, no) => {
					resolve = yes;
					reject = no;
				});
				cleanup = completion; // Before retirement, gate opening or reentrant cleanup.
				void completion.catch(() => undefined);
				retire();
				void (async (): Promise<void> => {
					let secondary = retirementFailure;
					try {
						retireRuntimeFixture(owner.owned);
					} catch (cause) {
						secondary ??= { cause };
					}
					try {
						await joinIssued();
					} catch (cause) {
						secondary ??= { cause };
					}
					for (const record of intents) {
						try {
							closeIntent(record.intent);
						} catch (cause) {
							secondary ??= { cause };
						}
					}
					for (const record of descriptors) {
						try {
							restore(record);
						} catch (cause) {
							secondary ??= { cause };
						}
					}
					try {
						await closeRecordedRealGuard(scope.fixture);
					} catch (cause) {
						secondary ??= { cause };
					}
					for (const record of modules) {
						try {
							await closeModule(record.module, true);
						} catch (cause) {
							secondary ??= { cause };
						}
					}
					removeOwnedFixtureObserver(owner.owned, backstop);
					unregisterCompletionObserver(backstop);
					if (secondary !== undefined) {
						owner.setup.cleanupFailure ??= secondary;
						throw secondary.cause;
					}
				})().then(resolve, reject);
				return completion;
			};
			const scope = {
				owner,
				database: owner.owned.database,
				controllerId: owner.owned.controllerId,
				sensorId: owner.owned.sensorId,
				relayId: owner.owned.relayId,
				runtime: owner.owned.runtime,
				fixture: originalFixture,
				actualClaims,
				actualStructure,
				actualGraph,
				comfort: owner.owned.comfort,
				configs: owner.owned.configs,
				values,
				producers: owner.owned.producers,
				events: owner.owned.events,
				fixtureState: owner.owned.state,
				mutationWriter: owner.owned.mutationWriter,
				mutationRegistry: owner.owned.mutationRegistry,
				mutationProvider: owner.owned.mutationProvider,
				assertLive,
				issue,
				enroll,
				consumed,
				observe,
				observeOriginal,
				forward,
				callback,
				sync,
				stopRuntime,
				descriptor,
				installed,
				restore,
				constructModule,
				closeModule,
				closeFixture,
				ownIntent,
				closeIntent,
				joinIssued,
				quiesce,
				phase,
				cleanup: finish,
				openOnRetire: (open: () => void): void => {
					assertLive();
					gates.add(open);
				},
				publish: (): void => {
					assertLive();
					runtime = scope.runtime;
					fixture = scope.fixture;
					comfort = scope.comfort;
					configs = scope.configs;
					values = scope.values;
					mutationProvider = scope.mutationProvider;
				},
			};
			const backstop = { retire, cleanup: finish };
			registerOwnedFixtureObserver(owner.owned, backstop);
			registerCompletionObserver(backstop); // Before any body/helper await or descriptor install.
			assertLive();
			return scope;
		};
		type ActualCaller = ReturnType<typeof captureActualCaller>;

		const makeActualRuntime = (transport = fixture.transport, caller?: ActualCaller) => {
			caller?.assertLive();
			return new VirtualThermostatRuntimeService(
				caller === undefined ? database : caller.database,
				caller === undefined ? actualStructure : caller.actualStructure,
				caller === undefined ? actualClaims : caller.actualClaims,
				new VirtualThermostatInputsService(
					caller === undefined ? database : caller.database,
					caller === undefined ? values : caller.values,
				),
				transport,
				caller === undefined ? values : caller.values,
				caller === undefined ? producers : caller.producers,
				caller === undefined ? events : caller.events,
				caller === undefined ? actualGraph : caller.actualGraph,
				caller === undefined ? comfort : caller.comfort,
				new ConfigService({ FB_CLI: 'off' }),
			);
		};
		const useSharedNativePipeline = async (scope: ActualCaller): Promise<TestingModule> => {
			scope.assertLive();
			const realOwner = scope.owner;
			scope.stopRuntime(scope.runtime);
			scope.fixture.revoke();
			await scope.joinIssued();
			scope.assertLive();
			await scope.observe(scope.issue(() => closeRecordedRealGuard(scope.fixture)));
			const pipeline = await scope.observe(
				scope.constructModule(() =>
					Test.createTestingModule({
						providers: [
							PropertyValueService,
							PropertyValueLockService,
							PropertyValueSourceRegistryService,
							StorageService,
							{ provide: PropertyProducerRegistryService, useValue: scope.producers },
							{ provide: DataSource, useValue: scope.database },
							{ provide: EventEmitter2, useValue: scope.events },
							{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }) },
							{
								provide: ModuleConfigService,
								useValue: {
									getModuleConfig: () =>
										Object.assign(new StorageConfigModel(), { primaryStorage: 'owned-bookkeeping-native' }),
								},
							},
						],
					}).compile(),
				),
			);
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
			scope.assertLive();
			scope.owner.owned.runtimePorts.values = scope.values = pipeline.get(PropertyValueService);
			scope.publish();
			const preparedFixture = await scope.observe(
				realOwner.construct(() =>
					realThermostatGuardFixture(
						scope.database,
						scope.events,
						scope.producers,
						scope.fixtureState.installedQualifications,
						'managed',
						{
							values: scope.values,
							sources: pipeline.get(PropertyValueSourceRegistryService),
						},
					),
				),
			);
			realOwner.assertLive();
			scope.fixture = preparedFixture;
			scope.publish();
			for (const evidence of scope.fixtureState.installedQualifications.values())
				scope.actualClaims.recordQualification(evidence);
			scope.mutationProvider.onModuleDestroy();
			scope.comfort.onModuleDestroy();
			scope.owner.owned.comfort =
				scope.owner.owned.runtimePorts.comfort =
				scope.comfort =
					new VirtualThermostatComfortService(
						scope.database,
						scope.actualStructure,
						scope.actualGraph,
						scope.actualClaims,
						scope.events,
						scope.mutationWriter,
					);
			scope.publish();
			scope.owner.owned.configs = scope.configs = new VirtualThermostatConfigService(
				scope.database,
				scope.actualStructure,
				scope.actualGraph,
				scope.actualClaims,
				scope.events,
				scope.values,
				undefined,
				scope.mutationWriter,
			);
			scope.publish();
			scope.owner.owned.mutationProvider = scope.mutationProvider = new VirtualThermostatAutomationService(
				scope.mutationWriter,
				scope.mutationRegistry,
				scope.actualGraph,
				new ConfigService({ FB_CLI: 'off' }),
				undefined,
				scope.configs,
				scope.comfort,
			);
			scope.publish();
			scope.mutationProvider.onModuleInit();
			for (const [id, sample] of scope.fixtureState.samples)
				if (typeof sample.value === 'number' || typeof sample.value === 'boolean') {
					const originalValue = sample.value;
					await scope.observe(scope.issue(() => scope.fixture.report(id, originalValue)));
				}
			scope.assertLive();
			return pipeline;
		};
		it('keeps actual state, branch/noop, command journal and enabled derived lock writes command-current through managed ON', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				await scope.observeOriginal(scope.issue(() => createTemperatureOutput(scope)));
				await scope.observeOriginal(scope.issue(() => scope.actualGraph.refreshQuarantine()));
				const pipeline = await scope.observeOriginal(useSharedNativePipeline(scope));
				const writes: string[] = [];
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>) => {
						if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) writes.push(event.query);
					},
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				const cleanupPhase1 = scope.phase();
				try {
					scope.owner.owned.runtime = scope.runtime = makeActualRuntime(scope.fixture.transport, scope);
					scope.publish();
					await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
					await scope.observeOriginal(settleReal(scope.fixture));
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const originalPort1 = scope.comfort;
					const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> =
						originalPort1;
					await scope.observeOriginal(
						scope.forward(originalPort1, originalFunctions1.override)(
							scope.controllerId,
							{
								expected_revision: before.revision,
								expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
							},
							{
								preset: null,
								setpoints: { heating_setpoint: 23, cooling_setpoint: null },
								expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
							},
							'bookkeeping',
						),
					);
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(scope.fixture.values).toBe(scope.values);
					expect(scope.fixture.controls.sends.some((send) => send.property === scope.relayId && send.on)).toBe(true);
					expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
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
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						scope.fixture.revoke();
					});
					await cleanupPhase1.attemptAsync(async () => {
						await scope.closeFixture(scope.fixture);
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
					await cleanupPhase1.attemptAsync(async () => {
						await scope.closeModule(pipeline);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it('rejects identical native journal SQL and ALL bindings from an actual same-runner subscriber without borrowing its enclosing ORM effect', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const entered = barrier(),
					resume = barrier();
				scope.openOnRetire(resume.open);
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
						originalCapture = scope.sync(() => scope.actualClaims.capture());
						const preciseEventView1: Readonly<{ parameters?: readonly unknown[] }> = event;
						nested = scope.issue(() => event.queryRunner.query(event.query, [...(preciseEventView1.parameters ?? [])]));
						void nested.catch(() => undefined);
						entered.open();
					},
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				scope.fixture.controls.beforeOn = scope.callback(async () => {
					await resume.promise;
				});
				const cleanupPhase1 = scope.phase();
				try {
					await scope.observeOriginal(scope.issue(() => scope.fixture.report(scope.sensorId, 18)));
					await entered.promise;
					scope.assertLive();
					await scope.observeOriginal(nested);
					expect(originalCapture?.isCurrent()).toBe(false);
					resume.open();
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(scope.fixture.controls.sends.filter((send) => send.on)).toEqual([]);
					const journal = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findBy(VirtualThermostatCommandEntity, {
								controllerId: scope.controllerId,
								action: 'on',
							}),
						),
					);
					expect(journal.length).toBeGreaterThan(0);
					expect(journal.every((row) => row.status === 'cancelled')).toBe(true);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						scope.fixture.revoke();
					});
					cleanupPhase1.attempt(() => {
						resume.open();
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
					await cleanupPhase1.attemptAsync(async () => {
						await nested?.catch(() => undefined);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it.each(['same-value', 'restore', 'slot'] satisfies readonly ('same-value' | 'restore' | 'slot')[])(
			'keeps an original time owner closed after relevant native %s and same-lifetime rejoin',
			async (mode) => {
				const scope = captureActualCaller();

				let bodyFailure: { cause: unknown } | undefined;
				try {
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const originalPort1 = scope.comfort;
					const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> =
						originalPort1;
					await scope.observeOriginal(
						scope.forward(originalPort1, originalFunctions1.override)(
							scope.controllerId,
							{
								expected_revision: before.revision,
								expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
							},
							{
								preset: 'eco',
								setpoints: null,
								expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
							},
							'no-clock-revival',
						),
					);
					await scope.observeOriginal(settleReal(scope.fixture));
					const row = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const original = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, row))),
					);
					const cleanupPhase2 = scope.phase();
					try {
						expect(original.isOverrideCurrent()).toBe(true);
						if (mode === 'slot')
							await scope.observeOriginal(
								scope.issue(() =>
									scope.database.query(
										'UPDATE "devices_module_climate_automation_slots" SET "manualCounter" = "manualCounter" WHERE "controllerId" = ?',
										[scope.controllerId],
									),
								),
							);
						else {
							await scope.observeOriginal(
								scope.issue(() =>
									scope.database.query(
										'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
										[mode === 'restore' ? 1 : Number(row.locked), scope.controllerId],
									),
								),
							);
							if (mode === 'restore')
								await scope.observeOriginal(
									scope.issue(() =>
										scope.database.query(
											'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
											[Number(row.locked), scope.controllerId],
										),
									),
								);
						}
						expect(original.isOverrideCurrent()).toBe(false);
						const originalPort2 = scope.comfort;
						const originalFunctions2: OriginalFunctions<Pick<VirtualThermostatComfortService, 'readIntentInManager'>> =
							originalPort2;
						const fresh = await scope.observeOriginal(
							scope.ownIntent(
								scope.forward(originalPort2, originalFunctions2.readIntentInManager)(
									scope.database.manager,
									await scope.observeOriginal(
										scope.issue(() =>
											scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
												controllerId: scope.controllerId,
											}),
										),
									),
								),
							),
						);
						const cleanupPhase1 = scope.phase();
						try {
							expect(fresh.isOverrideCurrent()).toBe(false);
						} catch (cause) {
							cleanupPhase1.state.primary = { cause };
						} finally {
							cleanupPhase1.attempt(() => {
								scope.closeIntent(fresh);
							});
						}
						if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
						if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
					} catch (cause) {
						cleanupPhase2.state.primary = { cause };
					} finally {
						cleanupPhase2.attempt(() => {
							scope.closeIntent(original);
						});
					}
					if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
					if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
				} catch (cause) {
					bodyFailure = { cause };
				}
				let cleanupFailure: { cause: unknown } | undefined;
				try {
					await scope.cleanup();
				} catch (cause) {
					cleanupFailure = { cause };
				}
				if (bodyFailure !== undefined) throw bodyFailure.cause;
				if (cleanupFailure !== undefined) throw cleanupFailure.cause;
			},
		);
		it('refreshes genuine claims after recovery TX AND original structure release, and cleans a failed original bootstrap before same-instance restart', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				scope.stopRuntime(scope.runtime);
				const original: Readonly<{ refresh: { call: (receiver: VirtualThermostatClaimsService) => Promise<void> } }> =
					scope.actualClaims;
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
				scope.sync(() => scope.database.subscribers.push(observer));
				const spyOwnership = scope.descriptor(scope.actualClaims, 'refresh');
				const spyOriginal = jest.spyOn(scope.actualClaims, 'refresh');
				scope.installed(spyOwnership, () => spyOriginal.mockRestore());
				const spy = spyOriginal.mockImplementation(() => {
					expect(scope.sync(() => scope.actualStructure.hasCurrentStructuralLease())).toBe(false);
					trace.push('released-refresh');
					return scope.enroll(refresh.call(scope.actualClaims));
				});
				spyOwnership.restore = () => spy.mockRestore();
				scope.owner.owned.runtime = scope.runtime = makeActualRuntime(scope.fixture.transport, scope);
				scope.publish();
				const cleanupPhase1 = scope.phase();
				try {
					const originalRejectedBootstrap = scope.issue(() =>
						scope.issue(() => scope.runtime.onApplicationBootstrap()),
					);
					await expect(originalRejectedBootstrap).rejects.toBe(failure);
					scope.consumed(originalRejectedBootstrap);
					scope.assertLive();
					expect(trace).toEqual(['recovery']);
					await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(trace.indexOf('released-refresh')).toBeGreaterThan(trace.lastIndexOf('recovery'));
					expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
					const a = scope.runtime;
					scope.stopRuntime(a);
					scope.owner.owned.runtime = scope.runtime = makeActualRuntime(scope.fixture.transport, scope);
					scope.publish();
					await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
					await scope.observeOriginal(settleReal(scope.fixture));
					const b = scope.sync(() => scope.actualClaims.capture());
					expect(b.isCurrent()).toBe(true);
					scope.stopRuntime(a);
					expect(b.isCurrent()).toBe(true);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
					await cleanupPhase1.attemptAsync(async () => {
						await scope.quiesce();
					});
					cleanupPhase1.attempt(() => {
						scope.restore(spyOwnership);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it('preserves only C original remaining TIME across D complete requestRelease, native slot/config effects, qualified drain and new graph generation', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				scope.stopRuntime(scope.runtime);
				const d = scope.sync(() => uuid()),
					relayDevice = scope.sync(() =>
						scope.database.manager.create(ShellyNgDeviceEntity, {
							id: scope.sync(() => uuid()),
							name: 'D physical',
							identifier: 'shellyplus1pm-a8032abe5085',
							canonicalMac: 'A8032ABE5085',
							category: DeviceCategory.SWITCHER,
							enabled: true,
						}),
					);
				const device = scope.sync(() =>
					scope.database.manager.create(VirtualDeviceEntity, {
						id: d,
						name: 'D controller',
						mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
						category: DeviceCategory.THERMOSTAT,
						enabled: true,
					}),
				);
				const channel = scope.sync(() =>
					scope.database.manager.create(ShellyNgChannelEntity, {
						id: scope.sync(() => uuid()),
						device: relayDevice,
						name: 'D switch',
						identifier: 'switch:0',
						category: ChannelCategory.SWITCHER,
					}),
				);
				const property = scope.sync(() =>
					scope.database.manager.create(ShellyNgChannelPropertyEntity, {
						id: scope.sync(() => uuid()),
						channel,
						identifier: 'output',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					}),
				);
				await scope.observeOriginal(scope.issue(() => scope.database.manager.insert(VirtualDeviceEntity, device)));
				await scope.observeOriginal(
					scope.issue(() => scope.database.manager.insert(ShellyNgDeviceEntity, relayDevice)),
				);
				await scope.observeOriginal(scope.issue(() => scope.database.manager.insert(ShellyNgChannelEntity, channel)));
				await scope.observeOriginal(
					scope.issue(() => scope.database.manager.insert(ShellyNgChannelPropertyEntity, property)),
				);
				const c = await scope.observeOriginal(
					scope.issue(() =>
						scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: scope.controllerId }),
					),
				);
				// Actual configure bootstrap for an existing catalog controller, not a fabricated releasing claim/slot.
				const originalPort2 = scope.configs;
				const originalFunctions2: OriginalFunctions<Pick<VirtualThermostatConfigService, 'configure'>> = originalPort2;
				await scope.observeOriginal(
					scope.forward(originalPort2, originalFunctions2.configure)(
						d,
						Object.assign(new ConfigureVirtualThermostatDto(), {
							schemaVersion: 1,
							expectedRevision: 0,
							expectedGraphRevision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
							requestedMode: 'heat',
							policy: structuredClone(c.policy),
							heuristic: null,
							contactOpeningMs: 0,
							contactClosingMs: 0,
							sources: [{ role: 'ambient', sourcePropertyId: scope.sensorId, maximumAgeSeconds: 300 }],
							actuators: [{ role: 'heating', sourcePropertyId: property.id, leaseSeconds: 30 }],
							settings: [],
						}),
					),
				);
				const pipeline = await scope.observeOriginal(useSharedNativePipeline(scope));
				let mono = scope.sync(() => performance.now());
				const initialMono = mono;
				const monotonicOwnership = scope.descriptor(performance, 'now');
				const monotonicOriginal = jest.spyOn(performance, 'now');
				scope.installed(monotonicOwnership, () => monotonicOriginal.mockRestore());
				const monotonic = monotonicOriginal.mockImplementation(() => mono);
				monotonicOwnership.restore = () => monotonic.mockRestore();
				const onEntered = barrier(),
					onResume = barrier();
				scope.openOnRetire(onResume.open);
				const effects: string[] = [];
				const observer = {
					beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
						if (/^(UPDATE|INSERT|DELETE) /.test(event.query)) effects.push(event.query);
					},
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				const cleanupPhase3 = scope.phase();
				try {
					scope.owner.owned.runtime = scope.runtime = makeActualRuntime(scope.fixture.transport, scope);
					scope.publish();
					await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
					await scope.observeOriginal(settleReal(scope.fixture));
					scope.fixture.controls.beforeOn = scope.callback(async (id: string) => {
						if (id === scope.relayId) {
							onEntered.open();
							await onResume.promise;
						}
					});
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const originalPort1 = scope.comfort;
					const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> =
						originalPort1;
					await scope.observeOriginal(
						scope.forward(originalPort1, originalFunctions1.override)(
							scope.controllerId,
							{
								expected_revision: before.revision,
								expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
							},
							{
								preset: null,
								setpoints: { heating_setpoint: 23, cooling_setpoint: null },
								expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
							},
							'C-original-budget',
						),
					);
					await onEntered.promise;
					scope.assertLive();
					const originalClaims = scope.sync(() => scope.actualClaims.capture()),
						originalGraph = scope.sync(() => scope.actualGraph.capturePublishGuard());
					const originalDatabase = scope.database,
						originalComfort = scope.comfort;
					const { originalConfig, originalIntent } = await scope.observeOriginal(
						scope.issue(() =>
							scope.actualStructure.runShared(async () => {
								const originalConfig = await scope.observeOriginal(
									scope.issue(() =>
										originalDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
											controllerId: scope.controllerId,
										}),
									),
								);
								const originalIntent = await scope.observeOriginal(
									scope.ownIntent(
										scope.issue(() => originalComfort.readIntentInManager(originalDatabase.manager, originalConfig)),
									),
								);
								return { originalConfig, originalIntent };
							}),
						),
					);
					const slot = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.query<Record<string, unknown>[]>(
								'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
								[scope.controllerId],
							),
						),
					);
					const dBefore = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: d }),
						),
					);
					const dSlot = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.query<{ slotRevision: number }[]>(
								'SELECT "slotRevision" FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
								[d],
							),
						),
					);
					const cleanupPhase2 = scope.phase();
					try {
						expect(originalIntent.isOverrideCurrent()).toBe(true);
						expect(originalClaims.isCurrent()).toBe(true);
						mono = initialMono + 500;
						effects.length = 0;
						const release = scope.issue(() => scope.configs.requestRelease(d, dBefore.revision));
						void release.catch(() => undefined);
						expect(originalClaims.isCurrent()).toBe(false);
						onResume.open();
						scope.fixture.controls.beforeOn = null;
						await scope.observeOriginal(release);
						await scope.observeOriginal(scope.issue(() => scope.fixture.flushTelemetry()));
						await scope.observeOriginal(settle(captureFixtureBodyOwner(scope.owner.owned), scope.issue));
						expect(
							(
								await scope.observeOriginal(
									scope.issue(() =>
										scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: d }),
									),
								)
							).state,
						).toBe('released');
						expect(
							(
								await scope.observeOriginal(
									scope.issue(() =>
										scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: d }),
									),
								)
							).revision,
						).toBe(dBefore.revision + 1);
						expect(
							(
								await scope.observeOriginal(
									scope.issue(() =>
										scope.database.query<{ slotRevision: number }[]>(
											'SELECT "slotRevision" FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
											[d],
										),
									),
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
						const afterC = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
									controllerId: scope.controllerId,
								}),
							),
						);
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
							await scope.observeOriginal(
								scope.issue(() =>
									scope.database.query(
										'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
										[scope.controllerId],
									),
								),
							),
						).toEqual(slot);
						const fresh = await scope.observeOriginal(
							scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, afterC))),
						);
						const cleanupPhase1 = scope.phase();
						try {
							expect(fresh.isOverrideCurrent()).toBe(true);
							scope.sync(() => scope.runtime.request(scope.controllerId));
							await scope.observeOriginal(settleReal(scope.fixture));
							expect(scope.fixture.controls.sends.some((send) => send.property === scope.relayId && send.on)).toBe(
								true,
							);
							mono = initialMono + 30_100; // would still fit a new D-time budget; cannot fit C's ORIGINAL deadline
							expect(fresh.isOverrideCurrent()).toBe(false);
						} catch (cause) {
							cleanupPhase1.state.primary = { cause };
						} finally {
							cleanupPhase1.attempt(() => {
								scope.closeIntent(fresh);
							});
						}
						if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
						if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
					} catch (cause) {
						cleanupPhase2.state.primary = { cause };
					} finally {
						cleanupPhase2.attempt(() => {
							scope.closeIntent(originalIntent);
						});
					}
					if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
					if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
				} catch (cause) {
					cleanupPhase3.state.primary = { cause };
				} finally {
					cleanupPhase3.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase3.attempt(() => {
						scope.fixture.revoke();
					});
					cleanupPhase3.attempt(() => {
						onResume.open();
					});
					await cleanupPhase3.attemptAsync(async () => {
						await scope.closeFixture(scope.fixture);
					});
					cleanupPhase3.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
					cleanupPhase3.attempt(() => {
						scope.restore(monotonicOwnership);
					});
					await cleanupPhase3.attemptAsync(async () => {
						await scope.closeModule(pipeline);
					});
				}
				if (cleanupPhase3.state.primary !== undefined) throw cleanupPhase3.state.primary.cause;
				if (cleanupPhase3.state.secondary !== undefined) throw cleanupPhase3.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it.each(['before-send', 'after-send'] satisfies readonly ('before-send' | 'after-send')[])(
			'keeps real enabled publication locks neutral while managed ON is pending %s, then preserves actual refusal/UNKNOWN on original claims loss',
			async (boundary) => {
				const scope = captureActualCaller();

				let bodyFailure: { cause: unknown } | undefined;
				try {
					scope.stopRuntime(scope.runtime);
					await scope.observeOriginal(scope.issue(() => createTemperatureOutput(scope)));
					await scope.observeOriginal(scope.issue(() => scope.actualGraph.refreshQuarantine()));
					const pipeline = await scope.observeOriginal(useSharedNativePipeline(scope));
					const entered = barrier(),
						resume = barrier(),
						locks: string[] = [];
					scope.openOnRetire(resume.open);
					const observer = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (/^(INSERT INTO|DELETE FROM) "devices_module_property_value_locks"/.test(event.query))
								locks.push(event.query);
						},
					};
					scope.sync(() => scope.database.subscribers.push(observer));
					const cleanupPhase1 = scope.phase();
					try {
						scope.owner.owned.runtime = scope.runtime = makeActualRuntime(scope.fixture.transport, scope);
						scope.publish();
						await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
						await scope.observeOriginal(settleReal(scope.fixture));
						locks.length = 0;
						scope.fixture.controls[boundary === 'before-send' ? 'beforeOn' : 'afterOn'] = scope.callback(
							async (id: string) => {
								if (id === scope.relayId) {
									entered.open();
									await resume.promise;
								}
							},
						);
						await scope.observeOriginal(scope.issue(() => scope.fixture.report(scope.sensorId, 18)));
						await entered.promise;
						scope.assertLive();
						await scope.observeOriginal(scope.issue(() => scope.runtime.flush()));
						const original = scope.sync(() => scope.actualClaims.capture());
						expect(original.isCurrent()).toBe(true);
						expect(locks.some((query) => query.startsWith('INSERT INTO'))).toBe(true);
						expect(locks.some((query) => query.startsWith('DELETE FROM'))).toBe(true);
						expect(
							scope.fixture.controls.sends.filter((send) => send.property === scope.relayId && send.on),
						).toHaveLength(boundary === 'before-send' ? 0 : 1);
						scope.sync(() => scope.actualClaims.invalidate());
						expect(original.isCurrent()).toBe(false);
						resume.open();
						await scope.observeOriginal(settleReal(scope.fixture));
						const journal = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findBy(VirtualThermostatCommandEntity, {
									controllerId: scope.controllerId,
									action: 'on',
								}),
							),
						);
						expect(journal).toHaveLength(1);
						expect(journal[0].status).toBe(boundary === 'before-send' ? 'cancelled' : 'unknown');
						expect(
							scope.fixture.controls.sends.filter((send) => send.property === scope.relayId && send.on),
						).toHaveLength(boundary === 'before-send' ? 0 : 1);
						expect(
							(
								await scope.observeOriginal(
									scope.issue(() =>
										scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
											controllerId: scope.controllerId,
										}),
									),
								)
							).releaseEvidence,
						).toBeNull();
					} catch (cause) {
						cleanupPhase1.state.primary = { cause };
					} finally {
						cleanupPhase1.attempt(() => {
							scope.stopRuntime(scope.runtime, true);
						});
						cleanupPhase1.attempt(() => {
							scope.fixture.revoke();
						});
						cleanupPhase1.attempt(() => {
							resume.open();
						});
						await cleanupPhase1.attemptAsync(async () => {
							await scope.closeFixture(scope.fixture);
						});
						cleanupPhase1.attempt(() => {
							scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
						});
						await cleanupPhase1.attemptAsync(async () => {
							await scope.closeModule(pipeline);
						});
					}
					if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
					if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
				} catch (cause) {
					bodyFailure = { cause };
				}
				let cleanupFailure: { cause: unknown } | undefined;
				try {
					await scope.cleanup();
				} catch (cause) {
					cleanupFailure = { cause };
				}
				if (bodyFailure !== undefined) throw bodyFailure.cause;
				if (cleanupFailure !== undefined) throw cleanupFailure.cause;
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
				fixtureOwner.runtime = runtime = makeActualRuntime();
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
				resume = barrier(),
				laterEntered = barrier(),
				laterResume = barrier();
			const owner = runtime,
				ownedFixture = fixture,
				ownedDatabase = database,
				ownedClaims = actualClaims,
				ownedComfort = comfort,
				ownedGraph = actualGraph,
				ownedControllerId = controllerId,
				ownedPropertyId = relayId,
				lifecycle = owner['lifecycle'],
				commands = owner['inFlightCommands'],
				operations = owner['inFlight'],
				contexts = owner['contexts'],
				contextLifecycles = owner['contextLifecycles'];
			const http = jest.mocked(guardedHttp.guardedShellyHttp),
				httpDescriptor = Object.getOwnPropertyDescriptor(guardedHttp, 'guardedShellyHttp');
			const httpMethods: OriginalFunctions<typeof http> = http;
			const implementation = httpMethods.getMockImplementation,
				installedImplementation = implementation.call(http),
				httpState: Omit<typeof http.mock, 'contexts'> & Readonly<{ contexts: readonly unknown[] }> = http.mock;
			const runtimeMethods: OriginalFunctions<Pick<VirtualThermostatRuntimeService, 'onModuleDestroy'>> = owner;
			const fixtureMethods: OriginalFunctions<Pick<typeof ownedFixture, 'revoke'>> = ownedFixture;
			const destroy = runtimeMethods.onModuleDestroy,
				revoke = fixtureMethods.revoke;
			let installedBeforeOn = ownedFixture.controls.beforeOn;
			const initialBeforeOn = installedBeforeOn;
			let retired = false,
				cleaned = false,
				onEntries = 0,
				selectorFailure: { cause: unknown } | undefined,
				cleanupFailure: { cause: unknown } | undefined,
				closeIntent: (() => void) | undefined;
			const assertOwner = (): void => {
				const descriptor = Object.getOwnPropertyDescriptor(guardedHttp, 'guardedShellyHttp');
				if (
					retired ||
					!lifecycle ||
					!owner['active'] ||
					owner['lifecycle'] !== lifecycle ||
					owner['dataSource'] !== ownedDatabase ||
					owner['claims'] !== ownedClaims ||
					owner['transport'] !== ownedFixture.transport ||
					ownedFixture.controls.beforeOn !== installedBeforeOn ||
					owner['inFlightCommands'] !== commands ||
					owner['inFlight'] !== operations ||
					owner['contexts'] !== contexts ||
					owner['contextLifecycles'] !== contextLifecycles ||
					!jest.isMockFunction(http) ||
					guardedHttp.guardedShellyHttp !== http ||
					http.mock !== httpState ||
					http.getMockImplementation !== implementation ||
					implementation.call(http) !== installedImplementation ||
					!installedImplementation ||
					!httpDescriptor ||
					!descriptor ||
					descriptor.value !== http ||
					descriptor.value !== httpDescriptor.value ||
					descriptor.get !== httpDescriptor.get ||
					descriptor.set !== httpDescriptor.set ||
					descriptor.configurable !== httpDescriptor.configurable ||
					descriptor.enumerable !== httpDescriptor.enumerable ||
					descriptor.writable !== httpDescriptor.writable
				)
					throw new Error('Original F53 runtime/fixture/HTTP owner unavailable');
				if (selectorFailure) throw selectorFailure.cause;
			};
			type Observed<T> = { kind: 'fulfilled'; value: T } | { kind: 'rejected'; cause: unknown };
			const observe = <T>(promise: Promise<T>): Promise<Observed<T>> =>
				promise.then<Observed<T>, Observed<T>>(
					(value) => ({ kind: 'fulfilled', value }),
					(cause: unknown) => ({ kind: 'rejected', cause }),
				);
			const captureEntry = (propertyId: string, ordinal: 1 | 2, prior?: VirtualThermostatCommandEntity) => {
				assertOwner();
				if (propertyId !== ownedPropertyId) throw new Error('Foreign F53 ON property');
				const calls = httpState.calls.map((call, index) => ({ call, index }));
				if (calls.some(({ call }) => !(call[0] instanceof URL))) throw new Error('Unknown F53 native call');
				const onCalls = calls.filter(({ call }) => call[0].searchParams.get('action') === 'on');
				const entering = onCalls.filter(({ index }) => httpState.results[index]?.type === 'incomplete');
				if (onCalls.length !== ordinal || entering.length !== 1) throw new Error('Nonunique F53 ON entry');
				const native = entering[0];
				if (typeof native.call[2] !== 'function' || typeof native.call[4] !== 'function')
					throw new Error('Original F53 H/onSend missing');
				const eligible = [...commands.values()].filter((command) => command.action === 'on' && command !== prior);
				if (eligible.length !== 1) throw new Error('Nonunique F53 command operation');
				const command = eligible[0],
					operation = operations.get(command.id),
					context = contexts.get(ownedControllerId);
				if (
					command.controllerId !== ownedControllerId ||
					(prior !== undefined && command.id === prior.id) ||
					command.status !== 'dispatching' ||
					command.dispatchedAt === null ||
					command.settledAt !== null ||
					commands.get(command.id) !== command ||
					!(operation instanceof Promise) ||
					!context ||
					contextLifecycles.get(context) !== lifecycle ||
					!context.commands.includes(command) ||
					context.config.revision !== command.configurationRevision ||
					context.state.decisionRevision !== command.decisionRevision
				)
					throw new Error('Original F53 command/context/operation association lost');
				const claims = context.claims.filter((claim) => claim.id === command.claimId);
				if (claims.length !== 1) throw new Error('Nonunique F53 claim');
				const claim = claims[0],
					target = context.targets.get(claim.id);
				if (
					claim.controllerId !== ownedControllerId ||
					claim.revision !== command.claimRevision ||
					claim.sourcePropertyId !== propertyId ||
					!target ||
					target.property.id !== propertyId ||
					claim.sourceDeviceId !== target.device.id ||
					target.property.channel !== target.channel ||
					target.channel.device !== target.device
				)
					throw new Error('Original F53 target/claim mismatch');
				const release = owner['reconciled'].get(`${claim.id}:${claim.revision}`);
				if (!release) throw new Error('Original qualified F53 release record missing');
				return Object.freeze({
					command,
					operation,
					operationResult: observe<void>(operation),
					context,
					claim,
					target,
					native,
					release,
					receiver: httpState.contexts[native.index],
					resultRecord: httpState.results[native.index],
					claimFacts: Object.freeze({
						id: claim.id,
						controllerId: claim.controllerId,
						revision: claim.revision,
						physicalIdentity: claim.physicalIdentity,
						qualificationGeneration: claim.qualificationGeneration,
						sourceDeviceId: claim.sourceDeviceId,
						sourcePropertyId: claim.sourcePropertyId,
						contractFingerprint: claim.contractFingerprint,
						leaseSeconds: claim.leaseSeconds,
					}),
					arguments: Object.freeze({
						url: native.call[0],
						href: native.call[0].href,
						deadline: native.call[1],
						H: native.call[2],
						createRequest: native.call[3],
						onSend: native.call[4],
						length: native.call.length,
					}),
				});
			};
			type Entry = ReturnType<typeof captureEntry>;
			const nativeRecord = (entry: Entry) => {
				assertOwner();
				const call = httpState.calls[entry.native.index],
					result = httpState.results[entry.native.index];
				if (
					call !== entry.native.call ||
					httpState.contexts[entry.native.index] !== entry.receiver ||
					!result ||
					result !== entry.resultRecord ||
					result.type !== 'return' ||
					!(result.value instanceof Promise) ||
					call.length !== entry.arguments.length ||
					call[0] !== entry.arguments.url ||
					call[0].href !== entry.arguments.href ||
					call[1] !== entry.arguments.deadline ||
					call[2] !== entry.arguments.H ||
					call[3] !== entry.arguments.createRequest ||
					call[4] !== entry.arguments.onSend
				)
					throw new Error('Original F53 HTTP invocation metadata changed');
				const native: Promise<unknown> = result.value;
				return native;
			};
			const receipts = (entry: Entry) => {
				const native = nativeRecord(entry);
				if (operations.get(entry.command.id) !== entry.operation || commands.get(entry.command.id) !== entry.command)
					throw new Error('Original F53 outer Promise receipt unavailable');
				return { native, nativeResult: observe<unknown>(native), operationResult: entry.operationResult };
			};
			let aEntry: Entry | undefined, bEntry: Entry | undefined;
			const attemptCleanup = (action: () => void): void => {
				try {
					action();
				} catch (cause) {
					cleanupFailure ??= { cause };
				}
			};
			const retire = (): void => {
				if (retired) return;
				retired = true;
				attemptCleanup(() => {
					if (owner['lifecycle'] === lifecycle) destroy.call(owner);
					else if (owner['active']) throw new Error('Foreign F53 runtime lifecycle must not be retired');
				});
				attemptCleanup(() => revoke.call(ownedFixture));
				// Revoke before releasing either actual native continuation, including timeout/partial setup.
				attemptCleanup(() => resume.open());
				attemptCleanup(() => laterResume.open());
				attemptCleanup(() => entered.open());
				attemptCleanup(() => laterEntered.open());
				attemptCleanup(() => closeIntent?.());
			};
			const backstop = {
				retire,
				cleanup: (): void => {
					retire();
					if (!cleaned) {
						cleaned = true;
						unregisterCompletionObserver(backstop);
					}
					if (cleanupFailure) throw cleanupFailure.cause;
				},
			};
			registerCompletionObserver(backstop);
			let primary: { cause: unknown } | undefined;
			try {
				assertOwner();
				if (initialBeforeOn !== null) throw new Error('Original F53 fixture already has an ON observer');
				installedBeforeOn = async (id: string): Promise<void> => {
					if (!retired) {
						onEntries++;
						try {
							if (onEntries === 1) aEntry = captureEntry(id, 1);
							else if (onEntries === 2 && aEntry) bEntry = captureEntry(id, 2, aEntry.command);
							else throw new Error('Unexpected additional F53 native ON entry');
						} catch (cause) {
							selectorFailure ??= { cause };
						}
						if (onEntries === 1) entered.open();
						else laterEntered.open();
						if (selectorFailure) {
							entered.open();
							laterEntered.open();
						}
					}
					// This test-owned gate never calls or replaces the original H, N, O or onSend.
					await (onEntries === 1 && !retired ? resume.promise : laterResume.promise);
				};
				ownedFixture.controls.beforeOn = installedBeforeOn;
				const row = await ownedDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: ownedControllerId,
				});
				assertOwner();
				const graphRevision = await ownedGraph.revision();
				assertOwner();
				await ownedComfort.override(
					ownedControllerId,
					{ expected_revision: row.revision, expected_graph_revision: graphRevision },
					{
						preset: null,
						setpoints: { heating_setpoint: 23, cooling_setpoint: null },
						expires_at: new Date(Date.now() + 30_000).toISOString(),
					},
					'foreign-effect',
				);
				assertOwner();
				await entered.promise;
				assertOwner();
				if (!aEntry) throw new Error('Original F53 A native entry missing');
				const a = aEntry,
					aReceipts = receipts(a);
				await owner.flush();
				assertOwner();
				const active = await ownedDatabase.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: ownedControllerId,
				});
				assertOwner();
				const intent = await ownedComfort.readIntentInManager(ownedDatabase.manager, active);
				const intentMethods: OriginalFunctions<typeof intent> = intent;
				const close = intentMethods.close;
				closeIntent = () => close.call(intent);
				if (retired) attemptCleanup(closeIntent);
				assertOwner();
				const original = ownedClaims.capture();
				const command = await ownedDatabase.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
					controllerId: ownedControllerId,
					action: 'on',
					status: 'dispatching',
				});
				assertOwner();
				expect(command.id).toBe(a.command.id);
				expect(operations.get(command.id)).toBe(a.operation);
				expect(onEntries).toBe(1);
				expect(intent.isOverrideCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(true);
				await ownedDatabase.query(
					'UPDATE "devices_virtual_thermostat_command_journal" SET "fault" = ? WHERE "id" = ?',
					[null, command.id],
				);
				assertOwner();
				expect(original.isCurrent()).toBe(false);
				expect(intent.isOverrideCurrent()).toBe(true);
				resume.open();
				// A-only terminal interval: do NOT call active settleReal or join held B's operation.
				const aNative = await aReceipts.nativeResult,
					aOperation = await aReceipts.operationResult;
				if (aOperation.kind === 'rejected') throw aOperation.cause;
				if (
					aNative.kind === 'rejected' &&
					(!(aNative.cause instanceof Error) ||
						Object.getPrototypeOf(aNative.cause) !== Error.prototype ||
						Object.getOwnPropertyDescriptor(aNative.cause, 'message')?.value !==
							'revoked before simulated network send')
				)
					throw aNative.cause;
				assertOwner();
				expect(nativeRecord(a)).toBe(aReceipts.native);
				expect(aNative.kind).toBe('rejected');
				if (aNative.kind !== 'rejected') throw new Error('Original A did not reach native pre-send refusal');
				expect(aNative.cause).toEqual(new Error('revoked before simulated network send'));
				expect(operations.has(command.id)).toBe(false);
				expect(
					(await ownedDatabase.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status,
				).toBe('cancelled');
				assertOwner();
				expect(original.isCurrent()).toBe(false);
				expect(ownedFixture.controls.sends.filter((send) => send.on)).toEqual([]);
				// A genuine existing ordinary/poll request must supply B; this test creates no request to force it.
				await laterEntered.promise;
				assertOwner();
				if (!bEntry) throw new Error('Independent F53 B native entry missing');
				const b = bEntry,
					bReceipts = receipts(b);
				expect(onEntries).toBe(2);
				expect(b.command.id).not.toBe(command.id);
				expect(b.command.claimId).toBe(command.claimId);
				expect(b.claimFacts).toEqual(a.claimFacts);
				expect(b.context).not.toBe(a.context);
				expect(b.operation).not.toBe(a.operation);
				expect(bReceipts.native).not.toBe(aReceipts.native);
				expect(b.arguments.H).not.toBe(a.arguments.H);
				expect(contexts.get(ownedControllerId)).toBe(b.context);
				const bOverride = b.context.config.comfort?.temporary_override,
					originalOverride = active.comfort?.temporary_override,
					branch = b.context.branches.get(b.claim.id),
					release = owner['reconciled'].get(`${b.claim.id}:${b.claim.revision}`);
				if (!bOverride || !originalOverride || !b.context.intent || !branch || !release)
					throw new Error('Genuine B intent/native release facts unavailable');
				expect(b.context.config.policy).toEqual(active.policy);
				expect(b.context.config.comfort?.user_off).toBe(false);
				const { wall_watermark_ms: aWatermark, ...aOverrideFacts } = originalOverride,
					{ wall_watermark_ms: bWatermark, ...bOverrideFacts } = bOverride;
				expect(bOverrideFacts).toEqual(aOverrideFacts);
				if (typeof aWatermark !== 'number' || typeof bWatermark !== 'number')
					throw new Error('Original and B lifetime evidence unavailable');
				expect(Number.isFinite(aWatermark) && Number.isFinite(bWatermark)).toBe(true);
				expect(bWatermark).toBeGreaterThanOrEqual(aWatermark);
				expect(bOverride.id).toBe(originalOverride.id);
				expect(bOverride.expires_at).toBe(originalOverride.expires_at);
				expect(bOverride.original_duration_ms).toBe(originalOverride.original_duration_ms);
				expect(bOverride.resolved_setpoints).toEqual({ heating_setpoint: 23, cooling_setpoint: null });
				expect(bOverride.status).toBe('active');
				expect(b.context.intent.projection.available).toBe(true);
				expect(b.context.intent.projection.manualHold).toBe(intent.projection.manualHold);
				expect(b.claim.state).toBe('reserved');
				expect(branch.activity).toBe('off');
				expect(branch.lastVerifiedOffAt).not.toBeNull();
				expect(branch.releaseProofId).not.toBeNull();
				expect(release).toBe(b.release);
				expect(release).not.toBe(a.release);
				expect(release.origin).not.toBe(a.release.origin);
				expect(release.qualification).toBe(a.release.qualification);
				expect(release.lifecycle).toBe(lifecycle);
				expect(release.claimRevision).toBe(b.claim.revision);
				expect(release.physicalIdentity).toBe(b.claim.physicalIdentity);
				expect(release.qualificationGeneration).toBe(b.claim.qualificationGeneration);
				expect(
					b.context.commands
						.filter((entry) => !['confirmed', 'cancelled'].includes(entry.status))
						.map((entry) => entry.id),
				).toEqual([b.command.id]);
				const bAdmission = ownedClaims.capture();
				expect(bAdmission.isCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(false);
				expect(ownedFixture.controls.sends.filter((send) => send.on)).toEqual([]);
				laterResume.open();
				const bNative = await bReceipts.nativeResult,
					bOperation = await bReceipts.operationResult;
				// Exact original operation failure P precedes HTTP Q, then test-selector/cleanup failures.
				if (bOperation.kind === 'rejected') throw bOperation.cause;
				if (bNative.kind === 'rejected') throw bNative.cause;
				assertOwner();
				expect(nativeRecord(b)).toBe(bReceipts.native);
				const requestedEpoch = b.native.call[0].searchParams.get('epoch'),
					requestedUntil = b.native.call[0].searchParams.get('untilMs');
				if (requestedEpoch === null || requestedUntil === null) throw new Error('Original B request bounds missing');
				expect(Number.isSafeInteger(Number(requestedEpoch))).toBe(true);
				expect(Number.isSafeInteger(Number(requestedUntil))).toBe(true);
				expect(bNative.value).toEqual({
					accepted: true,
					epoch: Number(requestedEpoch),
					untilMs: Number(requestedUntil),
				});
				const settledB = await ownedDatabase.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
					id: b.command.id,
				});
				assertOwner();
				expect(settledB.status).toBe('accepted');
				expect(settledB.fault).toBeNull();
				expect(settledB.dispatchedAt).toBeInstanceOf(Date);
				expect(settledB.settledAt).toBeInstanceOf(Date);
				expect(settledB.claimId).toBe(command.claimId);
				expect(settledB.claimRevision).toBe(b.claim.revision);
				expect(settledB.configurationRevision).toBe(b.command.configurationRevision);
				expect(settledB.decisionRevision).toBe(b.command.decisionRevision);
				expect(operations.has(settledB.id)).toBe(false);
				const pending = (
					await ownedDatabase.manager.findBy(VirtualThermostatCommandEntity, { controllerId: ownedControllerId })
				).filter((entry) => !['confirmed', 'cancelled'].includes(entry.status));
				assertOwner();
				expect(pending.map((entry) => entry.id)).toEqual([settledB.id]);
				expect(pending[0].action).toBe('on'); // accepted remains unresolved, never fictional confirmed/drained.
				const diagnostic = owner.readDiagnostics(ownedControllerId);
				expect(diagnostic?.configuration_revision).toBe(settledB.configurationRevision);
				expect(diagnostic?.effective_comfort.override_id).toBe(originalOverride.id);
				expect(diagnostic?.effective_comfort.expires_at).toBe(originalOverride.expires_at);
				expect(ownedFixture.controls.sends.filter((send) => send.on)).toEqual([
					{ property: ownedPropertyId, on: true },
				]);
				expect(onEntries).toBe(2);
				expect(original.isCurrent()).toBe(false);
			} catch (cause) {
				primary = { cause };
			} finally {
				retire();
				// Original O includes original N; join only the two positively identified owned operations.
				// On Jest timeout the existing synchronous backstop still revokes/releases first; no forced resolution.
				for (const entry of [aEntry, bEntry]) {
					if (entry) {
						const outcome = await entry.operationResult;
						if (outcome.kind === 'rejected') cleanupFailure ??= { cause: outcome.cause };
					}
				}
				try {
					backstop.cleanup();
				} catch (cause) {
					cleanupFailure ??= { cause };
				}
			}
			if (primary) throw primary.cause;
			if (cleanupFailure) throw cleanupFailure.cause;
		});
		it('keeps an original clock closed after a rolled-back same-value C write without resetting the restored lifetime', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const before = await scope.observeOriginal(
					scope.issue(() =>
						scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: scope.controllerId }),
					),
				);
				const originalPort1 = scope.comfort;
				const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> = originalPort1;
				await scope.observeOriginal(
					scope.forward(originalPort1, originalFunctions1.override)(
						scope.controllerId,
						{
							expected_revision: before.revision,
							expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
						},
						{
							preset: 'eco',
							setpoints: null,
							expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
						},
						'rollback-clock',
					),
				);
				await scope.observeOriginal(settleReal(scope.fixture));
				const row = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					),
					intent = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, row))),
					);
				const failure = new Error('known rollback');
				const cleanupPhase2 = scope.phase();
				try {
					expect(intent.isOverrideCurrent()).toBe(true);
					const originalRollback = scope.issue(() =>
						scope.database.transaction(async (manager) => {
							await scope.observeOriginal(
								scope.issue(() =>
									manager.query(
										'UPDATE "devices_virtual_thermostat_configs" SET "locked" = ? WHERE "controllerId" = ?',
										[Number(row.locked), scope.controllerId],
									),
								),
							);
							throw failure;
						}),
					);
					await expect(originalRollback).rejects.toBe(failure);
					scope.consumed(originalRollback);
					scope.assertLive();
					expect(
						await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
									controllerId: scope.controllerId,
								}),
							),
						),
					).toEqual(row);
					expect(intent.isOverrideCurrent()).toBe(false);
					const restored = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, row))),
					);
					const cleanupPhase1 = scope.phase();
					try {
						expect(restored.isOverrideCurrent()).toBe(false);
					} catch (cause) {
						cleanupPhase1.state.primary = { cause };
					} finally {
						cleanupPhase1.attempt(() => {
							scope.closeIntent(restored);
						});
					}
					if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
					if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
				} catch (cause) {
					cleanupPhase2.state.primary = { cause };
				} finally {
					cleanupPhase2.attempt(() => {
						scope.closeIntent(intent);
					});
				}
				if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
				if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it('pins the original native hydration method and never revives a clock after its observed replacement restores', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const before = await scope.observeOriginal(
					scope.issue(() =>
						scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: scope.controllerId }),
					),
				);
				const originalPort1 = scope.comfort;
				const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> = originalPort1;
				await scope.observeOriginal(
					scope.forward(originalPort1, originalFunctions1.override)(
						scope.controllerId,
						{
							expected_revision: before.revision,
							expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
						},
						{
							preset: 'eco',
							setpoints: null,
							expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
						},
						'native-method-clock',
					),
				);
				await scope.observeOriginal(settleReal(scope.fixture));
				const row = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					),
					intent = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, row))),
					);
				const methods: OriginalFunctions<{
					prepareHydratedValue: {
						call: (
							receiver: DataSource['driver'],
							...args: Parameters<DataSource['driver']['prepareHydratedValue']>
						) => unknown;
					};
				}> = scope.database.driver;
				const hydrate = methods.prepareHydratedValue;
				const spyOwnership = scope.descriptor(scope.database.driver, 'prepareHydratedValue');
				const spyOriginal = jest.spyOn(scope.database.driver, 'prepareHydratedValue');
				scope.installed(spyOwnership, () => spyOriginal.mockRestore());
				const spy = spyOriginal.mockImplementation((...args) => hydrate.call(scope.database.driver, ...args));
				spyOwnership.restore = () => spy.mockRestore();
				const cleanupPhase1 = scope.phase();
				try {
					expect(intent.isOverrideCurrent()).toBe(false);
					expect(spy).not.toHaveBeenCalled();
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.restore(spyOwnership);
					});
					cleanupPhase1.attempt(() => {
						scope.closeIntent(intent);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
				const fresh = await scope.observeOriginal(
					scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, row))),
				);
				const cleanupPhase2 = scope.phase();
				try {
					expect(fresh.isOverrideCurrent()).toBe(false);
				} catch (cause) {
					cleanupPhase2.state.primary = { cause };
				} finally {
					cleanupPhase2.attempt(() => {
						scope.closeIntent(fresh);
					});
				}
				if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
				if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
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
					unregisterCompletionObserver(readBackstop);
					if (failure) throw failure.cause;
				},
			};
			registerCompletionObserver(readBackstop);
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
					unregisterCompletionObserver(readBackstop);
					if (failure) throw failure.cause;
				},
			};
			registerCompletionObserver(readBackstop);
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
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const entered = barrier(),
					resume = barrier();
				scope.openOnRetire(resume.open);
				scope.fixture.controls.beforeOn = scope.callback(async (id: string) => {
					if (id === scope.relayId) {
						entered.open();
						await resume.promise;
					}
				});
				await scope.observeOriginal(scope.issue(() => scope.fixture.report(scope.sensorId, 18)));
				await entered.promise;
				scope.assertLive();
				const original = scope.sync(() => scope.actualClaims.capture()),
					claim = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
				const cleanupPhase1 = scope.phase();
				try {
					expect(original.isCurrent()).toBe(true);
					await scope.observeOriginal(
						scope.issue(() =>
							scope.database.query(
								'UPDATE "devices_virtual_thermostat_actuator_claims" SET "revision" = ? WHERE "id" = ? AND "revision" = ?',
								[claim.revision + 1, claim.id, claim.revision],
							),
						),
					);
					expect(original.isCurrent()).toBe(false);
					resume.open();
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(scope.fixture.controls.sends.filter((send) => send.on)).toEqual([]);
					expect(
						(
							await scope.observeOriginal(
								scope.issue(() =>
									scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id }),
								),
							)
						).revision,
					).toBe(claim.revision + 1);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						scope.fixture.revoke();
					});
					cleanupPhase1.attempt(() => {
						resume.open();
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it('never lends a closed ORM effect to a held AfterQuery descendant issuing the identical native write later', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const queryEntered = barrier(),
					queryResume = barrier(),
					onEntered = barrier(),
					onResume = barrier();
				scope.openOnRetire(onResume.open);
				scope.openOnRetire(queryResume.open);
				let armed = true,
					descendant: Promise<void> | undefined;
				const observer = {
					afterQuery: (event: import('typeorm').AfterQueryEvent<unknown>): Promise<void> | undefined => {
						if (!armed || !event.query.startsWith('UPDATE "devices_virtual_thermostat_runtime"')) return;
						armed = false;
						queryEntered.open();
						descendant = scope.enroll(
							queryResume.promise.then(async () => {
								const preciseEventView2: Readonly<{ parameters?: readonly unknown[] }> = event;
								await scope.observeOriginal(
									scope.issue(() => event.queryRunner.query(event.query, [...(preciseEventView2.parameters ?? [])])),
								);
							}),
						);
						return descendant;
					},
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				scope.fixture.controls.beforeOn = scope.callback(async (id: string) => {
					if (id === scope.relayId) {
						onEntered.open();
						await onResume.promise;
					}
				});
				const cleanupPhase1 = scope.phase();
				try {
					await scope.observeOriginal(scope.issue(() => scope.fixture.report(scope.sensorId, 18)));
					await queryEntered.promise;
					scope.assertLive();
					await onEntered.promise;
					scope.assertLive();
					const original = scope.sync(() => scope.actualClaims.capture());
					expect(original.isCurrent()).toBe(true);
					queryResume.open();
					await scope.observeOriginal(descendant);
					expect(original.isCurrent()).toBe(false);
					onResume.open();
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(scope.fixture.controls.sends.filter((send) => send.on)).toEqual([]);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						scope.fixture.revoke();
					});
					cleanupPhase1.attempt(() => {
						queryResume.open();
					});
					cleanupPhase1.attempt(() => {
						onResume.open();
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
					await cleanupPhase1.attemptAsync(async () => {
						await descendant?.catch(() => undefined);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
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
					fixtureOwner.mutationProvider = mutationProvider = new VirtualThermostatAutomationService(
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
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				scope.stopRuntime(scope.runtime);
				let mono = scope.sync(() => performance.now());
				const initialMono = mono;
				const monotonicOwnership = scope.descriptor(performance, 'now');
				const monotonicOriginal = jest.spyOn(performance, 'now');
				scope.installed(monotonicOwnership, () => monotonicOriginal.mockRestore());
				const monotonic = monotonicOriginal.mockImplementation(() => mono);
				monotonicOwnership.restore = () => monotonic.mockRestore();
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
				}> = scope.actualClaims;
				const refresh = originalRefresh.refresh;
				const refreshSpyOwnership = scope.descriptor(scope.actualClaims, 'refresh');
				const refreshSpyOriginal = jest.spyOn(scope.actualClaims, 'refresh');
				scope.installed(refreshSpyOwnership, () => refreshSpyOriginal.mockRestore());
				const refreshSpy = refreshSpyOriginal.mockImplementation(
					scope.callback(async () => {
						if (releasedRefresh || !native.length) return scope.enroll(refresh.call(scope.actualClaims));
						expect(scope.sync(() => scope.actualStructure.hasCurrentStructuralLease())).toBe(false);
						await scope.observeOriginal(scope.enroll(refresh.call(scope.actualClaims)));
						if (callbackFailure !== undefined) {
							callbackFailureReplayed = true;
							throw callbackFailure.cause;
						}
						expect(original?.isOverrideCurrent()).toBe(true);
						expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
						const recovered = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: recoveryId }),
							),
						);
						expect(recovered.status).toBe('unknown');
						expect(recovered.fault).toBe('restart_requires_release_reconciliation');
						const branches = await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findBy(VirtualThermostatBranchRuntimeEntity, {
									claimId: recovered.claimId,
								}),
							),
						);
						expect(branches).toHaveLength(1);
						expect(branches[0]).toMatchObject({ activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null });
						releasedRefresh = true;
					}),
				);
				refreshSpyOwnership.restore = () => refreshSpy.mockRestore();
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
				const cleanupPhase2 = scope.phase();
				try {
					const previousProvider = scope.mutationRegistry.captureProvider('virtual-thermostat:v1');
					expect(previousProvider?.isCurrent()).toBe(true);
					scope.mutationProvider.onModuleDestroy();
					expect(previousProvider?.isCurrent()).toBe(false);
					scope.owner.owned.mutationProvider = scope.mutationProvider = new VirtualThermostatAutomationService(
						scope.mutationWriter,
						scope.mutationRegistry,
						scope.actualGraph,
						new ConfigService({ FB_CLI: 'off' }),
						undefined,
						scope.configs,
						scope.comfort,
					);
					scope.publish();
					scope.sync(() => scope.mutationProvider.onModuleInit());
					expect(scope.mutationRegistry.captureProvider('virtual-thermostat:v1')?.isCurrent()).toBe(true);
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const originalPort1 = scope.comfort;
					const originalFunctions1: OriginalFunctions<Pick<VirtualThermostatComfortService, 'override'>> =
						originalPort1;
					await scope.observeOriginal(
						scope.forward(originalPort1, originalFunctions1.override)(
							scope.controllerId,
							{
								expected_revision: before.revision,
								expected_graph_revision: await scope.observeOriginal(scope.issue(() => scope.actualGraph.revision())),
							},
							{
								preset: 'eco',
								setpoints: null,
								expires_at: new Date(scope.sync(() => Date.now()) + 30_000).toISOString(),
							},
							'restart-original-budget',
						),
					);
					const config = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const slot: unknown = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.query('SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?', [
								scope.controllerId,
							]),
						),
					);
					original = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, config))),
					);
					captured = scope.sync(() => scope.actualClaims.capture());
					expect(original.isOverrideCurrent()).toBe(true);
					expect(captured.isCurrent()).toBe(true);
					const claim = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const id = scope.sync(() => uuid());
					recoveryId = id;
					await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.insert(VirtualThermostatCommandEntity, {
								id,
								controllerId: scope.controllerId,
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
							}),
						),
					);
					await scope.observeOriginal(scope.issue(() => scope.actualClaims.refresh()));
					captured = scope.sync(() => scope.actualClaims.capture());
					scope.sync(() => scope.database.subscribers.push(observer));
					mono = initialMono + 500;
					// Same instance, its original lifecycle was synchronously closed above.
					try {
						await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
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
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(native).toEqual([
						{
							query: journalSql,
							parameters: ['unknown', 'restart_requires_release_reconciliation', 'prepared', 'dispatching'],
						},
						{ query: branchSql, parameters: ['unknown', null] },
					]);
					expect(releasedRefresh).toBe(true);
					expect(captured.isCurrent()).toBe(false);
					expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
					const recovered = await scope.observeOriginal(
						scope.issue(() => scope.database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id })),
					);
					expect(recovered.fault).toBe('restart_requires_release_reconciliation');
					expect(recovered.status === 'unknown' || recovered.status === 'confirmed').toBe(true);
					const after = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					expect(after.comfort?.temporary_override?.expires_at).toBe(config.comfort?.temporary_override?.expires_at);
					expect(after.comfort?.temporary_override?.wall_watermark_ms).toBeGreaterThanOrEqual(
						config.comfort?.temporary_override?.wall_watermark_ms ?? 0,
					);
					expect(
						await scope.observeOriginal(
							scope.issue(() =>
								scope.database.query(
									'SELECT * FROM "devices_module_climate_automation_slots" WHERE "controllerId" = ?',
									[scope.controllerId],
								),
							),
						),
					).toEqual(slot);
					const fresh = await scope.observeOriginal(
						scope.ownIntent(scope.issue(() => scope.comfort.readIntentInManager(scope.database.manager, after))),
					);
					const cleanupPhase1 = scope.phase();
					try {
						expect(fresh.isOverrideCurrent()).toBe(true);
						mono = initialMono + 30_100;
						expect(fresh.isOverrideCurrent()).toBe(false);
					} catch (cause) {
						cleanupPhase1.state.primary = { cause };
					} finally {
						cleanupPhase1.attempt(() => {
							scope.closeIntent(fresh);
						});
					}
					if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
					if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
				} catch (cause) {
					cleanupPhase2.state.primary = { cause };
				} finally {
					cleanupPhase2.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase2.attempt(() => {
						scope.closeIntent(original);
					});
					const index = scope.database.subscribers.indexOf(observer);
					cleanupPhase2.attempt(() => {
						if (index >= 0) scope.database.subscribers.splice(index, 1);
					});
					await cleanupPhase2.attemptAsync(async () => {
						await scope.quiesce();
					});
					cleanupPhase2.attempt(() => {
						scope.restore(monotonicOwnership);
					});
					cleanupPhase2.attempt(() => {
						scope.mutationProvider.onModuleDestroy();
					});
					cleanupPhase2.attempt(() => {
						scope.restore(refreshSpyOwnership);
					});
				}
				if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
				if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
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
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				scope.stopRuntime(scope.runtime);
				const entered = barrier(),
					resume = barrier();
				scope.openOnRetire(resume.open);
				let armed = true;
				const observer = {
					beforeTransactionStart: scope.callback(async (): Promise<void> => {
						if (!armed) return;
						armed = false;
						entered.open();
						await resume.promise;
					}),
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				const a = scope.issue(() => scope.runtime.onApplicationBootstrap());
				void a.catch(() => undefined);
				await entered.promise;
				scope.assertLive();
				scope.stopRuntime(scope.runtime);
				const b = scope.issue(() => scope.runtime.onApplicationBootstrap());
				void b.catch(() => undefined);
				const cleanupPhase1 = scope.phase();
				try {
					expect(b).not.toBe(a);
					expect(scope.issue(() => scope.runtime.onApplicationBootstrap())).toBe(b);
					resume.open();
					await expect(a).rejects.toThrow('Original runtime lifecycle ended');
					scope.consumed(a);
					scope.assertLive();
					await scope.observeOriginal(b);
					await scope.observeOriginal(settleReal(scope.fixture));
					const capture = scope.sync(() => scope.actualClaims.capture());
					expect(capture.isCurrent()).toBe(true);
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(
						scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId))?.configuration_revision,
					).toBeGreaterThan(0);
					expect(capture.isCurrent()).toBe(true);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase1.attempt(() => {
						resume.open();
					});
					await cleanupPhase1.attemptAsync(async () => {
						await Promise.allSettled([a, b]);
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});
		it('stops A at an actual late native load read and admits fresh B only through its own structural ticket', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
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
						scope.stopRuntime(scope.runtime);
						entered.open();
					},
				};
				scope.sync(() => scope.database.subscribers.push(observer));
				const cleanupPhase1 = scope.phase();
				try {
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					oldQueue = scope.issue(() => scope.runtime.flush());
					void oldQueue.catch(() => undefined);
					await entered.promise;
					scope.assertLive();
					await scope.observeOriginal(scope.issue(() => scope.runtime.onApplicationBootstrap()));
					await scope.observeOriginal(oldQueue);
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(armed).toBe(false);
					expect(scope.sync(() => scope.actualClaims.capture()).isCurrent()).toBe(true);
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					expect(scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId))?.decision_revision).toBe(
						before.decisionRevision,
					);
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(
						scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId))?.decision_revision,
					).toBeGreaterThan(before.decisionRevision);
				} catch (cause) {
					cleanupPhase1.state.primary = { cause };
				} finally {
					cleanupPhase1.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					await cleanupPhase1.attemptAsync(async () => {
						await oldQueue?.catch(() => undefined);
					});
					cleanupPhase1.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
				}
				if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
				if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});

		it('drops a real completed A native load held after original shared release without closing B context or persisting A work', async () => {
			const scope = captureActualCaller();

			let bodyFailure: { cause: unknown } | undefined;
			try {
				const entered = barrier(),
					resume = barrier();
				scope.openOnRetire(resume.open);
				let nativeLoaded = false,
					armed = true;
				const original: Readonly<{
					runShared: { call: <T>(receiver: DeviceStructureLockService, fn: () => Promise<T>) => Promise<T> };
				}> = scope.actualStructure;
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
				scope.sync(() => scope.database.subscribers.push(observer));
				const spyOwnership = scope.descriptor(scope.actualStructure, 'runShared');
				const spyOriginal = jest.spyOn(scope.actualStructure, 'runShared');
				scope.installed(spyOwnership, () => spyOriginal.mockRestore());
				const originalSharedCallback = async <T>(fn: () => Promise<T>): Promise<T> => {
					const result = await scope.observeOriginal(scope.enroll(shared.call(scope.actualStructure, fn)));
					if (armed && nativeLoaded) {
						armed = false;
						// Ordinary shared promise settlement precedes its finally. A real exclusive ticket
						// proves the original shared owner has released, without a sleep or private flag.
						await scope.observeOriginal(
							scope.issue(() => scope.actualStructure.runExclusiveReleased(() => Promise.resolve(undefined))),
						);
						entered.open();
						await resume.promise;
					}
					return result;
				};
				const spy = spyOriginal.mockImplementation(
					<T>(fn: () => Promise<T>): Promise<T> => scope.enroll(originalSharedCallback(fn)),
				);
				spyOwnership.restore = () => spy.mockRestore();
				let oldQueue: Promise<void> | undefined, bBootstrap: Promise<void> | undefined;
				const bLoaded = barrier(),
					bReturn = barrier();
				scope.openOnRetire(bReturn.open);
				const originalFlush: Readonly<{
					flush: { call: (receiver: VirtualThermostatRuntimeService) => Promise<void> };
				}> = scope.runtime;
				const flush = originalFlush.flush;
				let restoreFlush: (() => void) | undefined;
				const cleanupPhase2 = scope.phase();
				try {
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					oldQueue = scope.issue(() => scope.runtime.flush());
					void oldQueue.catch(() => undefined);
					await entered.promise;
					scope.assertLive();
					// All original load SQL ran; its shared owner is actually released before B starts.
					scope.stopRuntime(scope.runtime);
					const flushSpyOwnership = scope.descriptor(scope.runtime, 'flush');
					const flushSpyOriginal = jest.spyOn(scope.runtime, 'flush');
					scope.installed(flushSpyOwnership, () => flushSpyOriginal.mockRestore());
					const flushSpy = flushSpyOriginal.mockImplementation(
						scope.callback(async () => {
							await scope.observeOriginal(scope.enroll(flush.call(scope.runtime)));
							bLoaded.open();
							await bReturn.promise;
						}),
					);
					flushSpyOwnership.restore = () => flushSpy.mockRestore();
					restoreFlush = () => scope.restore(flushSpyOwnership);
					bBootstrap = scope.issue(() => scope.runtime.onApplicationBootstrap());
					void bBootstrap.catch(() => undefined);
					await bLoaded.promise;
					scope.assertLive();
					// B's genuine native context/decision is loaded; its interval has not yet been installed.
					const before = await scope.observeOriginal(
						scope.issue(() =>
							scope.database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, {
								controllerId: scope.controllerId,
							}),
						),
					);
					const diagnostic = scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId)),
						capture = scope.sync(() => scope.actualClaims.capture());
					expect(diagnostic?.configuration_revision).toBeGreaterThan(0);
					expect(capture.isCurrent()).toBe(true);
					const writes: string[] = [];
					const watch = {
						beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
							if (/^(INSERT|UPDATE|DELETE) /.test(event.query)) writes.push(event.query);
						},
					};
					scope.sync(() => scope.database.subscribers.push(watch));
					const cleanupPhase1 = scope.phase();
					try {
						resume.open();
						await scope.observeOriginal(oldQueue);
						expect(writes).toEqual([]);
					} catch (cause) {
						cleanupPhase1.state.primary = { cause };
					} finally {
						cleanupPhase1.attempt(() => {
							scope.database.subscribers.splice(scope.database.subscribers.indexOf(watch), 1);
						});
					}
					if (cleanupPhase1.state.primary !== undefined) throw cleanupPhase1.state.primary.cause;
					if (cleanupPhase1.state.secondary !== undefined) throw cleanupPhase1.state.secondary.cause;
					expect(
						await scope.observeOriginal(
							scope.issue(() =>
								scope.database.manager.findOneByOrFail(VirtualThermostatRuntimeEntity, {
									controllerId: scope.controllerId,
								}),
							),
						),
					).toEqual(before);
					expect(scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId))?.decision_revision).toBe(
						diagnostic?.decision_revision,
					);
					expect(capture.isCurrent()).toBe(true);
					bReturn.open();
					await scope.observeOriginal(bBootstrap);
					restoreFlush();
					restoreFlush = undefined;
					scope.sync(() => scope.runtime.request(scope.controllerId, false));
					await scope.observeOriginal(settleReal(scope.fixture));
					expect(
						scope.sync(() => scope.runtime.readDiagnostics(scope.controllerId))?.decision_revision,
					).toBeGreaterThan(before.decisionRevision);
				} catch (cause) {
					cleanupPhase2.state.primary = { cause };
				} finally {
					cleanupPhase2.attempt(() => {
						scope.stopRuntime(scope.runtime, true);
					});
					cleanupPhase2.attempt(() => {
						resume.open();
					});
					cleanupPhase2.attempt(() => {
						bReturn.open();
					});
					await cleanupPhase2.attemptAsync(async () => {
						await oldQueue?.catch(() => undefined);
					});
					await cleanupPhase2.attemptAsync(async () => {
						await bBootstrap?.catch(() => undefined);
					});
					await cleanupPhase2.attemptAsync(async () => {
						await scope.quiesce();
					});
					cleanupPhase2.attempt(() => {
						restoreFlush?.();
					});
					cleanupPhase2.attempt(() => {
						scope.restore(spyOwnership);
					});
					cleanupPhase2.attempt(() => {
						scope.database.subscribers.splice(scope.database.subscribers.indexOf(observer), 1);
					});
				}
				if (cleanupPhase2.state.primary !== undefined) throw cleanupPhase2.state.primary.cause;
				if (cleanupPhase2.state.secondary !== undefined) throw cleanupPhase2.state.secondary.cause;
			} catch (cause) {
				bodyFailure = { cause };
			}
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				await scope.cleanup();
			} catch (cause) {
				cleanupFailure = { cause };
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
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
				for (const evidence of fixtureState.installedQualifications.values())
					actualClaims.recordQualification(evidence);
				actualClaims.revokeAllQualifications();
				expect(actualClaims.diagnosticQualificationsCurrent(capture)).toBe(false);
			} finally {
				actualClaims.closeDiagnosticQualifications(capture);
			}
		});
		// BEGIN R87 real managed public-settle native outcome drafts (UNRUN)
		it.each(['before-send', 'after-send'] satisfies readonly ('before-send' | 'after-send')[])(
			'R87 public settle fences a held first read and preserves actual managed %s native outcome without a response recapture',
			async (boundary) => {
				const owner = runtime,
					originalComfort = comfort,
					source = database,
					claims = actualClaims,
					managed = fixture;
				const ownedControllerId = controllerId,
					ownedRelayId = relayId,
					ownedSensorId = sensorId;
				const onEntered = barrier(),
					onResume = barrier(),
					observed = barrier(),
					readEntered = barrier(),
					readResume = barrier();
				let retired = false,
					cleaned = false,
					armed = true;
				let primary: { cause: unknown } | undefined, cleanupFailure: { cause: unknown } | undefined;
				let prelude: Promise<void> | undefined,
					settlement: Promise<void> | undefined,
					operation: Promise<void> | undefined;
				const results: Awaited<ReturnType<ThermostatActuationAdapter['send']>>[] = [];
				const original: OriginalFunctions<Pick<VirtualThermostatTransportService, 'get'>> = managed.transport;
				const get = original.get;
				const getSpy = jest.spyOn(managed.transport, 'get').mockImplementation((...args) => {
					const adapter = get.call(managed.transport, ...args);
					if (!adapter) return null;
					const methods: OriginalFunctions<ThermostatActuationAdapter> = adapter,
						send = methods.send;
					return {
						...adapter,
						send: async (
							...sendArgs: Parameters<ThermostatActuationAdapter['send']>
						): ReturnType<ThermostatActuationAdapter['send']> => {
							const result = await send.call(adapter, ...sendArgs);
							if (sendArgs[0].property.id === ownedRelayId && sendArgs[0].value === true) {
								results.push(result);
								observed.open();
							}
							return result;
						},
					};
				});
				const installed = Object.getOwnPropertyDescriptor(managed.transport, 'get');
				const previousGate = managed.controls[boundary === 'before-send' ? 'beforeOn' : 'afterOn'];
				const nativeGate = async (id: string): Promise<void> => {
					if (id !== ownedRelayId) return;
					onEntered.open();
					await onResume.promise;
				};
				managed.controls[boundary === 'before-send' ? 'beforeOn' : 'afterOn'] = nativeGate;
				const reader: import('typeorm').EntitySubscriberInterface = {
					beforeQuery: async (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> => {
						if (
							!armed ||
							!event.query.startsWith('SELECT') ||
							!event.query.includes('devices_virtual_thermostat_configs') ||
							!event.parameters?.includes(ownedControllerId)
						)
							return;
						armed = false;
						readEntered.open();
						await readResume.promise;
					},
				};
				const attempt = (action: () => void): void => {
					try {
						action();
					} catch (cause) {
						cleanupFailure ??= { cause };
					}
				};
				const backstop = {
					retire: (): void => {
						retired = true;
					},
					cleanup: (): void => {
						if (cleaned) return;
						cleaned = true;
						retired = true;
						attempt(() => owner.onModuleDestroy());
						attempt(() => managed.revoke());
						onResume.open();
						readResume.open();
						const index = source.subscribers.indexOf(reader);
						if (index >= 0) source.subscribers.splice(index, 1);
						attempt(() => {
							const key = boundary === 'before-send' ? 'beforeOn' : 'afterOn';
							if (managed.controls[key] !== nativeGate) throw new Error('R87 foreign native gate retained');
							managed.controls[key] = previousGate;
						});
						attempt(() => {
							const actual = Object.getOwnPropertyDescriptor(managed.transport, 'get');
							if (
								!installed ||
								!actual ||
								actual.value !== installed.value ||
								actual.get !== installed.get ||
								actual.set !== installed.set ||
								actual.writable !== installed.writable ||
								actual.enumerable !== installed.enumerable ||
								actual.configurable !== installed.configurable
							)
								throw new Error('R87 foreign transport descriptor retained');
							getSpy.mockRestore();
						});
						unregisterCompletionObserver(backstop);
						if (cleanupFailure) throw cleanupFailure.cause;
					},
				};
				registerCompletionObserver(backstop);
				const live = (): void => {
					if (retired || runtime !== owner || database !== source || fixture !== managed)
						throw new Error('R87 managed original owner retired');
				};
				try {
					prelude = managed.report(ownedSensorId, 18);
					await prelude;
					live();
					await onEntered.promise;
					live();
					const command = await source.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
						controllerId: ownedControllerId,
						action: 'on',
						status: 'dispatching',
					});
					live();
					operation = owner['inFlight'].get(command.id);
					if (operation === undefined) throw new Error('R87 genuine original ON operation missing');
					const capture = claims.capture();
					expect(capture.isCurrent()).toBe(true);
					const fences = managed.controls.fences.length;
					source.subscribers.push(reader);
					settlement = originalComfort.settle(ownedControllerId);
					void settlement.catch(() => undefined); // original Promise remains the caller's rejection root
					expect(capture.isCurrent()).toBe(false);
					await readEntered.promise;
					live();
					expect(claims.capture().isCurrent()).toBe(false);
					onResume.open();
					await observed.promise;
					live();
					expect(results).toHaveLength(1);
					if (boundary === 'before-send') {
						expect(results[0]).toMatchObject({ outcome: 'refused' });
						expect(managed.controls.sends.filter((send) => send.property === ownedRelayId)).toHaveLength(0);
					} else {
						expect(results[0]).toEqual({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
						expect(managed.controls.sends.filter((send) => send.property === ownedRelayId)).toHaveLength(1);
					}
					expect(managed.controls.fences).toHaveLength(fences);
					owner.onModuleDestroy(); // native refused/UNKNOWN above precedes retirement
					readResume.open();
					await settlement;
					await operation; // only after releasing the first native read; never join O under its DB lease
					const journal = await source.manager.findBy(VirtualThermostatCommandEntity, {
						controllerId: ownedControllerId,
						action: 'on',
					});
					expect(journal).toHaveLength(1);
					expect(journal[0].id).toBe(command.id);
					expect(journal[0].status).toBe(boundary === 'before-send' ? 'cancelled' : 'unknown');
					expect(capture.isCurrent()).toBe(false);
					expect(managed.controls.errors).toEqual([]);
				} catch (cause) {
					primary = { cause };
				} finally {
					attempt(() => backstop.retire());
					attempt(() => backstop.cleanup());
					for (const pending of [prelude, settlement, operation])
						if (pending !== undefined) {
							try {
								await pending;
							} catch (cause) {
								cleanupFailure ??= { cause };
							}
						}
				}
				if (primary) throw primary.cause;
				if (cleanupFailure) throw cleanupFailure.cause;
			},
		);
		// END R87 real managed public-settle native outcome drafts

		it.each(['before-send', 'after-send'] as const)(
			'keeps original actual SDK %s outcome truthful when comfort entry waits on its first real read',
			async (boundary) => {
				const originalCase = currentFixtureCase;
				const originalSetup = originalCase?.setup;
				const originalWriter = mutationWriter;
				const originalControllerId = controllerId;
				const originalWriterContext = originalWriter['context'];
				const originalWriterTurns = originalWriter['turns'];
				const originalSource = Object.freeze({ runtime, database, fixture, relayId });
				const onEntered = barrier(),
					onResume = barrier(),
					resultObserved = barrier(),
					readEntered = barrier(),
					readResume = barrier();
				const outcomes: Awaited<ReturnType<ThermostatActuationAdapter['send']>>[] = [];
				const heldSend: {
					count: number;
					invalid: boolean;
					first?: Readonly<{
						packet: Parameters<ThermostatActuationAdapter['send']>[4];
						claimId: string;
						claimRevision: number;
					}>;
				} = { count: 0, invalid: false };
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
							// Passive metadata only: invalid identity fails the test, never the native operation.
							try {
								if (sendArgs[0].property.id === originalSource.relayId && sendArgs[0].value === true) {
									heldSend.count++;
									if (
										heldSend.count !== 1 ||
										originalCase === undefined ||
										originalCase.retired ||
										originalSetup === undefined ||
										originalSetup.retired ||
										originalSetup.caseOwner !== originalCase ||
										sendArgs[4] === undefined ||
										sendArgs[1].controllerId !== originalControllerId ||
										sendArgs[1].sourcePropertyId !== originalSource.relayId ||
										sendArgs[1].sourcePropertyIdentity !== originalSource.relayId
									)
										heldSend.invalid = true;
									else
										heldSend.first = Object.freeze({
											packet: sendArgs[4],
											claimId: sendArgs[1].id,
											claimRevision: sendArgs[1].revision,
										});
								}
							} catch {
								heldSend.invalid = true;
							}
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
						const context = originalWriterContext.getStore();
						const turn = context?.turn;
						const phase = turn === undefined ? undefined : originalWriterTurns.get(turn);
						const operation = context?.operation;
						const input = phase?.existingInput;
						if (
							originalCase === undefined ||
							originalCase.retired ||
							originalSetup === undefined ||
							originalSetup.retired ||
							context === undefined ||
							context.internal !== true ||
							operation === undefined ||
							phase === undefined ||
							phase.operation !== operation ||
							operation.phase !== 'BODY_OPEN' ||
							operation.existingReadonlyProbe !== true ||
							operation.failure !== undefined ||
							phase.phase !== 'READ_BEFORE' ||
							operation.manager !== event.manager ||
							operation.runner !== event.queryRunner ||
							input === undefined ||
							input.kind !== 'preset:v1' ||
							input.controllerId !== originalControllerId ||
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
					const selectedSend = heldSend.first;
					expect(heldSend.invalid).toBe(false);
					expect(heldSend.count).toBe(1);
					if (selectedSend === undefined || selectedSend.packet === undefined)
						throw new Error('Original held ON packet was not observed');
					const heldId = selectedSend.packet.commandId;
					// Never refresh this baseline after comfort entry or infer history from row order.
					const preEntryOn = await originalSource.database.manager.findBy(VirtualThermostatCommandEntity, {
						controllerId: originalControllerId,
						action: 'on',
					});
					expect(originalCase?.retired).toBe(false);
					expect(originalSetup?.retired).toBe(false);
					expect(heldSend.invalid).toBe(false);
					expect(heldSend.count).toBe(1);
					expect(preEntryOn.filter((row) => row.id === heldId)).toHaveLength(1);
					const priorOn = preEntryOn
						.filter((row) => row.id !== heldId)
						.map((row) =>
							Object.freeze({
								...row,
								preparedAt: row.preparedAt.getTime(),
								dispatchedAt: row.dispatchedAt?.getTime() ?? null,
								settledAt: row.settledAt?.getTime() ?? null,
							}),
						);
					for (const row of preEntryOn) {
						expect(row).toMatchObject({
							controllerId: originalControllerId,
							claimId: selectedSend.claimId,
							claimRevision: selectedSend.claimRevision,
							configurationRevision: expected.expected_revision,
							action: 'on',
						});
						if (row.id === heldId) {
							expect(row.status).toBe('dispatching');
							expect(row.dispatchedAt).not.toBeNull();
							expect(row.settledAt).toBeNull();
							expect(row.fault).toBeNull();
						} else {
							expect(row).toMatchObject({
								status: 'cancelled',
								dispatchedAt: null,
								settledAt: null,
								fault: null,
								proofId: null,
							});
						}
					}
					const originalCapture = actualClaims.capture();
					expect(originalCapture.isCurrent()).toBe(true);
					// Positive reachability is beyond matched real SDK inspection/status and at actual HTTP ON pre/post onSend.
					expect(fixture.controls.sends.filter((send) => send.property === relayId)).toHaveLength(
						boundary === 'before-send' ? 0 : 1,
					);
					const fences = fixture.controls.fences.length;
					mutation = comfort.select(controllerId, expected, 'eco', false);
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
					const journal = await originalSource.database.manager.findBy(VirtualThermostatCommandEntity, {
						controllerId: originalControllerId,
						action: 'on',
					});
					expect(heldSend.invalid).toBe(false);
					expect(heldSend.count).toBe(1);
					expect(journal.map((row) => row.id).sort()).toEqual([...priorOn.map((row) => row.id), heldId].sort());
					for (const prior of priorOn) {
						const row = journal.find((entry) => entry.id === prior.id);
						if (row === undefined) throw new Error('Pre-entry ON history disappeared');
						expect({
							...row,
							preparedAt: row.preparedAt.getTime(),
							dispatchedAt: row.dispatchedAt?.getTime() ?? null,
							settledAt: row.settledAt?.getTime() ?? null,
						}).toEqual(prior);
					}
					const held = journal.find((row) => row.id === heldId);
					if (held === undefined) throw new Error('Original held ON journal row disappeared');
					expect(held).toMatchObject({
						id: heldId,
						controllerId: originalControllerId,
						claimId: selectedSend.claimId,
						claimRevision: selectedSend.claimRevision,
						configurationRevision: expected.expected_revision,
						action: 'on',
					});
					expect(held.status).toBe(boundary === 'before-send' ? 'cancelled' : 'unknown');
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
		let baselineIds: readonly string[] = Object.freeze<string[]>([]);
		// BEGIN R63 explicit original OFF journal baseline; no case callback is installed yet.
		{
			const baseline = Object.freeze(
				(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map((row) =>
					Object.freeze({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }),
				),
			);
			baselineIds = Object.freeze(baseline.map((row) => row.id));
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
				baseline.map((row) => ({ ...row, status: 'confirmed' })).sort((left, right) => left.id.localeCompare(right.id)),
			);
			expect(settledBaseline.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
		}
		// END R63 explicit original OFF journal baseline.
		// P0 is the ENTIRE completed baseline transcript, including empty calls and original order/multiplicity.
		const P0 = Object.freeze(fixtureState.reconciledCommandIds.map((ids) => Object.freeze([...ids])));
		for (const ids of P0) {
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.every((id) => baselineIds.includes(id))).toBe(true);
		}

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
		fixtureState.proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		const nativeRunners = new Map<object, NonNullable<ReturnType<typeof entry.scope.getStore>>>();
		let rollback = true,
			retired = false;
		let primary: { cause: unknown } | undefined;
		const subscriber = {
			listenTo: () => VirtualThermostatBranchRuntimeEntity,
			beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
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
				unregisterCompletionObserver(backstop);
			},
		};
		registerCompletionObserver(backstop);
		database.subscribers.push(subscriber);
		try {
			await expect(entry.startAfterOriginalOff(claim, command)).rejects.toThrow('fixture settlement rollback');
			expect(retire).not.toHaveBeenCalled();
			const rollbackK = entry.namedIds(command);
			const rolledBack = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(rolledBack.map((row) => row.id).sort()).toEqual([...baselineIds, ...rollbackK].sort());
			expect(
				rolledBack
					.filter((row) => rollbackK.includes(row.id))
					.map((row) => ({ id: row.id, status: row.status }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			).toEqual(
				rollbackK.map((id) => ({ id, status: 'accepted' })).sort((left, right) => left.id.localeCompare(right.id)),
			);
			for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
			expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
				[...P0, rollbackK].map((ids) => [...ids].sort()),
			);
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'accepted',
			);
			await entry.startAfterOriginalOff(claim, command);
			expect((await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status).toBe(
				'confirmed',
			);
			const K = entry.namedIds(command);
			expect(new Set(K).size).toBe(2);
			const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			expect(journal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
			expect(
				journal
					.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			).toEqual(
				[
					...baselineIds.map((id) => ({ id, claimId: claim.id, action: 'off', status: 'confirmed' })),
					{ id: command.id, claimId: claim.id, action: 'on', status: 'confirmed' },
					{ id: K[1], claimId: claim.id, action: 'off', status: 'confirmed' },
				].sort((left, right) => left.id.localeCompare(right.id)),
			);
			expect(journal.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
			expect(K).toBe(rollbackK);
			expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual([[[...K].sort()]]);
			for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
			expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
				[...P0, K, K].map((ids) => [...ids].sort()),
			);
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
		let baselineIds: readonly string[] = Object.freeze<string[]>([]);
		// BEGIN R63 explicit original OFF journal baseline; no case callback is installed yet.
		{
			const baseline = Object.freeze(
				(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map((row) =>
					Object.freeze({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }),
				),
			);
			baselineIds = Object.freeze(baseline.map((row) => row.id));
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
				baseline.map((row) => ({ ...row, status: 'confirmed' })).sort((left, right) => left.id.localeCompare(right.id)),
			);
			expect(settledBaseline.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
		}
		// END R63 explicit original OFF journal baseline.
		// P0 is the ENTIRE completed baseline transcript, including empty calls and original order/multiplicity.
		const P0 = Object.freeze(fixtureState.reconciledCommandIds.map((ids) => Object.freeze([...ids])));
		for (const ids of P0) {
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.every((id) => baselineIds.includes(id))).toBe(true);
		}

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
		const retire = jest.fn<void, [readonly string[]]>(() => {
			throw new Error('optional metadata only');
		});
		owned.assertLive();
		fixtureState.proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
		await entry.startAfterOriginalOff(claim, command);

		const K = entry.namedIds(command);
		expect(new Set(K).size).toBe(2);
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		expect(journal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
		expect(
			journal
				.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
				.sort((left, right) => left.id.localeCompare(right.id)),
		).toEqual(
			[
				...baselineIds.map((id) => ({ id, claimId: claim.id, action: 'off', status: 'confirmed' })),
				{ id: command.id, claimId: claim.id, action: 'on', status: 'confirmed' },
				{ id: K[1], claimId: claim.id, action: 'off', status: 'confirmed' },
			].sort((left, right) => left.id.localeCompare(right.id)),
		);
		expect(journal.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
		expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual([[[...K].sort()]]);
		for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
		expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
			[...P0, K].map((ids) => [...ids].sort()),
		);
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
		fixtureState.packetTick = useThermostatPacketClock();
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
		const before = fixtureState.proofCalls;
		after = oldProof.observedAt;
		expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'accepted' })).toBe(
			0,
		);
		fixtureState.packetTick();
		runtime.request(controllerId);
		await settle();
		expect(fixtureState.proofCalls).toBe(before + 1);
		expect(internal.reconciled.get(`${claim.id}:${claim.revision}`).observedAt).toBeGreaterThan(after);
		expect(fixtureState.sentTargets.some((entry) => entry.on)).toBe(false);
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
			let baselineIds: readonly string[] = Object.freeze<string[]>([]);
			// BEGIN R63 explicit original OFF journal baseline; no case callback is installed yet.
			{
				const baseline = Object.freeze(
					(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map((row) =>
						Object.freeze({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }),
					),
				);
				baselineIds = Object.freeze(baseline.map((row) => row.id));
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
			// P0 is the ENTIRE completed baseline transcript, including empty calls and original order/multiplicity.
			const P0 = Object.freeze(fixtureState.reconciledCommandIds.map((ids) => Object.freeze([...ids])));
			for (const ids of P0) {
				expect(new Set(ids).size).toBe(ids.length);
				expect(ids.every((id) => baselineIds.includes(id))).toBe(true);
			}
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
			fixtureState.proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
			let enter: () => void = () => undefined;
			let rejectObservation: (error: unknown) => void = () => undefined;
			let committedStatus: VirtualThermostatCommandEntity['status'] | undefined;
			let committedJournal:
				| readonly Readonly<{ id: string; claimId: string; action: string; status: string }>[]
				| undefined;
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
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): void => {
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
						committedJournal = Object.freeze(
							(await event.queryRunner.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).map((row) =>
								Object.freeze({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }),
							),
						);
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
					unregisterCompletionObserver(backstop);
				},
			};
			registerCompletionObserver(backstop);
			try {
				const pending = entry.startAfterOriginalOff(claim, command);
				// Attach both outcomes before releasing the controlled commit gate.
				const outcome: Promise<unknown> = pending.then<unknown, unknown>(
					() => null,
					(error: unknown) => error,
				);
				await entered;
				if (retired) throw new Error('Original ACK owner retired');
				expect(retire).not.toHaveBeenCalled();
				expect(committedStatus).toBe('confirmed');
				const K = entry.namedIds(command);
				expect(new Set(K).size).toBe(2);
				if (committedJournal === undefined) throw new Error('Original same-runner committed journal missing');
				expect(committedJournal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
				expect(
					committedJournal
						.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
						.sort((left, right) => left.id.localeCompare(right.id)),
				).toEqual(
					[
						...baselineIds.map((id) => ({ id, claimId: claim.id, action: 'off', status: 'confirmed' })),
						{ id: command.id, claimId: claim.id, action: 'on', status: 'confirmed' },
						{ id: K[1], claimId: claim.id, action: 'off', status: 'confirmed' },
					].sort((left, right) => left.id.localeCompare(right.id)),
				);
				expect(committedJournal.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
				for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
				expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
					[...P0, K].map((ids) => [...ids].sort()),
				);
				release();
				const error = await outcome;
				if (retired) throw new Error('Original ACK owner retired');
				if (mode === 'held acknowledgement') {
					expect(error).toBeNull();
					expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual([[[...K].sort()]]);
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
	// BEGIN R68 named original OFF completion proofs (SOURCE ONLY; all four expanded rows UNRUN).
	describe('R68 named original OFF completion', () => {
		const prepareCase = async () => {
			const owned = initialFixtureOwner();
			const { owner, source, id, settle } = owned;
			const entry = observeOriginalReconciliation(owner);
			await settle();
			const claim = await source.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: id });
			const baseline = Object.freeze(
				(await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id })).map((row) =>
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
			const settled = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
			expect(
				settled
					.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
					.sort((a, b) => a.id.localeCompare(b.id)),
			).toEqual(baseline.map((row) => ({ ...row, status: 'confirmed' })).sort((a, b) => a.id.localeCompare(b.id)));
			expect(settled.filter((row) => row.status !== 'confirmed' && row.status !== 'cancelled')).toEqual([]);
			const baselineIds = Object.freeze(baseline.map((row) => row.id));
			const P0 = Object.freeze(fixtureState.reconciledCommandIds.map((ids) => Object.freeze([...ids])));
			for (const ids of P0) {
				expect(new Set(ids).size).toBe(ids.length);
				expect(ids.every((key) => baselineIds.includes(key))).toBe(true);
			}
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
			const retire = jest.fn<void, [readonly string[]]>();
			owned.assertLive();
			fixtureState.proofMutation = (proof) => ({ ...proof, retireConfirmedCommandIds: retire });
			return { owned, entry, claim, command, retire, baselineIds, P0 };
		};
		// Only the two existing held rows opt in. This observes send entry; it does not authorize native work.
		const observeHeldOffSend = (
			owned: ReturnType<typeof initialFixtureOwner>,
			entry: ReturnType<typeof observeOriginalReconciliation>,
			claim: VirtualThermostatActuatorClaimEntity,
			seed: VirtualThermostatCommandEntity,
		) => {
			const owner = owned.owner,
				lifecycle = owner['lifecycle'];
			if (fixtureState.heldOffSendObserver !== null || lifecycle === undefined || !owner['active'])
				throw new Error('Original held OFF send observation unavailable');
			let closed = false,
				observed = false,
				restored = false;
			let observationFailure: { cause: unknown } | undefined;
			let resolveEntry: () => void = () => undefined;
			let rejectEntry: (cause: unknown) => void = () => undefined;
			const entered = new Promise<void>((resolve, reject) => {
				resolveEntry = resolve;
				rejectEntry = reject;
			});
			void entered.then(
				() => undefined,
				() => undefined,
			); // Partial setup/timeout never leaves an unhandled side rejection.
			const fail = (cause: unknown): void => {
				observationFailure ??= { cause };
				rejectEntry(cause);
			};
			const observer: HeldOffSendObserver = Object.freeze({
				fail,
				observe: (
					target: Parameters<ThermostatActuationAdapter['send']>[0],
					member: Parameters<ThermostatActuationAdapter['send']>[1],
					packet: Parameters<ThermostatActuationAdapter['send']>[4],
				): void => {
					try {
						const K = entry.namedIds(seed); // Already frozen at actual original O insertion, independently of send/proof callbacks.
						const command = owner['inFlightCommands'].get(K[1]);
						const job = command === undefined ? undefined : owner['offJobs'].get(command);
						const originalTarget = job?.context.targets.get(claim.id);
						if (
							closed ||
							observed ||
							fixtureState.heldOffSendObserver !== observer ||
							owner['lifecycle'] !== lifecycle ||
							!owner['active'] ||
							owner['dataSource'] !== owned.source ||
							packet?.commandId !== K[1] ||
							command === undefined ||
							job === undefined ||
							job.command !== command ||
							job.operation !== owner['inFlight'].get(K[1]) ||
							command.action !== 'off' ||
							command.controllerId !== owned.id ||
							command.claimId !== claim.id ||
							command.claimRevision !== claim.revision ||
							member !== job.context.claims.find((candidate) => candidate.id === claim.id) ||
							originalTarget === undefined ||
							target.device !== originalTarget.device ||
							target.channel !== originalTarget.channel ||
							target.property !== originalTarget.property
						)
							throw new Error('Held OFF send entry was foreign, closed or ambiguous');
						observed = true;
						resolveEntry();
					} catch (cause) {
						fail(cause);
					}
				},
			});
			fixtureState.heldOffSendObserver = observer;
			const retire = (): void => {
				if (closed) return;
				closed = true;
				rejectEntry(new Error('Original held OFF send observation retired'));
			};
			const backstop = {
				entered,
				retire,
				cleanup: (): void => {
					retire();
					if (restored) return;
					if (owner['active'] || owner['lifecycle'] !== undefined) throw new Error('Held OFF send owner not retired');
					if (fixtureState.heldOffSendObserver !== observer)
						throw new Error('Held OFF send observer replaced by foreign owner');
					fixtureState.heldOffSendObserver = null;
					restored = true;
					unregisterCompletionObserver(backstop);
					if (observationFailure !== undefined) throw observationFailure.cause;
				},
			};
			registerCompletionObserver(backstop); // Covers partial case setup before its gate backstop exists.
			return backstop;
		};
		it('holds the actual named OFF before confirmation and retires the complete K only after known ACK', async () => {
			const { owned, entry, claim, command, retire, baselineIds, P0 } = await prepareCase();
			const { owner, source, id } = owned;
			let release: () => void = () => undefined;
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			const sendEntry = observeHeldOffSend(owned, entry, claim, command);
			fixtureState.offGate = held;
			const attemptsBefore = Object.freeze([...fixtureState.actuationAttempts]);
			let primary: { cause: unknown } | undefined;
			const backstop = {
				retire: (): void => {
					sendEntry.retire();
					try {
						owner.onModuleDestroy();
					} finally {
						release();
					}
				},
				cleanup: (): void => {
					let failure: { cause: unknown } | undefined;
					try {
						backstop.retire();
					} catch (cause) {
						failure = { cause };
					}
					try {
						sendEntry.cleanup();
					} catch (cause) {
						failure ??= { cause };
					}
					unregisterCompletionObserver(backstop);
					if (failure !== undefined) throw failure.cause;
				},
			};
			registerCompletionObserver(backstop);
			try {
				const pending = entry.startAfterOriginalOff(claim, command);
				const K = await entry.namedOpening();
				await sendEntry.entered;
				const heldJournal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				expect(fixtureState.actuationAttempts).toEqual([...attemptsBefore, false]); // Real send has entered the existing OFF gate.
				expect(heldJournal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
				expect(
					heldJournal
						.filter((row) => K.includes(row.id))
						.map((row) => ({ id: row.id, action: row.action, status: row.status }))
						.sort((a, b) => a.id.localeCompare(b.id)),
				).toEqual(
					[
						{ id: command.id, action: 'on', status: 'accepted' },
						{ id: K[1], action: 'off', status: 'dispatching' },
					].sort((a, b) => a.id.localeCompare(b.id)),
				);
				expect(retire).not.toHaveBeenCalled();
				expect(fixtureState.reconciledCommandIds).toEqual(P0);
				release();
				await pending;
				expect(entry.namedInspectionCount()).toBeLessThanOrEqual(2);
				expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual([[[...K].sort()]]);
				for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
				expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
					[...P0, K].map((ids) => [...ids].sort()),
				);
				const journal = await source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: id });
				expect(journal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
				expect(journal.filter((row) => K.includes(row.id)).map((row) => row.status)).toEqual([
					'confirmed',
					'confirmed',
				]);
				expect(fixtureState.actuationAttempts.every((on) => !on)).toBe(true);
			} catch (cause) {
				primary = { cause };
			} finally {
				try {
					backstop.cleanup();
				} catch (cause) {
					primary ??= { cause };
				}
				if (fixtureState.offGate === held) fixtureState.offGate = null;
			}
			if (primary !== undefined) throw primary.cause;
		});
		const failedOffOutcomes: readonly ('refused' | 'unknown')[] = ['refused', 'unknown'];
		it.each(failedOffOutcomes)(
			'rejects the test receipt without S1 while preserving exact native effects after the actual OFF is %s',
			async (outcome) => {
				const { owned, entry, claim, command, retire, baselineIds, P0 } = await prepareCase();
				// Predeclare BOTH complete native-effect grammars; neither K nor a branch choice comes from a callback.
				type NativeEffects = Readonly<{
					proof: readonly (readonly string[])[];
					retirement: readonly (readonly (readonly string[])[])[];
					journal: readonly Readonly<{ id: string; claimId: string; action: string; status: string }>[];
				}>;
				const expectedEffects = (
					K: readonly string[],
				): Readonly<{ noSettlement: NativeEffects; knownAcknowledgement: NativeEffects }> =>
					Object.freeze({
						noSettlement: Object.freeze({
							proof: P0,
							retirement: Object.freeze([]),
							journal: [
								...baselineIds.map((id) => ({ id, claimId: claim.id, action: 'off', status: 'confirmed' })),
								{ id: command.id, claimId: claim.id, action: 'on', status: 'accepted' },
								{ id: K[1], claimId: claim.id, action: 'off', status: 'unknown' },
							],
						}),
						knownAcknowledgement: Object.freeze({
							proof: Object.freeze([...P0, K]),
							retirement: Object.freeze([Object.freeze([K])]),
							journal: [
								...baselineIds.map((id) => ({ id, claimId: claim.id, action: 'off', status: 'confirmed' })),
								{ id: command.id, claimId: claim.id, action: 'on', status: 'confirmed' },
								{ id: K[1], claimId: claim.id, action: 'off', status: 'confirmed' },
							],
						}),
					});
				fixtureState.offOutcome = outcome;
				await expect(entry.startAfterOriginalOff(claim, command)).rejects.toThrow(
					'Named OFF did not finish an accepted saved native outcome',
				);
				const K = entry.namedIds(command);
				expect(new Set(K).size).toBe(2);
				expect(entry.namedInspectionCount()).toBe(1);
				const journal = await owned.source.manager.findBy(VirtualThermostatCommandEntity, { controllerId: owned.id });
				const originalOn = journal.find((row) => row.id === command.id);
				const grammars = expectedEffects(K);
				const grammar =
					originalOn?.status === 'accepted'
						? grammars.noSettlement
						: originalOn?.status === 'confirmed'
							? grammars.knownAcknowledgement
							: undefined;
				if (grammar === undefined) throw new Error('Failed OFF had an undeclared native journal result');
				expect(journal.map((row) => row.id).sort()).toEqual([...baselineIds, ...K].sort());
				expect(
					journal
						.map((row) => ({ id: row.id, claimId: row.claimId, action: row.action, status: row.status }))
						.sort((a, b) => a.id.localeCompare(b.id)),
				).toEqual([...grammar.journal].sort((a, b) => a.id.localeCompare(b.id)));
				for (const [index, ids] of P0.entries()) expect(fixtureState.reconciledCommandIds[index]).toEqual(ids);
				expect(fixtureState.reconciledCommandIds.map((ids) => [...ids].sort())).toEqual(
					grammar.proof.map((ids) => [...ids].sort()),
				);
				expect(retire.mock.calls.map((call) => call.map((ids) => [...ids].sort()))).toEqual(
					grammar.retirement.map((call) => call.map((ids) => [...ids].sort())),
				);
				expect(fixtureState.actuationAttempts.every((on) => !on)).toBe(true);
			},
		);
		it('cannot let a retired A completion settle B or restore a foreign descriptor', async () => {
			const { owned, entry, claim, command, retire } = await prepareCase();
			const A = owned.owner;
			const sendEntry = observeHeldOffSend(owned, entry, claim, command);
			const attemptsBeforeA = Object.freeze([...fixtureState.actuationAttempts]);
			let releaseA: () => void = () => undefined,
				releaseB: () => void = () => undefined;
			let enterB: () => void = () => undefined;
			const heldA = new Promise<void>((resolve) => {
				releaseA = resolve;
			});
			const heldB = new Promise<void>((resolve) => {
				releaseB = resolve;
			});
			const enteredB = new Promise<void>((resolve) => {
				enterB = resolve;
			});
			let B: VirtualThermostatRuntimeService | undefined;
			let primary: { cause: unknown } | undefined;
			let beforeB: (() => Promise<void>) | undefined;
			const map = A['inFlight'];
			const installedSet = Object.getOwnPropertyDescriptor(map, 'set');
			if (installedSet === undefined) throw new Error('Original A instance Map observer missing');
			const foreignSet = { ...installedSet, enumerable: !installedSet.enumerable };
			const backstop = {
				retire: (): void => {
					let failure: { cause: unknown } | undefined;
					sendEntry.retire();
					try {
						A.onModuleDestroy();
					} catch (cause) {
						failure = { cause };
					}
					try {
						B?.onModuleDestroy();
					} catch (cause) {
						failure ??= { cause };
					}
					releaseA();
					releaseB();
					if (fixtureState.beforeProof === beforeB) fixtureState.beforeProof = null;
					if (failure !== undefined) throw failure.cause;
				},
				cleanup: (): void => {
					let failure: { cause: unknown } | undefined;
					try {
						backstop.retire();
					} catch (cause) {
						failure = { cause };
					}
					try {
						sendEntry.cleanup();
					} catch (cause) {
						failure ??= { cause };
					}
					unregisterCompletionObserver(backstop);
					if (failure !== undefined) throw failure.cause;
				},
			};
			registerCompletionObserver(backstop);
			try {
				fixtureState.offGate = heldA;
				const pendingA = entry.startAfterOriginalOff(claim, command);
				const outcomeA = pendingA.then(
					() => ({ fulfilled: true, cause: undefined }),
					(cause: unknown) => ({ fulfilled: false, cause }),
				);
				const originalAK = await entry.namedOpening();
				await sendEntry.entered;
				const heldJournalA = await owned.source.manager.findBy(VirtualThermostatCommandEntity, {
					controllerId: owned.id,
				});
				expect(heldJournalA.find((row) => row.id === command.id)?.status).toBe('accepted');
				expect(fixtureState.actuationAttempts).toEqual([...attemptsBeforeA, false]);
				expect(heldJournalA.find((row) => row.id === entry.namedIds(command)[1])?.status).toBe('dispatching');
				sendEntry.retire();
				A.onModuleDestroy(); // Genuine old lifecycle retirement, not a currentness mock.
				sendEntry.cleanup();
				fixtureState.offGate = null; // A already awaits heldA; B uses its actual unheld native path.
				beforeB = async (): Promise<void> => {
					enterB();
					await heldB;
				};
				fixtureState.beforeProof = beforeB;
				B = makeRuntime();
				installInitialRuntimeObservers(B, owned.source, owned.id);
				fixtureOwner.runtime = runtime = B;
				const startingB = B.onApplicationBootstrap();
				void startingB.then(
					() => undefined,
					() => undefined,
				);
				await enteredB; // Actual B proof call, not a fabricated service result.
				const lifecycleB = B['lifecycle'],
					contextB = B['contexts'].get(owned.id);
				const descriptorB = Object.getOwnPropertyDescriptor(B, 'serviceFeedback');
				let publicBCompleted = false;
				const publicB = B.inspect(owned.id);
				void publicB.then(
					() => {
						publicBCompleted = true;
					},
					() => {
						publicBCompleted = true;
					},
				);
				Object.defineProperty(map, 'set', foreignSet);
				expect(() => entry.cleanupAfterRetirement()).toThrow('Original entry observer replaced by foreign owner');
				expect(Object.getOwnPropertyDescriptor(map, 'set')).toEqual(foreignSet);
				releaseA();
				expect((await outcomeA).fulfilled).toBe(false);
				expect(entry.namedInspectionCount()).toBe(1);
				expect(entry.namedIds(command)).toBe(originalAK);
				expect(retire).not.toHaveBeenCalled();
				expect(
					(await owned.source.manager.findOneByOrFail(VirtualThermostatCommandEntity, { id: command.id })).status,
				).toBe('accepted');
				expect(publicBCompleted).toBe(false);
				expect(B['lifecycle']).toBe(lifecycleB);
				expect(B['contexts'].get(owned.id)).toBe(contextB);
				expect(Object.getOwnPropertyDescriptor(B, 'serviceFeedback')).toEqual(descriptorB);
				expect(Object.getOwnPropertyDescriptor(map, 'set')).toEqual(foreignSet);
				releaseB();
				await startingB;
				await publicB;
				expect(fixtureState.actuationAttempts.every((on) => !on)).toBe(true);
			} catch (cause) {
				primary = { cause };
			} finally {
				try {
					backstop.cleanup();
				} catch (cause) {
					primary ??= { cause };
				}
				if (fixtureState.offGate === heldA) fixtureState.offGate = null;
				try {
					const current = Object.getOwnPropertyDescriptor(map, 'set');
					if (
						current?.value === foreignSet.value &&
						current.get === foreignSet.get &&
						current.set === foreignSet.set &&
						current.configurable === foreignSet.configurable &&
						current.enumerable === foreignSet.enumerable &&
						current.writable === foreignSet.writable
					)
						Object.defineProperty(map, 'set', installedSet); // Relinquish only our deliberate foreign rewrite after both owners retired.
				} catch (cause) {
					primary ??= { cause };
				}
				try {
					entry.cleanupAfterRetirement();
				} catch (cause) {
					primary ??= { cause };
				}
			}
			if (primary !== undefined) throw primary.cause;
		});
	});
	// END R68 named original OFF completion proofs.
	// R227: eight expanded lifetime negatives, all UNRUN. No native authority is manufactured.
	describe('R227 exact issued setup and cleanup ownership', () => {
		const freshSetup = async () => {
			const owner = currentFixtureCase;
			if (owner === undefined || owner.setup === undefined) throw new Error('Case setup missing');
			assertFixtureCaseLive(owner);
			await teardownFixtureSetup(owner.setup);
			assertFixtureCaseLive(owner);
			return { owner, setup: beginFixtureSetup(owner) };
		};
		it('retains issued A setup and orphan cleanup while genuine B adopts before A resumes', async () => {
			const { owner, setup: a } = await freshSetup(),
				entered = fixtureGate(),
				release = fixtureGate();
			let sourceA: SqliteDataSource | undefined, directoryA: string | undefined;
			const selected = 'SELECT "id", "revision" FROM "devices_virtual_graph_revision" ORDER BY "id"';
			const observer = {
				beforeQuery: (event: import('typeorm').BeforeQueryEvent<unknown>): Promise<void> | void => {
					if (event.query === selected) {
						entered.open();
						return release.promise;
					}
				},
			};
			const backstop = {
				retire: release.open,
				cleanup: (): void => {
					release.open();
					unregisterCompletionObserver(backstop);
				},
			};
			registerCaseBackstop(owner, backstop);
			const pendingA = fixtureOutcome(
				completeFixtureSetup(a, {
					install: (source): void => {
						source.subscribers.push(observer);
					},
					issued: (): void => undefined,
					sourceAllocated: (source, directory): void => {
						sourceA = source;
						directoryA = directory;
					},
				}),
			);
			try {
				await entered.promise;
				expect(a.completion).toBeDefined();
				expect(a.issued.size).toBeGreaterThan(0);
				await teardownFixtureSetup(a);
				const cleanup = a.cleanup;
				expect(cleanup).toBeDefined();
				expect(a.completed).toBe(false);
				expect(sourceA?.isInitialized).toBe(true);
				const bSetup = beginFixtureSetup(owner),
					b = await completeFixtureSetup(bSetup);
				expect(fixtureOwner).toBe(b);
				release.open();
				const result = await pendingA;
				expect(result.fulfilled).toBe(false);
				if (result.fulfilled) throw new Error('Retired A adopted');
				const closed = await fixtureOutcome(teardownFixtureSetup(a));
				expect(closed.fulfilled).toBe(false);
				if (closed.fulfilled) throw new Error('A primary missing');
				expect(closed.cause).toBe(result.cause);
				expect(a.cleanup).toBe(cleanup);
				expect(a.completed).toBe(true);
				expect(sourceA?.isInitialized).toBe(false);
				if (directoryA === undefined) throw new Error('A directory missing');
				await expect(readFile(join(directoryA, 'runtime.sqlite'))).rejects.toThrow();
				expect(b.database.isInitialized).toBe(true);
				expect(currentFixtureCase?.setup).toBe(bSetup);
				expect(runtime).toBe(b.runtime);
			} finally {
				release.open();
				await pendingA;
				backstop.cleanup();
			}
		});
		it.each(['initialize', 'compile'] satisfies readonly ('initialize' | 'compile')[])(
			'closes exact partial resources after original %s rejection without adopting its result',
			async (kind) => {
				const { setup } = await freshSetup(),
					primary = new Error('Original provider construction failed');
				let partial: SqliteDataSource | undefined, originalDirectory: string | undefined;
				const result = await fixtureOutcome(
					completeFixtureSetup(setup, {
						install: (): void => undefined,
						issued: (): void => undefined,
						sourceAllocated: (source, directory): void => {
							partial = source;
							originalDirectory = directory;
							if (kind === 'initialize') source.setOptions({ database: directory }); // Real SQLite open of a directory must reject.
						},
						builderCreated: (builder): void => {
							if (kind === 'compile')
								builder.overrideProvider(StorageService).useFactory({
									factory: () => {
										throw primary;
									},
								});
						},
					}),
				);
				expect(result.fulfilled).toBe(false);
				if (result.fulfilled) throw new Error('Failed original setup adopted');
				if (kind === 'compile') expect(result.cause).toBe(primary);
				expect(setup.failure?.cause).toBe(result.cause);
				expect(setup.adopted).toBeUndefined();
				expect(setup.completed).toBe(true);
				expect(partial?.isInitialized).toBe(false);
				if (originalDirectory === undefined) throw new Error('Partial directory missing');
				await expect(readFile(join(originalDirectory, 'runtime.sqlite'))).rejects.toThrow();
				const cleaned = await fixtureOutcome(teardownFixtureSetup(setup));
				expect(cleaned.fulfilled).toBe(false);
				if (cleaned.fulfilled) throw new Error('Partial primary lost');
				expect(cleaned.cause).toBe(result.cause);
			},
		);
		it('publishes the same cleanup before original module close can reenter', async () => {
			const owned = fixtureOwner,
				methods: OriginalFunctions<Pick<TestingModule, 'close'>> = owned.mutationPipeline;
			const close = methods.close;
			let reentered: Promise<void> | undefined;
			const observed = jest.spyOn(owned.mutationPipeline, 'close').mockImplementation(() => {
				reentered = closeRuntimeFixture(owned);
				return close.call(owned.mutationPipeline);
			});
			const first = closeRuntimeFixture(owned),
				second = closeRuntimeFixture(owned);
			expect(second).toBe(first);
			await first;
			expect(reentered).toBe(first);
			expect(observed).toHaveBeenCalledTimes(1);
			expect(owned.database.isInitialized).toBe(false);
			observed.mockRestore();
		});
		it('retains a foreign E2 descriptor and reports restoration Q after E1 consumers retire', async () => {
			const setup = requireFixtureSetup(),
				target = { note: (): void => undefined };
			const original = Object.getOwnPropertyDescriptor(target, 'note');
			const e1 = { configurable: true, enumerable: true, writable: true, value: (): void => undefined };
			const e2 = { configurable: true, enumerable: true, writable: true, value: (): void => undefined };
			let retired = false;
			const observer = {
				retire: (): void => {
					retired = true;
				},
				cleanup: (): void => {
					expect(retired).toBe(true);
					unregisterCompletionObserver(observer);
					restoreOriginalEntry(target, 'note', e1, original);
				},
			};
			registerCompletionObserver(observer);
			Object.defineProperty(target, 'note', e1);
			Object.defineProperty(target, 'note', e2);
			const result = await fixtureOutcome(teardownFixtureSetup(setup));
			expect(result.fulfilled).toBe(false);
			if (result.fulfilled) throw new Error('Foreign descriptor restoration accepted');
			expect(result.cause).toEqual(new Error('Original entry observer replaced by foreign owner'));
			expect(Object.getOwnPropertyDescriptor(target, 'note')).toEqual(e2);
			expect(setup.adopted?.database.isInitialized).toBe(false);
			const again = await fixtureOutcome(teardownFixtureSetup(setup));
			expect(again.fulfilled).toBe(false);
			expect(Object.getOwnPropertyDescriptor(target, 'note')).toEqual(e2);
		});
		it.each<Readonly<{ kind: string; primary: unknown }>>([
			{ kind: 'undefined', primary: undefined },
			{ kind: 'null', primary: null },
			{ kind: 'false', primary: false },
		])('keeps present setup $kind P ahead of cleanup Q and still closes partial resources', async ({ primary }) => {
			const { setup } = await freshSetup(),
				q = new Error('Original cleanup Q');
			let cleanupAttempted = false,
				directory: string | undefined;
			const observer = {
				retire: (): void => undefined,
				cleanup: (): void => {
					cleanupAttempted = true;
					unregisterCompletionObserver(observer);
					throw q;
				},
			};
			const result = await fixtureOutcome(
				completeFixtureSetup(setup, {
					install: (): void => undefined,
					issued: (): void => undefined,
					sourceAllocated: (_source, allocatedDirectory): void => {
						directory = allocatedDirectory;
						registerCompletionObserver(observer);
						throw primary; // Deliberate synchronous SETUP-hook P, not native P or ACK.
					},
				}),
			);
			expect(result.fulfilled).toBe(false);
			if (result.fulfilled) throw new Error('Present primary lost');
			expect(result.cause).toBe(primary);
			const cleaned = await fixtureOutcome(teardownFixtureSetup(setup));
			expect(cleaned.fulfilled).toBe(false);
			if (cleaned.fulfilled) throw new Error('Cleanup replaced primary');
			expect(cleaned.cause).toBe(primary);
			expect(setup.cleanupFailure?.cause).toBe(q);
			expect(cleanupAttempted).toBe(true);
			if (directory === undefined) throw new Error('Partial directory missing');
			await expect(readFile(join(directory, 'runtime.sqlite'))).rejects.toThrow();
		});
	});
	it('R241 attempts both original owner cleanup observers before SQLite closes when the first removes itself', async () => {
		const owned = fixtureOwner;
		const attempted: string[] = [];
		const databaseOpenDuringCleanup: boolean[] = [];
		const first = {
			retire: (): void => {
				attempted.push('retire:first');
			},
			cleanup: (): void => {
				attempted.push('cleanup:first');
				databaseOpenDuringCleanup.push(owned.database.isInitialized);
				removeOwnedFixtureObserver(owned, first);
			},
		};
		const second = {
			retire: (): void => {
				attempted.push('retire:second');
			},
			cleanup: (): void => {
				attempted.push('cleanup:second');
				databaseOpenDuringCleanup.push(owned.database.isInitialized);
			},
		};
		registerOwnedFixtureObserver(owned, first);
		registerOwnedFixtureObserver(owned, second);
		await closeRuntimeFixture(owned);
		expect(attempted).toEqual(['retire:first', 'retire:second', 'cleanup:first', 'cleanup:second']);
		expect(databaseOpenDuringCleanup).toEqual([true, true]);
		expect(owned.observers).not.toContain(first);
		expect(owned.observers).toContain(second);
		expect(owned.database.isInitialized).toBe(false);
	});
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
