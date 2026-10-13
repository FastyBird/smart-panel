import { ShellyGuardScriptQualification } from './guard-script.contract';

/** Internal only. Installed hardware evidence must be supplied by the qualification registry. */
export interface ShellyProtectiveQualification {
	/** Shelly.GetDeviceInfo.id (hardware identity), not the panel database device UUID. */
	readonly deviceId: string;
	readonly model: string;
	readonly firmware: string;
	readonly componentId: number;
	readonly evidenceId: string;
	readonly revision: number;
	readonly testedLeaseSeconds: { readonly min: number; readonly max: number };
	readonly releaseOrderingQualified: boolean;
	readonly independentProtectionQualified: boolean;
	readonly guardScript?: ShellyGuardScriptQualification;
}

export type ShellyProtectiveCommand =
	| { readonly on: true; readonly leaseSeconds: number; readonly qualification: ShellyProtectiveQualification }
	| { readonly on: false };

export type ShellyProtectiveCommandResult =
	| { readonly outcome: 'refused'; readonly reasons: readonly string[] }
	| {
			readonly outcome: 'accepted';
			readonly wasOn: boolean;
			readonly outputConfirmed: false;
			readonly pendingOnDrained: false;
	  }
	| { readonly outcome: 'unknown'; readonly outputConfirmed: false; readonly pendingOnDrained: false };

/** Return identity, ordering, protection and tested-lease blockers for installed protective ON eligibility. */
export function protectiveReadiness(
	identity: { deviceId: string; model: string; firmware: string },
	componentId: number,
	qualification?: ShellyProtectiveQualification,
): readonly string[] {
	const reasons: string[] = [];
	// Protocol candidate only. This is deliberately not a brand-wide hardware guarantee.
	if (identity.model !== 'SNSW-001P16EU') reasons.push('unsupported_model');
	if (!qualification) return [...reasons, 'hardware_evidence_missing'];
	if (
		qualification.deviceId !== identity.deviceId ||
		qualification.model !== identity.model ||
		!identity.firmware ||
		qualification.firmware !== identity.firmware ||
		qualification.componentId !== componentId
	)
		reasons.push('hardware_identity_mismatch');
	if (!qualification.evidenceId || !Number.isSafeInteger(qualification.revision) || qualification.revision < 1)
		reasons.push('hardware_evidence_missing');
	if (!qualification.releaseOrderingQualified) reasons.push('release_ordering_unqualified');
	if (!qualification.independentProtectionQualified) reasons.push('independent_protection_unqualified');
	const bounds = qualification.testedLeaseSeconds;
	if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.min <= 0 || bounds.max < bounds.min)
		reasons.push('lease_bounds_unqualified');
	return reasons;
}

/** v1's generic setter cannot supply this contract. */
export const SHELLY_V1_PROTECTIVE_READINESS = Object.freeze(['unsupported_protective_protocol']);
