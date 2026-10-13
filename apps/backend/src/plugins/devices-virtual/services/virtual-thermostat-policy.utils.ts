/** Deterministic demand policy. The runtime owns claims, durable dispatch and physical confirmation. */
export type VirtualThermostatMode = 'off' | 'heat' | 'cool' | 'auto';
export interface VirtualThermostatPolicy {
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
	coldTolerance: number;
	hotTolerance: number;
	neutralMargin: number;
	minimumOffMs: number;
	changeoverMs: number;
	floor: { limit: number; recoveryHysteresis: number } | null;
}
export interface ThermostatActuatorEvidence {
	activity: 'on' | 'off' | 'unknown';
	pendingOn: boolean;
	/** Ordered release proof, including drainage of earlier energizing commands. */
	releaseProven: boolean;
	/** Qualified provider readiness and current controller ownership, never a public override. */
	canEnergize: boolean;
	offSince: number | null;
}
export interface VirtualThermostatPolicyInput {
	now: number;
	mode: VirtualThermostatMode;
	ambient: number | null;
	floor: number | null;
	heating: ThermostatActuatorEvidence | null;
	cooling: ThermostatActuatorEvidence | null;
	previousDemand: 'off' | 'heat' | 'cool';
	floorOverheatLatched: boolean;
	/** Fresh, debounced contact states. Null denotes a mandatory unknown contact. */
	windows: readonly ('closed' | 'open' | null)[];
	heuristicWindowPause: boolean;
	reconciled: boolean;
}
export interface VirtualThermostatDecision {
	desiredHeating: boolean;
	desiredCooling: boolean;
	comfortDemand: 'off' | 'heat' | 'cool';
	floorOverheatLatched: boolean;
	reasons: string[];
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function validateVirtualThermostatPolicy(policy: VirtualThermostatPolicy): string[] {
	const reasons: string[] = [];
	if (
		!policy ||
		!finite(policy.coldTolerance) ||
		policy.coldTolerance < 0 ||
		!finite(policy.hotTolerance) ||
		policy.hotTolerance < 0 ||
		!finite(policy.neutralMargin) ||
		policy.neutralMargin <= 0 ||
		!finite(policy.minimumOffMs) ||
		policy.minimumOffMs < 0 ||
		!finite(policy.changeoverMs) ||
		policy.changeoverMs < 0 ||
		(policy.heatingSetpoint !== null && !finite(policy.heatingSetpoint)) ||
		(policy.coolingSetpoint !== null && !finite(policy.coolingSetpoint)) ||
		(policy.heatingSetpoint === null && policy.coolingSetpoint === null)
	)
		return ['invalid_configuration'];
	const neutralBand = policy.coldTolerance + policy.hotTolerance + policy.neutralMargin;
	if (
		!finite(neutralBand) ||
		[policy.heatingSetpoint, policy.coolingSetpoint].some(
			(setpoint) =>
				setpoint !== null && (!finite(setpoint - policy.coldTolerance) || !finite(setpoint + policy.hotTolerance)),
		)
	)
		reasons.push('invalid_configuration');
	if (
		policy.heatingSetpoint !== null &&
		policy.coolingSetpoint !== null &&
		(!finite(policy.coolingSetpoint - policy.heatingSetpoint) ||
			policy.coolingSetpoint - policy.heatingSetpoint < neutralBand)
	)
		reasons.push('overlapping_setpoints');
	if (
		policy.floor &&
		(policy.heatingSetpoint === null ||
			!finite(policy.floor.limit) ||
			!finite(policy.floor.recoveryHysteresis) ||
			policy.floor.recoveryHysteresis <= 0 ||
			!finite(policy.floor.limit - policy.floor.recoveryHysteresis))
	)
		reasons.push('invalid_floor_guard');
	return reasons;
}

/** Safety inhibits always release immediately; cycle protection only gates new energizing. */
export function evaluateVirtualThermostatPolicy(
	policy: VirtualThermostatPolicy,
	input: VirtualThermostatPolicyInput,
): VirtualThermostatDecision {
	const reasons = validateVirtualThermostatPolicy(policy);
	const result: VirtualThermostatDecision = {
		desiredHeating: false,
		desiredCooling: false,
		comfortDemand: 'off',
		floorOverheatLatched: input.floorOverheatLatched,
		reasons,
	};
	if (reasons.length || !finite(input.now)) {
		if (!finite(input.now)) reasons.push('invalid_clock');
		return result;
	}
	const heatingExists = !!input.heating && policy.heatingSetpoint !== null;
	const coolingExists = !!input.cooling && policy.coolingSetpoint !== null;
	if (
		(input.mode === 'heat' && !heatingExists) ||
		(input.mode === 'cool' && !coolingExists) ||
		(input.mode === 'auto' && (!heatingExists || !coolingExists)) ||
		!['off', 'heat', 'cool', 'auto'].includes(input.mode)
	)
		reasons.push('unsupported_mode');
	if (!input.reconciled) reasons.push('startup_unreconciled');
	if (!finite(input.ambient)) reasons.push('ambient_unavailable');
	if (input.mode === 'off') reasons.push('user_off');
	let floorBlocked = false;
	if (policy.floor) {
		if (!finite(input.floor)) {
			reasons.push('floor_unavailable');
			floorBlocked = true;
		} else {
			if (input.floor >= policy.floor.limit) result.floorOverheatLatched = true;
			else if (input.floor < policy.floor.limit - policy.floor.recoveryHysteresis) result.floorOverheatLatched = false;
			if (result.floorOverheatLatched) {
				reasons.push('floor_overheat');
				floorBlocked = true;
			}
		}
	} else result.floorOverheatLatched = false;
	if (input.windows.includes(null)) reasons.push('contact_unknown');
	if (input.windows.includes('open')) reasons.push('window_open');
	if (input.heuristicWindowPause) reasons.push('suspected_window_open');
	const globalInhibit =
		!input.reconciled ||
		!finite(input.ambient) ||
		input.mode === 'off' ||
		reasons.includes('unsupported_mode') ||
		input.windows.some((state) => state !== 'closed') ||
		input.heuristicWindowPause;
	if (finite(input.ambient) && !reasons.includes('unsupported_mode') && input.mode !== 'off') {
		const heat =
			heatingExists &&
			(input.mode === 'heat' || input.mode === 'auto') &&
			(input.previousDemand === 'heat'
				? input.ambient < policy.heatingSetpoint + policy.hotTolerance
				: input.ambient < policy.heatingSetpoint - policy.coldTolerance);
		const cool =
			coolingExists &&
			(input.mode === 'cool' || input.mode === 'auto') &&
			(input.previousDemand === 'cool'
				? input.ambient > policy.coolingSetpoint - policy.coldTolerance
				: input.ambient > policy.coolingSetpoint + policy.hotTolerance);
		result.comfortDemand = heat ? 'heat' : cool ? 'cool' : 'off';
	}
	if (globalInhibit) return result;
	const admit = (
		branch: 'heating' | 'cooling',
		own: ThermostatActuatorEvidence,
		opposite: ThermostatActuatorEvidence | null,
	) => {
		if (!own.canEnergize || own.activity === 'unknown') {
			reasons.push(branch + '_not_ready');
			return false;
		}
		if (opposite && (opposite.activity !== 'off' || opposite.pendingOn || !opposite.releaseProven)) {
			reasons.push(branch + '_interlock');
			return false;
		}
		if (
			own.activity !== 'on' &&
			(!finite(own.offSince) || input.now < own.offSince || input.now - own.offSince < policy.minimumOffMs)
		) {
			reasons.push(branch + '_cycle_wait');
			return false;
		}
		if (
			own.activity !== 'on' &&
			opposite &&
			(!finite(opposite.offSince) ||
				input.now < opposite.offSince ||
				input.now - opposite.offSince < policy.changeoverMs)
		) {
			reasons.push(branch + '_changeover_wait');
			return false;
		}
		return true;
	};
	if (result.comfortDemand === 'heat' && !floorBlocked)
		result.desiredHeating = admit('heating', input.heating, input.cooling);
	if (result.comfortDemand === 'cool') result.desiredCooling = admit('cooling', input.cooling, input.heating);
	return result;
}
