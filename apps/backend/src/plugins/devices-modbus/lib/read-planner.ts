import { ModbusRegisterType } from '../devices-modbus.constants';

export interface ReadPoint {
	key: string;
	registerType: ModbusRegisterType;
	address: number;
	span: number;
}

export interface ReadBlock {
	registerType: ModbusRegisterType;
	address: number;
	count: number;
	points: ReadPoint[];
}

export interface ReadLimits {
	maxRegisters: number;
	maxBits: number;
	maxGap: number;
}

const REGISTER_TYPE_ORDER = Object.values(ModbusRegisterType);

const isBitType = (registerType: ModbusRegisterType): boolean =>
	registerType === ModbusRegisterType.COIL || registerType === ModbusRegisterType.DISCRETE_INPUT;

/**
 * Groups points into as few block reads as the limits allow. Blocks never mix register types and are ordered by
 * register type (enum order), then address. Points sharing a register end up in the same block.
 */
export function planReadBlocks(points: readonly ReadPoint[], limits: ReadLimits): ReadBlock[] {
	const sorted = [...points].sort(
		(a, b) =>
			REGISTER_TYPE_ORDER.indexOf(a.registerType) - REGISTER_TYPE_ORDER.indexOf(b.registerType) ||
			a.address - b.address,
	);

	const blocks: ReadBlock[] = [];
	let current: ReadBlock | null = null;

	for (const point of sorted) {
		if (current !== null && current.registerType === point.registerType) {
			const limit = isBitType(point.registerType) ? limits.maxBits : limits.maxRegisters;
			const end = current.address + current.count;
			const gap = Math.max(0, point.address - end);
			const mergedCount = Math.max(end, point.address + point.span) - current.address;

			if (gap <= limits.maxGap && mergedCount <= limit) {
				current.count = mergedCount;
				current.points.push(point);

				continue;
			}
		}

		current = { registerType: point.registerType, address: point.address, count: point.span, points: [point] };
		blocks.push(current);
	}

	return blocks;
}

/** Splits a block into one block per distinct (address, span), for the fallback after a read exception. */
export function splitBlock(block: ReadBlock): ReadBlock[] {
	const groups = new Map<string, ReadBlock>();

	for (const point of [...block.points].sort((a, b) => a.address - b.address)) {
		const id = `${point.address}:${point.span}`;
		const group = groups.get(id);

		if (group) {
			group.points.push(point);
		} else {
			groups.set(id, {
				registerType: block.registerType,
				address: point.address,
				count: point.span,
				points: [point],
			});
		}
	}

	return [...groups.values()];
}

export function sliceForPoint(
	block: ReadBlock,
	values: readonly (number | boolean)[],
	point: ReadPoint,
): (number | boolean)[] {
	const offset = point.address - block.address;

	return values.slice(offset, offset + point.span);
}
