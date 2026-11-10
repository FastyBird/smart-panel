import { ModbusByteOrder, ModbusDataType } from '../devices-modbus.constants';
import { ModbusValueMapEntry } from '../entities/modbus-binding.entity';

export interface ModbusValueOptions {
	dataType: ModbusDataType;
	byteOrder: ModbusByteOrder;
	wordOrder: ModbusByteOrder;
	bit: number | null;
	invert: boolean;
	scale: number;
	offset: number;
	valueMap: ModbusValueMapEntry[] | null;
}

export type ModbusPropertyValue = string | number | boolean;

export class ModbusValueRangeError extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'ModbusValueRangeError';
	}
}

const INTEGER_RANGES: Partial<Record<ModbusDataType, [number, number]>> = {
	[ModbusDataType.INT16]: [-32768, 32767],
	[ModbusDataType.UINT16]: [0, 65535],
	[ModbusDataType.INT32]: [-2147483648, 2147483647],
	[ModbusDataType.UINT32]: [0, 4294967295],
};

export function registerSpan(dataType: ModbusDataType): 1 | 2 {
	return dataType === ModbusDataType.INT32 || dataType === ModbusDataType.UINT32 || dataType === ModbusDataType.FLOAT32
		? 2
		: 1;
}

const swapBytes = (word: number): number => ((word & 0xff) << 8) | ((word >> 8) & 0xff);

/** Wire words to big-endian words, undoing word and byte order. */
function normaliseWords(words: readonly number[], options: ModbusValueOptions): number[] {
	let result = [...words];

	if (result.length > 1 && options.wordOrder === ModbusByteOrder.LITTLE) {
		result = result.reverse();
	}

	if (options.byteOrder === ModbusByteOrder.LITTLE) {
		result = result.map(swapBytes);
	}

	return result;
}

/** Big-endian words to wire words, applying word and byte order. */
function wireWords(words: number[], options: ModbusValueOptions): number[] {
	let result = words;

	if (options.byteOrder === ModbusByteOrder.LITTLE) {
		result = result.map(swapBytes);
	}

	if (result.length > 1 && options.wordOrder === ModbusByteOrder.LITTLE) {
		result = [...result].reverse();
	}

	return result;
}

function lookupRaw(raw: number, valueMap: ModbusValueMapEntry[]): ModbusPropertyValue | null {
	const entry = valueMap.find((e) => e.raw === raw);

	return entry ? entry.value : null;
}

export function decodeBit(
	bit: boolean,
	options: Pick<ModbusValueOptions, 'invert' | 'valueMap'>,
): ModbusPropertyValue | null {
	const value = options.invert ? !bit : bit;

	return options.valueMap ? lookupRaw(value ? 1 : 0, options.valueMap) : value;
}

export function decodeRegisters(words: readonly number[], options: ModbusValueOptions): ModbusPropertyValue | null {
	const span = registerSpan(options.dataType);

	if (words.length < span) {
		throw new ModbusValueRangeError(`Expected ${span} register(s), got ${words.length}`);
	}

	const ordered = normaliseWords(words.slice(0, span), options);
	const view = new DataView(new ArrayBuffer(4));

	if (span === 2) {
		view.setUint16(0, ordered[0]);
		view.setUint16(2, ordered[1]);
	} else {
		view.setUint16(0, ordered[0]);
	}

	let raw: number;

	switch (options.dataType) {
		case ModbusDataType.BOOL:
			raw = ordered[0];
			break;
		case ModbusDataType.INT16:
			raw = view.getInt16(0);
			break;
		case ModbusDataType.UINT16:
			raw = view.getUint16(0);
			break;
		case ModbusDataType.INT32:
			raw = view.getInt32(0);
			break;
		case ModbusDataType.UINT32:
			raw = view.getUint32(0);
			break;
		case ModbusDataType.FLOAT32:
			raw = view.getFloat32(0);
			break;
	}

	if (options.bit !== null) {
		return decodeBit(((ordered[0] >> options.bit) & 1) === 1, options);
	}

	if (options.dataType === ModbusDataType.BOOL && !options.valueMap) {
		return options.invert ? raw === 0 : raw !== 0;
	}

	if (options.valueMap) {
		return lookupRaw(raw, options.valueMap);
	}

	const value = raw * options.scale + options.offset;

	// A FLOAT32 register pair can carry NaN or ±Infinity (and scaling can overflow): neither is a reading, and NaN,
	// never equal to itself, would be re-reported on every poll. Reported as invalid instead.
	return Number.isFinite(value) ? value : null;
}

export function encodeValue(
	value: ModbusPropertyValue,
	options: ModbusValueOptions,
	target: 'bit' | 'registers',
): { kind: 'bit'; value: boolean } | { kind: 'registers'; words: number[] } {
	if (options.bit !== null) {
		throw new ModbusValueRangeError('Bit bindings are read-only');
	}

	if (typeof value === 'number' && !Number.isFinite(value)) {
		throw new ModbusValueRangeError('Value must be a finite number');
	}

	let raw: number;

	if (options.valueMap) {
		const entry = options.valueMap.find((e) => e.value === value);

		if (!entry) {
			throw new ModbusValueRangeError(`Value ${String(value)} is not in the write map`);
		}

		raw = entry.raw;
	} else if (options.dataType === ModbusDataType.BOOL) {
		if (typeof value !== 'boolean') {
			throw new ModbusValueRangeError('Expected a boolean value');
		}

		raw = (options.invert ? !value : value) ? 1 : 0;
	} else {
		if (typeof value !== 'number') {
			throw new ModbusValueRangeError('Expected a numeric value');
		}

		raw = (value - options.offset) / options.scale;

		if (options.dataType !== ModbusDataType.FLOAT32) {
			raw = Math.round(raw);
		}

		if (!Number.isFinite(raw)) {
			throw new ModbusValueRangeError('Value is not representable');
		}
	}

	if (target === 'bit') {
		return { kind: 'bit', value: raw !== 0 };
	}

	const range = INTEGER_RANGES[options.dataType];
	const effective = options.dataType === ModbusDataType.BOOL ? ([0, 65535] as [number, number]) : range;

	if (effective && (!Number.isInteger(raw) || raw < effective[0] || raw > effective[1])) {
		throw new ModbusValueRangeError(`Raw value ${raw} is outside the ${options.dataType} range`);
	}

	const view = new DataView(new ArrayBuffer(4));

	switch (options.dataType) {
		case ModbusDataType.BOOL:
		case ModbusDataType.UINT16:
			view.setUint16(0, raw);
			break;
		case ModbusDataType.INT16:
			view.setInt16(0, raw);
			break;
		case ModbusDataType.INT32:
			view.setInt32(0, raw);
			break;
		case ModbusDataType.UINT32:
			view.setUint32(0, raw);
			break;
		case ModbusDataType.FLOAT32:
			view.setFloat32(0, raw);

			if (!Number.isFinite(view.getFloat32(0))) {
				throw new ModbusValueRangeError('Value overflows float32');
			}

			break;
	}

	const big = registerSpan(options.dataType) === 2 ? [view.getUint16(0), view.getUint16(2)] : [view.getUint16(0)];

	return { kind: 'registers', words: wireWords(big, options) };
}
