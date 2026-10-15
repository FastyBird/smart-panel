import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { type ThermostatConfiguration, buildThermostatRequest, draftFromConfiguration } from './thermostat-authoring';
import { emptyMemberInstallation, memberInstallationBlocker, memberInstallationRequest } from './thermostat-member-installation';
import { type ThermostatMemberContext, type ThermostatMemberRuntime, memberObservation, memberReading } from './thermostat-members';

export const memberConfiguration = (count = 2): ThermostatConfiguration =>
	({
		controller: 'controller',
		revision: 3,
		graph_revision: 8,
		requested_mode: 'heat',
		policy: {
			heatingSetpoint: 21,
			coolingSetpoint: null,
			coldTolerance: 0.5,
			hotTolerance: 0.5,
			neutralMargin: 1,
			minimumOffMs: 0,
			changeoverMs: 0,
			floor: { limit: 28, recoveryHysteresis: 1 },
		},
		heuristic: null,
		contact_opening_ms: 0,
		contact_closing_ms: 0,
		sources: [
			{
				id: 'ambient-binding',
				role: 'ambient',
				source_property: 'ambient',
				source_identity: 'ambient',
				maximum_age_seconds: 60,
				open_value: null,
				closed_value: null,
			},
		],
		actuators: Array.from({ length: count }, (_, index) => ({
			id: `claim-${index}`,
			role: 'heating',
			state: 'reserved',
			source_property: `relay-${index}`,
			source_identity: `relay-${index}`,
			physical_identity: `shelly-${index}`,
			lease_seconds: 30,
			revision: 4,
			qualification_generation: `generation-${index}`,
			protection: {
				schema_version: 1,
				kind: 'local_floor',
				source_property: `floor-${index}`,
				source_identity: `floor-${index}`,
				physical_property: `physical-${index}`,
				maximum_age_seconds: 30,
				revision: 2,
			},
		})),
		settings: [],
		released_actuators: [],
	}) as unknown as ThermostatConfiguration;

