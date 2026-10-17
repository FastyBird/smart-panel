/** Cooling protection is an independent lower surface bound, never a heating floor policy. */
export interface VirtualCoolingPolicy {
	schemaVersion: 1;
	marginC: number;
	recoveryHysteresisC: number;
	absoluteMinimumC?: number | null;
}
export function validCoolingPolicy(policy: VirtualCoolingPolicy): boolean {
	return (
		!!policy &&
		policy.schemaVersion === 1 &&
		Number.isFinite(policy.marginC) &&
		policy.marginC > 0 &&
		policy.marginC <= 60 &&
		Number.isFinite(policy.recoveryHysteresisC) &&
		policy.recoveryHysteresisC > 0 &&
		policy.recoveryHysteresisC <= 60 &&
		(policy.absoluteMinimumC == null ||
			(Number.isFinite(policy.absoluteMinimumC) && policy.absoluteMinimumC > -45 && policy.absoluteMinimumC <= 60))
	);
}
export function evaluateCoolingProtection(
	policy: VirtualCoolingPolicy,
	dewPoint: number | null,
	surface: number | null,
	latched = true,
): { ready: boolean; latched: boolean; threshold: number | null; reasons: string[] } {
	if (!validCoolingPolicy(policy))
		return { ready: false, latched: true, threshold: null, reasons: ['invalid_cooling_policy'] };
	if (
		dewPoint === null ||
		surface === null ||
		!Number.isFinite(dewPoint) ||
		dewPoint <= -45 ||
		dewPoint > 60 ||
		!Number.isFinite(surface) ||
		surface <= -45 ||
		surface > 60
	)
		return { ready: false, latched: true, threshold: null, reasons: ['cooling_evidence_unavailable'] };
	const threshold = Math.max(dewPoint + policy.marginC, policy.absoluteMinimumC ?? -Infinity);
	if (!Number.isFinite(threshold) || threshold > 60)
		return { ready: false, latched: true, threshold: null, reasons: ['cooling_threshold_domain'] };
	if (surface <= threshold) latched = true;
	else if (surface > threshold + policy.recoveryHysteresisC) latched = false;
	return { ready: !latched, latched, threshold, reasons: latched ? ['cooling_surface_cutoff'] : [] };
}
