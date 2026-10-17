import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

/** Versioned internal contracts. Registration or command acceptance cannot grant protective authority. */
export const THERMOSTAT_ACTUATION_CONTRACT_VERSION = 1 as const;
export const SHELLY_GUARDED_PROFILE = 'shelly-ng.guarded-switch' as const;
export const SHELLY_GUARDED_PROFILE_VERSION = 1 as const;
export const MAX_THERMOSTAT_ACTUATOR_MEMBERS = 8;

export interface ThermostatProviderProfile {
	readonly id: string;
	readonly version: number;
}
export type ThermostatActuationResult =
	| { readonly outcome: 'refused'; readonly reasons: readonly string[] }
	| {
			readonly outcome: 'accepted';
			readonly wasOn: boolean;
			readonly outputConfirmed: false;
			readonly pendingOnDrained: false;
	  }
	| { readonly outcome: 'unknown'; readonly outputConfirmed: false; readonly pendingOnDrained: false };

/** A causal observation identifies the request and provider session; an unrelated live sample is insufficient. */
export interface ThermostatCausalObservation {
	readonly contractVersion: 1;
	readonly physicalIdentity: string;
	readonly requestIdentity: string;
	readonly connectionIdentity: string;
	readonly sample: QualifiedPropertySample;
	readonly isCurrent: () => boolean;
}

/** Local protection, observation and transport acceptance are intentionally separate capabilities. */
export interface ThermostatProtectiveQualification<LocalProfile> {
	/** Omitted only by the legacy installed Shelly evidence loader; normalized at admission. */
	readonly contractVersion?: 1;
	readonly providerProfile?: ThermostatProviderProfile;
	readonly physicalIdentity: string;
	readonly qualificationGeneration?: string;
	readonly profile: LocalProfile;
	readonly upstreamWritersExcluded: boolean;
	readonly opposedOutputsInterlocked: boolean;
	readonly machineLeaseIsCurrent?: () => boolean;
}

export type ThermostatControlStrategy =
	| {
			readonly version: 1;
			readonly controlStrategy: 'guarded_branches';
			readonly guardedBranches: { readonly heating: readonly string[]; readonly cooling: readonly string[] };
			readonly nativeUnit?: never;
	  }
	| {
			readonly version: 1;
			readonly controlStrategy: 'native_unit';
			readonly nativeUnit: {
				readonly provider: 'home-assistant' | 'zigbee2mqtt';
				readonly physicalIdentity: string;
				readonly profile: ThermostatProviderProfile;
			};
			readonly guardedBranches?: never;
	  };

/** Group identity is a stable controller/role tuple; physical claim and journal identities never change. */
export const thermostatBranchGroupIdentity = (controllerId: string, role: 'heating' | 'cooling'): string =>
	`${controllerId}:${role}`;
export const thermostatHasOpposedBranches = (claims: readonly { role: 'heating' | 'cooling' }[]): boolean =>
	claims.some((claim) => claim.role === 'heating') && claims.some((claim) => claim.role === 'cooling');

export interface ThermostatReconciliationScope<Qualification> {
	readonly controllerId: string;
	readonly controllerRevision: number;
	readonly claimId: string;
	readonly claimRevision: number;
	readonly contractFingerprint: string;
	readonly qualification: Qualification;
}
export interface ThermostatReleaseOrderingEvidence<Qualification> {
	readonly proofId: string;
	readonly scope: Omit<ThermostatReconciliationScope<Qualification>, 'qualification'>;
	readonly observedAt: Date;
	readonly isCurrent: () => boolean;
	/** Stable provider lease, independent of a single evaluation/command admission window. */
	readonly sourceIsCurrent: () => boolean;
	readonly physicalIdentity: string;
	readonly connectionIdentity: string;
	readonly coveredCommandIds: readonly string[];
	/** Provider barrier includes all earlier transport aliases and commands, including pre-claim ordinary writers. */
	readonly externalWriterBarrier: true;
	readonly offSample: QualifiedPropertySample;
}
/**
 * Read-only original provider/session continuity, NOT installed readiness, claim/CAS or sample authority.
 * No session, command or disposal capability is exposed. Implementations must be synchronous and pure.
 */
export interface CapturedThermostatReconcileReadiness {
	readonly capabilityVersion: 1;
	readonly providerProfile: ThermostatProviderProfile;
	readonly physicalIdentity: string;
	readonly qualificationGeneration: string;
	readonly isCurrent: () => boolean;
}

export interface ThermostatActuationAdapter<Qualification> {
	readonly contractVersion: 1;
	readonly providerProfile: ThermostatProviderProfile;
	canReconcile(target: IDevicePropertyData, qualification: Qualification): boolean;
	/**
	 * Optional explicit opt-in by trusted INTERNAL registrations only. Missing means bridge-ineligible.
	 * Opt-in certifies capture, isCurrent AND canReconcile as pure synchronous metadata predicates.
	 * Capture must retain the ORIGINAL provider/session guard; later readiness cannot recapture/rescue it.
	 * No I/O, inspection, polling, installation or actuation is permitted in these predicates.
	 */
	captureReconcileReadiness?(
		target: IDevicePropertyData,
		qualification: Qualification,
	): CapturedThermostatReconcileReadiness | null;
	send(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: Qualification | null,
		isAdmitted: () => boolean,
	): Promise<ThermostatActuationResult>;
	/** Only tested ordered/correlated or cancellation barriers may return proof; RPC acceptance is insufficient. */
	reconcile(
		target: IDevicePropertyData,
		commandIds: readonly string[],
		off: QualifiedPropertySample,
		isCurrent: () => boolean,
		scope: ThermostatReconciliationScope<Qualification>,
	): Promise<ThermostatReleaseOrderingEvidence<Qualification> | null>;
}
