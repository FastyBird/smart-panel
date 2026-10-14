import {
	VirtualThermostatPolicy,
	VirtualThermostatPolicyInput,
	evaluateVirtualThermostatPolicy,
	validateVirtualThermostatPolicy,
} from './virtual-thermostat-policy.utils';

const policy: VirtualThermostatPolicy = {
	heatingSetpoint: 21,
	coolingSetpoint: 25,
	coldTolerance: 0.5,
	hotTolerance: 0.5,
	neutralMargin: 1,
	minimumOffMs: 1000,
	changeoverMs: 2000,
	floor: { limit: 29, recoveryHysteresis: 2 },
};
const evidence = () => ({
	activity: 'off' as const,
	pendingOn: false,
	releaseProven: true,
	canEnergize: true,
	offSince: 0,
});
const input = (): VirtualThermostatPolicyInput => ({
	now: 10_000,
	mode: 'auto',
	ambient: 20,
	floor: 25,
	heating: evidence(),
	cooling: evidence(),
	previousDemand: 'off',
	floorOverheatLatched: false,
	windows: [],
	heuristicWindowPause: false,
	reconciled: true,
});

describe('virtual thermostat demand policy', () => {
	it.each([
		[20, true, false],
		[20.5, false, false],
		[23, false, false],
		[25.5, false, false],
		[26, false, true],
	])('has separated start thresholds at %s', (ambient, heating, cooling) => {
		expect(evaluateVirtualThermostatPolicy(policy, { ...input(), ambient })).toMatchObject({
			desiredHeating: heating,
			desiredCooling: cooling,
		});
	});
	it.each([
		['heat', 21.49, true, false],
		['heat', 21.5, false, false],
		['cool', 24.51, false, true],
		['cool', 24.5, false, false],
	] as const)(
		'releases %s at its hysteresis boundary %s',
		(previousDemand, ambient, desiredHeating, desiredCooling) => {
			expect(evaluateVirtualThermostatPolicy(policy, { ...input(), previousDemand, ambient })).toMatchObject({
				desiredHeating,
				desiredCooling,
			});
		},
	);
	it('releases heat immediately at the floor limit despite continuing comfort demand', () => {
		const result = evaluateVirtualThermostatPolicy(policy, {
			...input(),
			previousDemand: 'heat',
			heating: { ...evidence(), activity: 'on', offSince: null },
			floor: 29,
		});
		expect(result).toMatchObject({ desiredHeating: false, comfortDemand: 'heat', floorOverheatLatched: true });
		expect(result.reasons).toContain('floor_overheat');
	});
	it.each([27, 28, 29])('keeps floor inhibit latched at %s including recovery equality', (floor) => {
		expect(
			evaluateVirtualThermostatPolicy(policy, { ...input(), floorOverheatLatched: true, floor }).desiredHeating,
		).toBe(false);
	});
	it('recovers strictly below the floor recovery threshold and reevaluates latest mode', () => {
		expect(
			evaluateVirtualThermostatPolicy(policy, { ...input(), floorOverheatLatched: true, floor: 26.99 }),
		).toMatchObject({ desiredHeating: true, floorOverheatLatched: false });
		expect(
			evaluateVirtualThermostatPolicy(policy, { ...input(), floorOverheatLatched: true, floor: 26.99, mode: 'off' })
				.desiredHeating,
		).toBe(false);
	});
	it.each([null, NaN, Infinity])(
		'blocks heating on invalid configured floor %s while preserving the latch',
		(floor) => {
			const result = evaluateVirtualThermostatPolicy(policy, { ...input(), floorOverheatLatched: true, floor });
			expect(result).toMatchObject({ desiredHeating: false, floorOverheatLatched: true });
			expect(result.reasons).toContain('floor_unavailable');
		},
	);
	it('floor protection does not become another ambient setpoint or inhibit an otherwise safe cooling branch', () => {
		expect(evaluateVirtualThermostatPolicy(policy, { ...input(), ambient: 26, floor: null })).toMatchObject({
			desiredHeating: false,
			desiredCooling: true,
		});
	});
	it.each([
		{ mode: 'off' as const },
		{ ambient: null },
		{ windows: ['open'] as const },
		{ windows: [null] },
		{ heuristicWindowPause: true },
		{ reconciled: false },
	])('releases immediately on a safety/user inhibit %j', (changes) => {
		const result = evaluateVirtualThermostatPolicy(policy, {
			...input(),
			heating: { ...evidence(), activity: 'on' },
			previousDemand: 'heat',
			...changes,
		});
		expect(result.desiredHeating).toBe(false);
		expect(result.desiredCooling).toBe(false);
	});
	it('reports every simultaneous reason instead of letting one inhibit mask another', () => {
		const result = evaluateVirtualThermostatPolicy(policy, {
			...input(),
			mode: 'off',
			ambient: null,
			floor: 30,
			windows: ['open', null],
			heuristicWindowPause: true,
			reconciled: false,
		});
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				'startup_unreconciled',
				'ambient_unavailable',
				'user_off',
				'floor_overheat',
				'window_open',
				'contact_unknown',
				'suspected_window_open',
			]),
		);
	});
	it.each([
		{ pendingOn: true },
		{ activity: 'unknown' as const },
		{ activity: 'on' as const },
		{ releaseProven: false },
	])('blocks cooling until earlier heating ON has drained %j', (changes) => {
		const result = evaluateVirtualThermostatPolicy(policy, {
			...input(),
			ambient: 26,
			heating: { ...evidence(), ...changes },
		});
		expect(result.desiredCooling).toBe(false);
		expect(result.reasons).toContain('cooling_interlock');
	});
	it.each([null, 10_001, 9_001])('requires known, monotonic minimum-off evidence before energizing %s', (offSince) => {
		expect(
			evaluateVirtualThermostatPolicy(policy, { ...input(), heating: { ...evidence(), offSince } }).desiredHeating,
		).toBe(false);
	});
	it('admits energizing at minimum-off equality and changeover equality', () => {
		expect(
			evaluateVirtualThermostatPolicy(policy, {
				...input(),
				heating: { ...evidence(), offSince: 9000 },
				cooling: { ...evidence(), offSince: 8000 },
			}).desiredHeating,
		).toBe(true);
	});
	it('rejects overlapping persisted setpoint pairs and a cooling-only floor guard', () => {
		expect(validateVirtualThermostatPolicy({ ...policy, coolingSetpoint: 22 })).toContain('overlapping_setpoints');
		expect(validateVirtualThermostatPolicy({ ...policy, heatingSetpoint: null })).toContain('invalid_floor_guard');
	});
	it('exposes heat/cool/auto only for the configured actuator branches', () => {
		expect(
			evaluateVirtualThermostatPolicy({ ...policy, coolingSetpoint: null }, { ...input(), mode: 'auto', cooling: null })
				.reasons,
		).toContain('unsupported_mode');
		expect(
			evaluateVirtualThermostatPolicy({ ...policy, coolingSetpoint: null }, { ...input(), mode: 'heat', cooling: null })
				.desiredHeating,
		).toBe(true);
	});
	it('never uses a cycle/changeover wait to release an already active healthy branch', () => {
		expect(
			evaluateVirtualThermostatPolicy(policy, {
				...input(),
				previousDemand: 'heat',
				heating: { ...evidence(), activity: 'on', offSince: null },
				cooling: { ...evidence(), offSince: 9999 },
			}).desiredHeating,
		).toBe(true);
	});
	it('rejects nonfinite thresholds produced from finite policy operands', () => {
		expect(
			validateVirtualThermostatPolicy({
				...policy,
				heatingSetpoint: Number.MAX_VALUE,
				coolingSetpoint: null,
				hotTolerance: Number.MAX_VALUE,
			}),
		).toContain('invalid_configuration');
		expect(
			validateVirtualThermostatPolicy({
				...policy,
				heatingSetpoint: -Number.MAX_VALUE,
				coolingSetpoint: Number.MAX_VALUE,
			}),
		).toContain('overlapping_setpoints');
	});
});
