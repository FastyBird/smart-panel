import { VirtualThermostatPolicy, validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';

export type ThermostatPreset = 'comfort' | 'eco' | 'away';
export interface ThermostatSetpoints {
	heating_setpoint: number | null;
	cooling_setpoint: number | null;
}
export interface ThermostatComfortConfiguration {
	/** Explicit operator ranges in Celsius, matching the installed branches. No seeded temperatures. */
	heating_range: { minimum: number; maximum: number } | null;
	cooling_range: { minimum: number; maximum: number } | null;
	presets: { preset: ThermostatPreset; setpoints: ThermostatSetpoints }[];
	selected_preset: ThermostatPreset | null;
	user_off: boolean;
	/** Disabled until an operator explicitly opts in; no schedule/presence engine is implemented here. */
	automation_enabled: boolean;
	automation_baseline?: {
		preset: ThermostatPreset | null;
		setpoints: ThermostatSetpoints | null;
		actor_id: string;
		revision: number;
	} | null;
	temporary_override: ThermostatComfortOverride | null;
}
export interface ThermostatComfortOverride {
	id: string;
	source: 'user' | 'panel';
	actor_id: string;
	revision: number;
	created_at: string;
	original_duration_ms?: number;
	wall_watermark_ms?: number;
	expires_at: string;
	preset: ThermostatPreset | null;
	setpoints: ThermostatSetpoints | null;
	/** Resolved once at override creation, so later preset edits cannot overwrite a live override. */
	resolved_setpoints: ThermostatSetpoints;
	status: 'active' | 'expired' | 'cancelled' | 'clock_uncertain';
	terminated_at: string | null;
}
export interface ThermostatEffectiveComfort extends ThermostatSetpoints {
	source: 'manual' | 'preset' | 'automation' | 'override' | 'user_off';
	preset: ThermostatPreset | null;
	override_id: string | null;
	expires_at: string | null;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function validateThermostatSetpoints(
	setpoints: ThermostatSetpoints,
	comfort: Pick<ThermostatComfortConfiguration, 'heating_range' | 'cooling_range'>,
	policy: VirtualThermostatPolicy,
): string[] {
	if (!setpoints) return ['setpoints_required'];
	for (const branch of ['heating', 'cooling'] as const) {
		const value = setpoints[`${branch}_setpoint`];
		const range = comfort[`${branch}_range`];
		const supported = policy[`${branch}Setpoint`] !== null;
		if (
			(supported && (!range || !finite(value) || value < range.minimum || value > range.maximum)) ||
			(!supported && (value !== null || range !== null))
		)
			return ['unsupported_branch_or_setpoint_range'];
	}
	return validateVirtualThermostatPolicy({
		...policy,
		heatingSetpoint: setpoints.heating_setpoint,
		coolingSetpoint: setpoints.cooling_setpoint,
	});
}

export function validateThermostatComfort(
	comfort: ThermostatComfortConfiguration,
	policy: VirtualThermostatPolicy,
): string[] {
	for (const branch of ['heating', 'cooling'] as const) {
		const range = comfort[`${branch}_range`];
		if (
			policy[`${branch}Setpoint`] !== null
				? !range || !finite(range.minimum) || !finite(range.maximum) || range.minimum > range.maximum
				: range !== null
		)
			return ['invalid_branch_range'];
	}
	if (
		typeof comfort.automation_enabled !== 'boolean' ||
		!Array.isArray(comfort.presets) ||
		comfort.presets.length > 3 ||
		new Set(comfort.presets.map((entry) => entry.preset)).size !== comfort.presets.length ||
		comfort.presets.some((entry) => !['comfort', 'eco', 'away'].includes(entry.preset)) ||
		(comfort.selected_preset !== null && !comfort.presets.some((entry) => entry.preset === comfort.selected_preset))
	)
		return ['invalid_preset_configuration'];
	const sets = [
		{ heating_setpoint: policy.heatingSetpoint, cooling_setpoint: policy.coolingSetpoint },
		...comfort.presets.map((entry) => entry.setpoints),
	];
	if (comfort.automation_baseline) {
		const baseline = comfort.automation_baseline;
		if ((baseline.preset === null) === (baseline.setpoints === null)) return ['invalid_automation_baseline'];
		const target = baseline.preset
			? comfort.presets.find((entry) => entry.preset === baseline.preset)?.setpoints
			: baseline.setpoints;
		if (!target) return ['automation_preset_missing'];
		sets.push(target);
	}
	if (['active', 'clock_uncertain'].includes(comfort.temporary_override?.status)) {
		if ((comfort.temporary_override.preset === null) === (comfort.temporary_override.setpoints === null))
			return ['invalid_override'];
		const target = comfort.temporary_override.resolved_setpoints;
		if (!target) return ['override_preset_missing'];
		sets.push(target);
	}
	return sets.flatMap((setpoints) => validateThermostatSetpoints(setpoints, comfort, policy));
}

/** Resolves current configuration, never a captured baseline or historical command. Safety is evaluated downstream. */
export function effectiveThermostatComfort(
	policy: VirtualThermostatPolicy,
	comfort: ThermostatComfortConfiguration | null | undefined,
): ThermostatEffectiveComfort {
	const result: ThermostatEffectiveComfort = {
		heating_setpoint: policy.heatingSetpoint,
		cooling_setpoint: policy.coolingSetpoint,
		source: 'manual',
		preset: null,
		override_id: null,
		expires_at: null,
	};
	if (!comfort) return result;
	const override = ['active', 'clock_uncertain'].includes(comfort.temporary_override?.status)
		? comfort.temporary_override
		: null;
	const automation = comfort.automation_enabled ? comfort.automation_baseline : null;
	const preset = override ? override.preset : automation ? automation.preset : comfort.selected_preset;
	const setpoints =
		override?.resolved_setpoints ??
		automation?.setpoints ??
		comfort.presets.find((entry) => entry.preset === preset)?.setpoints;
	if (setpoints) Object.assign(result, setpoints);
	result.source = comfort.user_off
		? 'user_off'
		: override
			? 'override'
			: automation
				? 'automation'
				: preset
					? 'preset'
					: 'manual';
	result.preset = preset;
	result.override_id = override?.id ?? null;
	result.expires_at = override?.expires_at ?? null;
	return result;
}
