import type { ThermostatMemberContext, ThermostatStageRequest } from './thermostat-members';

export const attestationKinds = [
	'commissioning_barrier',
	'writer_isolation',
	'restart_drain',
	'local_execution_bounds',
	'endpoint_authentication',
	'independent_protection',
	'opposed_interlock',
] as const;
export interface MemberInstallationDraft {
	endpoint: string;
	epoch: string;
	script: number | null;
	ceiling: number | null;
	minimumLease: number | null;
	maximumLease: number | null;
	watchdog: number | null;
	heatingMinimum: number | null;
	heatingMaximum: number | null;
	coolingMinimum: number | null;
	coolingMaximum: number | null;
	attestations: {
		kind: string;
		equipment: string;
		procedure: string;
		evidenceReference: string;
		testedAt: string;
		maximumObservedMs: number | null;
	}[];
}
export const emptyMemberInstallation = (): MemberInstallationDraft => ({
	endpoint: '',
	epoch: '',
	script: null,
	ceiling: null,
	minimumLease: null,
	maximumLease: null,
	watchdog: null,
	heatingMinimum: null,
	heatingMaximum: null,
	coolingMinimum: null,
	coolingMaximum: null,
	attestations: [],
});
const number = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value);
export function memberInstallationRequest(
	draft: MemberInstallationDraft,
	context: ThermostatMemberContext | null,
	revision: number,
	generation?: string | null
): ThermostatStageRequest | null {
	if (
		!context?.device_hardware_id ||
		!context.firmware ||
		!context.switch_configuration_json ||
		context.reasons.length ||
		!draft.endpoint.trim() ||
		!draft.epoch.trim() ||
		!number(draft.script) ||
		!Number.isInteger(draft.script) ||
		!number(draft.ceiling) ||
		!number(draft.minimumLease) ||
		!number(draft.maximumLease) ||
		!number(draft.watchdog) ||
		!number(draft.heatingMinimum) ||
		!number(draft.heatingMaximum) ||
		draft.heatingMinimum >= draft.heatingMaximum ||
		((draft.coolingMinimum !== null || draft.coolingMaximum !== null) &&
			(!number(draft.coolingMinimum) || !number(draft.coolingMaximum) || draft.coolingMinimum >= draft.coolingMaximum)) ||
		draft.attestations.some(
			(item) => !item.equipment.trim() || !item.procedure.trim() || !item.evidenceReference.trim() || !Number.isFinite(Date.parse(item.testedAt))
		)
	)
		return null;
	return {
		expected_revision: revision,
		expected_configuration_revision: context.configuration_revision,
		expected_claim_revision: context.claim_revision,
		expected_qualification_generation: generation,
		member_setup: {
			format_version: 2,
			installed_floor_ceiling_c: draft.ceiling,
			device_hardware_id: context.device_hardware_id,
			firmware: context.firmware,
			switch_configuration_json: context.switch_configuration_json,
			endpoint_hostname: draft.endpoint.trim(),
			script_id: draft.script,
			epoch_key: draft.epoch.trim(),
			heating_setpoint_range: { minimum: draft.heatingMinimum, maximum: draft.heatingMaximum },
			cooling_setpoint_range: draft.coolingMinimum === null ? null : { minimum: draft.coolingMinimum, maximum: draft.coolingMaximum! },
			minimum_lease_seconds: draft.minimumLease,
			maximum_lease_seconds: draft.maximumLease,
			watchdog_ms: draft.watchdog,
		},
		operator_attestations: draft.attestations.map(({ maximumObservedMs, ...item }) => ({
			...item,
			...(maximumObservedMs === null ? {} : { maximumObservedMs }),
		})),
	} as ThermostatStageRequest;
}
