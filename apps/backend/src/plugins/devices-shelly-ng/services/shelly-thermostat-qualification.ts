import { performance } from 'node:perf_hooks';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ThermostatProtectiveQualification } from '../../devices-virtual/contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../../devices-virtual/entities/virtual-thermostat.entity';
import { InstalledThermostatEvidence } from '../../devices-virtual/services/thermostat-actuation-registry.service';
import { guardScriptReadiness } from '../contracts/guard-script.contract';
import { ShellyProtectiveQualification } from '../contracts/protective-switch.contract';
import { SHELLY_GUARDED_PROFILE, SHELLY_GUARDED_PROFILE_VERSION } from '../contracts/thermostat-actuation.constants';

import { REMOTE_DEW_POINT_PROFILE } from './remote-dew-point-lease.contract';
import { qualifiedRemoteDewPointBlockers } from './remote-dew-point-qualification';

export type ShellyThermostatQualification = ThermostatProtectiveQualification<ShellyProtectiveQualification>;

export function qualifyShellyThermostat(raw: InstalledThermostatEvidence): ShellyThermostatQualification {
	const evidence = raw as ShellyThermostatQualification;
	const profile = evidence.profile;
	if (evidence.providerProfile?.id === REMOTE_DEW_POINT_PROFILE) {
		const remote = profile.remoteDewPoint;
		if (
			!profile.evidenceId ||
			!Number.isSafeInteger(profile.revision) ||
			profile.revision < 1 ||
			evidence.contractVersion !== 1 ||
			evidence.providerProfile.version !== 1 ||
			qualifiedRemoteDewPointBlockers(remote).length ||
			evidence.physicalIdentity !== remote?.artifact.binding.physicalActuator ||
			!evidence.qualificationGeneration ||
			typeof evidence.machineLeaseIsCurrent !== 'function' ||
			!evidence.machineLeaseIsCurrent() ||
			!evidence.upstreamWritersExcluded ||
			!profile.releaseOrderingQualified ||
			!profile.independentProtectionQualified ||
			profile.guardScript ||
			profile.deviceId !== remote.artifact.binding.deviceId ||
			profile.model !== remote.artifact.binding.model ||
			profile.firmware !== remote.artifact.binding.firmware ||
			profile.componentId !== remote.artifact.binding.switchId ||
			profile.testedLeaseSeconds.min * 1000 !== remote.artifact.binding.timing.minimumLifetimeMs ||
			profile.testedLeaseSeconds.max * 1000 !== remote.artifact.binding.timing.maximumLeaseMs
		)
			throw new DevicesValidationException('Separate installed remote cooling qualification is incomplete.');
		const deadline = performance.now() + Math.max(0, remote.installation.expiresAt - Date.now());
		const machine = evidence.machineLeaseIsCurrent;
		return Object.freeze({
			...evidence,
			machineLeaseIsCurrent: () =>
				performance.now() < deadline &&
				evidence.machineLeaseIsCurrent === machine &&
				machine.call(evidence) &&
				qualifiedRemoteDewPointBlockers(remote).length === 0,
			coolingBinding: Object.freeze({
				protectionFingerprint: remote.artifact.binding.protectionFingerprint,
				remoteLineageFingerprint: remote.artifact.binding.remoteLineageFingerprint,
				surfaceFingerprint: remote.artifact.binding.localSurface.calibrationFingerprint,
			}),
			providerProfile: Object.freeze({ id: REMOTE_DEW_POINT_PROFILE, version: 1 }),
			profile: Object.freeze({
				...profile,
				testedLeaseSeconds: Object.freeze({ ...profile.testedLeaseSeconds }),
				remoteDewPoint: Object.freeze({
					...remote,
					authenticatedStatus: Object.freeze({ ...remote.authenticatedStatus }),
					installation: Object.freeze({
						...remote.installation,
						surface: Object.freeze({ ...remote.installation.surface }),
						restartDrainObservation: Object.freeze({
							...remote.installation.restartDrainObservation,
							coveredJournalIds: Object.freeze([...remote.installation.restartDrainObservation.coveredJournalIds]),
						}),
						measuredTiming: Object.freeze({ ...remote.installation.measuredTiming }),
					}),
				}),
			}),
		});
	}
	if (
		!evidence.physicalIdentity ||
		!evidence.qualificationGeneration ||
		!!profile.remoteDewPoint ||
		evidence.contractVersion !== 1 ||
		(evidence.providerProfile !== undefined &&
			(evidence.providerProfile.id !== SHELLY_GUARDED_PROFILE ||
				evidence.providerProfile.version !== SHELLY_GUARDED_PROFILE_VERSION)) ||
		!profile.evidenceId ||
		!profile.firmware ||
		!profile.deviceId ||
		profile.model !== 'SNSW-001P16EU' ||
		!profile.releaseOrderingQualified ||
		!profile.independentProtectionQualified ||
		!evidence.upstreamWritersExcluded ||
		(profile.guardScript !== undefined &&
			(guardScriptReadiness(profile.guardScript).length > 0 ||
				profile.guardScript.evidenceId !== profile.evidenceId)) ||
		!Number.isSafeInteger(profile.revision) ||
		profile.revision < 1 ||
		!Number.isFinite(profile.testedLeaseSeconds.min) ||
		!Number.isFinite(profile.testedLeaseSeconds.max) ||
		profile.testedLeaseSeconds.min <= 0 ||
		profile.testedLeaseSeconds.max < profile.testedLeaseSeconds.min
	)
		throw new DevicesValidationException('Installed actuator qualification is incomplete.');

	const qualifiedProfile = {
		...profile,
		testedLeaseSeconds: Object.freeze({ ...profile.testedLeaseSeconds }),
	};
	const guard = profile.guardScript;
	if (guard) {
		const guardScript = { ...guard };
		if (guard.installationMetadata) {
			guardScript.installationMetadata = Object.freeze({ ...guard.installationMetadata });
		}
		qualifiedProfile.guardScript = Object.freeze(guardScript);
	}
	return Object.freeze({
		...evidence,
		contractVersion: 1,
		providerProfile: Object.freeze({ id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION }),
		profile: Object.freeze(qualifiedProfile),
	});
}

export function allowsShellyThermostat(
	claim: VirtualThermostatActuatorClaimEntity,
	installed: InstalledThermostatEvidence,
	opposed: boolean,
): boolean {
	const { profile, providerProfile } = installed as ShellyThermostatQualification;
	return (
		(!opposed || installed.opposedOutputsInterlocked) &&
		(providerProfile.id !== REMOTE_DEW_POINT_PROFILE ||
			(claim.role === 'cooling' &&
				(!opposed || !!profile.remoteDewPoint?.installation.opposedOutputInterlockAuditId))) &&
		claim.leaseSeconds >= profile.testedLeaseSeconds.min &&
		claim.leaseSeconds <= profile.testedLeaseSeconds.max
	);
}
