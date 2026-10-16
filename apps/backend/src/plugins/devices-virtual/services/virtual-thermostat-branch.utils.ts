import { ThermostatActuatorEvidence } from './virtual-thermostat-policy.utils';

/** All members are mandatory. A branch's OFF clock starts with its last qualified member OFF. */
export function thermostatBranchEvidence(
	members: readonly ThermostatActuatorEvidence[],
): ThermostatActuatorEvidence | null {
	if (!members.length) return null;
	return {
		// For demand hysteresis, a partially running branch is running. Published activity requires consensus instead.
		activity: members.some((member) => member.activity === 'unknown')
			? 'unknown'
			: members.some((member) => member.activity === 'on')
				? 'on'
				: 'off',
		pendingOn: members.some((member) => member.pendingOn),
		releaseProven: members.every((member) => member.activity === 'off' && member.releaseProven && !member.pendingOn),
		canEnergize: members.every((member) => member.canEnergize),
		offSince: members.every((member) => member.offSince !== null)
			? Math.max(...members.map((member) => member.offSince))
			: null,
	};
}

/** Mixed/partial activity is unknown, never an aggregate statement based on one sibling. */
export function thermostatBranchActivity(
	members: readonly { activity: 'on' | 'off' | 'unknown' }[],
): 'on' | 'off' | 'unknown' {
	return members.length && members.every((member) => member.activity === 'on')
		? 'on'
		: members.length && members.every((member) => member.activity === 'off')
			? 'off'
			: 'unknown';
}
