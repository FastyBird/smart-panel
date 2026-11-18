import { describe, expect, it } from 'vitest';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { newThermostatDraft } from '../services/thermostat-authoring';

import {
	addThermostatWizardActuator,
	addThermostatWizardSource,
	removeThermostatWizardSource,
	setThermostatWizardSourceRole,
	syncThermostatWizardBranches,
	syncThermostatWizardFloor,
	thermostatWizardCandidates,
	thermostatWizardIssueStep,
	thermostatWizardSources,
} from './thermostat-wizard-selection';

const devices = [
	{ id: 'physical', type: 'devices-zigbee2mqtt' },
	{ id: 'relay', type: 'devices-shelly-ng' },
	{ id: 'virtual', type: 'virtual', mode: 'sensor_aggregate' },
] as unknown as IDevice[];
const channels = [
	{ id: 'temperature', device: 'physical', category: 'temperature' },
	{ id: 'contact', device: 'physical', category: 'contact' },
	{ id: 'switch', device: 'relay', category: 'switcher', identifier: 'switch:0' },
	{ id: 'derived', device: 'virtual', category: 'temperature' },
] as unknown as IChannel[];
const property = (id: string, fields: Record<string, unknown> = {}) =>
	({
		id,
		channel: 'temperature',
		category: 'temperature',
		dataType: 'float',
		permissions: ['ro'],
		unit: '°C',
		...fields,
	}) as unknown as IChannelProperty;
const sensor = (id: string) => thermostatWizardCandidates('sources', devices, channels, [property(id)])[0];
const relay = (id: string) =>
	thermostatWizardCandidates('actuators', devices, channels, [
		property(id, { channel: 'switch', category: 'on', identifier: 'output', dataType: 'bool', permissions: ['rw'], unit: null }),
	])[0];

