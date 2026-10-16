import { toRaw } from 'vue';

import {
	DevicesVirtualPluginConfigureDewPointSchema_version,
	DevicesVirtualPluginCoolingDependencyPurpose,
	DevicesVirtualPluginThermostatMemberProtectionKind,
	SpacesModuleClimateIntentMode,
	type components,
} from '../../../openapi';

export type ThermostatConfiguration = components['schemas']['DevicesVirtualPluginDataThermostatConfiguration'];
export type ThermostatRequest = components['schemas']['DevicesVirtualPluginConfigureThermostat'];
export type ThermostatSource = ThermostatRequest['sources'][number];
export type ThermostatActuator = ThermostatRequest['actuators'][number];
export type ThermostatSetting = ThermostatRequest['settings'][number];

export type ThermostatClaim = ThermostatConfiguration['actuators'][number];
export type ThermostatMemberDraft = Omit<ThermostatActuator, 'lease_seconds' | 'source_property'> & {
	source_property: string | null;
	lease_seconds: number | null;
	retained?: ThermostatClaim;
};

export interface ThermostatDraft {
	display_floor_claim?: string | null;
	requested_mode: ThermostatRequest['requested_mode'];
	policy: {
		heatingSetpoint: number | null;
		coolingSetpoint: number | null;
		coldTolerance: number | null;
		hotTolerance: number | null;
		neutralMargin: number | null;
		minimumOffMs: number | null;
		changeoverMs: number | null;
		floor: { limit: number | null; recoveryHysteresis: number | null } | null;
		cooling?: { schemaVersion: 1; marginC: number | null; recoveryHysteresisC: number | null; absoluteMinimumC?: number | null } | null;
	};
	heuristic: {
		sampleWindowMs: number | null;
		minimumSamples: number | null;
		minimumSpanMs: number | null;
		maximumSampleAgeMs: number | null;
		slopeThresholdCPerMinute: number | null;
		confirmationMs: number | null;
		recoveryMs: number | null;
		maximumPauseMs: number | null;
		cooldownMs: number | null;
	} | null;
	contact_opening_ms: number | null;
	contact_closing_ms: number | null;
	sources: (Omit<ThermostatSource, 'maximum_age_seconds'> & { maximum_age_seconds: number | null })[];
	actuators: ThermostatMemberDraft[];
	settings: ThermostatSetting[];
}

export const emptyThermostatDraft = (): ThermostatDraft => ({
	requested_mode: SpacesModuleClimateIntentMode.off,
	policy: {
		heatingSetpoint: null,
		coolingSetpoint: null,
		coldTolerance: null,
		hotTolerance: null,
		neutralMargin: null,
		minimumOffMs: null,
		changeoverMs: null,
		floor: null,
	},
	heuristic: null,
	contact_opening_ms: null,
	contact_closing_ms: null,
	sources: [],
	actuators: [],
	settings: [],
});

export const draftFromConfiguration = (config: ThermostatConfiguration): ThermostatDraft => ({
	display_floor_claim: config.display_floor_claim ?? null,
	requested_mode: config.requested_mode,
	policy: structuredClone(toRaw(config.policy)),
	heuristic: config.heuristic ? structuredClone(toRaw(config.heuristic)) : null,
	contact_opening_ms: config.contact_opening_ms,
	contact_closing_ms: config.contact_closing_ms,
	sources: config.sources.map((source) => ({
		id: source.id,
		role: source.role,
		source_property: source.source_property,
		maximum_age_seconds: source.maximum_age_seconds,
		open_value: source.open_value,
		closed_value: source.closed_value,
	})),
	actuators: config.actuators.map((claim) => ({
		role: claim.role,
		source_property: claim.source_property ?? claim.source_identity,
		lease_seconds: claim.lease_seconds,
		retained: structuredClone(toRaw(claim)),
		...(claim.cooling_protection
			? {
					cooling_protection: {
						schemaVersion: DevicesVirtualPluginConfigureDewPointSchema_version.Value1,
						purpose: DevicesVirtualPluginCoolingDependencyPurpose.cooled_surface,
						dew_point_property: claim.cooling_protection.dew_point_property,
						surface_property: claim.cooling_protection.surface_property,
						maximum_age_seconds: claim.cooling_protection.maximum_age_seconds,
					} as ThermostatActuator['cooling_protection'],
				}
			: {}),
		...(claim.protection
			? {
					protection: {
						schema_version: DevicesVirtualPluginConfigureDewPointSchema_version.Value1,
						kind: DevicesVirtualPluginThermostatMemberProtectionKind.local_floor,
						source_property: claim.protection.source_property,
						maximum_age_seconds: claim.protection.maximum_age_seconds,
					},
				}
			: {}),
	})),
	settings: config.settings.map((setting) => ({ ...setting })),
});

