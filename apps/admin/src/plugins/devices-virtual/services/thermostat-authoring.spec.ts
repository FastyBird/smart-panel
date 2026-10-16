import { describe, expect, it } from 'vitest';

import {
	DevicesVirtualPluginThermostatActuatorRole as ActuatorRole,
	DevicesVirtualPluginConfigureDewPointSchema_version,
	DevicesVirtualPluginCoolingDependencyPurpose,
	DevicesVirtualPluginThermostatSourceRole as SourceRole,
} from '../../../openapi';

import { type ThermostatConfiguration, buildThermostatRequest, draftFromConfiguration, emptyThermostatDraft } from './thermostat-authoring';

describe('thermostat authoring payload', () => {
	it('does not invent safety thresholds or actuator leases for a new draft', () => {
		const result = buildThermostatRequest(emptyThermostatDraft(), 0);
		expect(result.request).toBeUndefined();
		expect(result.errors).toContain('Enter the minimum OFF interval in milliseconds.');
		expect(result.errors).toContain('Select at least one physical actuator.');
	});

	it('preserves missing binding identity and exact revisions for repair', () => {
		const configuration = {
			requested_mode: 'off',
			revision: 3,
			graph_revision: 7,
			policy: {
				heatingSetpoint: 21,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 60000,
				changeoverMs: 90000,
				floor: null,
			},
			heuristic: null,
			contact_opening_ms: 0,
			contact_closing_ms: 0,
			sources: [
				{
					id: 'binding',
					role: 'ambient',
					source_property: null,
					source_identity: 'old',
					maximum_age_seconds: 30,
					open_value: null,
					closed_value: null,
				},
			],
			actuators: [{ role: 'heating', source_property: 'switch', lease_seconds: 60 }],
			settings: [{ setting: 'heating_setpoint', property: 'local' }],
		} as ThermostatConfiguration;
		const draft = draftFromConfiguration(configuration);
		expect(draft.sources[0]).toMatchObject({ id: 'binding', source_property: null });
		draft.sources[0].source_property = 'replacement';
		const result = buildThermostatRequest(draft, configuration.revision, configuration.graph_revision);
		expect(result.request).toMatchObject({
			expected_revision: 3,
			expected_graph_revision: 7,
			sources: [{ id: 'binding', source_property: 'replacement' }],
		});
	});

	it('requires explicit floor and trend policy values when selected', () => {
		const draft = emptyThermostatDraft();
		draft.policy.floor = { limit: null, recoveryHysteresis: null };
		draft.heuristic = {
			sampleWindowMs: null,
			minimumSamples: null,
			minimumSpanMs: null,
			maximumSampleAgeMs: null,
			slopeThresholdCPerMinute: null,
			confirmationMs: null,
			recoveryMs: null,
			maximumPauseMs: null,
			cooldownMs: null,
		};
		const result = buildThermostatRequest(draft, 0);
		expect(result.errors).toContain('Enter the floor limit and positive recovery hysteresis in Celsius.');
		expect(result.errors).toContain('Complete every enabled trend setting.');
	});

	it('requires an independent floor source and matching comfort actuator', () => {
		const draft = emptyThermostatDraft();
		draft.policy.heatingSetpoint = 21;
		draft.policy.coldTolerance = 0.5;
		draft.policy.hotTolerance = 0.5;
		draft.policy.neutralMargin = 1;
		draft.policy.minimumOffMs = 60000;
		draft.policy.changeoverMs = 90000;
		draft.policy.floor = { limit: 28, recoveryHysteresis: 1 };
		draft.contact_opening_ms = 0;
		draft.contact_closing_ms = 0;
		draft.sources.push({ role: SourceRole.ambient, source_property: 'ambient', maximum_age_seconds: 60 });
		const incomplete = buildThermostatRequest(draft, 0);
		expect(incomplete.errors).toContain('Floor protection requires a global source or an explicit local guard for every heating member.');
		expect(incomplete.errors).toContain('heating actuator must match its comfort setpoint branch.');
		draft.sources.push({ role: SourceRole.floor, source_property: 'floor', maximum_age_seconds: 60 });
		draft.actuators.push({ role: ActuatorRole.heating, source_property: 'switch', lease_seconds: 60 });
		expect(buildThermostatRequest(draft, 0).errors).toEqual([]);
	});
	const coolingDraft = () => {
		const draft = emptyThermostatDraft();
		Object.assign(draft.policy, {
			heatingSetpoint: null,
			coolingSetpoint: 25,
			coldTolerance: 0.5,
			hotTolerance: 0.5,
			neutralMargin: 1,
			minimumOffMs: 60000,
			changeoverMs: 90000,
			cooling: { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1, absoluteMinimumC: null },
		});
		draft.contact_opening_ms = 0;
		draft.contact_closing_ms = 0;
		draft.sources.push({ role: SourceRole.ambient, source_property: 'ambient', maximum_age_seconds: 60 });
		draft.actuators.push({ role: ActuatorRole.cooling, source_property: 'relay', lease_seconds: 5 });
		return draft;
	};
	const dependencies = () => ({
		schemaVersion: DevicesVirtualPluginConfigureDewPointSchema_version.Value1,
		purpose: DevicesVirtualPluginCoolingDependencyPurpose.cooled_surface,
		dew_point_property: 'dew',
		surface_property: 'surface',
		maximum_age_seconds: 30,
	});
	it('requires protection on EVERY cooling leaf and emits source-owned schemaVersion without qualification or mode changes', () => {
		const draft = coolingDraft();
		draft.actuators[0].cooling_protection = dependencies();
		draft.actuators.push({ role: ActuatorRole.cooling, source_property: 'relay2', lease_seconds: 5 });
		expect(buildThermostatRequest(draft, 1, 2).request).toBeUndefined();
		draft.actuators[1].cooling_protection = dependencies();
		const result = buildThermostatRequest(draft, 1, 2);
		expect(result.errors).toEqual([]);
		expect(result.request?.actuators.map((member) => member.cooling_protection)).toEqual([dependencies(), dependencies()]);
		expect(result.request?.requested_mode).toBe('off');
		expect(JSON.stringify(result.request)).not.toContain('qualification');
		expect(result.request?.actuators[0].cooling_protection).not.toHaveProperty('schema_version');
	});
	it('retains a missing cooling dependency for repair but refuses replacing a still-bound source with null', () => {
		const draft = coolingDraft();
		draft.actuators[0].cooling_protection = { ...dependencies(), dew_point_property: null };
		draft.actuators[0].retained = {
			id: 'claim',
			source_property: 'relay',
			source_identity: 'relay',
			cooling_protection: {
				...dependencies(),
				schema_version: 1,
				dew_point_identity: 'retained-dew',
				dew_point_property: null,
				surface_identity: 'surface',
			},
		} as never;
		expect(buildThermostatRequest(draft, 7, 12).errors).toEqual([]);
		draft.actuators[0].cooling_protection.surface_property = null;
		expect(buildThermostatRequest(draft, 7, 12).request).toBeUndefined();
		draft.actuators[0].cooling_protection = { ...dependencies(), dew_point_property: 'repaired-dew' };
		const result = buildThermostatRequest(draft, 7, 12);
		expect(result.request?.expected_revision).toBe(7);
		expect(result.request?.actuators[0].cooling_protection?.dew_point_property).toBe('repaired-dew');
		expect(result.request?.actuators[0]).not.toHaveProperty('retained');
	});
	it('keeps optional absolute minimum explicit and rejects invalid domain/age instead of clamping it', () => {
		const draft = coolingDraft();
		draft.actuators[0].cooling_protection = dependencies();
		expect(buildThermostatRequest(draft, 1, 2).request?.policy.cooling?.absoluteMinimumC).toBeNull();
		draft.policy.cooling!.absoluteMinimumC = -45;
		expect(buildThermostatRequest(draft, 1, 2).request).toBeUndefined();
		draft.policy.cooling!.absoluteMinimumC = 8;
		draft.actuators[0].cooling_protection.maximum_age_seconds = 0;
		expect(buildThermostatRequest(draft, 1, 2).request).toBeUndefined();
		draft.actuators[0].cooling_protection.maximum_age_seconds = 30;
		expect(buildThermostatRequest(draft, 1, 2).request?.policy.cooling?.absoluteMinimumC).toBe(8);
	});
});
