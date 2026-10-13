import { describe, expect, it } from 'vitest';

import { buildThermostatRequest, draftFromConfiguration, emptyThermostatDraft, type ThermostatConfiguration } from './thermostat-authoring';

describe('thermostat authoring payload', () => {
	it('does not invent safety thresholds or actuator leases for a new draft', () => {
		const result = buildThermostatRequest(emptyThermostatDraft(), 0);
		expect(result.request).toBeUndefined();
		expect(result.errors).toContain('Enter the minimum OFF interval in milliseconds.');
		expect(result.errors).toContain('Select at least one physical actuator.');
	});

	it('preserves missing binding identity and exact revisions for repair', () => {
		const configuration = {
			requested_mode: 'off', revision: 3, graph_revision: 7,
			policy: { heatingSetpoint: 21, coolingSetpoint: null, coldTolerance: 0.5, hotTolerance: 0.5,
				neutralMargin: 1, minimumOffMs: 60000, changeoverMs: 90000, floor: null },
			heuristic: null, contact_opening_ms: 0, contact_closing_ms: 0,
			sources: [{ id: 'binding', role: 'ambient', source_property: null, source_identity: 'old',
				maximum_age_seconds: 30, open_value: null, closed_value: null }],
			actuators: [{ role: 'heating', source_property: 'switch', lease_seconds: 60 }],
			settings: [{ setting: 'heating_setpoint', property: 'local' }],
		} as ThermostatConfiguration;
		const draft = draftFromConfiguration(configuration);
		expect(draft.sources[0]).toMatchObject({ id: 'binding', source_property: null });
		draft.sources[0].source_property = 'replacement';
		const result = buildThermostatRequest(draft, configuration.revision, configuration.graph_revision);
		expect(result.request).toMatchObject({ expected_revision: 3, expected_graph_revision: 7,
			sources: [{ id: 'binding', source_property: 'replacement' }] });
	});

	it('requires explicit floor and trend policy values when selected', () => {
		const draft = emptyThermostatDraft();
		draft.policy.floor = { limit: null, recoveryHysteresis: null };
		draft.heuristic = { sampleWindowMs: null, minimumSamples: null, minimumSpanMs: null,
			maximumSampleAgeMs: null, slopeThresholdCPerMinute: null, confirmationMs: null,
			recoveryMs: null, maximumPauseMs: null, cooldownMs: null };
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
		draft.sources.push({ role: 'ambient', source_property: 'ambient', maximum_age_seconds: 60 });
		const incomplete = buildThermostatRequest(draft, 0);
		expect(incomplete.errors).toContain('Floor protection requires exactly one independent floor source.');
		expect(incomplete.errors).toContain('heating actuator must match its comfort setpoint branch.');
		draft.sources.push({ role: 'floor', source_property: 'floor', maximum_age_seconds: 60 });
		draft.actuators.push({ role: 'heating', source_property: 'switch', lease_seconds: 60 });
		expect(buildThermostatRequest(draft, 0).errors).toEqual([]);
	});
});
