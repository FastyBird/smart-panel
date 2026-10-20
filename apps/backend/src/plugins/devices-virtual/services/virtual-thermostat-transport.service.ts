import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	captureDiagnosticTree,
	closeDiagnosticTree,
	creationHasDataMethod,
	creationMethodCurrent,
	diagnosticTreeCurrent,
} from '../../../modules/devices/services/device-creation-context';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { OwnedSampleOrigin, PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import {
	CapturedThermostatReconcileReadiness,
	ThermostatActuationAdapter as ProviderActuationAdapter,
	ThermostatReconciliationScope as ProviderReconciliationScope,
	ThermostatReleaseOrderingEvidence as ProviderReleaseOrderingEvidence,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { RemoteCoolingFrame, ThermostatRemoteCoolingAdapter } from './thermostat-remote-cooling-adapter';
import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import {
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';

type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFunctions<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };
type DispatchDescriptor = Omit<PropertyDescriptor, 'value'> & { readonly value?: unknown };
const dispatchObjects: Readonly<{
	getOwnPropertyDescriptor: (owner: object, key: PropertyKey) => DispatchDescriptor | undefined;
	getPrototypeOf: (owner: object) => object | null;
}> = Object;

// The builtin discriminator is a trusted inherited getter, never arbitrary runtime accessor data.
const originalShellyTypePrototype = ShellyNgDeviceEntity.prototype;
const originalShellyTypeParent = dispatchObjects.getPrototypeOf(originalShellyTypePrototype);
const originalShellyTypeDescriptor: Readonly<{
	get?: unknown;
	set?: unknown;
	enumerable?: boolean;
	configurable?: boolean;
}> | undefined = dispatchObjects.getOwnPropertyDescriptor(originalShellyTypePrototype, 'type');
const originalShellyType = Object.freeze({
	get: originalShellyTypeDescriptor?.get,
	set: originalShellyTypeDescriptor?.set,
	enumerable: originalShellyTypeDescriptor?.enumerable,
	configurable: originalShellyTypeDescriptor?.configurable,
});
/** Negative metadata only: never invokes the discriminator or adopts a nearer declaration. */
function captureOriginalShellyDispatchType(device: object): (() => boolean) | null {
	if (typeof originalShellyType.get !== 'function' || originalShellyType.set !== undefined) return null;
	const canonicalCurrent = (): boolean => {
		const descriptor = dispatchObjects.getOwnPropertyDescriptor(originalShellyTypePrototype, 'type');
		return (
			dispatchObjects.getPrototypeOf(originalShellyTypePrototype) === originalShellyTypeParent &&
			!!descriptor &&
			descriptor.get === originalShellyType.get &&
			descriptor.set === undefined &&
			descriptor.enumerable === originalShellyType.enumerable &&
			descriptor.configurable === originalShellyType.configurable
		);
	};
	const chain: { owner: object; prototype: object | null }[] = [];
	for (let owner: object | null = device; owner !== null; ) {
		if (owner === originalShellyTypePrototype) {
			if (!canonicalCurrent()) return null;
			return (): boolean =>
				chain.every(
					(pin) =>
						dispatchObjects.getPrototypeOf(pin.owner) === pin.prototype &&
						dispatchObjects.getOwnPropertyDescriptor(pin.owner, 'type') === undefined,
				) && canonicalCurrent();
		}
		if (dispatchObjects.getOwnPropertyDescriptor(owner, 'type') !== undefined) return null;
		const prototype = dispatchObjects.getPrototypeOf(owner);
		chain.push({ owner, prototype });
		owner = prototype;
	}
	return null;
}

export type ThermostatReconciliationScope = ProviderReconciliationScope<ThermostatInstalledQualification>;
export type ThermostatReleaseOrderingEvidence = ProviderReleaseOrderingEvidence<ThermostatInstalledQualification>;
export type ThermostatActuationAdapter = ProviderActuationAdapter<ThermostatInstalledQualification>;

export class RuntimeFeedbackConsumer {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class RuntimeReconciliationWork {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class RuntimeOffDispatchWork {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
interface BuiltinDispatchRecord {
	readonly current: () => boolean;
}
interface OffDispatchWorkRecord {
	readonly purpose: 'GUARDED_OFF_DISPATCH';
	readonly token: RuntimeOffDispatchWork;
	readonly consumer: FeedbackConsumerRecord;
	readonly adapter: ThermostatActuationAdapter;
	readonly method: ThermostatActuationAdapter['send'];
	readonly target: IDevicePropertyData;
	readonly claim: VirtualThermostatActuatorClaimEntity;
	readonly qualification: ThermostatInstalledQualification;
	readonly guard: () => boolean;
	readonly packet: Readonly<{ commandId: string }>;
	readonly current: () => boolean;
	readonly dispose: () => void;
	origin?: OwnedSampleOrigin;
	session?: object;
	fence?: unknown;
	sessionCurrent?: unknown;
	entered: boolean;
	delivered: boolean;
	closed: boolean;
}
type FeedbackWorkRecord = ReconciliationWorkRecord | OffDispatchWorkRecord;
interface FeedbackConsumerRecord {
	readonly token: RuntimeFeedbackConsumer;
	readonly receiver: object;
	readonly reconcile: unknown;
	readonly dispatch: unknown;
	readonly destroy: unknown;
	readonly works: Set<FeedbackWorkRecord>;
	closed: boolean;
}
interface ReconciliationWorkRecord {
	readonly purpose: 'RECONCILIATION_OFF';
	readonly token: RuntimeReconciliationWork;
	readonly consumer: FeedbackConsumerRecord;
	readonly scope: ThermostatReconciliationScope;
	readonly adapter: ThermostatActuationAdapter;
	readonly method: ThermostatActuationAdapter['reconcile'];
	readonly guard: () => boolean;
	origin?: OwnedSampleOrigin;
	entered: boolean;
	delivered: boolean;
	closed: boolean;
}
/**
 * Structural view of an ORIGINAL function's existing call operation. This neither binds nor wraps it.
 * Keep its declared result and explicit receiver when strictBindCallApply is not enabled by the project.
 */
type OriginalReceiverCall<Receiver, Args extends unknown[], Result> = {
	readonly call: (receiver: Receiver, ...args: Args) => Result;
};

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService implements OnModuleDestroy {
	private readonly adapters = new Map<string, ThermostatActuationAdapter>();
	private readonly registrations = new Map<string, object>();
	/** Mutation-owned per-type epochs. Lookup never creates one; absence is a stable initial incarnation. */
	private readonly registrationEpochs = new Map<string, symbol>();
	private destroyed = false;
	private feedbackConsumer?: FeedbackConsumerRecord;
	private readonly feedbackWorks = new Map<RuntimeReconciliationWork, ReconciliationWorkRecord>();
	private readonly feedbackScopes = new WeakMap<ThermostatReconciliationScope, ReconciliationWorkRecord>();
	private readonly feedbackOrigins = new Map<OwnedSampleOrigin, FeedbackWorkRecord>();
	private readonly builtinDispatchAdapters = new WeakMap<ThermostatActuationAdapter, BuiltinDispatchRecord>();
	private readonly dispatchPackets = new WeakMap<Readonly<{ commandId: string }>, OffDispatchWorkRecord>();
	private readonly dispatchWorks = new Map<RuntimeOffDispatchWork, OffDispatchWorkRecord>();
	private readonly originalRegistrationCapture?: OriginalFunction<
		PlatformRegistryService,
		PlatformRegistryService['captureRegistration']
	>;
	registerRuntimeFeedbackConsumer(receiver: object): RuntimeFeedbackConsumer {
		if (
			this.destroyed ||
			!creationHasDataMethod(receiver, 'reconcile') ||
			!creationHasDataMethod(receiver, 'dispatch') ||
			!creationHasDataMethod(receiver, 'onModuleDestroy')
		)
			throw new Error('Original feedback consumer unavailable');
		const reconcile: unknown = Reflect.get(receiver, 'reconcile'),
			dispatch: unknown = Reflect.get(receiver, 'dispatch'),
			destroy: unknown = Reflect.get(receiver, 'onModuleDestroy');
		if (this.feedbackConsumer && !this.feedbackConsumer.closed) {
			if (
				this.feedbackConsumer.receiver === receiver &&
				this.feedbackConsumer.reconcile === reconcile &&
				this.feedbackConsumer.dispatch === dispatch &&
				this.feedbackConsumer.destroy === destroy
			)
				return this.feedbackConsumer.token;
			throw new Error('Feedback consumer already owned');
		}
		const token = Object.freeze(new RuntimeFeedbackConsumer());
		this.feedbackConsumer = { token, receiver, reconcile, dispatch, destroy, works: new Set(), closed: false };
		return token;
	}
	private feedbackConsumerCurrent(record: FeedbackConsumerRecord): boolean {
		return (
			!this.destroyed &&
			!record.closed &&
			this.feedbackConsumer === record &&
			creationMethodCurrent(record.receiver, 'reconcile', record.reconcile) &&
			creationMethodCurrent(record.receiver, 'dispatch', record.dispatch) &&
			creationMethodCurrent(record.receiver, 'onModuleDestroy', record.destroy)
		);
	}
	closeRuntimeFeedbackConsumer(token: RuntimeFeedbackConsumer): void {
		const record = this.feedbackConsumer;
		if (!record || record.token !== token) return;
		record.closed = true;
		for (const work of [...record.works]) this.closeFeedbackWork(work);
		if (this.feedbackConsumer === record) this.feedbackConsumer = undefined;
	}
	openRuntimeReconciliationWork(
		token: RuntimeFeedbackConsumer,
		scope: ThermostatReconciliationScope,
		adapter: ThermostatActuationAdapter,
		guard: () => boolean,
	): RuntimeReconciliationWork {
		const consumer = this.feedbackConsumer;
		if (
			!consumer ||
			consumer.token !== token ||
			!this.feedbackConsumerCurrent(consumer) ||
			!Object.isFrozen(scope) ||
			this.feedbackScopes.has(scope) ||
			!creationHasDataMethod(adapter, 'reconcile')
		)
			throw new Error('Original native feedback work unavailable');
		const originalAdapterMethods: OriginalFunctions<ThermostatActuationAdapter> = adapter;
		const work = Object.freeze(new RuntimeReconciliationWork());
		const record: ReconciliationWorkRecord = {
			purpose: 'RECONCILIATION_OFF',
			token: work,
			consumer,
			scope,
			adapter,
			method: originalAdapterMethods.reconcile,
			guard,
			entered: false,
			delivered: false,
			closed: false,
		};
		consumer.works.add(record);
		this.feedbackWorks.set(work, record);
		this.feedbackScopes.set(scope, record);
		return work;
	}
	closeRuntimeReconciliationWork(token: RuntimeReconciliationWork): void {
		const record = this.feedbackWorks.get(token);
		if (record) this.closeFeedbackWork(record);
	}
	private closeFeedbackWork(record: FeedbackWorkRecord): void {
		if (record.closed) return;
		record.closed = true;
		if (record.origin) {
			this.feedbackOrigins.delete(record.origin);
			try {
				this.originalSampleOrigin.close.call(this.values, record.origin);
			} catch {
				/* Provenance cleanup cannot replace native P. */
			}
		}
		record.consumer.works.delete(record);
		if (record.purpose === 'RECONCILIATION_OFF') {
			this.feedbackScopes.delete(record.scope);
			this.feedbackWorks.delete(record.token);
		} else {
			if (this.dispatchPackets.get(record.packet) === record) this.dispatchPackets.delete(record.packet);
			this.dispatchWorks.delete(record.token);
			record.dispose();
		}
	}
	captureRuntimeFeedbackDelivery(event: object): RuntimeReconciliationWork | RuntimeOffDispatchWork | null {
		if (!this.sampleOriginMethodsCurrent()) return null;
		const origin = this.originalSampleOrigin.delivery.call(this.values, event);
		const work = origin ? this.feedbackOrigins.get(origin) : undefined;
		if (
			!work ||
			work.closed ||
			work.delivered ||
			!this.feedbackConsumerCurrent(work.consumer) ||
			!(work.purpose === 'RECONCILIATION_OFF'
				? creationMethodCurrent(work.adapter, 'reconcile', work.method)
				: work.current())
		)
			return null;
		work.delivered = true;
		return work.token;
	}
	/** Negative-only origin admission. The original send guard/session is never invoked here. */
	openRuntimeOffDispatchWork(
		token: RuntimeFeedbackConsumer,
		adapter: ThermostatActuationAdapter,
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification | null,
		guard: () => boolean,
		packet: Readonly<{ commandId: string }>,
	): RuntimeOffDispatchWork | null {
		let dispose: (() => void) | undefined;
		try {
			const consumer = this.feedbackConsumer,
				builtin = this.builtinDispatchAdapters.get(adapter);
			if (
				!consumer ||
				consumer.token !== token ||
				!this.feedbackConsumerCurrent(consumer) ||
				!builtin ||
				!builtin.current() ||
				!qualification ||
				!Object.isFrozen(packet) ||
				this.dispatchPackets.has(packet) ||
				!creationHasDataMethod(adapter, 'send')
			)
				return null;
			const pins: {
				owner: object;
				key: string;
				prototype: object | null;
				descriptor: DispatchDescriptor | undefined;
			}[] = [];
			for (const [owner, keys] of [
				{ owner: target, keys: ['device', 'channel', 'property', 'value'] },
				{ owner: target.device, keys: ['id', 'canonicalMac', 'identifier', 'enabled'] },
				{ owner: target.channel, keys: ['id', 'device', 'identifier', 'category'] },
				{
					owner: target.property,
					keys: [
						'id',
						'channel',
						'identifier',
						'category',
						'dataType',
						'permissions',
						'unit',
						'format',
						'valueOrigin',
						'sourcePropertyId',
					],
				},
				{
					owner: claim,
					keys: [
						'id',
						'controllerId',
						'revision',
						'role',
						'state',
						'leaseSeconds',
						'sourcePropertyId',
						'sourcePropertyIdentity',
						'sourceDeviceId',
						'sourceDeviceIdentity',
						'physicalIdentity',
						'contractFingerprint',
						'qualificationGeneration',
						'providerProfile',
						'providerProfileVersion',
					],
				},
				{ owner: packet, keys: ['commandId'] },
			].map((entry) => [entry.owner, entry.keys] satisfies [object, string[]])) {
				for (const key of keys) {
					const descriptor = dispatchObjects.getOwnPropertyDescriptor(owner, key);
					if (descriptor?.get || descriptor?.set || (!descriptor && key in owner)) return null;
					pins.push({ owner, key, prototype: dispatchObjects.getPrototypeOf(owner), descriptor });
				}
			}
			const typeCurrent = captureOriginalShellyDispatchType(target.device);
			if (!typeCurrent) return null;
			const tree = captureDiagnosticTree({
				qualification,
				permissions: target.property.permissions,
				format: target.property.format,
			});
			let live = true;
			dispose = () => {
				live = false;
				closeDiagnosticTree(tree);
			};
			if (
				target.value !== false ||
				!packet.commandId ||
				!qualification.upstreamWritersExcluded ||
				!qualification.profile.releaseOrderingQualified ||
				!qualification.profile.independentProtectionQualified ||
				qualification.physicalIdentity !== claim.physicalIdentity ||
				qualification.qualificationGeneration !== claim.qualificationGeneration ||
				qualification.physicalIdentity !== thermostatActuatorIdentity(target.property, target.channel, target.device) ||
				claim.sourcePropertyId !== target.property.id ||
				claim.sourceDeviceId !== target.device.id ||
				claim.contractFingerprint !== thermostatPropertyContract(target.property, target.channel, target.device)
			) {
				dispose();
				return null;
			}
			const methods: OriginalFunctions<ThermostatActuationAdapter> = adapter;
			const method = methods.send;
			const current = (): boolean => {
				try {
					live =
						live &&
						builtin.current() &&
						this.feedbackConsumerCurrent(consumer) &&
						diagnosticTreeCurrent(tree) &&
						creationMethodCurrent(adapter, 'send', method) &&
						typeCurrent() &&
						pins.every(({ owner, key, prototype, descriptor }) => {
							if (dispatchObjects.getPrototypeOf(owner) !== prototype) return false;
							const now = dispatchObjects.getOwnPropertyDescriptor(owner, key);
							return descriptor
								? !!now &&
										!now.get &&
										!now.set &&
										now.value === descriptor.value &&
										now.writable === descriptor.writable &&
										now.configurable === descriptor.configurable &&
										now.enumerable === descriptor.enumerable
								: !now && !(key in owner);
						});
					return live;
				} catch {
					live = false;
					return false;
				}
			};
			if (!current()) {
				dispose();
				return null;
			}
			const work = Object.freeze(new RuntimeOffDispatchWork());
			const record: OffDispatchWorkRecord = {
				purpose: 'GUARDED_OFF_DISPATCH',
				token: work,
				consumer,
				adapter,
				method,
				target,
				claim,
				qualification,
				guard,
				packet,
				current,
				dispose,
				entered: false,
				delivered: false,
				closed: false,
			};
			consumer.works.add(record);
			this.dispatchPackets.set(packet, record);
			this.dispatchWorks.set(work, record);
			return work;
		} catch {
			try {
				dispose?.();
			} catch {
				/* Optional origin refusal cannot replace native P. */
			}
			return null;
		}
	}
	closeRuntimeOffDispatchWork(token: RuntimeOffDispatchWork): void {
		const record = this.dispatchWorks.get(token);
		if (record) this.closeFeedbackWork(record);
	}
	private readonly originalSampleOrigin: Readonly<{
		open: OriginalReceiverCall<
			PropertyValueService,
			[import('../../../modules/devices/models/property-sample.model').PropertySampleEvidence, string],
			OwnedSampleOrigin | null
		>;
		close: OriginalReceiverCall<PropertyValueService, [OwnedSampleOrigin], void>;
		delivery: OriginalReceiverCall<PropertyValueService, [object], OwnedSampleOrigin | null>;
	}>;
	private sampleOriginMethodsCurrent(): boolean {
		return (
			creationMethodCurrent(this.values, 'openOwnedSampleOrigin', this.originalSampleOrigin.open) &&
			creationMethodCurrent(this.values, 'closeOwnedSampleOrigin', this.originalSampleOrigin.close) &&
			creationMethodCurrent(this.values, 'captureOwnedFeedbackDelivery', this.originalSampleOrigin.delivery)
		);
	}

	private remoteCooling?: ThermostatRemoteCoolingAdapter;
	private coolingFrameReader?: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null;
	registerCoolingFrameReader(
		reader: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null,
	): () => void {
		if (this.coolingFrameReader) throw new Error('Cooling evidence reader already registered');
		this.coolingFrameReader = reader;
		return () => {
			if (this.coolingFrameReader === reader) this.coolingFrameReader = undefined;
		};
	}

	constructor(
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
	) {
		const originalRegistry: OriginalFunctions<PlatformRegistryService> = platforms;
		if (creationHasDataMethod(platforms, 'captureRegistration'))
			this.originalRegistrationCapture = originalRegistry.captureRegistration;
		const originalValues: OriginalFunctions<PropertyValueService> = values;
		this.originalSampleOrigin = Object.freeze({
			open: originalValues.openOwnedSampleOrigin,
			close: originalValues.closeOwnedSampleOrigin,
			delivery: originalValues.captureOwnedFeedbackDelivery,
		});
	}
	register(type: string, adapter: ThermostatActuationAdapter): () => void {
		if (this.destroyed) throw new Error('Thermostat transport is destroyed');
		if (
			adapter.contractVersion !== 1 ||
			!adapter.providerProfile.id ||
			!Number.isSafeInteger(adapter.providerProfile.version) ||
			adapter.providerProfile.version < 1
		)
			throw new Error('Unsupported thermostat actuation contract/profile');
		if (this.adapters.has(type)) throw new Error('Thermostat transport already registered');
		const registration = Object.freeze({ adapter });
		this.adapters.set(type, adapter);
		this.registrations.set(type, registration);
		this.registrationEpochs.set(type, Symbol('registered thermostat transport'));
		return () => {
			if (this.registrations.get(type) !== registration) return;
			this.registrations.delete(type);
			this.adapters.delete(type);
			this.registrationEpochs.set(type, Symbol('retired thermostat transport'));
		};
	}
	onModuleDestroy(): void {
		if (this.destroyed) return;
		if (this.feedbackConsumer) this.closeRuntimeFeedbackConsumer(this.feedbackConsumer.token);
		this.destroyed = true;
		for (const type of this.registrationEpochs.keys())
			this.registrationEpochs.set(type, Symbol('destroyed thermostat transport'));
		this.registrations.clear();
		this.adapters.clear();
	}

	/**
	 * Capture transport continuity only. Durable current claim/source/slot CAS, qualification admission,
	 * qualified samples and their ORIGINAL deadlines remain separate mandatory bridge constituents.
	 * Never invokes send/reconcile, samples, inspection or physical qualification installation.
	 */
	captureReconcileReadiness(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	): CapturedThermostatReconcileReadiness | null {
		try {
			if (this.destroyed) return null;
			const { device, channel, property } = target;
			const type = device.type;
			const epoch = this.registrationEpochs.get(type);
			const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
			const qualificationGeneration = qualification.qualificationGeneration;
			const machineLease = qualification.machineLeaseIsCurrent;
			const profile = qualification.providerProfile;
			const localProfile = qualification.profile;
			const channelDeviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
			const propertyChannelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			if (
				!physicalIdentity ||
				claim.sourcePropertyIdentity !== property.id ||
				claim.sourceDeviceIdentity !== device.id ||
				propertyChannelId !== channel.id ||
				channelDeviceId !== device.id ||
				qualification.contractVersion !== 1 ||
				!profile ||
				!Number.isSafeInteger(profile.version) ||
				profile.version < 1 ||
				typeof profile.id !== 'string' ||
				!profile.id ||
				typeof qualificationGeneration !== 'string' ||
				!qualificationGeneration ||
				claim.qualificationGeneration !== qualificationGeneration ||
				typeof machineLease !== 'function' ||
				machineLease.call(qualification) !== true ||
				qualification.physicalIdentity !== physicalIdentity ||
				claim.physicalIdentity !== physicalIdentity ||
				claim.providerProfile !== profile.id ||
				claim.providerProfileVersion !== profile.version ||
				!claim.id ||
				!claim.controllerId ||
				!Number.isSafeInteger(claim.revision) ||
				claim.revision < 1 ||
				claim.state !== 'reserved' ||
				claim.sourcePropertyId !== property.id ||
				claim.sourceDeviceId !== device.id ||
				claim.contractFingerprint !== thermostatPropertyContract(property, channel, device) ||
				!localProfile
			)
				return null;
			const script = localProfile.guardScript;
			const bounds = localProfile.testedLeaseSeconds;
			const metadata = script?.installationMetadata;
			const snapshot = () =>
				thermostatFingerprint({
					target: {
						contract: thermostatPropertyContract(target.property, target.channel, target.device),
						physicalIdentity: thermostatActuatorIdentity(target.property, target.channel, target.device),
						enabled: target.device.enabled,
						identifier: target.device.identifier,
						channelDeviceId:
							typeof target.channel.device === 'string' ? target.channel.device : target.channel.device?.id,
						propertyChannelId:
							typeof target.property.channel === 'string' ? target.property.channel : target.property.channel?.id,
					},
					claim: {
						id: claim.id,
						controllerId: claim.controllerId,
						revision: claim.revision,
						role: claim.role,
						physicalIdentity: claim.physicalIdentity,
						providerProfile: claim.providerProfile,
						providerProfileVersion: claim.providerProfileVersion,
						qualificationGeneration: claim.qualificationGeneration,
						state: claim.state,
						leaseSeconds: claim.leaseSeconds,
						sourcePropertyId: claim.sourcePropertyId,
						sourceDeviceId: claim.sourceDeviceId,
						sourcePropertyIdentity: claim.sourcePropertyIdentity,
						sourceDeviceIdentity: claim.sourceDeviceIdentity,
						contractFingerprint: claim.contractFingerprint,
					},
					qualification: {
						contractVersion: qualification.contractVersion,
						physicalIdentity: qualification.physicalIdentity,
						qualificationGeneration: qualification.qualificationGeneration,
						providerProfile: qualification.providerProfile,
						upstreamWritersExcluded: qualification.upstreamWritersExcluded,
						opposedOutputsInterlocked: qualification.opposedOutputsInterlocked,
						profile: qualification.profile,
					},
				});
			const originalSnapshot = snapshot();
			const metadataCurrent = () =>
				!this.destroyed &&
				this.registrationEpochs.get(type) === epoch &&
				target.device === device &&
				target.channel === channel &&
				target.property === property &&
				qualification.providerProfile === profile &&
				qualification.profile === localProfile &&
				localProfile.guardScript === script &&
				localProfile.testedLeaseSeconds === bounds &&
				script?.installationMetadata === metadata &&
				qualification.machineLeaseIsCurrent === machineLease &&
				snapshot() === originalSnapshot &&
				machineLease.call(qualification) === true;
			let providerCurrent: () => boolean;
			const supplied = this.adapters.get(type);
			if (supplied) {
				const registration = this.registrations.get(type);
				const suppliedMethods: {
					readonly captureReconcileReadiness?: OriginalReceiverCall<
						ThermostatActuationAdapter,
						[IDevicePropertyData, ThermostatInstalledQualification],
						CapturedThermostatReconcileReadiness | null
					>;
					readonly canReconcile: OriginalReceiverCall<
						ThermostatActuationAdapter,
						[IDevicePropertyData, ThermostatInstalledQualification],
						boolean
					>;
				} = supplied;
				const capture = suppliedMethods.captureReconcileReadiness;
				const canReconcile = suppliedMethods.canReconcile;
				const providerProfile = supplied.providerProfile;
				if (
					!capture ||
					supplied.contractVersion !== 1 ||
					providerProfile.id !== profile.id ||
					providerProfile.version !== profile.version ||
					canReconcile.call(supplied, target, qualification) !== true
				)
					return null;
				// Only the optional explicit pure contract is eligible. Legacy canReconcile alone is never called.
				const original = capture.call(supplied, target, qualification);
				if (
					!original ||
					original.capabilityVersion !== 1 ||
					original.physicalIdentity !== physicalIdentity ||
					original.qualificationGeneration !== qualificationGeneration ||
					original.providerProfile.id !== profile.id ||
					original.providerProfile.version !== profile.version ||
					typeof original.isCurrent !== 'function'
				)
					return null;
				const originalMethods: {
					readonly isCurrent: OriginalReceiverCall<typeof original, [], boolean>;
				} = original;
				const originalGuard = originalMethods.isCurrent;
				const originalProfile = original.providerProfile;
				providerCurrent = () =>
					this.registrations.get(type) === registration &&
					this.adapters.get(type) === supplied &&
					supplied.contractVersion === 1 &&
					supplied.providerProfile === providerProfile &&
					providerProfile.id === profile.id &&
					providerProfile.version === profile.version &&
					supplied.captureReconcileReadiness === capture &&
					supplied.canReconcile === canReconcile &&
					original.capabilityVersion === 1 &&
					original.physicalIdentity === physicalIdentity &&
					original.qualificationGeneration === qualificationGeneration &&
					original.providerProfile === originalProfile &&
					originalProfile.id === profile.id &&
					originalProfile.version === profile.version &&
					original.isCurrent === originalGuard &&
					originalGuard.call(original) === true &&
					canReconcile.call(supplied, target, qualification) === true;
			} else {
				if (profile.id !== SHELLY_GUARDED_PROFILE || profile.version !== SHELLY_GUARDED_PROFILE_VERSION) return null;
				const platformLease = this.platforms.captureRegistration(device);
				if (!platformLease || !(platformLease.platform instanceof ShellyNgDevicePlatform)) return null;
				const platform = platformLease.platform;
				// Capture EXACTLY once. Final checks must never ask a new wrapper/session to rescue this one.
				const original = platform.prepareGuardRpcSession(target, localProfile);
				if (!original || typeof original.isCurrent !== 'function') return null;
				const originalMethods: {
					readonly isCurrent: OriginalReceiverCall<typeof original, [], boolean>;
				} = original;
				const originalGuard = originalMethods.isCurrent;
				providerCurrent = () =>
					!this.adapters.has(type) &&
					platformLease.isCurrent() === true &&
					original.isCurrent === originalGuard &&
					originalGuard.call(original) === true &&
					qualification.upstreamWritersExcluded === true &&
					localProfile.releaseOrderingQualified === true &&
					localProfile.independentProtectionQualified === true &&
					qualification.physicalIdentity === thermostatActuatorIdentity(property, channel, device);
			}
			const isCurrent = () => {
				try {
					return metadataCurrent() && providerCurrent();
				} catch {
					return false;
				}
			};
			if (!isCurrent()) return null;
			return Object.freeze({
				capabilityVersion: 1,
				providerProfile: Object.freeze({ id: profile.id, version: profile.version }),
				physicalIdentity,
				qualificationGeneration,
				isCurrent,
			});
		} catch {
			return null;
		}
	}

	get(target: IDevicePropertyData, claim?: VirtualThermostatActuatorClaimEntity): ThermostatActuationAdapter | null {
		if (this.destroyed) return null;
		if (
			claim?.providerProfile === REMOTE_DEW_POINT_PROFILE &&
			claim.providerProfileVersion === 1 &&
			claim.role === 'cooling'
		) {
			return (this.remoteCooling ??= new ThermostatRemoteCoolingAdapter(
				this.values,
				(member) => this.coolingFrameReader?.(member) ?? null,
				async (leaf, current) => {
					const platform = this.platforms.get(leaf.device);
					if (!(leaf.device instanceof ShellyNgDeviceEntity) || !(platform instanceof ShellyNgDevicePlatform))
						return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
					return platform.processProtectiveCommand(
						{ device: leaf.device, channel: leaf.channel, property: leaf.property },
						{ on: false },
						1000,
						current,
					);
				},
			));
		}

		const supplied = this.adapters.get(target.device.type);
		if (supplied)
			return !claim ||
				(supplied.contractVersion === 1 &&
					supplied.providerProfile.id === (claim.providerProfile ?? SHELLY_GUARDED_PROFILE) &&
					supplied.providerProfile.version === (claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION))
				? supplied
				: null;
		if (
			claim &&
			((claim.providerProfile ?? SHELLY_GUARDED_PROFILE) !== SHELLY_GUARDED_PROFILE ||
				(claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION) !== SHELLY_GUARDED_PROFILE_VERSION)
		)
			return null;
		const platform = this.platforms.get(target.device);
		if (!(platform instanceof ShellyNgDevicePlatform)) return null;
		const originalPlatform: OriginalFunctions<ShellyNgDevicePlatform> = platform;
		const prepare = originalPlatform.prepareGuardRpcSession,
			admit = originalPlatform.admitGuardFenceSample;
		const platformCurrent = (): boolean =>
			creationMethodCurrent(platform, 'prepareGuardRpcSession', prepare) &&
			creationMethodCurrent(platform, 'admitGuardFenceSample', admit);
		const adapter: ThermostatActuationAdapter = {
			contractVersion: 1,
			providerProfile: { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION },
			canReconcile: (target, qualification) =>
				qualification.upstreamWritersExcluded &&
				qualification.profile.releaseOrderingQualified &&
				qualification.profile.independentProtectionQualified &&
				qualification.physicalIdentity === thermostatActuatorIdentity(target.property, target.channel, target.device) &&
				platformCurrent() &&
				!!prepare.call(platform, target, qualification.profile),
			/** Refuse ON before energizing or report a possible send as unknown; OFF acceptance alone cannot release a claim. */
			send: ((service: VirtualThermostatTransportService): ThermostatActuationAdapter['send'] =>
				async function send(this: ThermostatActuationAdapter, target, claim, qualification, isAdmitted, packet) {
					const originalWork = packet && service.dispatchPackets.get(packet);
					let joined: OffDispatchWorkRecord | undefined;
					try {
						if (
							this === adapter &&
							originalWork &&
							originalWork.adapter === adapter &&
							originalWork.target === target &&
							originalWork.claim === claim &&
							originalWork.qualification === qualification &&
							originalWork.guard === isAdmitted &&
							!originalWork.entered &&
							!originalWork.closed &&
							originalWork.current()
						) {
							joined = originalWork;
							joined.entered = true;
						}
					} catch {
						/* Missing provenance keeps the original native path. */
					}
					if (!(target.device instanceof ShellyNgDeviceEntity))
						return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
					const session = qualification && platformCurrent() && prepare.call(platform, target, qualification.profile);
					if (target.value === true) {
						if (
							!session ||
							!qualification.upstreamWritersExcluded ||
							!qualification.profile.releaseOrderingQualified ||
							!qualification.profile.independentProtectionQualified ||
							qualification.physicalIdentity !== claim.physicalIdentity
						)
							return { outcome: 'refused', reasons: ['ordered_script_qualification_missing'] };
						return session.on(claim.leaseSeconds, 1000, isAdmitted);
					}
					if (session) {
						const nativeSession: OriginalFunctions<typeof session> = session;
						const fence = nativeSession.fence;
						if (joined && creationHasDataMethod(session, 'fence') && creationHasDataMethod(session, 'isCurrent')) {
							joined.session = session;
							joined.fence = fence;
							joined.sessionCurrent = nativeSession.isCurrent;
						}
						const readback = await fence.call(session, 1000, isAdmitted);
						if (readback) {
							if (!platformCurrent())
								return {
									outcome: 'unknown',
									reasons: ['original_guard_platform_lost'],
									outputConfirmed: false,
									pendingOnDrained: false,
								};
							let origin: OwnedSampleOrigin | null = null;
							try {
								const evidenceDescriptor = dispatchObjects.getOwnPropertyDescriptor(readback, 'evidence');
								if (
									evidenceDescriptor &&
									!evidenceDescriptor.get &&
									!evidenceDescriptor.set &&
									joined &&
									!joined.closed &&
									joined.session === session &&
									creationMethodCurrent(session, 'fence', joined.fence) &&
									creationMethodCurrent(session, 'isCurrent', joined.sessionCurrent) &&
									joined.current() &&
									service.sampleOriginMethodsCurrent()
								) {
									origin = service.originalSampleOrigin.open.call(
										service.values,
										readback.evidence,
										target.property.id,
									);
									if (origin) {
										joined.origin = origin;
										service.feedbackOrigins.set(origin, joined);
									}
								}
							} catch {
								/* Origin-only refusal cannot affect original admission. */
							}
							try {
								await admit.call(platform, target, readback);
							} finally {
								if (origin) {
									service.feedbackOrigins.delete(origin);
									try {
										service.originalSampleOrigin.close.call(service.values, origin);
									} catch {
										/* Preserve native P. */
									}
									if (joined?.origin === origin) joined.origin = undefined;
								}
							}
							return { outcome: 'accepted', wasOn: readback.wasOn, outputConfirmed: false, pendingOnDrained: false };
						}
					}
					// An unconfirmed script barrier still permits best-effort absolute native OFF.
					return platform.processProtectiveCommand(
						{ device: target.device, channel: target.channel, property: target.property },
						{ on: false },
						1000,
						isAdmitted,
					);
				})(this),
			/** Bind drainage to the installed qualification, live connection lease and freshly admitted OFF sample. */
			reconcile: async (target, commandIds, _off, isCurrent, scope) => {
				const work = this.feedbackScopes.get(scope);
				const joined =
					work &&
					work.adapter === adapter &&
					work.guard === isCurrent &&
					!work.entered &&
					!work.closed &&
					this.feedbackConsumerCurrent(work.consumer) &&
					creationMethodCurrent(adapter, 'reconcile', work.method)
						? work
						: undefined;
				if (joined) joined.entered = true;
				const qualification = scope.qualification;
				if (
					!qualification.upstreamWritersExcluded ||
					!qualification.profile.releaseOrderingQualified ||
					!qualification.profile.independentProtectionQualified ||
					qualification.physicalIdentity !== thermostatActuatorIdentity(target.property, target.channel, target.device)
				)
					return null;
				const session = platformCurrent() && prepare.call(platform, target, qualification.profile);
				if (!session) return null;
				const readback = await session.fence(1000, isCurrent);
				if (!readback || !readback.isCurrent() || typeof readback.evidence.sourceIsCurrent !== 'function') return null;
				if (
					joined &&
					!joined.closed &&
					this.feedbackConsumerCurrent(joined.consumer) &&
					this.sampleOriginMethodsCurrent()
				) {
					const origin = this.originalSampleOrigin.open.call(this.values, readback.evidence, target.property.id);
					if (origin) {
						joined.origin = origin;
						this.feedbackOrigins.set(origin, joined);
					}
				}
				if (!platformCurrent()) return null;
				await admit.call(platform, target, readback);
				const sample = this.values.readQualifiedSample(target.property, 30_000);
				if (
					!sample ||
					sample.value !== false ||
					sample.provenance !== 'live' ||
					sample.quality !== 'good' ||
					sample.sampledAt.getTime() !== readback.evidence.sampledAt.getTime() ||
					sample.receivedAt.getTime() !== readback.evidence.receivedAt.getTime() ||
					!readback.isCurrent()
				)
					return null;
				return {
					proofId: readback.proofId,
					physicalIdentity: qualification.physicalIdentity,
					connectionIdentity: readback.connectionIdentity,
					coveredCommandIds: [...commandIds],
					externalWriterBarrier: true,
					offSample: sample,
					observedAt: readback.evidence.observedAt,
					isCurrent: readback.isCurrent,
					sourceIsCurrent: readback.evidence.sourceIsCurrent,
					scope: {
						controllerId: scope.controllerId,
						controllerRevision: scope.controllerRevision,
						claimId: scope.claimId,
						claimRevision: scope.claimRevision,
						contractFingerprint: scope.contractFingerprint,
					},
				};
			},
		};
		try {
			if (
				this.originalRegistrationCapture &&
				creationMethodCurrent(this.platforms, 'captureRegistration', this.originalRegistrationCapture)
			) {
				const lease = this.originalRegistrationCapture.call(this.platforms, target.device);
				const get = ((owner: OriginalFunctions<VirtualThermostatTransportService>) => owner.get)(this);
				const epoch = this.registrationEpochs.get(target.device.type),
					type = target.device.type;
				if (lease && lease.platform === platform) {
					const originalLease: OriginalFunctions<typeof lease> = lease;
					const current = originalLease.isCurrent;
					this.builtinDispatchAdapters.set(adapter, {
						current: () =>
							!this.destroyed &&
							!this.adapters.has(type) &&
							this.registrationEpochs.get(type) === epoch &&
							platformCurrent() &&
							creationMethodCurrent(this, 'get', get) &&
							creationMethodCurrent(this.platforms, 'captureRegistration', this.originalRegistrationCapture) &&
							creationMethodCurrent(lease, 'isCurrent', current) &&
							current.call(lease),
					});
				}
			}
		} catch {
			/* Metadata-only origin is optional; native send remains original. */
		}
		return adapter;
	}
}