/** Preserve editable intent while authoritative release results replace every retained ownership identity. */
export const draftAfterRelease = (draft: ThermostatDraft, config: ThermostatConfiguration): ThermostatDraft => {
	const authoritative = draftFromConfiguration(config);
	return {
		...draft,
		display_floor_claim: authoritative.actuators.some((member) => member.retained?.id === draft.display_floor_claim)
			? draft.display_floor_claim
			: null,
		actuators: [
			...authoritative.actuators.map((member) => {
				const edited = draft.actuators.find((entry) => entry.retained?.id === member.retained?.id);
				return edited ? { ...edited, source_property: member.source_property, retained: member.retained } : member;
			}),
			...draft.actuators.filter((member) => !member.retained),
		],
	};
};

const finite = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value);
const whole = (value: number | null): value is number => finite(value) && Number.isInteger(value);

/** Client-side completeness only. The backend preview decides eligibility and ownership. */
export const buildThermostatRequest = (
	draft: ThermostatDraft,
	revision: number,
	graphRevision?: number
): { request?: ThermostatRequest; errors: string[] } => {
	const errors: string[] = [];
	const policy = draft.policy;
	if (policy.cooling) {
		if (
			!finite(policy.cooling.marginC) ||
			policy.cooling.marginC <= 0 ||
			policy.cooling.marginC > 60 ||
			!finite(policy.cooling.recoveryHysteresisC) ||
			policy.cooling.recoveryHysteresisC <= 0 ||
			policy.cooling.recoveryHysteresisC > 60
		)
			errors.push('devicesVirtualPlugin.dewPoint.errors.coolingPolicy');
		if (
			policy.cooling.absoluteMinimumC != null &&
			(!finite(policy.cooling.absoluteMinimumC) || policy.cooling.absoluteMinimumC <= -45 || policy.cooling.absoluteMinimumC > 60)
		)
			errors.push('devicesVirtualPlugin.dewPoint.errors.coolingMinimum');
		for (const member of draft.actuators.filter((m) => m.role === 'cooling'))
			if (
				!member.cooling_protection ||
				(!member.cooling_protection.dew_point_property &&
					!(member.cooling_protection.dew_point_property === null && member.retained?.cooling_protection?.dew_point_property === null)) ||
				(!member.cooling_protection.surface_property &&
					!(member.cooling_protection.surface_property === null && member.retained?.cooling_protection?.surface_property === null)) ||
				!whole(member.cooling_protection.maximum_age_seconds) ||
				member.cooling_protection.maximum_age_seconds < 1 ||
				member.cooling_protection.maximum_age_seconds > 86400
			)
				errors.push('devicesVirtualPlugin.dewPoint.errors.coolingDependencies');
	}
	if (!finite(policy.heatingSetpoint) && !finite(policy.coolingSetpoint)) errors.push('Select at least one comfort branch and setpoint.');
	if (!finite(policy.coldTolerance) || policy.coldTolerance < 0) errors.push('Enter a nonnegative cold tolerance.');
	if (!finite(policy.hotTolerance) || policy.hotTolerance < 0) errors.push('Enter a nonnegative hot tolerance.');
	if (!finite(policy.neutralMargin) || policy.neutralMargin <= 0) errors.push('Enter a positive neutral margin.');
	if (!whole(policy.minimumOffMs) || policy.minimumOffMs < 0) errors.push('Enter the minimum OFF interval in milliseconds.');
	if (!whole(policy.changeoverMs) || policy.changeoverMs < 0) errors.push('Enter the changeover interval in milliseconds.');
	if (policy.floor && (!finite(policy.floor.limit) || !finite(policy.floor.recoveryHysteresis) || policy.floor.recoveryHysteresis <= 0)) {
		errors.push('Enter the floor limit and positive recovery hysteresis in Celsius.');
	}
	if (draft.heuristic && Object.values(draft.heuristic).some((value) => !finite(value))) {
		errors.push('Complete every enabled trend setting.');
	}
	if (!whole(draft.contact_opening_ms) || draft.contact_opening_ms < 0 || !whole(draft.contact_closing_ms) || draft.contact_closing_ms < 0) {
		errors.push('Enter both contact debounce intervals in milliseconds.');
	}
	if (draft.sources.filter((source) => source.role === 'ambient').length !== 1) errors.push('Configure exactly one ambient source.');
	if (draft.sources.some((source) => source.role === 'floor') && !policy.floor)
		errors.push('Retain a common floor policy for the existing global guard.');
	if (
		policy.floor &&
		!draft.sources.some((source) => source.role === 'floor') &&
		!(
			draft.actuators.some((member) => member.role === 'heating') &&
			draft.actuators.filter((member) => member.role === 'heating').every((member) => !!member.protection)
		)
	)
		errors.push('Floor protection requires a global source or an explicit local guard for every heating member.');
	if (draft.sources.filter((source) => source.role === 'contact').length > 1) errors.push('Configure at most one contact source.');
	for (const source of draft.sources) {
		if (!whole(source.maximum_age_seconds) || source.maximum_age_seconds < 1) errors.push(`Enter a positive maximum age for ${source.role}.`);
		if (!source.source_property && !source.id) errors.push(`Select a ${source.role} source.`);
		if (source.role === 'contact' && (source.open_value == null || source.closed_value == null))
			errors.push('Map both contact open and closed values.');
		if (source.role === 'contact' && source.open_value === source.closed_value) errors.push('Contact open and closed values must differ.');
	}
	if (!draft.actuators.length) errors.push('Select at least one physical actuator.');
	for (const role of ['heating', 'cooling'] as const) {
		if (draft.actuators.some((actuator) => actuator.role === role) !== finite(policy[`${role}Setpoint`]))
			errors.push(`${role} actuator must match its comfort setpoint branch.`);
	}
	if (draft.actuators.length > 8) errors.push('At most eight mandatory members, including retained claims, are allowed.');
	if (new Set(draft.actuators.map((member) => member.source_property)).size !== draft.actuators.length)
		errors.push('Each physical member must be distinct.');
	const parallelHeating = draft.actuators.filter((member) => member.role === 'heating').length > 1;
	for (const actuator of draft.actuators) {
		if (actuator.retained && !actuator.retained.source_property)
			errors.push(`Repair retained claim ${actuator.retained.id}; its ownership is preserved.`);
		if (actuator.role === 'heating' && (parallelHeating || actuator.protection)) {
			if (!policy.floor) errors.push('Enter the shared floor limit and hysteresis for local protection.');
			if (!actuator.protection || (!actuator.protection.source_property && !actuator.retained?.protection))
				errors.push('Every heating member requires an explicit local protective source.');
			if (actuator.protection && (!whole(actuator.protection.maximum_age_seconds) || actuator.protection.maximum_age_seconds < 1))
				errors.push('Enter a positive protective source maximum age.');
		}
		if (!actuator.source_property) errors.push(`Repair the ${actuator.role} actuator before saving.`);
		if (!finite(actuator.lease_seconds) || actuator.lease_seconds <= 0) errors.push(`Enter a positive ${actuator.role} ON lease.`);
	}
	if (new Set(draft.settings.map((setting) => setting.setting)).size !== draft.settings.length)
		errors.push('Each local setting role may be registered once.');
	if (draft.settings.some((setting) => !setting.property)) errors.push('Select a local property for each setting.');
	if (errors.length) return { errors };
	return {
		errors,
		request: {
			schema_version: 1,
			expected_revision: revision,
			...(graphRevision === undefined ? {} : { expected_graph_revision: graphRevision }),
			display_floor_claim: draft.display_floor_claim,
			requested_mode: draft.requested_mode,
			policy: policy as ThermostatRequest['policy'],
			heuristic: draft.heuristic as ThermostatRequest['heuristic'],
			contact_opening_ms: draft.contact_opening_ms as number,
			contact_closing_ms: draft.contact_closing_ms as number,
			sources: draft.sources as ThermostatSource[],
			actuators: draft.actuators.map((member) => ({
				role: member.role,
				source_property: member.source_property,
				lease_seconds: member.lease_seconds,
				...(member.protection ? { protection: member.protection } : {}),
				...(member.cooling_protection ? { cooling_protection: member.cooling_protection } : {}),
			})) as ThermostatActuator[],
			settings: draft.settings,
		},
	};
};
