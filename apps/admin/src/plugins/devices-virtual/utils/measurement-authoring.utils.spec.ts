import { describe, expect, it } from 'vitest';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesVirtualPluginDeviceMode,
} from '../../../openapi.constants';
import { shellyMeasurementAlias } from '../../devices-shelly-ng/utils/measurement-alias';

import {
	type AggregateProfile,
	type MeasurementSourceChannel,
	type MeasurementSourceDevice,
	type MeasurementSourceProperty,
	aggregateCandidates,
	aggregateDraft,
	measurementCandidates,
	measurementDraft,
	preferCanonicalMeasurementSources,
	withPlacement,
} from './measurement-authoring.utils';

const device = (type: string, mode?: string): MeasurementSourceDevice => ({ id: 'device', type, name: 'Probe', mode });
const channel = (category = DevicesModuleChannelCategory.temperature): MeasurementSourceChannel => ({
	id: 'channel',
	device: 'device',
	category,
	name: 'Input',
});
const property = (fields: Partial<MeasurementSourceProperty> = {}): MeasurementSourceProperty => ({
	id: 'property',
	name: null,
	channel: 'channel',
	category: DevicesModuleChannelPropertyCategory.temperature,
	dataType: DevicesModuleChannelPropertyDataType.float,
	permissions: [DevicesModuleChannelPropertyPermissions.ro],
	unit: '°C',
	...fields,
});

describe('measurement candidate and output contracts', () => {
	it('offers native Celsius as a direct affine source and permits only canonical transformed temperature in aggregates', () => {
		expect(
			measurementCandidates(DevicesVirtualPluginDeviceMode.sensor_transform, [device('devices-shelly-ng')], [channel()], [property()])
		).toHaveLength(1);
		expect(
			measurementCandidates(
				DevicesVirtualPluginDeviceMode.sensor_aggregate,
				[device('virtual', 'sensor_transform')],
				[channel()],
				[property({ valueOrigin: 'derived' })]
			)
		).toHaveLength(1);
		for (const mode of ['projection', 'sensor_aggregate', 'actuator_group'])
			expect(
				measurementCandidates(
					DevicesVirtualPluginDeviceMode.sensor_aggregate,
					[device('virtual', mode)],
					[channel()],
					[property({ valueOrigin: 'derived' })]
				)
			).toEqual([]);
	});
	it('never allows a generic Celsius unit label to masquerade as temperature', () => {
		expect(
			measurementCandidates(
				DevicesVirtualPluginDeviceMode.sensor_aggregate,
				[device('virtual', 'sensor_transform')],
				[channel(DevicesModuleChannelCategory.analog_input)],
				[property({ category: DevicesModuleChannelPropertyCategory.value, valueOrigin: 'derived', unit: '°C' })]
			)
		).toEqual([]);
	});
	it('filters recursive transforms, writable virtual output and unitless inputs', () => {
		expect(
			measurementCandidates(DevicesVirtualPluginDeviceMode.sensor_transform, [device('virtual', 'sensor_transform')], [channel()], [property()])
		).toEqual([]);
		expect(
			measurementCandidates(DevicesVirtualPluginDeviceMode.sensor_transform, [device('devices-shelly-ng')], [channel()], [property({ unit: null })])
		).toEqual([]);
		expect(
			measurementCandidates(
				DevicesVirtualPluginDeviceMode.sensor_aggregate,
				[device('virtual', 'sensor_transform')],
				[channel()],
				[property({ valueOrigin: 'derived', permissions: [DevicesModuleChannelPropertyPermissions.rw] })]
			)
		).toEqual([]);
	});
	it('creates a generic derived readonly FLOAT with the declared range and owned UUID', () => {
		const draft = measurementDraft(DevicesVirtualPluginDeviceMode.sensor_transform, 'Custom scale', false, 'output', 'device', 'channel', {
			minimum: -10000,
			maximum: 20000,
		});
		expect(draft.channels?.[0]).toMatchObject({
			category: 'analog_input',
			properties: [{ id: 'output', category: 'value', data_type: 'float', permissions: ['ro'], value_origin: 'derived', format: [-10000, 20000] }],
		});
	});
});

describe('backend aggregate capability payloads', () => {
	it.each([
		['humidity', 'humidity', 'uchar', '%', 1],
		['carbon_dioxide', 'concentration', 'float', 'ppm', 1],
		['illuminance', 'illuminance', 'float', 'lx', 0.1],
		['contact', 'detected', 'bool', null, null],
		['motion', 'detected', 'bool', null, null],
		['occupancy', 'detected', 'bool', null, null],
	])('materializes %s from the server contract with stable IDs', (profile, quantity, type, unit, step) => {
		const capability = {
			profile,
			channel: profile,
			quantity,
			data_types: [type],
			unit,
			output_step: step,
			numeric_policy: type !== 'bool',
			operators: [],
		} as AggregateProfile;
		const draft = aggregateDraft(capability, 'Combined', 'output', 'device', 'channel');
		expect(draft).toMatchObject({
			id: 'device',
			channels: [{ id: 'channel', category: profile, properties: [{ id: 'output', category: quantity, data_type: type }] }],
		});
		expect(draft.channels![0].properties![0].step).toBe(step ?? undefined);
	});
	it('uses only returned source IDs even when local catalog data is absent or suggests a different profile', () => {
		const capability = { quantity: 'detected', unit: null } as AggregateProfile;
		expect(aggregateCandidates([{ property: 'server-admitted', device: 'd', channel: 'c' }], [], [], [property()], capability)).toEqual([
			{ id: 'server-admitted', label: 'server-admitted', quantity: 'detected', unit: '' },
		]);
	});
	it('adds a room and zones to a draft only when they are chosen', () => {
		const device = { id: 'device', name: 'Combined' };
		expect(withPlacement(device, { roomId: null, zoneIds: [] })).toEqual(device);
		expect(withPlacement(device, { roomId: 'room', zoneIds: ['zone-a', 'zone-b'] })).toEqual({
			...device,
			room_id: 'room',
			zone_ids: ['zone-a', 'zone-b'],
		});
	});
});