describe('mandatory member authoring and current evidence', () => {
	it('roundtrips two independent local sources without client-only metadata or invented settings', () => {
		const draft = draftFromConfiguration(memberConfiguration());
		const request = buildThermostatRequest(draft, 3, 8).request!;
		expect(request.actuators).toHaveLength(2);
		expect(request.actuators.map((entry) => entry.protection?.source_property)).toEqual(['floor-0', 'floor-1']);
		expect(request.actuators[0]).not.toHaveProperty('retained');
		expect(request.policy.floor).toEqual({ limit: 28, recoveryHysteresis: 1 });
		expect(request).toMatchObject({ expected_revision: 3, expected_graph_revision: 8 });
	});
	it('counts retained missing/releasing/suspended members toward eight and preserves missing identities', () => {
		const config = memberConfiguration(8);
		config.actuators[0].source_property = null;
		config.actuators[0].state = 'missing' as (typeof config.actuators)[0]['state'];
		config.actuators[1].state = 'releasing' as (typeof config.actuators)[1]['state'];
		config.actuators[2].state = 'suspended' as (typeof config.actuators)[2]['state'];
		const draft = draftFromConfiguration(config);
		expect(draft.actuators).toHaveLength(8);
		expect(draft.actuators[0]).toMatchObject({ source_property: 'relay-0', retained: { id: 'claim-0', source_property: null } });
		draft.actuators.push({ ...draft.actuators[7], source_property: 'ninth' });
		expect(buildThermostatRequest(draft, 3).errors).toContain('At most eight mandatory members, including retained claims, are allowed.');
	});
	it('retains missing protective identities and requires every parallel heating member binding', () => {
		const config = memberConfiguration();
		config.actuators[0].protection!.source_property = null;
		const draft = draftFromConfiguration(config);
		expect(draft.actuators[0].retained!.protection!.source_identity).toBe('floor-0');
		expect(buildThermostatRequest(draft, 3).request!.actuators[0].protection!.source_property).toBeNull();
		delete draft.actuators[1].protection;
		expect(buildThermostatRequest(draft, 3).request).toBeUndefined();
	});
	it('ages individual live evidence, distinguishes false from missing, and never promotes retained values', () => {
		const member = {
			pending_on: false,
			protection: {
				status: 'fresh',
				quality: 'good',
				temperature: 0,
				ready: true,
				age_seconds: 0,
				maximum_age_seconds: 10,
				expires_at: new Date(10000).toISOString(),
			},
		} as ThermostatMemberRuntime;
		expect(memberReading(member, 0, 0)).toMatchObject({ temperature: 0, ready: true });
		expect(memberReading(member, 0, 10000)).toMatchObject({ temperature: null, ready: false, status: 'stale' });
		expect(memberReading(null, 0, 0).ready).toBe(false);
		expect(memberReading(member, 1000, 999).ready).toBe(false);
		member.protection!.status = 'unavailable' as NonNullable<ThermostatMemberRuntime['protection']>['status'];
		expect(memberReading(member, 0, 1).temperature).toBeNull();
	});
	it.each([true, false, null])('keeps qualification %s distinct from physical activity and expires original evidence', (qualification) => {
		const runtime = {
			activity: 'off',
			qualification_ready: qualification,
			activity_sampled_at: new Date(0).toISOString(),
			activity_expires_at: new Date(30000).toISOString(),
		} as unknown as ThermostatMemberRuntime;
		expect(memberObservation(runtime, 0, 0)).toMatchObject({ activity: 'off', qualification });
		expect(memberObservation(runtime, 0, 30000)).toEqual({ activity: 'unknown', qualification: null, sampledAt: null, expiresAt: null });
		expect(memberObservation(runtime, 1, 0).qualification).toBeNull();
	});
	it('withholds missing legacy timestamps and never promotes retained OFF history to live relay activity', () => {
		const history = {
			activity: 'on',
			qualification_ready: true,
			last_verified_off_at: new Date(0).toISOString(),
			release_proven: true,
		} as unknown as ThermostatMemberRuntime;
		expect(memberObservation(history, 0, 0)).toEqual({ activity: 'unknown', qualification: null, sampledAt: null, expiresAt: null });
		expect(memberObservation(null, 0, 0).activity).toBe('unknown');
	});
	it('stages with derived snapshot only and leaves evidence unasserted until supplied', () => {
		const draft = emptyMemberInstallation();
		expect(draft.attestations).toEqual([]);
		expect(memberInstallationRequest(draft, null, 0)).toBeNull();
		Object.assign(draft, {
			endpoint: 'offline.fixture',
			epoch: 'operator-key',
			script: 2,
			ceiling: 30,
			minimumLease: 1,
			maximumLease: 30,
			watchdog: 100,
			heatingMinimum: 15,
			heatingMaximum: 25,
		});
		const context = {
			configuration_revision: 3,
			claim_revision: 4,
			device_hardware_id: 'actual-fixture-id',
			firmware: 'actual-fixture-fw',
			switch_configuration_json: '{"id":0}',
			reasons: [],
			candidates: [
				{ property: 'selected-floor', snapshot: { component: 'temperature:100' } },
				{ property: 'other-floor', snapshot: null },
			],
		} as unknown as ThermostatMemberContext;
		const request = memberInstallationRequest(draft, context, 7, 'reviewed-generation', 'selected-floor')!;
		expect(request).toMatchObject({
			expected_revision: 7,
			expected_configuration_revision: 3,
			expected_claim_revision: 4,
			expected_qualification_generation: 'reviewed-generation',
			operator_attestations: [],
			member_setup: {
				device_hardware_id: 'actual-fixture-id',
				switch_configuration_json: '{"id":0}',
				installed_floor_ceiling_c: 30,
			},
		});
		expect(request.member_setup).not.toHaveProperty('floor_configuration_json');
		context.candidates[0].snapshot = null;
		expect(memberInstallationBlocker(context, 'selected-floor')).toBe('selected_protective_source_installation_snapshot_missing');
		expect(memberInstallationRequest(draft, context, 7, undefined, 'selected-floor')).toBeNull();
		context.candidates[0].snapshot = { component: 'temperature:100' };
		expect(memberInstallationRequest(draft, context, 7, undefined, 'selected-floor')).not.toBeNull();
		context.candidates.push({
			...context.candidates[0],
			property: 'converted-floor',
			snapshot: { component: 'input:100', calibration: { operator: 'steinhart_hart' } },
		});
		expect(memberInstallationRequest(draft, context, 7, undefined, 'converted-floor')).not.toBeNull();
		context.switch_configuration_json = null;
		expect(memberInstallationRequest(draft, context, 7, undefined, 'selected-floor')).toBeNull();
	});
	it('contains the same translated member controls in every supported locale', () => {
		const locales = ['en-US', 'cs-CZ', 'de-DE', 'es-ES', 'pl-PL', 'sk-SK'].map(
			(locale) => JSON.parse(readFileSync(`src/plugins/devices-virtual/locales/${locale}.json`, 'utf8')).members as Record<string, string>
		);
		for (const locale of locales) {
			expect(Object.keys(locale).sort()).toEqual(Object.keys(locales[0]).sort());
			expect(Object.values(locale).every((value) => value.trim())).toBe(true);
		}
	});
});
