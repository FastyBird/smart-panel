import { describe, expect, it } from 'vitest';

import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../openapi.constants';

import {
	CUSTOM_CAPABILITIES,
	applyCapability,
	capabilityKindOf,
	defaultRegisterTypeFor,
	pointBaseFor,
	registerTypesFor,
	withCapabilityStatics,
} from './capabilities';
import { pointsFromRange } from './points';

const capability = (key: string) => {
	const found = CUSTOM_CAPABILITIES.find((c) => c.key === key);

	if (!found) {
		throw new Error(`No capability ${key}`);
	}

	return found;
};

describe('CUSTOM_CAPABILITIES', () => {
	it('lists the custom capabilities with their kind, access, data type, permissions and unit', () => {
		expect(CUSTOM_CAPABILITIES.map((c) => [c.key, c.kind, c.readable, c.writable, c.dataType, c.permissions, c.unit])).toEqual([
			['binary_input.state', 'bool', true, false, 'bool', ['ro'], null],
			['switcher.on', 'bool', true, true, 'bool', ['rw'], null],
			['outlet.on', 'bool', true, true, 'bool', ['rw'], null],
			['valve.on', 'bool', true, true, 'bool', ['rw'], null],
			['button.event', 'button', true, false, 'enum', ['ev'], null],
			['analog_input.value', 'number', true, false, 'float', ['ro'], null],
			['temperature.temperature', 'number', true, false, 'float', ['ro'], '°C'],
			['humidity.humidity', 'number', true, false, 'uchar', ['ro'], '%'],
			['electrical_power.power', 'number', true, false, 'float', ['ro'], 'W'],
			['pressure.pressure', 'number', true, false, 'float', ['ro'], 'kPa'],
			['illuminance.illuminance', 'number', true, false, 'float', ['ro'], 'lx'],
		]);
	});

	it('has unique keys that match channel and property category', () => {
		for (const c of CUSTOM_CAPABILITIES) {
			expect(c.key).toBe(`${c.channelCategory}.${c.propertyCategory}`);
		}
		expect(new Set(CUSTOM_CAPABILITIES.map((c) => c.key)).size).toBe(CUSTOM_CAPABILITIES.length);
	});

	it('gives only the valve a static sibling, the generic valve type', () => {
		expect(CUSTOM_CAPABILITIES.filter((c) => c.statics.length > 0).map((c) => c.key)).toEqual(['valve.on']);
		expect(capability('valve.on').statics).toEqual([
			{
				propertyCategory: 'type',
				dataType: 'enum',
				permissions: ['ro'],
				value: 'generic',
				format: ['generic', 'irrigation', 'shower_head', 'water_faucet'],
			},
		]);
	});
});

