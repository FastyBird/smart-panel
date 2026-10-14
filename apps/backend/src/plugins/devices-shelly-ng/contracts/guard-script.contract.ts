import { isIP } from 'node:net';

/** Internal installation evidence only. No public DTO accepts or constructs this contract. */
export interface ShellyGuardScriptQualification {
	readonly scriptId: number;
	/** SHA-256 of complete installed code, including its installation configuration prefix. */
	readonly sourceHash: string;
	readonly endpointHostname: string;
	readonly canonicalMac: string;
	readonly evidenceId: string;
	readonly writerIsolationEvidenceId: string;
	readonly commissioningBarrierEvidenceId: string;
	readonly endpointAuthenticationEvidenceId: string;
	readonly restartDrainEvidenceId: string;
	readonly localExecutionBoundsEvidenceId: string;
	readonly installationMetadata?: {
		readonly componentType: string;
		readonly componentId: number;
		readonly configurationJson: string;
		readonly switchConfigurationJson: string;
		readonly peripheralsJson: string;
	};
	readonly protocol: 'sp-guard-candidate-1';
}
/**
 * Validate installation metadata and a literal IP endpoint before a guard session is eligible.
 * Evidence identifiers reference commissioning results; their presence alone does not prove hardware safety.
 */
export function guardScriptReadiness(value: ShellyGuardScriptQualification | undefined): readonly string[] {
	if (!value) return ['ordered_script_qualification_missing'];
	const identifiers = [
		value.evidenceId,
		value.writerIsolationEvidenceId,
		value.commissioningBarrierEvidenceId,
		value.endpointAuthenticationEvidenceId,
		value.restartDrainEvidenceId,
		value.localExecutionBoundsEvidenceId,
	];
	if (identifiers.some((id) => typeof id !== 'string' || !id.trim() || id.length > 256))
		return ['ordered_script_qualification_invalid'];
	try {
		const endpoint = new URL(`http://${value.endpointHostname}`);
		if (
			isIP(endpoint.hostname.replace(/^\[|\]$/g, '')) === 0 ||
			endpoint.host !== value.endpointHostname ||
			endpoint.username ||
			endpoint.password ||
			endpoint.pathname !== '/' ||
			endpoint.search ||
			endpoint.hash
		)
			return ['ordered_script_endpoint_invalid'];
	} catch {
		return ['ordered_script_endpoint_invalid'];
	}
	return Number.isSafeInteger(value.scriptId) &&
		value.scriptId >= 0 &&
		/^[a-f0-9]{64}$/.test(value.sourceHash) &&
		/^[a-f0-9]{12}$/i.test(value.canonicalMac) &&
		!!value.endpointHostname &&
		!!value.evidenceId &&
		!!value.writerIsolationEvidenceId &&
		!!value.commissioningBarrierEvidenceId &&
		!!value.endpointAuthenticationEvidenceId &&
		!!value.restartDrainEvidenceId &&
		!!value.localExecutionBoundsEvidenceId &&
		value.protocol === 'sp-guard-candidate-1'
		? []
		: ['ordered_script_qualification_invalid'];
}
