import { describe, expect, it } from 'vitest';

import { type ModbusDeviceChannelInput, type ModbusDevicePropertyInput, deviceBindingFromWire, pointsFromDevice } from './device-points';

const property = (id: string, extra: Partial<ModbusDevicePropertyInput>): ModbusDevicePropertyInput => ({
	id,
	identifier: null,
	name: null,
	category: 'on',
	dataType: 'bool',
	permissions: ['rw'],
	unit: null,
	format: null,
	value: null,
	...extra,
});

describe('device points', () => {
	it('reads a wire binding with an empty value map as no map', () => {
		const binding = deviceBindingFromWire({
			id: 'b1',
			property_id: 'p1',
			role: 'read',
			register_type: 'holding_register',
			address: 3,
			data_type: 'int16',
			value_map: [],
			long_press_ms: 900,
		});

		expect(binding).toEqual({
			id: 'b1',
			propertyId: 'p1',
			role: 'read',
			binding: expect.objectContaining({ registerType: 'holding_register', address: 3, valueMap: null, scale: 1, longPressMs: 900 }),
		});
	});

	it('gives a static property without a stored value the default of its capability', () => {
		const channels: ModbusDeviceChannelInput[] = [
			{
				id: 'c1',
				identifier: null,
				name: 'Valve',
				category: 'valve',
				properties: [property('p1', {}), property('p2', { category: 'type', dataType: 'enum', permissions: ['ro'] })],
			},
		];

		const points = pointsFromDevice(channels, [
			deviceBindingFromWire({ id: 'b1', property_id: 'p1', role: 'read', register_type: 'coil', address: 0, data_type: 'bool' }),
		]);

		expect(points.map((point) => [point.propertyId, point.staticValue])).toEqual([
			['p1', null],
			['p2', 'generic'],
		]);
		// A channel without an identifier is grouped by its id.
		expect(points.every((point) => point.channelIdentifier === 'c1')).toBe(true);
	});
});