describe('relay thermostat wizard selection contracts', () => {
	it('offers Celsius temperatures and only actual boolean contact readings, including offline devices', () => {
		const result = thermostatWizardCandidates('sources', devices, channels, [
			property('temperature'),
			property('spec-unit', { unit: null }),
			property('contact', { channel: 'contact', category: 'detected', dataType: 'bool', unit: null }),
			property('battery', { category: 'battery' }),
			property('humidity', { category: 'humidity' }),
			property('fahrenheit', { unit: '°F' }),
			property('writable', { permissions: ['rw'] }),
			property('write-only', { permissions: ['wo'] }),
			property('contact-number', { channel: 'contact', category: 'detected', dataType: 'int' }),
			property('unrelated-bool', { category: 'active', dataType: 'bool' }),
		]);
		expect(result.map((candidate) => candidate.id)).toEqual(['temperature', 'spec-unit', 'contact']);
		expect(result[2].roles).toEqual(['contact']);
	});
	it('allows a materialized aggregate only as ambient and excludes forwarding virtuals', () => {
		const derived = property('derived', { channel: 'derived', valueOrigin: 'derived', sourceProperty: null });
		expect(thermostatWizardCandidates('sources', devices, channels, [derived])[0].roles).toEqual(['ambient']);
		expect(thermostatWizardCandidates('sources', [{ ...devices[2], mode: 'projection' }] as unknown as IDevice[], channels, [derived])).toEqual([]);
	});
	it('offers only the supported readable/writable relay output, never alarms or arbitrary booleans', () => {
		const valid = relay('output');
		expect(valid.roles).toEqual(['heating', 'cooling']);
		const properties = [
			valid.property,
			{ ...valid.property, id: 'alarm', identifier: 'overtemperature' },
			{ ...valid.property, id: 'read-only', permissions: ['ro'] } as IChannelProperty,
		];
		expect(thermostatWizardCandidates('actuators', devices, channels, properties).map((candidate) => candidate.id)).toEqual(['output']);
	});
	it('adds sensors into free roles without duplicates and defers contact mapping to configuration', () => {
		const draft = newThermostatDraft();
		expect(addThermostatWizardSource(draft, sensor('a'))).toBe(true);
		expect(addThermostatWizardSource(draft, sensor('a'))).toBe(false);
		expect(addThermostatWizardSource(draft, sensor('b'))).toBe(true);
		expect(addThermostatWizardSource(draft, sensor('c'))).toBe(false);
		const contact = thermostatWizardCandidates('sources', devices, channels, [
			property('contact', { channel: 'contact', category: 'detected', dataType: 'bool' }),
		])[0];
		expect(addThermostatWizardSource(draft, contact)).toBe(true);
		expect(draft.sources.map((source) => source.role)).toEqual(['ambient', 'floor', 'contact']);
		expect(draft.sources[2].open_value).toBeUndefined();
		expect(draft.policy.floor).toEqual({ limit: 28, recoveryHysteresis: 1 });
	});
	it('swaps temperature roles while keeping each sensor and its configured age', () => {
		const draft = newThermostatDraft();
		const candidates = [sensor('a'), sensor('b')];
		candidates.forEach((candidate) => addThermostatWizardSource(draft, candidate));
		draft.sources[0].maximum_age_seconds = 123;
		expect(setThermostatWizardSourceRole(draft, candidates[0], 'floor' as never, candidates)).toBe(true);
		expect(draft.sources.map((source) => [source.source_property, source.role, source.maximum_age_seconds])).toEqual([
			['a', 'floor', 123],
			['b', 'ambient', 300],
		]);
	});
	it('does not swap a virtual aggregate into the floor role', () => {
		const draft = newThermostatDraft();
		const derived = thermostatWizardCandidates('sources', devices, channels, [
			property('derived', { channel: 'derived', valueOrigin: 'derived' }),
		])[0];
		const physical = sensor('a');
		[derived, physical].forEach((candidate) => addThermostatWizardSource(draft, candidate));
		expect(setThermostatWizardSourceRole(draft, physical, 'ambient' as never, [derived, physical])).toBe(false);
		expect(draft.sources.map((source) => source.role)).toEqual(['ambient', 'floor']);
	});
	it('keeps the relay cap and unique bindings while allowing several members of one branch', () => {
		const draft = newThermostatDraft();
		for (let index = 0; index < 8; index++) expect(addThermostatWizardActuator(draft, relay(`relay-${index}`))).toBe(true);
		expect(addThermostatWizardActuator(draft, relay('relay-0'))).toBe(false);
		expect(addThermostatWizardActuator(draft, relay('relay-8'))).toBe(false);
		expect(draft.actuators.every((member) => member.role === 'heating' && member.lease_seconds === 600)).toBe(true);
	});
	it('drops settings for removed branches and invalid modes without resetting remaining settings', () => {
		const draft = newThermostatDraft();
		addThermostatWizardActuator(draft, relay('heat'));
		draft.policy.heatingSetpoint = 21;
		draft.policy.coolingSetpoint = 25;
		draft.requested_mode = 'cool' as never;
		syncThermostatWizardBranches(draft);
		expect(draft.policy.heatingSetpoint).toBe(21);
		expect(draft.policy.coolingSetpoint).toBeNull();
		expect(draft.requested_mode).toBe('off');
	});
	it('derives floor protection from the selected role, preserves edited limits and removes obsolete new guards', () => {
		const draft = newThermostatDraft();
		addThermostatWizardSource(draft, sensor('ambient'));
		addThermostatWizardSource(draft, sensor('floor'));
		addThermostatWizardActuator(draft, relay('heat'));
		draft.policy.floor!.limit = 27;
		draft.actuators[0].protection = { schema_version: 1, kind: 'local_floor', source_property: 'floor', maximum_age_seconds: 300 } as never;
		syncThermostatWizardFloor(draft);
		expect(draft.policy.floor!.limit).toBe(27);
		expect(draft.actuators[0].protection).toBeDefined();
		draft.sources = draft.sources.filter((source) => source.role !== 'floor');
		syncThermostatWizardFloor(draft);
		expect(draft.policy.floor).toBeNull();
		expect(draft.actuators[0].protection).toBeUndefined();
	});
	it('initializes active setpoints without overwriting changes when revisiting configuration', () => {
		const draft = newThermostatDraft();
		addThermostatWizardActuator(draft, relay('heat'));
		addThermostatWizardActuator(draft, relay('cool'));
		draft.actuators[1].role = 'cooling' as never;
		syncThermostatWizardBranches(draft);
		expect(draft.policy).toMatchObject({ heatingSetpoint: 21, coolingSetpoint: 25 });
		draft.policy.heatingSetpoint = 22;
		syncThermostatWizardBranches(draft);
		expect(draft.policy.heatingSetpoint).toBe(22);
	});
	it('offers only dedicated derived dew-point outputs and compatible structural surface types', () => {
		const dew = property('dew', { channel: 'derived', valueOrigin: 'derived', sourceProperty: null });
		const dewDevice = [{ ...devices[2], mode: 'dew_point' }] as unknown as IDevice[];
		expect(thermostatWizardCandidates('sources', dewDevice, channels, [dew])[0].roles).toEqual(['dew_point']);
		expect(thermostatWizardCandidates('sources', dewDevice, channels, [{ ...dew, valueOrigin: 'static' }] as unknown as IChannelProperty[])).toEqual(
			[]
		);
		const localChannels = [...channels, { id: 'probe', device: 'relay', category: 'temperature' }] as unknown as IChannel[];
		expect(thermostatWizardCandidates('sources', devices, localChannels, [property('surface', { channel: 'probe' })])[0].roles).toContain(
			'cooled_surface'
		);
		expect(sensor('room').roles).not.toContain('cooled_surface');
	});
	it('keeps cooling selections separate from control source roles and supports several surface probes', () => {
		const draft = newThermostatDraft();
		addThermostatWizardSource(draft, sensor('ambient'));
		const channelsWithProbe = [...channels, { id: 'probe', device: 'relay', category: 'temperature' }] as unknown as IChannel[];
		const surface = thermostatWizardCandidates('sources', devices, channelsWithProbe, [property('surface', { channel: 'probe' })])[0];
		addThermostatWizardSource(draft, surface);
		expect(setThermostatWizardSourceRole(draft, surface, 'cooled_surface', [sensor('ambient'), surface])).toBe(true);
		expect(draft.sources.map((source) => source.source_property)).toEqual(['ambient']);
		expect(draft.policy.floor).toBeNull();
		expect(draft.coolingSources).toEqual([{ role: 'cooled_surface', source_property: 'surface' }]);
		expect(draft.policy.cooling).toMatchObject({ marginC: 2, recoveryHysteresisC: 1 });
		for (let i = 1; i < 8; i++) expect(addThermostatWizardSource(draft, { ...surface, id: `surface-${i}`, roles: ['cooled_surface'] })).toBe(true);
		expect(addThermostatWizardSource(draft, { ...surface, id: 'too-many', roles: ['cooled_surface'] })).toBe(false);
		expect(thermostatWizardSources(draft)).toHaveLength(9);
		draft.actuators.push({
			role: 'cooling' as never,
			source_property: 'relay',
			lease_seconds: 600,
			cooling_protection: {
				schemaVersion: 1,
				purpose: 'cooled_surface',
				dew_point_property: 'dew',
				surface_property: 'surface',
				maximum_age_seconds: 60,
			} as never,
		});
		removeThermostatWizardSource(draft, 'surface');
		expect(draft.actuators[0].cooling_protection!.surface_property).toBeNull();
		expect(draft.coolingSources).toHaveLength(7);
	});
	it('validates selections before configuration and never asks for a setpoint, lease or age in a selection step', () => {
		for (const error of ['ambientSource', 'sourceSelect', 'contactSourceLimit']) expect(thermostatWizardIssueStep(error)).toBe(1);
		for (const error of ['actuatorRequired', 'memberDistinct', 'memberLimit']) expect(thermostatWizardIssueStep(error)).toBe(2);
		for (const error of [
			'setpointRequired',
			'branchMismatch',
			'sourceAge',
			'contactValues',
			'lease',
			'floorPolicy',
			'localProtection',
			'coolingDependencies',
		])
			expect(thermostatWizardIssueStep(error)).toBe(3);
	});
});
