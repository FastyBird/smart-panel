import { Injectable } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	ThermostatActuationAdapter as ProviderActuationAdapter,
	ThermostatReconciliationScope as ProviderReconciliationScope,
	ThermostatReleaseOrderingEvidence as ProviderReleaseOrderingEvidence,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';

export type ThermostatReconciliationScope = ProviderReconciliationScope<ThermostatInstalledQualification>;
export type ThermostatReleaseOrderingEvidence = ProviderReleaseOrderingEvidence<ThermostatInstalledQualification>;
export type ThermostatActuationAdapter = ProviderActuationAdapter<ThermostatInstalledQualification>;

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService {
	private readonly adapters = new Map<string, ThermostatActuationAdapter>();
	constructor(
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
	) {}
	register(type: string, adapter: ThermostatActuationAdapter): () => void {
		if (
			adapter.contractVersion !== 1 ||
			!adapter.providerProfile.id ||
			!Number.isSafeInteger(adapter.providerProfile.version) ||
			adapter.providerProfile.version < 1
		)
			throw new Error('Unsupported thermostat actuation contract/profile');
		if (this.adapters.has(type)) throw new Error('Thermostat transport already registered');
		this.adapters.set(type, adapter);
		return () => this.adapters.delete(type);
	}
	get(target: IDevicePropertyData, claim?: VirtualThermostatActuatorClaimEntity): ThermostatActuationAdapter | null {
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
