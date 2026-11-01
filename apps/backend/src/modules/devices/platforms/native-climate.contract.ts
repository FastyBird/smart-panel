/** Native regulation is delegation, never a protective output lease or physical completion proof. */
export type NativeClimateMode = 'off' | 'heat' | 'cool' | 'auto';
export interface NativeClimateRequest {
	readonly mode?: NativeClimateMode;
	readonly heatingSetpoint?: number;
	readonly coolingSetpoint?: number;
}
export interface NativeClimateRange {
	readonly minimum: number;
	readonly maximum: number;
	readonly step: number;
}
export interface NativeClimateCapabilities {
	readonly modes: readonly NativeClimateMode[];
	/** All public settings and observations use degrees Celsius. */
	readonly heating: NativeClimateRange | null;
	readonly cooling: NativeClimateRange | null;
	readonly supportsCompound: boolean;
}
export interface NativeClimateObservation {
	/** Internal original-sample lease; functions are never serialized as API data. */
	readonly isCurrent?: () => boolean;
	readonly available: boolean;
	readonly temperature: number | null;
	readonly mode: NativeClimateMode | null;
	readonly heatingSetpoint: number | null;
	readonly coolingSetpoint: number | null;
	readonly activity: 'heating' | 'cooling' | 'idle' | null;
	readonly observedAt: string | null;
	readonly reasons: readonly string[];
}
export interface NativeClimateOperationResult {
	readonly operation: string;
	readonly outcome: 'accepted' | 'refused' | 'unknown';
	readonly reason?: string;
	/** Provider acceptance and matching later telemetry are not causal physical confirmation. */
	readonly confirmed: false;
}
export interface PreparedNativeClimateRequest {
	readonly isCurrent: () => boolean;
	readonly dispatch: (isAdmitted: () => boolean) => Promise<readonly NativeClimateOperationResult[]>;
}
/** A process-local snapshot of one canonical unit and its original provider connection/capabilities. */
export interface NativeClimateUnit {
	readonly contractVersion: 1;
	readonly provider: 'home-assistant' | 'zigbee2mqtt';
	readonly deviceId: string;
	readonly physicalIdentity: string;
	readonly fingerprint: string;
	readonly ownedPropertyIds: readonly string[];
	readonly capabilities: NativeClimateCapabilities;
	readonly isCurrent: () => boolean;
	readonly observe: () => NativeClimateObservation;
	/** Unsupported requests return null before any transport or state mutation. */
	readonly prepare: (request: NativeClimateRequest) => PreparedNativeClimateRequest | null;
}
