import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	CapturedThermostatReconcileReadiness,
	ThermostatActuationAdapter as ProviderActuationAdapter,
	ThermostatReconciliationScope as ProviderReconciliationScope,
	ThermostatReleaseOrderingEvidence as ProviderReleaseOrderingEvidence,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatFingerprint, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

export type ThermostatReconciliationScope = ProviderReconciliationScope<ThermostatInstalledQualification>;
export type ThermostatReleaseOrderingEvidence = ProviderReleaseOrderingEvidence<ThermostatInstalledQualification>;
export type ThermostatActuationAdapter = ProviderActuationAdapter<ThermostatInstalledQualification>;

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService implements OnModuleDestroy {
	private readonly adapters = new Map<string, ThermostatActuationAdapter>();
	private readonly registrations = new Map<string, object>();
	/** Mutation-owned per-type epochs. Lookup never creates one; absence is a stable initial incarnation. */
	private readonly registrationEpochs = new Map<string, symbol>();
	private destroyed = false;
	constructor(
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
	) {}
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
			if (
				!physicalIdentity || qualification.contractVersion !== 1 ||
				!profile || !Number.isSafeInteger(profile.version) || profile.version < 1 || typeof profile.id !== 'string' || !profile.id ||
				typeof qualificationGeneration !== 'string' || !qualificationGeneration || claim.qualificationGeneration !== qualificationGeneration ||
				typeof machineLease !== 'function' || machineLease.call(qualification) !== true ||
				qualification.physicalIdentity !== physicalIdentity || claim.physicalIdentity !== physicalIdentity ||
				claim.providerProfile !== profile.id || claim.providerProfileVersion !== profile.version ||
				!claim.id || !claim.controllerId || !Number.isSafeInteger(claim.revision) || claim.revision < 1 ||
				claim.state !== 'reserved' || claim.sourcePropertyId !== property.id || claim.sourceDeviceId !== device.id ||
				claim.contractFingerprint !== thermostatPropertyContract(property, channel, device) || !localProfile
			) return null;
			const script = localProfile.guardScript;
			const bounds = localProfile.testedLeaseSeconds;
			const metadata = script?.installationMetadata;
			const snapshot = () => thermostatFingerprint({
				target: { contract: thermostatPropertyContract(target.property, target.channel, target.device),
					physicalIdentity: thermostatActuatorIdentity(target.property, target.channel, target.device),
					enabled: target.device.enabled, identifier: target.device.identifier,
					channelDeviceId: typeof target.channel.device === 'string' ? target.channel.device : target.channel.device?.id,
					propertyChannelId: typeof target.property.channel === 'string' ? target.property.channel : target.property.channel?.id },
				claim: { id: claim.id, controllerId: claim.controllerId, revision: claim.revision, role: claim.role,
					physicalIdentity: claim.physicalIdentity, providerProfile: claim.providerProfile, providerProfileVersion: claim.providerProfileVersion,
					qualificationGeneration: claim.qualificationGeneration, state: claim.state, leaseSeconds: claim.leaseSeconds,
					sourcePropertyId: claim.sourcePropertyId, sourceDeviceId: claim.sourceDeviceId,
					sourcePropertyIdentity: claim.sourcePropertyIdentity, sourceDeviceIdentity: claim.sourceDeviceIdentity,
					contractFingerprint: claim.contractFingerprint },
				qualification: { contractVersion: qualification.contractVersion, physicalIdentity: qualification.physicalIdentity,
					qualificationGeneration: qualification.qualificationGeneration, providerProfile: qualification.providerProfile,
					upstreamWritersExcluded: qualification.upstreamWritersExcluded, opposedOutputsInterlocked: qualification.opposedOutputsInterlocked,
					profile: qualification.profile },
			});
			const originalSnapshot = snapshot();
			const metadataCurrent = () => !this.destroyed && this.registrationEpochs.get(type) === epoch &&
				target.device === device && target.channel === channel && target.property === property &&
				qualification.providerProfile === profile && qualification.profile === localProfile &&
				localProfile.guardScript === script && localProfile.testedLeaseSeconds === bounds &&
				script?.installationMetadata === metadata && qualification.machineLeaseIsCurrent === machineLease &&
				snapshot() === originalSnapshot && machineLease.call(qualification) === true;
			let providerCurrent: () => boolean;
			const supplied = this.adapters.get(type);
			if (supplied) {
				const registration = this.registrations.get(type);
				const capture = supplied.captureReconcileReadiness;
				const canReconcile = supplied.canReconcile;
				const providerProfile = supplied.providerProfile;
				if (!capture || supplied.contractVersion !== 1 || providerProfile.id !== profile.id ||
					providerProfile.version !== profile.version || canReconcile.call(supplied, target, qualification) !== true) return null;
				// Only the optional explicit pure contract is eligible. Legacy canReconcile alone is never called.
				const original = capture.call(supplied, target, qualification);
				if (!original || original.capabilityVersion !== 1 || original.physicalIdentity !== physicalIdentity ||
					original.qualificationGeneration !== qualificationGeneration || original.providerProfile.id !== profile.id ||
					original.providerProfile.version !== profile.version || typeof original.isCurrent !== 'function') return null;
				const originalGuard = original.isCurrent;
				const originalProfile = original.providerProfile;
				providerCurrent = () => this.registrations.get(type) === registration && this.adapters.get(type) === supplied &&
					supplied.contractVersion === 1 && supplied.providerProfile === providerProfile &&
					providerProfile.id === profile.id && providerProfile.version === profile.version &&
					supplied.captureReconcileReadiness === capture && supplied.canReconcile === canReconcile &&
					original.capabilityVersion === 1 && original.physicalIdentity === physicalIdentity &&
					original.qualificationGeneration === qualificationGeneration && original.providerProfile === originalProfile &&
					originalProfile.id === profile.id && originalProfile.version === profile.version &&
					original.isCurrent === originalGuard && originalGuard.call(original) === true && canReconcile.call(supplied, target, qualification) === true;
			} else {
				if (profile.id !== SHELLY_GUARDED_PROFILE || profile.version !== SHELLY_GUARDED_PROFILE_VERSION) return null;
				const platformLease = this.platforms.captureRegistration(device);
				if (!platformLease || !(platformLease.platform instanceof ShellyNgDevicePlatform)) return null;
				const platform = platformLease.platform;
				// Capture EXACTLY once. Final checks must never ask a new wrapper/session to rescue this one.
				const original = platform.prepareGuardRpcSession(target, localProfile);
				if (!original || typeof original.isCurrent !== 'function') return null;
				const originalGuard = original.isCurrent;
				providerCurrent = () => !this.adapters.has(type) && platformLease.isCurrent() === true &&
					original.isCurrent === originalGuard && originalGuard.call(original) === true &&
					qualification.upstreamWritersExcluded === true && localProfile.releaseOrderingQualified === true &&
					localProfile.independentProtectionQualified === true &&
					qualification.physicalIdentity === thermostatActuatorIdentity(property, channel, device);
			}
			const isCurrent = () => {
				try { return metadataCurrent() && providerCurrent(); } catch { return false; }
			};
			if (!isCurrent()) return null;
			return Object.freeze({ capabilityVersion: 1, providerProfile: Object.freeze({ id: profile.id, version: profile.version }),
				physicalIdentity, qualificationGeneration, isCurrent });
		} catch { return null; }
	}

	get(target: IDevicePropertyData, claim?: VirtualThermostatActuatorClaimEntity): ThermostatActuationAdapter | null {
		if (this.destroyed) return null;
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
		return {
			contractVersion: 1,
			providerProfile: { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION },
			canReconcile: (target, qualification) =>
				qualification.upstreamWritersExcluded &&
				qualification.profile.releaseOrderingQualified &&
				qualification.profile.independentProtectionQualified &&
				qualification.physicalIdentity === thermostatActuatorIdentity(target.property, target.channel, target.device) &&
				!!platform.prepareGuardRpcSession(target, qualification.profile),
			/** Refuse ON before energizing or report a possible send as unknown; OFF acceptance alone cannot release a claim. */
			send: async (target, claim, qualification, isAdmitted) => {
				if (!(target.device instanceof ShellyNgDeviceEntity))
					return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
				const session = qualification && platform.prepareGuardRpcSession(target, qualification.profile);
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
					const readback = await session.fence(1000, isAdmitted);
					if (readback) {
						await platform.admitGuardFenceSample(target, readback);
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
			},
			/** Bind drainage to the installed qualification, live connection lease and freshly admitted OFF sample. */
			reconcile: async (target, commandIds, _off, isCurrent, scope) => {
				const qualification = scope.qualification;
				if (
					!qualification.upstreamWritersExcluded ||
					!qualification.profile.releaseOrderingQualified ||
					!qualification.profile.independentProtectionQualified ||
					qualification.physicalIdentity !== thermostatActuatorIdentity(target.property, target.channel, target.device)
				)
					return null;
				const session = platform.prepareGuardRpcSession(target, qualification.profile);
				if (!session) return null;
				const readback = await session.fence(1000, isCurrent);
				if (!readback || !readback.isCurrent() || typeof readback.evidence.sourceIsCurrent !== 'function') return null;
				await platform.admitGuardFenceSample(target, readback);
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
	}
}
