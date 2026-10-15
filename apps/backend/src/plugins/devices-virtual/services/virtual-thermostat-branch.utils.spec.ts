import { thermostatBranchActivity, thermostatBranchEvidence } from './virtual-thermostat-branch.utils';
import { ThermostatActuatorEvidence, evaluateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';

const off = (offSince: number): ThermostatActuatorEvidence => ({
	activity: 'off',
	pendingOn: false,
	releaseProven: true,
	canEnergize: true,
	offSince,
});

describe('mandatory thermostat branch evidence', () => {
	it.each([
		[[], 'unknown'],
		[['on', 'on'], 'on'],
		[['off', 'off'], 'off'],
		[['on', 'off'], 'unknown'],
		[['off', 'unknown'], 'unknown'],
		[['on', 'unknown'], 'unknown'],
	] as const)(
		'reports actual consensus for %j',
		(activities: readonly ThermostatActuatorEvidence['activity'][], expected) => {
			expect(thermostatBranchActivity(activities.map((activity) => ({ activity })))).toBe(expected);
		},
	);

	it('requires each member and never borrows readiness or drain proof from a sibling', () => {
		expect(thermostatBranchEvidence([])).toBeNull();
		const evidence = thermostatBranchEvidence([
			off(1),
			{ ...off(2), activity: 'unknown', canEnergize: false, pendingOn: true, releaseProven: false, offSince: null },
		]);
		expect(evidence).toMatchObject({
			activity: 'unknown',
			canEnergize: false,
			pendingOn: true,
			releaseProven: false,
			offSince: null,
		});
	});

	it('starts opposed changeover at the last member OFF and admits the exact interval boundary', () => {
		const evaluate = (now: number, last: ThermostatActuatorEvidence = off(9000)) =>
			evaluateVirtualThermostatPolicy(
				{
					heatingSetpoint: 20,
					coolingSetpoint: 24,
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 1000,
					floor: null,
				},
				{
					now,
					mode: 'auto',
					ambient: 26,
					floor: null,
					heating: thermostatBranchEvidence([off(1000), last]),
					cooling: off(1000),
					previousDemand: 'off',
					floorOverheatLatched: false,
					windows: [],
					heuristicWindowPause: false,
					reconciled: true,
				},
			);
		expect(evaluate(9999)).toMatchObject({ desiredCooling: false, reasons: ['cooling_changeover_wait'] });
		expect(evaluate(10000).desiredCooling).toBe(true);
		expect(evaluate(10000, { ...off(9000), pendingOn: true }).desiredCooling).toBe(false);
		expect(evaluate(10000, { ...off(9000), releaseProven: false }).desiredCooling).toBe(false);
		expect(evaluate(10000, { ...off(9000), activity: 'unknown' }).desiredCooling).toBe(false);
	});
});
