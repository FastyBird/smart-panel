import { ModbusByteOrder, ModbusDataType } from '../devices-modbus.constants';

import {
	ModbusValueOptions,
	ModbusValueRangeError,
	decodeBit,
	decodeRegisters,
	encodeValue,
	registerSpan,
} from './codec';

const opts = (over: Partial<ModbusValueOptions> = {}): ModbusValueOptions => ({
	dataType: ModbusDataType.UINT16,
	byteOrder: ModbusByteOrder.BIG,
	wordOrder: ModbusByteOrder.BIG,
	bit: null,
	invert: false,
	scale: 1,
	offset: 0,
	valueMap: null,
	...over,
});

describe('modbus codec', () => {
	it('reports register span', () => {
		expect(registerSpan(ModbusDataType.FLOAT32)).toBe(2);
		expect(registerSpan(ModbusDataType.INT32)).toBe(2);
		expect(registerSpan(ModbusDataType.UINT16)).toBe(1);
		expect(registerSpan(ModbusDataType.BOOL)).toBe(1);
	});

	it('decodes big-endian float', () => {
		const v = decodeRegisters([0x3fec, 0xcccd], opts({ dataType: ModbusDataType.FLOAT32 }));

		expect(v).toBeCloseTo(1.85, 5);
	});

	it('decodes low-word-first uint32', () => {
		expect(
			decodeRegisters([0x0001, 0x0000], opts({ dataType: ModbusDataType.UINT32, wordOrder: ModbusByteOrder.LITTLE })),
		).toBe(1);
	});

	it('decodes byte-swapped uint32', () => {
		expect(
			decodeRegisters([0x0000, 0x0100], opts({ dataType: ModbusDataType.UINT32, byteOrder: ModbusByteOrder.LITTLE })),
		).toBe(1);
	});

	it('decodes int16 sign', () => {
		expect(decodeRegisters([0xffff], opts({ dataType: ModbusDataType.INT16 }))).toBe(-1);
		expect(decodeRegisters([0xffff], opts({ dataType: ModbusDataType.UINT16 }))).toBe(65535);
	});

	it('extracts Qingjun bits', () => {
		const o = opts({ dataType: ModbusDataType.BOOL });

		expect(decodeRegisters([0x8000], { ...o, bit: 15 })).toBe(true);
		expect(decodeRegisters([0x0001], { ...o, bit: 0 })).toBe(true);
		expect(decodeRegisters([0x0001], { ...o, bit: 1 })).toBe(false);
	});

	it('treats non-zero bool register as true', () => {
		const o = opts({ dataType: ModbusDataType.BOOL });

		expect(decodeRegisters([1], o)).toBe(true);
		expect(decodeRegisters([0], o)).toBe(false);
	});

	it('inverts booleans', () => {
		expect(decodeBit(true, { invert: true, valueMap: null })).toBe(false);
		expect(decodeBit(true, { invert: false, valueMap: null })).toBe(true);
	});

	it('maps relay read values', () => {
		const valueMap = [
			{ raw: 1, value: true },
			{ raw: 0, value: false },
		];

		expect(decodeRegisters([1], opts({ valueMap }))).toBe(true);
		expect(decodeRegisters([0], opts({ valueMap }))).toBe(false);
		expect(decodeRegisters([2], opts({ valueMap }))).toBeNull();
	});

	it('applies scale and offset', () => {
		expect(decodeRegisters([215], opts({ dataType: ModbusDataType.INT16, scale: 0.1 }))).toBeCloseTo(21.5, 9);
		expect(decodeRegisters([10], opts({ scale: 2, offset: 1 }))).toBe(21);
	});

	it.each([
		['NaN', [0x7fc0, 0x0000]],
		['+Infinity', [0x7f80, 0x0000]],
		['-Infinity', [0xff80, 0x0000]],
	])('decodes a float32 %s as null', (_case, words) => {
		expect(decodeRegisters(words, opts({ dataType: ModbusDataType.FLOAT32 }))).toBeNull();
	});

	it('decodes a reading that scaling overflows as null', () => {
		// The largest finite float32 times 1e300 exceeds Number.MAX_VALUE.
		expect(decodeRegisters([0x7f7f, 0xffff], opts({ dataType: ModbusDataType.FLOAT32, scale: 1e300 }))).toBeNull();
	});

	it('encodes relay write values', () => {
		const valueMap = [
			{ raw: 256, value: true },
			{ raw: 512, value: false },
		];

		expect(encodeValue(true, opts({ valueMap }), 'registers')).toEqual({ kind: 'registers', words: [256] });
		expect(encodeValue(false, opts({ valueMap }), 'registers')).toEqual({ kind: 'registers', words: [512] });
	});

	it('encodes coil', () => {
		const o = opts({ dataType: ModbusDataType.BOOL });

		expect(encodeValue(true, o, 'bit')).toEqual({ kind: 'bit', value: true });
		expect(encodeValue(true, { ...o, invert: true }, 'bit')).toEqual({ kind: 'bit', value: false });
	});

	it('encodes bool into a register', () => {
		expect(encodeValue(true, opts({ dataType: ModbusDataType.BOOL }), 'registers')).toEqual({
			kind: 'registers',
			words: [1],
		});
	});

	it('encodes scaled int16', () => {
		expect(encodeValue(21.5, opts({ dataType: ModbusDataType.INT16, scale: 0.1 }), 'registers')).toEqual({
			kind: 'registers',
			words: [215],
		});
		expect(encodeValue(-1, opts({ dataType: ModbusDataType.INT16 }), 'registers')).toEqual({
			kind: 'registers',
			words: [0xffff],
		});
	});

	it('refuses out-of-range', () => {
		expect(() => encodeValue(70000, opts(), 'registers')).toThrow(ModbusValueRangeError);
		expect(() => encodeValue('toggle', opts({ valueMap: [{ raw: 1, value: true }] }), 'registers')).toThrow(
			ModbusValueRangeError,
		);
		expect(() => encodeValue(Number.NaN, opts(), 'registers')).toThrow(ModbusValueRangeError);
		expect(() => encodeValue(Infinity, opts({ dataType: ModbusDataType.FLOAT32 }), 'registers')).toThrow(
			ModbusValueRangeError,
		);
	});

	it('refuses bit writes', () => {
		expect(() => encodeValue(true, opts({ dataType: ModbusDataType.BOOL, bit: 3 }), 'registers')).toThrow(
			ModbusValueRangeError,
		);
		expect(() => encodeValue(true, opts({ dataType: ModbusDataType.BOOL, bit: 3 }), 'bit')).toThrow(
			ModbusValueRangeError,
		);
	});

	it('round-trips float32 low-word-first', () => {
		const o = opts({
			dataType: ModbusDataType.FLOAT32,
			wordOrder: ModbusByteOrder.LITTLE,
			byteOrder: ModbusByteOrder.LITTLE,
		});
		const enc = encodeValue(1.85, o, 'registers');

		if (enc.kind !== 'registers') throw new Error('expected registers');

		expect(enc.words).toHaveLength(2);
		expect(decodeRegisters(enc.words, o)).toBeCloseTo(1.85, 5);
	});
});
