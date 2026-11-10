import { describe, expect, it } from 'vitest';

import { DevicesModbusPluginRegisterType as RT } from '../../../openapi.constants';

import { type AddressNotation, AddressNotationError, formatAddress, parseAddressInput } from './address-notation';

describe('parseAddressInput', () => {
	it.each<[string, AddressNotation, RT, { registerType: RT | null; start: number; count: number }]>([
		['40001', 'modicon', RT.coil, { registerType: RT.holding_register, start: 0, count: 1 }],
		['30010', 'modicon', RT.coil, { registerType: RT.input_register, start: 9, count: 1 }],
		['400001', 'modicon', RT.coil, { registerType: RT.holding_register, start: 0, count: 1 }],
		['00001', 'modicon', RT.holding_register, { registerType: RT.coil, start: 0, count: 1 }],
		['10005', 'modicon', RT.holding_register, { registerType: RT.discrete_input, start: 4, count: 1 }],
		['40001-40008', 'modicon', RT.coil, { registerType: RT.holding_register, start: 0, count: 8 }],
		['1', 'one_based', RT.coil, { registerType: null, start: 0, count: 1 }],
		['65536', 'one_based', RT.coil, { registerType: null, start: 65535, count: 1 }],
		['5', 'pdu', RT.coil, { registerType: null, start: 5, count: 1 }],
		['0-31', 'pdu', RT.coil, { registerType: null, start: 0, count: 32 }],
		[' 0 - 255 ', 'pdu', RT.coil, { registerType: null, start: 0, count: 256 }],
		['65535', 'pdu', RT.coil, { registerType: null, start: 65535, count: 1 }],
	])('parses %s as %s', (input, notation, type, expected) => {
		expect(parseAddressInput(input, notation, type)).toEqual(expected);
	});

	it.each<[string, AddressNotation, string]>([
		['0', 'one_based', 'zeroNotAllowed'],
		['0-300', 'pdu', 'tooMany'],
		['65530-65540', 'pdu', 'outOfRange'],
		['abc', 'pdu', 'invalid'],
		['', 'pdu', 'empty'],
		['5-2', 'pdu', 'reversed'],
		['1.5', 'pdu', 'invalid'],
		['-3', 'pdu', 'invalid'],
		['2001', 'modicon', 'modiconFormat'],
		['40000', 'modicon', 'zeroNotAllowed'],
		['20001', 'modicon', 'modiconFormat'],
		['465537', 'modicon', 'outOfRange'],
		['30001-40002', 'modicon', 'modiconMixed'],
	])('rejects %s (%s) with %s', (input, notation, key) => {
		let error: unknown;
		try {
			parseAddressInput(input, notation, RT.coil);
		} catch (e) {
			error = e;
		}
		expect(error).toBeInstanceOf(AddressNotationError);
		expect((error as Error).message).toBe(`devicesModbusPlugin.wizard.address.errors.${key}`);
	});
});

describe('formatAddress', () => {
	it.each<[number, RT, AddressNotation, string]>([
		[0, RT.holding_register, 'modicon', '40001'],
		[9, RT.input_register, 'modicon', '30010'],
		[4, RT.discrete_input, 'modicon', '10005'],
		[0, RT.coil, 'modicon', '00001'],
		[10000, RT.holding_register, 'modicon', '410001'],
		[7, RT.coil, 'pdu', '7'],
		[7, RT.coil, 'one_based', '8'],
	])('formats %i %s as %s', (address, type, notation, expected) => {
		expect(formatAddress(address, type, notation)).toBe(expected);
	});
});
