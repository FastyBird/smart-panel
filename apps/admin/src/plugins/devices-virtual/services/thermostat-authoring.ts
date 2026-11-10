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

/** Recommended starting values for the mandatory per-entry fields of a new thermostat. */
export const RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS = 300;
export const RECOMMENDED_ACTUATOR_LEASE_SECONDS = 600;

/**
 * Starting point for a thermostat that does not exist yet. Unlike {@link emptyThermostatDraft} the
 * timing and tolerance fields carry recommended values: every one of them is mandatory, none has an
 * obvious value to someone meeting the form for the first time, and an all-blank form answered with
 * a wall of validation errors before anything had been touched. They are ordinary editable values —
 * setpoints, sources and members still have to be chosen, because those depend on the room.
 */
export const newThermostatDraft = (): ThermostatDraft => {
	const draft = emptyThermostatDraft();

	draft.policy.coldTolerance = 0.5;
	draft.policy.hotTolerance = 0.5;
	draft.policy.neutralMargin = 1;
	draft.policy.minimumOffMs = 300_000;
	draft.policy.changeoverMs = 600_000;
	draft.contact_opening_ms = 30_000;
	draft.contact_closing_ms = 60_000;

	return draft;
};

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

const THERMOSTAT_ERRORS = 'devicesVirtualPlugin.thermostat.errors';
const THERMOSTAT_ROLES = 'devicesVirtualPlugin.thermostat.roles';

/**
 * Validation problems are reported as translation keys, never as prose: this module has no access to
 * the active locale, and its messages are shown verbatim in the editor. A key may carry parameters
 * after a `?`, as JSON — `role` names a source or actuator role and is itself translated.
 */
export const thermostatError = (key: string, params?: Record<string, string>): string =>
	`${THERMOSTAT_ERRORS}.${key}${params ? `?${JSON.stringify(params)}` : ''}`;

/** Renders a problem produced by {@link thermostatError} (or any plain translation key) for display. */
export const translateThermostatError = (t: (key: string, params?: Record<string, unknown>) => string, error: string): string => {
	if (!error.startsWith('devicesVirtualPlugin.')) return error;
	const separator = error.indexOf('?');
	if (separator < 0) return t(error);
	const params = JSON.parse(error.slice(separator + 1)) as Record<string, string>;
	return t(error.slice(0, separator), { ...params, ...(params.role ? { role: t(`${THERMOSTAT_ROLES}.${params.role}`) } : {}) });
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
	if (!finite(policy.heatingSetpoint) && !finite(policy.coolingSetpoint)) errors.push(thermostatError('setpointRequired'));
	if (!finite(policy.coldTolerance) || policy.coldTolerance < 0) errors.push(thermostatError('coldTolerance'));
	if (!finite(policy.hotTolerance) || policy.hotTolerance < 0) errors.push(thermostatError('hotTolerance'));
	if (!finite(policy.neutralMargin) || policy.neutralMargin <= 0) errors.push(thermostatError('neutralMargin'));
	if (!whole(policy.minimumOffMs) || policy.minimumOffMs < 0) errors.push(thermostatError('minimumOff'));
	if (!whole(policy.changeoverMs) || policy.changeoverMs < 0) errors.push(thermostatError('changeover'));
	if (policy.floor && (!finite(policy.floor.limit) || !finite(policy.floor.recoveryHysteresis) || policy.floor.recoveryHysteresis <= 0)) {
		errors.push(thermostatError('floorPolicy'));
	}
	if (draft.heuristic && Object.values(draft.heuristic).some((value) => !finite(value))) {
		errors.push(thermostatError('trendIncomplete'));
	}
	if (!whole(draft.contact_opening_ms) || draft.contact_opening_ms < 0 || !whole(draft.contact_closing_ms) || draft.contact_closing_ms < 0) {
		errors.push(thermostatError('contactDebounce'));
	}
	if (draft.sources.filter((source) => source.role === 'ambient').length !== 1) errors.push(thermostatError('ambientSource'));
	if (draft.sources.some((source) => source.role === 'floor') && !policy.floor) errors.push(thermostatError('retainFloorPolicy'));
	if (
		policy.floor &&
		!draft.sources.some((source) => source.role === 'floor') &&
		!(
			draft.actuators.some((member) => member.role === 'heating') &&
			draft.actuators.filter((member) => member.role === 'heating').every((member) => !!member.protection)
		)
	)
		errors.push(thermostatError('floorProtectionSource'));
	if (draft.sources.filter((source) => source.role === 'contact').length > 1) errors.push(thermostatError('contactSourceLimit'));
	for (const source of draft.sources) {
		if (!whole(source.maximum_age_seconds) || source.maximum_age_seconds < 1) errors.push(thermostatError('sourceAge', { role: source.role }));
		if (!source.source_property && !source.id) errors.push(thermostatError('sourceSelect', { role: source.role }));
		if (source.role === 'contact' && (source.open_value == null || source.closed_value == null)) errors.push(thermostatError('contactValues'));
		if (source.role === 'contact' && source.open_value === source.closed_value) errors.push(thermostatError('contactValuesDiffer'));
	}
	if (!draft.actuators.length) errors.push(thermostatError('actuatorRequired'));
	for (const role of ['heating', 'cooling'] as const) {
		if (draft.actuators.some((actuator) => actuator.role === role) !== finite(policy[`${role}Setpoint`]))
			errors.push(thermostatError('branchMismatch', { role }));
	}
	if (draft.actuators.length > 8) errors.push(thermostatError('memberLimit'));
	if (new Set(draft.actuators.map((member) => member.source_property)).size !== draft.actuators.length)
		errors.push(thermostatError('memberDistinct'));
	const parallelHeating = draft.actuators.filter((member) => member.role === 'heating').length > 1;
	for (const actuator of draft.actuators) {
		if (actuator.retained && !actuator.retained.source_property) errors.push(thermostatError('retainedClaim', { id: actuator.retained.id }));
		if (actuator.role === 'heating' && (parallelHeating || actuator.protection)) {
			if (!policy.floor) errors.push(thermostatError('sharedFloorPolicy'));
			if (!actuator.protection || (!actuator.protection.source_property && !actuator.retained?.protection))
				errors.push(thermostatError('localProtection'));
			if (actuator.protection && (!whole(actuator.protection.maximum_age_seconds) || actuator.protection.maximum_age_seconds < 1))
				errors.push(thermostatError('protectionAge'));
		}
		if (!actuator.source_property) errors.push(thermostatError('actuatorRepair', { role: actuator.role }));
		if (!finite(actuator.lease_seconds) || actuator.lease_seconds <= 0) errors.push(thermostatError('lease', { role: actuator.role }));
	}
	if (new Set(draft.settings.map((setting) => setting.setting)).size !== draft.settings.length) errors.push(thermostatError('settingUnique'));
	if (draft.settings.some((setting) => !setting.property)) errors.push(thermostatError('settingProperty'));
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
				...(policy.cooling && member.role === 'cooling' && member.cooling_protection ? { cooling_protection: member.cooling_protection } : {}),
			})) as ThermostatActuator[],
			settings: draft.settings,
		},
	};
};