describe('custom capability helpers', () => {
	const [binaryInput, switcher] = CUSTOM_CAPABILITIES;

	it('limits writable capabilities to writable tables', () => {
		expect(registerTypesFor(switcher)).toEqual([DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register]);
		expect(registerTypesFor(binaryInput)).toContain(DevicesModbusPluginRegisterType.discrete_input);
		expect(defaultRegisterTypeFor(binaryInput)).toBe(DevicesModbusPluginRegisterType.discrete_input);
	});

	it('offers registers to number capabilities and the bool tables and register bits to buttons', () => {
		expect(registerTypesFor(capability('humidity.humidity'))).toEqual([
			DevicesModbusPluginRegisterType.input_register,
			DevicesModbusPluginRegisterType.holding_register,
		]);
		expect(defaultRegisterTypeFor(capability('humidity.humidity'))).toBe(DevicesModbusPluginRegisterType.input_register);
		expect(registerTypesFor(capability('button.event'))).toEqual([
			DevicesModbusPluginRegisterType.discrete_input,
			DevicesModbusPluginRegisterType.coil,
			DevicesModbusPluginRegisterType.input_register,
			DevicesModbusPluginRegisterType.holding_register,
		]);
		expect(defaultRegisterTypeFor(capability('button.event'))).toBe(DevicesModbusPluginRegisterType.discrete_input);
	});

	it('builds a read-only and a read-write base', () => {
		const [ro] = pointBaseFor(binaryInput, DevicesModbusPluginRegisterType.discrete_input);
		const [rw] = pointBaseFor(switcher, DevicesModbusPluginRegisterType.coil);

		expect([ro.permissions, ro.write === null, ro.read?.registerType]).toEqual([['ro'], true, DevicesModbusPluginRegisterType.discrete_input]);
		expect([rw.permissions, rw.write?.registerType]).toEqual([['rw'], DevicesModbusPluginRegisterType.coil]);
	});

	it('adds the static valve type to a valve base', () => {
		const bases = pointBaseFor(capability('valve.on'), DevicesModbusPluginRegisterType.coil);

		expect(bases).toHaveLength(2);
		expect(bases[0]).toMatchObject({ channelCategory: 'valve', propertyCategory: 'on', permissions: ['rw'], staticValue: null });
		expect(bases[0].read?.registerType).toBe(DevicesModbusPluginRegisterType.coil);
		expect(bases[0].write?.registerType).toBe(DevicesModbusPluginRegisterType.coil);
		expect(bases[1]).toEqual({
			channelCategory: 'valve',
			propertyCategory: 'type',
			propertyIdentifier: null,
			propertyName: null,
			format: ['generic', 'irrigation', 'shower_head', 'water_faucet'],
			dataType: 'enum',
			permissions: ['ro'],
			staticValue: 'generic',
			unit: null,
			read: null,
			write: null,
		});
	});

	it('puts the static valve type into the channel of every valve of a range', () => {
		const points = pointsFromRange(
			pointBaseFor(capability('valve.on'), DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 4, count: 2 },
			'Valve'
		);

		expect(points.map((p) => [p.channelIdentifier, p.name, p.propertyCategory, p.read?.address ?? null, p.staticValue])).toEqual([
			['valve_1', 'Valve 1', 'on', 4, null],
			['valve_1', 'Valve 1', 'type', null, 'generic'],
			['valve_2', 'Valve 2', 'on', 5, null],
			['valve_2', 'Valve 2', 'type', null, 'generic'],
		]);
		expect(new Set(points.map((p) => p.key)).size).toBe(4);
	});

	it('builds a button event with a bool read binding and the default long press', () => {
		const [base, ...statics] = pointBaseFor(capability('button.event'), DevicesModbusPluginRegisterType.discrete_input);

		expect(statics).toEqual([]);
		expect(base).toMatchObject({
			channelCategory: 'button',
			propertyCategory: 'event',
			dataType: 'enum',
			permissions: ['ev'],
			format: ['press', 'long_press', 'down', 'up'],
			write: null,
		});
		expect(base.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.discrete_input,
			dataType: DevicesModbusPluginDataType.bool,
			bit: null,
			longPressMs: null,
		});
	});

	it('reads a button from bit 0 of a register', () => {
		const [base] = pointBaseFor(capability('button.event'), DevicesModbusPluginRegisterType.holding_register);

		expect(base.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.holding_register,
			dataType: DevicesModbusPluginDataType.bool,
			bit: 0,
		});
	});

	it('builds a humidity point on an int16 input register', () => {
		const [base] = pointBaseFor(capability('humidity.humidity'), defaultRegisterTypeFor(capability('humidity.humidity')));

		expect(base).toMatchObject({ channelCategory: 'humidity', dataType: 'uchar', permissions: ['ro'], unit: '%', format: null, write: null });
		expect(base.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.input_register,
			dataType: DevicesModbusPluginDataType.int16,
			bit: null,
			scale: 1,
			offset: 0,
			longPressMs: null,
		});
	});

	it('adds and drops the write binding when the capability changes', () => {
		const [point] = pointsFromRange(
			pointBaseFor(binaryInput, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 7, count: 1 },
			'Input'
		);

		const writable = applyCapability(point, switcher);

		expect(writable.channelCategory).toBe('switcher');
		expect(writable.write?.address).toBe(7);
		expect(writable.permissions).toEqual(['rw']);

		const readOnly = applyCapability(writable, binaryInput);

		expect(readOnly.write).toBeNull();
		expect(readOnly.read?.address).toBe(7);
	});

	it('starts a fresh binding at the same address when the kind of the point changes', () => {
		const [point] = pointsFromRange(
			pointBaseFor(binaryInput, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 7, count: 1 },
			'Input'
		);

		const temperature = applyCapability({ ...point, read: { ...point.read!, invert: true } }, capability('temperature.temperature'));

		expect(temperature).toMatchObject({ channelCategory: 'temperature', dataType: 'float', permissions: ['ro'], unit: '°C', write: null });
		expect(temperature.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.input_register,
			address: 7,
			dataType: DevicesModbusPluginDataType.int16,
			invert: false,
		});

		const button = applyCapability(temperature, capability('button.event'));

		expect(button).toMatchObject({ dataType: 'enum', permissions: ['ev'], unit: null, format: ['press', 'long_press', 'down', 'up'] });
		expect(button.read).toMatchObject({
			registerType: DevicesModbusPluginRegisterType.input_register,
			address: 7,
			dataType: DevicesModbusPluginDataType.bool,
			bit: 0,
			longPressMs: null,
		});

		const input = applyCapability(button, binaryInput);

		expect(input).toMatchObject({ dataType: 'bool', permissions: ['ro'], format: null });
		expect(input.read).toMatchObject({ address: 7, dataType: DevicesModbusPluginDataType.bool, bit: null });
	});

	it('swaps the static siblings of a channel when the capability of its point changes', () => {
		const [relay] = pointsFromRange(
			pointBaseFor(switcher, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 0, count: 1 },
			'Relay'
		);
		const [other] = pointsFromRange(
			pointBaseFor(switcher, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 1, count: 1 },
			'Other'
		);

		const valve = applyCapability(relay, capability('valve.on'));
		const withType = withCapabilityStatics([valve, other], valve);

		expect(withType.map((p) => [p.channelIdentifier, p.channelCategory, p.propertyCategory, p.staticValue])).toEqual([
			['relay_1', 'valve', 'on', null],
			['relay_1', 'valve', 'type', 'generic'],
			['other_1', 'switcher', 'on', null],
		]);
		expect(withType[1]).toMatchObject({ name: 'Relay 1', channelId: null, propertyId: null, read: null, write: null });

		const back = applyCapability(withType[0], switcher);

		expect(
			withCapabilityStatics(
				withType.map((p) => (p.key === back.key ? back : p)),
				back
			).map((p) => p.propertyCategory)
		).toEqual(['on', 'on']);
	});

	it('gives a point a kind only for bool, numeric and button event properties', () => {
		const [point] = pointsFromRange(
			pointBaseFor(binaryInput, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 0, count: 1 },
			'Point'
		);
		const kindOf = (fields: Partial<typeof point>) => capabilityKindOf({ ...point, ...fields });

		expect(kindOf({})).toBe('bool');
		expect(kindOf({ channelCategory: 'analog_input', propertyCategory: 'value', dataType: 'ushort' })).toBe('number');
		expect(kindOf({ channelCategory: 'button', propertyCategory: 'event', dataType: 'enum', permissions: ['ev'] })).toBe('button');
		expect(kindOf({ channelCategory: 'heater', propertyCategory: 'mode', dataType: 'enum' })).toBeNull();
		expect(kindOf({ channelCategory: 'heater', propertyCategory: 'name', dataType: 'string' })).toBeNull();
	});
});
