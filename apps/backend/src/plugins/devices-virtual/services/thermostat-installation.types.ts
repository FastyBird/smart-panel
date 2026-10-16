export const THERMOSTAT_ATTESTATION_KINDS = [
	'commissioning_barrier',
	'writer_isolation',
	'restart_drain',
	'local_execution_bounds',
	'endpoint_authentication',
	'independent_protection',
	'opposed_interlock',
] as const;
export type ThermostatAttestationKind = (typeof THERMOSTAT_ATTESTATION_KINDS)[number];
/** Human evidence is retained as an attestation, never serialized as an RPC drain/physical OFF proof. */
export interface ThermostatOperatorAttestation {
	kind: ThermostatAttestationKind;
	equipment: string;
	procedure: string;
	evidenceReference: string;
	testedAt: string;
	maximumObservedMs?: number;
}
export interface ThermostatGuardSetup {
	/** Absent means the immutable legacy format. */
	formatVersion?: 2;
	installedFloorCeilingC?: number;
	effectiveFloorCutoffC?: number;
	floorDomainC?: { minimum: number; maximum: number };
	deviceHardwareId: string;
	firmware: string;
	endpointHostname: string;
	scriptId: number;
	epochKey: string;
	heatingSetpointRange: { minimum: number; maximum: number } | null;
	coolingSetpointRange: { minimum: number; maximum: number } | null;
	minimumLeaseSeconds: number;
	maximumLeaseSeconds: number;
	watchdogMs: number;
	floorMaximumAgeMs: number;
	floorComponentType: 'temperature' | 'voltmeter' | 'input';
	floorComponentId: number;
	floorAttribute: 'tC' | 'xvoltage' | 'xpercent' | 'voltage';
	floorConfigurationJson: string;
	switchConfigurationJson: string;
	peripheralsJson: string;
	floorConversion?: {
		kind: 'steinhart_hart';
		referenceVoltage: number;
		seriesResistance: number;
		a: number;
		b: number;
		c: number;
		thermistorLeg: 'low' | 'high';
		inputRange: { minimum: number; maximum: number };
		outputRange: { minimum: number; maximum: number };
	};
}
export interface ThermostatMachineObservation {
	observedAt: string;
	configurationRevision?: number;
	state: 'verified_metadata' | 'blocked';
	reasons: string[];
	scriptHash?: string;
	firmware?: string;
	/** Metadata observations do not certify physical interlocks, cancellation, or electrical isolation. */
	physicalSafetyCertified: false;
}

/** Catalog-derived fields are deliberately absent from the new authoring request. */
export type ThermostatMemberGuardSetup = Pick<
	ThermostatGuardSetup,
	| 'deviceHardwareId'
	| 'firmware'
	| 'endpointHostname'
	| 'scriptId'
	| 'epochKey'
	| 'heatingSetpointRange'
	| 'coolingSetpointRange'
	| 'minimumLeaseSeconds'
	| 'maximumLeaseSeconds'
	| 'watchdogMs'
	| 'switchConfigurationJson'
> & { formatVersion: 2; installedFloorCeilingC: number };
