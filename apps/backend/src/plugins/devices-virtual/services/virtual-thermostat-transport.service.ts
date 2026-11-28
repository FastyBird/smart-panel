import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyReadProofService } from '../../../modules/devices/services/property-read-proof.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	CapturedThermostatReconcileReadiness,
	ThermostatActuationAdapter as ProviderActuationAdapter,
	ThermostatReconciliationScope as ProviderReconciliationScope,
	ThermostatReleaseOrderingEvidence as ProviderReleaseOrderingEvidence,
	RemoteCoolingFrame,
	SUPERVISED_SWITCH_PROFILE,
	SUPERVISED_SWITCH_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { SupervisedThermostatSwitch } from './supervised-thermostat-switch';
import { ThermostatActuationRegistry } from './thermostat-actuation-registry.service';
import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import {
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';

export type ThermostatReconciliationScope = ProviderReconciliationScope<ThermostatInstalledQualification>;
export type ThermostatReleaseOrderingEvidence = ProviderReleaseOrderingEvidence<ThermostatInstalledQualification>;
export type ThermostatActuationAdapter = ProviderActuationAdapter<ThermostatInstalledQualification>;

// Keep provider qualification bytes opaque while retaining their original data descriptors.
function captureProfile(profile: object, seen = new Set<object>()): { current: () => boolean }[] {
	if (seen.has(profile)) return [];
	seen.add(profile);
	const capture = captureCreation(profile, Object.keys(profile) as (keyof typeof profile)[]);
	const nested = Object.values(capture.values).flatMap((value: unknown) =>
		value && typeof value === 'object' ? captureProfile(value, seen) : [],
	);
	return [capture, ...nested];
}

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService implements OnModuleDestroy {
	private destroyed = false;
	private readonly registrationEpochs = new Map<string, object>();
	private readonly adapters = new Map<
		string,
		{
			readonly adapter: ThermostatActuationAdapter;
			readonly profileId: string;
			readonly profileVersion: number;
		}
	>();
	private readonly adapterOwners = new WeakMap<ThermostatActuationAdapter, () => boolean>();
	private readonly supervised: SupervisedThermostatSwitch;
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
		values: PropertyValueService,
		@Optional() private readonly extensions: ThermostatActuationRegistry = new ThermostatActuationRegistry(),
		@Optional() proof?: PropertyReadProofService,
	) {
		this.supervised = new SupervisedThermostatSwitch(this.platforms, values, proof);
	}
	register(type: string, adapter: ThermostatActuationAdapter): () => void {
		if (this.destroyed) throw new Error('Thermostat transport is destroyed');
		if (
			adapter.contractVersion !== 1 ||
			!adapter.providerProfile.id ||
			adapter.providerProfile.id === SUPERVISED_SWITCH_PROFILE ||
			!Number.isSafeInteger(adapter.providerProfile.version) ||
			adapter.providerProfile.version < 1
		)
			throw new Error('Unsupported thermostat actuation contract/profile');
		if (this.adapters.has(type)) throw new Error('Thermostat transport already registered');
		const registration = Object.freeze({
			adapter,
			profileId: adapter.providerProfile.id,
			profileVersion: adapter.providerProfile.version,
		});
		this.adapters.set(type, registration);
		this.registrationEpochs.set(type, registration);
		return () => {
			if (this.adapters.get(type) === registration) {
				this.adapters.delete(type);
				this.registrationEpochs.set(type, Object.freeze({}));
			}
		};
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.supervised.destroy();
		this.adapters.clear();
		this.registrationEpochs.clear();
	}

	forgetSupervisedOff(claim: VirtualThermostatActuatorClaimEntity): void {
		this.supervised.forget(claim);
	}

	awaitingSupervisedOff(claim: VirtualThermostatActuatorClaimEntity): boolean {
		return claim.providerProfile === SUPERVISED_SWITCH_PROFILE && this.supervised.awaitingReport(claim);
	}

	/** Read-only OFF observation. No provider, session, machine predicate or sample is invoked. */
	captureOffMetadata(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	): Readonly<{ isCurrent: () => boolean }> | null {
		const metadata = this.captureReadinessMetadata(target, claim, qualification);
		return metadata ? Object.freeze({ isCurrent: metadata.isCurrent }) : null;
	}
	private captureReadinessMetadata(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	) {
		try {
			if (this.destroyed || !qualification) return null;
			const targetPin = captureCreation(target, ['device', 'channel', 'property']);
			const { device, channel, property } = targetPin.values;
			const profileId = captureCreation(claim, ['providerProfile', 'providerProfileVersion']);
			const registration = this.extensions.get(
				profileId.values.providerProfile,
				profileId.values.providerProfileVersion,
			);
			const targetGuard = registration?.extension.captureTargetMetadata?.(target);
			if (targetGuard === null || (targetGuard && !targetGuard.isCurrent())) return null;
			// Provider entity classes supply the discriminator through a prototype getter.
			// An instance-level accessor is not part of that contract.
			if (Object.getOwnPropertyDescriptor(device, 'type')?.get) return null;
			const devicePin = captureCreation(device, ['id', 'enabled', 'identifier', 'getPhysicalSwitchIdentity']);
			const channelPin = captureCreation(channel, ['id', 'identifier', 'category', 'device']);
			const propertyKeys = [
				'id',
				'identifier',
				'category',
				'dataType',
				'permissions',
				'unit',
				'format',
				'channel',
			] as const;
			if (propertyKeys.some((key) => key in property && !Object.hasOwn(property, key))) return null;
			const propertyPin = captureCreation(property, propertyKeys);
			const claimPin = captureCreation(claim, [
				'id',
				'controllerId',
				'revision',
				'role',
				'state',
				'physicalIdentity',
				'providerProfile',
				'providerProfileVersion',
				'qualificationGeneration',
				'leaseSeconds',
				'independentProtectionAcknowledged',
				'sourcePropertyId',
				'sourceDeviceId',
				'sourcePropertyIdentity',
				'sourceDeviceIdentity',
				'contractFingerprint',
			]);
			const qualificationPin = captureCreation(qualification, [
				'contractVersion',
				'providerProfile',
				'physicalIdentity',
				'qualificationGeneration',
				'profile',
				'machineLeaseIsCurrent',
				'upstreamWritersExcluded',
				'opposedOutputsInterlocked',
			]);
			const generationDescriptor = Object.getOwnPropertyDescriptor(qualification, 'qualificationGeneration');
			if ('qualificationGeneration' in qualification && (!generationDescriptor || !('value' in generationDescriptor)))
				return null;
			if (!Object.hasOwn(claim, 'qualificationGeneration')) return null;
			const profile = qualificationPin.values.providerProfile;
			const local = qualificationPin.values.profile;
			if (!profile || !local) return null;
			const profilePin = captureCreation(profile, ['id', 'version']);
			const profilePins = captureProfile(local);
			const permissionsPin = captureCreation(
				property.permissions,
				Object.keys(property.permissions) as (keyof typeof property.permissions)[],
			);
			const channelDevice = channelPin.values.device;
			const propertyChannel = propertyPin.values.channel;
			const channelDevicePin =
				typeof channelDevice === 'object' && channelDevice ? captureCreation(channelDevice, ['id']) : null;
			const propertyChannelPin =
				typeof propertyChannel === 'object' && propertyChannel ? captureCreation(propertyChannel, ['id']) : null;
			const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
			const generation = qualificationPin.values.qualificationGeneration;
			const generated =
				typeof generation === 'string' &&
				generation.length > 0 &&
				claimPin.values.qualificationGeneration === generation;
			const machine = qualificationPin.values.machineLeaseIsCurrent;
			if (
				!physicalIdentity ||
				qualification.contractVersion !== 1 ||
				!generated ||
				typeof machine !== 'function' ||
				!profile.id ||
				!Number.isSafeInteger(profile.version) ||
				profile.version < 1 ||
				qualification.physicalIdentity !== physicalIdentity ||
				claim.physicalIdentity !== physicalIdentity ||
				claim.providerProfile !== profile.id ||
				claim.providerProfileVersion !== profile.version ||
				!claim.id ||
				!claim.controllerId ||
				!Number.isSafeInteger(claim.revision) ||
				claim.revision < 1 ||
				(claim.state !== 'reserved' && claim.state !== 'releasing') ||
				claim.sourcePropertyId !== property.id ||
				claim.sourcePropertyIdentity !== property.id ||
				claim.sourceDeviceId !== device.id ||
				claim.sourceDeviceIdentity !== device.id ||
				(typeof channelDevice === 'string' ? channelDevice : channelDevicePin?.values.id) !== device.id ||
				(typeof propertyChannel === 'string' ? propertyChannel : propertyChannelPin?.values.id) !== channel.id ||
				claim.contractFingerprint !== thermostatPropertyContract(property, channel, device)
			)
				return null;
			const pins = [
				targetPin,
				devicePin,
				channelPin,
				propertyPin,
				claimPin,
				qualificationPin,
				profilePin,
				...profilePins,
				permissionsPin,
				channelDevicePin,
				propertyChannelPin,
			].filter((pin) => !!pin);
			const snapshot = () =>
				thermostatFingerprint({
					contract: thermostatPropertyContract(property, channel, device),
					identity: thermostatActuatorIdentity(property, channel, device),
					local,
				});
			const image = snapshot();
			let open = true;
			const isCurrent = () => {
				if (!open) return false;
				try {
					open =
						!this.destroyed &&
						(!targetGuard || targetGuard.isCurrent()) &&
						pins.every((pin) => pin.current()) &&
						snapshot() === image;
				} catch {
					open = false;
				}
				return open;
			};
			return { device, profile, generation, physicalIdentity, machine, isCurrent };
		} catch {
			return null;
		}
	}

	/** Pure, original registration/session continuity; never calls send, reconcile or sample storage. */
	captureReconcileReadiness(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	): CapturedThermostatReconcileReadiness | null {
		try {
			const metadata = this.captureReadinessMetadata(target, claim, qualification);
			if (!metadata) return null;
			const { device, profile, generation, physicalIdentity, machine } = metadata;
			const type = device.type;
			const epoch = this.registrationEpochs.get(type);
			const registration = this.adapters.get(type);
			const extension = this.extensions.get(profile.id, profile.version);
			let providerCurrent: () => boolean;
			if (registration?.profileId === profile.id && registration.profileVersion === profile.version) {
				const adapter = registration.adapter;
				const methods = captureCreation(adapter, [
					'captureReconcileReadiness',
					'canReconcile',
					'contractVersion',
					'providerProfile',
				]);
				const suppliedProfile = captureCreation(methods.values.providerProfile, ['id', 'version']);
				if (
					!methods.values.captureReconcileReadiness ||
					methods.values.contractVersion !== 1 ||
					suppliedProfile.values.id !== profile.id ||
					suppliedProfile.values.version !== profile.version ||
					invokeCreation(machine, qualification) !== true ||
					invokeCreation(methods.values.canReconcile, adapter, target, qualification) !== true
				)
					return null;
				const original = invokeCreation(methods.values.captureReconcileReadiness, adapter, target, qualification);
				if (!original) return null;
				const evidence = captureCreation(original, [
					'capabilityVersion',
					'providerProfile',
					'physicalIdentity',
					'qualificationGeneration',
					'isCurrent',
				]);
				const evidenceProfile = captureCreation(evidence.values.providerProfile, ['id', 'version']);
				if (
					evidence.values.capabilityVersion !== 1 ||
					evidence.values.physicalIdentity !== physicalIdentity ||
					evidence.values.qualificationGeneration !== generation ||
					evidenceProfile.values.id !== profile.id ||
					evidenceProfile.values.version !== profile.version ||
					typeof evidence.values.isCurrent !== 'function'
				)
					return null;
				providerCurrent = () =>
					methods.current() &&
					suppliedProfile.current() &&
					evidence.current() &&
					evidenceProfile.current() &&
					invokeCreation(evidence.values.isCurrent, original) === true &&
					invokeCreation(methods.values.canReconcile, adapter, target, qualification) === true;
			} else {
				if (!invokeCreation(machine, qualification)) return null;
				const capability =
					profile.id === SUPERVISED_SWITCH_PROFILE && profile.version === SUPERVISED_SWITCH_PROFILE_VERSION
						? this.supervised.readiness(target, qualification)
						: extension?.extension.captureReadiness?.(target, qualification);
				if (
					!capability ||
					capability.capabilityVersion !== 1 ||
					capability.providerProfile.id !== profile.id ||
					capability.providerProfile.version !== profile.version ||
					capability.physicalIdentity !== physicalIdentity ||
					capability.qualificationGeneration !== generation
				)
					return null;
				const captured = captureCreation(capability, ['isCurrent']);
				providerCurrent = () =>
					this.extensions.get(profile.id, profile.version) === extension &&
					captured.current() &&
					invokeCreation(captured.values.isCurrent, capability);
			}
			let current = true;
			const isCurrent = () => {
				if (!current) return false;
				try {
					current =
						!this.destroyed &&
						metadata.isCurrent() &&
						this.registrationEpochs.get(type) === epoch &&
						this.adapters.get(type) === registration &&
						invokeCreation(machine, qualification) === true &&
						providerCurrent();
				} catch {
					current = false;
				}
				return current;
			};
			if (!isCurrent()) return null;
			if (typeof generation !== 'string') return null;
			return Object.freeze({
				capabilityVersion: 1,
				providerProfile: Object.freeze({ id: profile.id, version: profile.version }),
				physicalIdentity,
				qualificationGeneration: generation,
				isCurrent,
			});
		} catch {
			return null;
		}
	}

	/** Capture the actual command adapter before journal I/O; a later registration cannot receive it. */
	capture(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification?: ThermostatInstalledQualification | null,
	) {
		const dispatch = captureCreation(this, ['get']);
		const registrations = this.adapters;
		const type = target.device.type;
		const registration = registrations.get(type);
		const extension = this.extensions.get(claim.providerProfile, claim.providerProfileVersion);
		const adapter = dispatch.values.get.call(dispatch.receiver, target, claim, qualification);
		if (!adapter) return null;
		const owner = this.adapterOwners.get(adapter);
		const methods = captureCreation(adapter, [
			'send',
			'reconcile',
			'canReconcile',
			'providerProfile',
			'contractVersion',
		]);
		const profile = captureCreation(methods.values.providerProfile, ['id', 'version']);
		let current = true;
		const isCurrent = () => {
			if (!current) return false;
			try {
				current =
					!this.destroyed &&
					dispatch.current() &&
					this.extensions.get(claim.providerProfile, claim.providerProfileVersion) === extension &&
					methods.current() &&
					profile.current() &&
					(owner?.() ?? true) &&
					this.adapters === registrations &&
					registrations.get(type) === registration;
			} catch {
				current = false;
			}
			return current;
		};
		return Object.freeze({
			isCurrent,
			send: (...args: Parameters<ThermostatActuationAdapter['send']>) =>
				invokeCreation(methods.values.send, methods.receiver, ...args),
			reconcile: (...args: Parameters<ThermostatActuationAdapter['reconcile']>) =>
				invokeCreation(methods.values.reconcile, methods.receiver, ...args),
			canReconcile: (...args: Parameters<ThermostatActuationAdapter['canReconcile']>) =>
				invokeCreation(methods.values.canReconcile, methods.receiver, ...args),
		});
	}
	get(
		target: IDevicePropertyData,
		claim?: VirtualThermostatActuatorClaimEntity,
		capturedQualification?: ThermostatInstalledQualification | null,
	): ThermostatActuationAdapter | null {
		if (this.destroyed) return null;
		const custom = this.adapters.get(target.device.type);
		if (
			custom &&
			(!claim || (custom.profileId === claim.providerProfile && custom.profileVersion === claim.providerProfileVersion))
		) {
			const supplied = custom.adapter;
			return supplied.providerProfile.id === custom.profileId &&
				supplied.providerProfile.version === custom.profileVersion
				? supplied
				: null;
		}
		if (!claim) return null;
		const registration = this.extensions.get(claim.providerProfile, claim.providerProfileVersion);
		const reader = this.coolingFrameReader;
		const adapter =
			claim.providerProfile === SUPERVISED_SWITCH_PROFILE &&
			claim.providerProfileVersion === SUPERVISED_SWITCH_PROFILE_VERSION
				? this.supervised.capture(target)
				: registration?.extension.captureAdapter(
						target,
						claim,
						capturedQualification,
						(member) => reader?.(member) ?? null,
					);
		if (!adapter) return null;
		const original = captureCreation(adapter, ['isCurrent']);
		this.adapterOwners.set(
			adapter,
			() =>
				this.coolingFrameReader === reader &&
				original.current() &&
				(!original.values.isCurrent || invokeCreation(original.values.isCurrent, adapter)),
		);
		return adapter;
	}
}
