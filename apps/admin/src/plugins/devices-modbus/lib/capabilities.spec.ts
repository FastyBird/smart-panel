import { describe, expect, it } from 'vitest';

import { DevicesModbusPluginRegisterType } from '../../../openapi.constants';

import { CUSTOM_CAPABILITIES, applyCapability, defaultRegisterTypeFor, pointBaseFor, registerTypesFor } from './capabilities';
import { pointsFromRange } from './points';

describe('CUSTOM_CAPABILITIES', () => {
	it('lists the three custom capabilities with their access', () => {
		expect(CUSTOM_CAPABILITIES.map((c) => [c.key, c.readable, c.writable, c.dataType])).toEqual([
			['binary_input.state', true, false, 'bool'],
			['switcher.on', true, true, 'bool'],
			['outlet.on', true, true, 'bool'],
		]);
	});

	it('has unique keys that match channel and property category', () => {
		for (const c of CUSTOM_CAPABILITIES) {
			expect(c.key).toBe(`${c.channelCategory}.${c.propertyCategory}`);
		}
		expect(new Set(CUSTOM_CAPABILITIES.map((c) => c.key)).size).toBe(CUSTOM_CAPABILITIES.length);
	});
});

describe('custom capability helpers', () => {
	const [binaryInput, switcher] = CUSTOM_CAPABILITIES;

	it('limits writable capabilities to writable tables', () => {
		expect(registerTypesFor(switcher)).toEqual([DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register]);
		expect(registerTypesFor(binaryInput)).toContain(DevicesModbusPluginRegisterType.discrete_input);
		expect(defaultRegisterTypeFor(binaryInput)).toBe(DevicesModbusPluginRegisterType.discrete_input);
	});

	it('builds a read-only and a read-write base', () => {
		const ro = pointBaseFor(binaryInput, DevicesModbusPluginRegisterType.discrete_input);
		const rw = pointBaseFor(switcher, DevicesModbusPluginRegisterType.coil);

		expect([ro.permissions, ro.write === null, ro.read?.registerType]).toEqual([['ro'], true, DevicesModbusPluginRegisterType.discrete_input]);
		expect([rw.permissions, rw.write?.registerType]).toEqual([['rw'], DevicesModbusPluginRegisterType.coil]);
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
});