describe('thermistor source admission', () => {
	const candidates = (provider: string, fields: Partial<MeasurementSourceProperty> = {}) =>
		measurementCandidates(
			DevicesVirtualPluginDeviceMode.sensor_transform,
			[device(provider)],
			[channel(DevicesModuleChannelCategory.analog_input)],
			[property({ category: DevicesModuleChannelPropertyCategory.value, unit: 'V', ...fields })]
		);
	it.each(['devices-shelly-ng', 'devices-modbus', 'new-plugin'])(
		'accepts the declared unit of a read-only voltage measurement from %s',
		(provider) => {
			expect(candidates(provider)).toEqual([expect.objectContaining({ unit: 'V', thermistorVoltage: true })]);
		}
	);
	it('requires explicit units and a voltage measurement contract', () => {
		expect(candidates('new-plugin', { unit: null })).toEqual([]);
		expect(candidates('new-plugin', { permissions: [DevicesModuleChannelPropertyPermissions.rw] })[0].thermistorVoltage).toBeUndefined();
		expect(candidates('new-plugin', { category: DevicesModuleChannelPropertyCategory.temperature })[0].thermistorVoltage).toBeUndefined();
	});
});

describe('duplicate Shelly addon readings in the wizard', () => {
	const fingerprint = 'a'.repeat(64);
	const oldChannel = { ...channel(), id: 'legacy-channel', identifier: 'temperature:100' };
	const canonicalChannel = { ...channel(), id: 'probe-channel', identifier: `probe-temperature:temperature:100:${fingerprint}` };
	const oldProperty = property({ id: 'legacy', channel: oldChannel.id, identifier: 'tC' });
	const canonicalProperty = property({ id: 'probe', channel: canonicalChannel.id, identifier: 'tC' });
	const rows = [
		{ id: 'legacy', online: true },
		{ id: 'probe', online: false },
	];
	const shelly = device('devices-shelly-ng');

	it('offers the address-bound reading once, including offline, without rewriting existing row identities', () => {
		const result = preferCanonicalMeasurementSources(
			rows,
			[shelly],
			[oldChannel, canonicalChannel],
			[oldProperty, canonicalProperty],
			shellyMeasurementAlias
		);
		expect(result).toEqual([rows[1]]);
		expect(result[0]).toBe(rows[1]);
		expect(rows.map((row) => row.id)).toEqual(['legacy', 'probe']);
	});

	it('retains a source when no canonical replacement is offered by the backend catalogue', () => {
		expect(
			preferCanonicalMeasurementSources([rows[0]], [shelly], [oldChannel, canonicalChannel], [oldProperty, canonicalProperty], shellyMeasurementAlias)
		).toEqual([rows[0]]);
	});

	it.each(['provider', 'device', 'component', 'fingerprint', 'unit', 'property'])(
		'does not merge readings with a different %s identity',
		(difference) => {
			const channels = [oldChannel, { ...canonicalChannel }];
			const properties = [oldProperty, { ...canonicalProperty }];
			const devices = [{ ...shelly }, { ...shelly, id: 'other' }];
			if (difference === 'provider') devices[0].type = 'devices-home-assistant';
			if (difference === 'device') channels[1].device = 'other';
			if (difference === 'component') channels[1].identifier = `probe-temperature:temperature:101:${fingerprint}`;
			if (difference === 'fingerprint') channels[1].identifier = 'probe-temperature:temperature:100:unknown';
			if (difference === 'unit') properties[1].unit = '°F';
			if (difference === 'property') properties[1].identifier = 'tF';
			expect(preferCanonicalMeasurementSources(rows, devices, channels, properties, shellyMeasurementAlias)).toEqual(rows);
		}
	);

	it('retains ambiguous identities rather than choosing an arbitrary installation', () => {
		const other = { ...canonicalChannel, id: 'other-probe', identifier: `probe-temperature:temperature:100:${'b'.repeat(64)}` };
		const choices = [...rows, { id: 'other', online: true }];
		expect(
			preferCanonicalMeasurementSources(
				choices,
				[shelly],
				[oldChannel, canonicalChannel, other],
				[oldProperty, canonicalProperty, { ...canonicalProperty, id: 'other', channel: other.id }],
				shellyMeasurementAlias
			)
		).toEqual(choices);
	});
});
