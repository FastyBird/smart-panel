import { describe, expect, it } from 'vitest';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesVirtualPluginDeviceMode,
} from '../../../openapi.constants';

import {
	type AggregateProfile,
	type MeasurementSourceChannel,
	type MeasurementSourceDevice,
	type MeasurementSourceProperty,
	aggregateCandidates,
	aggregateDraft,
	measurementCandidates,
	measurementDraft,
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
		expect(measurementCandidates(DevicesVirtualPluginDeviceMode.sensor_transform, [device('shelly-ng')], [channel()], [property()])).toHaveLength(1);
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
			measurementCandidates(DevicesVirtualPluginDeviceMode.sensor_transform, [device('shelly-ng')], [channel()], [property({ unit: null })])
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
});
