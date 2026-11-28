import { randomUUID } from 'node:crypto';

import {
	QualifiedPropertySample,
	isIndependentPropertyReport,
} from '../../../modules/devices/models/property-sample.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyReadProofService } from '../../../modules/devices/services/property-read-proof.service';
import { currentSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	CapturedThermostatReconcileReadinessV1,
	SUPERVISED_SWITCH_PROFILE,
	SUPERVISED_SWITCH_PROFILE_VERSION,
	ThermostatActuationAdapter,
	ThermostatActuationResult,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { InstalledThermostatEvidence } from './thermostat-actuation-registry.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

interface PendingOffObservation {
	readonly claimId: string;
	readonly claimRevision: number;
	readonly commandId: string;
	readonly submittedAt: Date;
	readonly acceptedAt: number;
	readonly property: IDevicePropertyData['property'];
	readonly cancel: AbortController;
	readonly isCurrent: () => boolean;
	waiting: boolean;
	settled?: boolean;
	sample?: QualifiedPropertySample;
	sampleSourceIsCurrent?: () => boolean;
}

const profile = Object.freeze({ id: SUPERVISED_SWITCH_PROFILE, version: SUPERVISED_SWITCH_PROFILE_VERSION });

/** Commands from this controller are serialized even for a platform that only implements processBatch. */
export class SupervisedThermostatSwitch {
	private readonly writes = new Map<string, Promise<unknown>>();
	private readonly observations = new Map<string, PendingOffObservation>();
	private destroyed = false;

	constructor(
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
		private readonly reports: PropertyReadProofService | undefined,
	) {}

	forget(claim: VirtualThermostatActuatorClaimEntity): void {
		const witness = this.observations.get(claim.physicalIdentity);
		if (witness?.claimId !== claim.id || witness.claimRevision !== claim.revision) return;
		witness.cancel.abort();
		this.observations.delete(claim.physicalIdentity);
	}

	destroy(): void {
		this.destroyed = true;
		for (const observation of this.observations.values()) observation.cancel.abort();
		this.observations.clear();
	}

	awaitingReport(claim: VirtualThermostatActuatorClaimEntity): boolean {
		const observation = this.observations.get(claim.physicalIdentity);
		if (
			!observation ||
			observation.claimId !== claim.id ||
			observation.claimRevision !== claim.revision ||
			!observation.isCurrent() ||
			observation.settled
		)
			return false;
		// Retry an acknowledged OFF if the device stays silent. A report between the retry deadline
		// and the next evaluation still answers the previous command.
		if (observation.waiting) return Date.now() - observation.acceptedAt < 30_000;
		const sample =
			observation.sampleSourceIsCurrent?.() && this.values.readQualifiedSample(observation.property, 30_000);
		if (!sample) return false;
		return sample.value === false && sample.quality === 'good' && isIndependentPropertyReport(sample);
	}

	readiness(
		target: IDevicePropertyData,
		qualification: InstalledThermostatEvidence,
	): CapturedThermostatReconcileReadinessV1 | null {
		const lease = this.platforms.captureRegistration(target.device.type);
		if (
			!lease ||
			!this.reports ||
			!qualification.qualificationGeneration ||
			qualification.physicalIdentity !== thermostatActuatorIdentity(target.property, target.channel, target.device)
		)
			return null;
		return Object.freeze({
			capabilityVersion: 1,
			providerProfile: profile,
			physicalIdentity: qualification.physicalIdentity,
			qualificationGeneration: qualification.qualificationGeneration,
			isCurrent: () => !this.destroyed && lease.isCurrent() && qualification.machineLeaseIsCurrent?.() === true,
		});
	}

	capture(
		target: IDevicePropertyData,
	): (ThermostatActuationAdapter<InstalledThermostatEvidence> & { isCurrent: () => boolean }) | null {
		const platform = this.platforms.get(target.device);
		const lease = this.platforms.captureRegistration(target.device.type);
		const identity = thermostatActuatorIdentity(target.property, target.channel, target.device);
		if (!platform || !lease || !identity || !this.reports) return null;
		const contract = thermostatPropertyContract(target.property, target.channel, target.device);
		const sameTarget = (leaf: IDevicePropertyData) =>
			thermostatActuatorIdentity(leaf.property, leaf.channel, leaf.device) === identity &&
			thermostatPropertyContract(leaf.property, leaf.channel, leaf.device) === contract;
		const methods = captureCreation(platform, ['prepareCompositeBatch', 'processBatch', 'requestPropertyRead']);
		const isCurrent = () => !this.destroyed && lease.isCurrent() && methods.current() && sameTarget(target);
		const canReconcile = (leaf: IDevicePropertyData, evidence: InstalledThermostatEvidence) =>
			isCurrent() &&
			sameTarget(leaf) &&
			evidence?.providerProfile.id === profile.id &&
			evidence.providerProfile.version === profile.version &&
			evidence.physicalIdentity === identity &&
			evidence.machineLeaseIsCurrent?.() === true;
		return {
			contractVersion: 1,
			providerProfile: profile,
			isCurrent,
			canReconcile,
			send: (input, claim, evidence, isAdmitted, dispatch) => {
				const update = { ...input };
				const desired = update.value;
				const commandId = dispatch?.commandId;
				const write = async (): Promise<ThermostatActuationResult> => {
					const admitted = () =>
						isCurrent() &&
						typeof update.value === 'boolean' &&
						update.value === desired &&
						sameTarget(update) &&
						isAdmitted() &&
						(update.value === false ||
							(claim.independentProtectionAcknowledged === true && !!evidence && canReconcile(update, evidence)));
					if (!admitted() || !commandId || claim.physicalIdentity !== identity)
						return { outcome: 'refused', reasons: ['supervised_switch_not_admitted'] };
					const prepared = await methods.values.prepareCompositeBatch?.call(platform, [update]);
					if (
						prepared &&
						(prepared.updates.length !== 1 ||
							prepared.updates[0].property.id !== update.property.id ||
							prepared.updates[0].device.id !== update.device.id ||
							prepared.updates[0].channel.id !== update.channel.id ||
							prepared.updates[0].value !== update.value ||
							!prepared.isCurrent())
					) {
						prepared.dispose?.();
						return { outcome: 'refused', reasons: ['supervised_switch_target_changed'] };
					}
					try {
						if (!admitted()) return { outcome: 'refused', reasons: ['supervised_switch_not_admitted'] };
						this.observations.get(identity)?.cancel.abort();
						this.observations.delete(identity);
						const submittedAt = new Date();
						const beforeDispatch = currentSampleIngress();
						const accepted = prepared
							? await prepared.dispatch(() => admitted() && prepared.isCurrent())
							: await methods.values.processBatch.call(platform, [update]);
						if (!accepted) return { outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false };
						if (desired === false && isCurrent())
							this.observeOff(update, claim, commandId, submittedAt, beforeDispatch, isCurrent);
						return { outcome: 'accepted', outputConfirmed: false, pendingOnDrained: false };
					} finally {
						prepared?.dispose?.();
					}
				};
				const operation = (this.writes.get(identity) ?? Promise.resolve()).then(write, write);
				this.writes.set(identity, operation);
				return operation.finally(() => {
					if (this.writes.get(identity) === operation) this.writes.delete(identity);
				});
			},
			reconcile: (leaf, commandIds, off, admitted, scope) => {
				const witness = this.observations.get(identity);
				if (
					!witness?.sample ||
					!witness.isCurrent() ||
					!witness.sampleSourceIsCurrent?.() ||
					!admitted() ||
					this.writes.has(identity) ||
					scope.claimId !== witness.claimId ||
					scope.claimRevision !== witness.claimRevision ||
					!commandIds.includes(witness.commandId) ||
					!canReconcile(leaf, scope.qualification) ||
					off.value !== false ||
					off.quality !== 'good' ||
					!isIndependentPropertyReport(off) ||
					off.sampledAt.getTime() < witness.submittedAt.getTime() ||
					off.ingressSequence === undefined ||
					off.ingressSequence < witness.sample.ingressSequence
				)
					return Promise.resolve(null);
				const source = this.values.captureSampleSourceGuard(target.property);
				const sourceIsCurrent = () => isCurrent() && witness.sampleSourceIsCurrent() && source();
				const current = () =>
					sourceIsCurrent() && admitted() && this.observations.get(identity) === witness && !this.writes.has(identity);
				return Promise.resolve({
					proofId: randomUUID(),
					physicalIdentity: identity,
					connectionIdentity: scope.qualification.qualificationGeneration,
					coveredCommandIds: [...commandIds],
					retireConfirmedCommandIds: (ids: readonly string[]) => {
						if (ids.includes(witness.commandId)) witness.settled = true;
					},
					supervisedOffCommandId: witness.commandId,
					offSample: off,
					observedAt: off.receivedAt,
					isCurrent: current,
					sourceIsCurrent,
					scope,
				});
			},
		};
	}

	private observeOff(
		update: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		commandId: string,
		submittedAt: Date,
		beforeDispatch: number,
		current: () => boolean,
	): void {
		const observation: PendingOffObservation = {
			claimId: claim.id,
			claimRevision: claim.revision,
			commandId,
			submittedAt,
			acceptedAt: Date.now(),
			property: update.property,
			cancel: new AbortController(),
			waiting: true,
			isCurrent: current,
		};
		const identity = claim.physicalIdentity;
		this.observations.set(identity, observation);
		void this.reports
			.observeNextReport(update, {
				signal: observation.cancel.signal,
				minimumSampledAt: submittedAt,
				unsolicited: {
					afterIngress: beforeDispatch,
					latest: () => {
						const sample = this.values.readQualifiedSample(update.property, 30_000);
						return sample?.value === false && sample.quality === 'good' ? sample : null;
					},
				},
			})
			.then((result) => {
				observation.waiting = false;
				if (this.observations.get(identity) !== observation) return;
				if (
					current() &&
					result.status === 'reported' &&
					result.sample.provenance === 'live' &&
					result.sample.value === false &&
					result.sample.quality === 'good' &&
					this.values.readQualifiedSample(update.property, 30_000)?.ingressSequence === result.sample.ingressSequence
				) {
					observation.sampleSourceIsCurrent = this.values.captureSampleSourceGuard(update.property);
					observation.sample = { ...result.sample, provenance: 'live' };
				} else this.observations.delete(identity);
			})
			.catch(() => {
				// A failed or expired provider read is still unproven and must be retried.
				if (this.observations.get(identity) === observation) this.observations.delete(identity);
			});
	}
}
