import {
	type ApiCreateModbusDeviceStructure,
	type ApiUpdateModbusDeviceStructure,
	type DevicesModbusPluginByteOrder,
	DevicesModbusPluginDataType,
	DevicesModbusPluginRegisterType,
	DevicesModbusPluginWriteFunction,
} from '../../../openapi.constants';
import type { IModbusTemplatePreview, IModbusTemplatePreviewBinding } from '../store/templates.types';

import type { ParsedAddress } from './address-notation';

export interface ModbusPointBinding {
	registerType: DevicesModbusPluginRegisterType;
	/** 0-based PDU address */
	address: number;
	dataType: DevicesModbusPluginDataType;
	bit: number | null;
	/** null = use the device setting */
	byteOrder: DevicesModbusPluginByteOrder | null;
	wordOrder: DevicesModbusPluginByteOrder | null;
	scale: number;
	offset: number;
	invert: boolean;
	valueMap: { raw: number; value: string | number | boolean }[] | null;
	writeFunction: DevicesModbusPluginWriteFunction | null;
	pollIntervalMs: number | null;
	/** Hold time of a long press; only the read binding of a button event has one. null = the backend default (800 ms) */
	longPressMs: number | null;
}

export interface ModbusPoint {
	/** Local identity of the row, not part of the point's content */
	key: string;
	name: string;
	/** ID of the existing channel the point belongs to; null for a channel the request creates */
	channelId: string | null;
	/** ID of the existing property the point maps; null for a property the request creates */
	propertyId: string | null;
	channelCategory: string;
	channelIdentifier: string;
	propertyCategory: string;
	propertyIdentifier: string | null;
	propertyName: string | null;
	format: (string | number)[] | null;
	dataType: string;
	permissions: string[];
	staticValue: string | number | boolean | null;
	unit: string | null;
	read: ModbusPointBinding | null;
	write: ModbusPointBinding | null;
}

/** The content of a new point before it is placed in a channel. */
export type ModbusPointBase = Omit<ModbusPoint, 'key' | 'name' | 'channelId' | 'propertyId' | 'channelIdentifier'>;

let keySequence = 0;

/** A new local row key. */
export const nextPointKey = (): string => `point-${++keySequence}`;

const slug = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '');

const uniqueIdentifier = (wanted: string, taken: Set<string>): string => {
	const root = wanted === '' ? 'point' : wanted;
	let candidate = root;

	for (let suffix = 2; taken.has(candidate); suffix++) {
		candidate = `${root}_${suffix}`;
	}

	taken.add(candidate);

	return candidate;
};

/**
 * One new channel per address of the range. Every base becomes a point of each channel: the bound ones at the
 * channel's address, the static ones (no bindings) as they are.
 */
export function pointsFromRange(
	bases: ModbusPointBase | ModbusPointBase[],
	parsed: ParsedAddress,
	namePrefix: string,
	existingIdentifiers: string[] = []
): ModbusPoint[] {
	const taken = new Set(existingIdentifiers);
	const points: ModbusPoint[] = [];

	for (let i = 0; i < parsed.count; i++) {
		const shift = (binding: ModbusPointBinding | null): ModbusPointBinding | null =>
			binding === null
				? null
				: {
						...binding,
						registerType: parsed.registerType ?? binding.registerType,
						address: parsed.start + i,
						valueMap: binding.valueMap === null ? null : binding.valueMap.map((entry) => ({ ...entry })),
					};

		const name = `${namePrefix} ${i + 1}`;
		const channelIdentifier = uniqueIdentifier(slug(name), taken);

		for (const base of Array.isArray(bases) ? bases : [bases]) {
			points.push({
				...base,
				permissions: [...base.permissions],
				read: shift(base.read),
				write: shift(base.write),
				key: nextPointKey(),
				channelId: null,
				propertyId: null,
				propertyIdentifier: base.propertyIdentifier ?? null,
				propertyName: base.propertyName ?? null,
				format: base.format ? [...base.format] : null,
				name,
				channelIdentifier,
			});
		}
	}

	return points;
}

const isBound = (point: ModbusPoint): boolean => point.read !== null || point.write !== null;

/**
 * Removes a point. The static points of its channel go with it when no bound point is left in the channel, so a
 * valve never keeps its type without its state; a channel of static points only is left alone.
 */
export function removePoint(points: ModbusPoint[], key: string): ModbusPoint[] {
	const removed = points.find((point) => point.key === key);
	const rest = points.filter((point) => point.key !== key);

	if (removed === undefined || !isBound(removed)) {
		return rest;
	}

	const sameChannel = (point: ModbusPoint): boolean => point.channelIdentifier === removed.channelIdentifier;

	return rest.some((point) => sameChannel(point) && isBound(point)) ? rest : rest.filter((point) => !sameChannel(point));
}

const bindingFromPreview = (binding: IModbusTemplatePreviewBinding | undefined): ModbusPointBinding | null =>
	binding === undefined
		? null
		: {
				registerType: binding.registerType,
				address: binding.address,
				dataType: binding.dataType,
				bit: binding.bit ?? null,
				byteOrder: binding.byteOrder ?? null,
				wordOrder: binding.wordOrder ?? null,
				scale: binding.scale ?? 1,
				offset: binding.offset ?? 0,
				invert: binding.invert ?? false,
				// An empty map is no map: the editor and the request treat both alike.
				valueMap: binding.valueMap?.length ? binding.valueMap.map((entry) => ({ raw: entry.raw, value: entry.value })) : null,
				writeFunction: binding.writeFunction ?? null,
				pollIntervalMs: binding.pollIntervalMs ?? null,
				longPressMs: binding.longPressMs ?? null,
			};

export function pointsFromPreview(preview: IModbusTemplatePreview): ModbusPoint[] {
	return preview.channels.flatMap((channel) =>
		channel.properties.map((property) => ({
			key: nextPointKey(),
			name: channel.name,
			channelId: null,
			propertyId: null,
			channelCategory: channel.category,
			channelIdentifier: channel.identifier,
			propertyCategory: property.category,
			propertyIdentifier: property.identifier ?? null,
			propertyName: property.name ?? null,
			format: property.format ? [...property.format] : null,
			dataType: property.dataType,
			permissions: [...property.permissions],
			staticValue: property.staticValue ?? null,
			unit: property.unit ?? null,
			read: bindingFromPreview(property.read),
			write: bindingFromPreview(property.write),
		}))
	);
}

const withoutKey = (point: ModbusPoint): Omit<ModbusPoint, 'key'> => {
	const content: Partial<ModbusPoint> = { ...point };
	delete content.key;

	return content as Omit<ModbusPoint, 'key'>;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
	if (a === b) {
		return true;
	}

	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
	}

	if (a && b && typeof a === 'object' && typeof b === 'object') {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

		return [...keys].every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
	}

	return false;
};

/** Compares the content of two point lists, ignoring the row keys. */
export function samePoints(a: ModbusPoint[], b: ModbusPoint[]): boolean {
	return a.length === b.length && a.every((point, index) => deepEqual(withoutKey(point), withoutKey(b[index])));
}

/** Channels whose points measure a quantity; a device of only these is a sensor. */
const MEASURED_CHANNELS: readonly string[] = ['temperature', 'humidity', 'electrical_power', 'pressure', 'illuminance', 'analog_input'];

export type ModbusSuggestedCategory = 'valve' | 'switcher' | 'sensor' | 'input_controller';

/** The device category the points suggest. Static points (no bindings) say nothing about the device. */
export function suggestCategory(points: ModbusPoint[]): ModbusSuggestedCategory {
	if (points.some((point) => point.channelCategory === 'valve' && point.propertyCategory === 'on')) {
		return 'valve';
	}

	if (points.some((point) => point.write !== null)) {
		return 'switcher';
	}

	const bound = points.filter(isBound);

	return bound.length > 0 && bound.every((point) => MEASURED_CHANNELS.includes(point.channelCategory)) ? 'sensor' : 'input_controller';
}

type Body = ApiCreateModbusDeviceStructure['data'];
type Channel = Body['channels'][number];
type Property = Channel['properties'][number];
type RequestBinding = NonNullable<Property['read']>;

export const toRequestBinding = (binding: ModbusPointBinding): RequestBinding => ({
	register_type: binding.registerType,
	address: binding.address,
	data_type: binding.dataType,
	...(binding.bit !== null ? { bit: binding.bit } : {}),
	...(binding.byteOrder !== null ? { byte_order: binding.byteOrder } : {}),
	...(binding.wordOrder !== null ? { word_order: binding.wordOrder } : {}),
	...(binding.valueMap !== null && binding.valueMap.length > 0
		? { value_map: binding.valueMap.map((entry) => ({ raw: entry.raw, value: entry.value })) }
		: {
				...(binding.scale !== 1 ? { scale: binding.scale } : {}),
				...(binding.offset !== 0 ? { offset: binding.offset } : {}),
			}),
	...(binding.invert ? { invert: true } : {}),
	...(binding.writeFunction !== null ? { write_function: binding.writeFunction } : {}),
	...(binding.pollIntervalMs !== null ? { poll_interval_ms: binding.pollIntervalMs } : {}),
	...(binding.longPressMs !== null ? { long_press_ms: binding.longPressMs } : {}),
});

const toRequestProperty = (point: ModbusPoint): Property => ({
	...(point.propertyId !== null ? { id: point.propertyId } : {}),
	...(point.propertyIdentifier !== null ? { identifier: point.propertyIdentifier } : {}),
	...(point.propertyName !== null ? { name: point.propertyName } : {}),
	category: point.propertyCategory as Property['category'],
	data_type: point.dataType as Property['data_type'],
	permissions: point.permissions as Property['permissions'],
	...(point.unit !== null ? { unit: point.unit } : {}),
	...(point.format !== null ? { format: point.format } : {}),
	...(point.staticValue !== null ? { static_value: point.staticValue } : {}),
	...(point.read !== null ? { read: toRequestBinding(point.read) } : {}),
	...(point.write !== null ? { write: toRequestBinding(point.write) } : {}),
});

export interface ModbusCreateInput {
	name: string;
	category: string;
	roomId: string | null;
	endpointId: string;
	unitId: number;
	pollIntervalMs: number;
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
	points: ModbusPoint[];
	template: { id: string; revision: string; points: ModbusPoint[] } | null;
	manufacturer?: string;
	model?: string;
	maxReadRegisters?: number | null;
	maxReadBits?: number | null;
	maxReadGap?: number | null;
}

export interface ModbusUpdateInput {
	category: string;
	pollIntervalMs: number;
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
	points: ModbusPoint[];
}

/** Groups the points into request channels by channel identifier; an existing channel or property keeps its id. */
const toRequestChannels = (points: ModbusPoint[]): Channel[] => {
	const channels = new Map<string, Channel>();

	for (const point of points) {
		const existing = channels.get(point.channelIdentifier);

		if (existing) {
			if (
				existing.name !== point.name ||
				existing.category !== point.channelCategory ||
				(existing.id !== undefined && point.channelId !== null && existing.id !== point.channelId)
			) {
				throw new Error(`Points of channel "${point.channelIdentifier}" disagree on the channel id, name or category`);
			}

			if (existing.id === undefined && point.channelId !== null) {
				existing.id = point.channelId;
			}

			existing.properties.push(toRequestProperty(point));
		} else {
			channels.set(point.channelIdentifier, {
				...(point.channelId !== null ? { id: point.channelId } : {}),
				identifier: point.channelIdentifier,
				name: point.name,
				category: point.channelCategory as Channel['category'],
				properties: [toRequestProperty(point)],
			});
		}
	}

	return [...channels.values()];
};

export function toCreateRequest(input: ModbusCreateInput): ApiCreateModbusDeviceStructure {
	const channels = toRequestChannels(input.points);

	const fromTemplate = input.template !== null && samePoints(input.points, input.template.points);

	return {
		data: {
			name: input.name,
			category: input.category as Body['category'],
			...(input.roomId !== null ? { room_id: input.roomId } : {}),
			endpoint_id: input.endpointId,
			unit_id: input.unitId,
			poll_interval_ms: input.pollIntervalMs,
			byte_order: input.byteOrder,
			word_order: input.wordOrder,
			...(input.maxReadRegisters !== null && input.maxReadRegisters !== undefined ? { max_read_registers: input.maxReadRegisters } : {}),
			...(input.maxReadBits !== null && input.maxReadBits !== undefined ? { max_read_bits: input.maxReadBits } : {}),
			...(input.maxReadGap !== null && input.maxReadGap !== undefined ? { max_read_gap: input.maxReadGap } : {}),
			...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
			...(input.model !== undefined ? { model: input.model } : {}),
			...(fromTemplate && input.template ? { template_id: input.template.id, template_revision: input.template.revision } : {}),
			channels,
		},
	};
}

/** The points update of an existing device; template provenance is not part of it. */
export function toUpdateRequest(input: ModbusUpdateInput): ApiUpdateModbusDeviceStructure {
	return {
		data: {
			category: input.category as ApiUpdateModbusDeviceStructure['data']['category'],
			poll_interval_ms: input.pollIntervalMs,
			byte_order: input.byteOrder,
			word_order: input.wordOrder,
			channels: toRequestChannels(input.points),
		},
	};
}

const NUMERIC_DATA_TYPES: readonly string[] = ['char', 'uchar', 'short', 'ushort', 'int', 'uint', 'float'];

/**
 * The value-map value typed into a text input. Only a numeric property turns "1" into 1; a string or enum property
 * keeps the text as typed, including a leading zero such as "01".
 */
export const valueMapValueFromText = (text: string, dataType: string): string | number =>
	NUMERIC_DATA_TYPES.includes(dataType) && text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;

const ADDRESS_SPACE = 65536;

/** Registers (or coils) a binding occupies: 32-bit values take two registers. */
export const bindingSpan = (binding: Pick<ModbusPointBinding, 'registerType' | 'dataType'>): number => {
	if (binding.registerType === DevicesModbusPluginRegisterType.coil || binding.registerType === DevicesModbusPluginRegisterType.discrete_input) {
		return 1;
	}

	return binding.dataType === DevicesModbusPluginDataType.int32 ||
		binding.dataType === DevicesModbusPluginDataType.uint32 ||
		binding.dataType === DevicesModbusPluginDataType.float32
		? 2
		: 1;
};

/**
 * Whether a value-map raw value can come from (and be written to) the binding: a coil, discrete input or single bit
 * is 0 or 1, a register read as bool is its whole 16-bit word, and the integer types hold their own range.
 */
const rawFits = (raw: number, binding: ModbusPointBinding): boolean => {
	if (!Number.isInteger(raw)) {
		return false;
	}

	const bitTable =
		binding.registerType === DevicesModbusPluginRegisterType.coil || binding.registerType === DevicesModbusPluginRegisterType.discrete_input;

	if (bitTable || (binding.bit !== null && binding.dataType === DevicesModbusPluginDataType.bool)) {
		return raw === 0 || raw === 1;
	}

	switch (binding.dataType) {
		case DevicesModbusPluginDataType.int16:
			return raw >= -0x8000 && raw <= 0x7fff;
		case DevicesModbusPluginDataType.int32:
			return raw >= -0x80000000 && raw <= 0x7fffffff;
		case DevicesModbusPluginDataType.uint32:
			return raw >= 0 && raw <= 0xffffffff;
		default:
			// uint16, and bool read from a whole register.
			return raw >= 0 && raw <= 0xffff;
	}
};

export type ModbusBindingIssueField = 'address' | 'dataType' | 'bit' | 'valueMap' | 'invert' | 'writeFunction';

/**
 * The binding rules the backend applies when the device is created, as translation keys per field, so the point
 * editor can refuse a combination before the wizard reaches Create. `binding` carries the parsed address and table.
 */
export function bindingIssues(binding: ModbusPointBinding, kind: 'read' | 'write'): Partial<Record<ModbusBindingIssueField, string>> {
	const issues: Partial<Record<ModbusBindingIssueField, string>> = {};
	const bitTable =
		binding.registerType === DevicesModbusPluginRegisterType.coil || binding.registerType === DevicesModbusPluginRegisterType.discrete_input;
	const span = bindingSpan(binding);

	if (bitTable && binding.dataType !== DevicesModbusPluginDataType.bool) {
		issues.dataType = 'devicesModbusPlugin.wizard.points.errors.bitTableBool';
	}

	if (binding.bit !== null && (!Number.isInteger(binding.bit) || binding.bit < 0 || binding.bit > 15)) {
		issues.bit = 'devicesModbusPlugin.wizard.points.errors.bitRange';
	}

	if (binding.address + span > ADDRESS_SPACE) {
		issues.address = 'devicesModbusPlugin.wizard.points.errors.beyondAddressSpace';
	}

	const valueMap = binding.valueMap ?? [];

	if (valueMap.length > 0) {
		const raws = valueMap.map((entry) => entry.raw);
		const values = valueMap.map((entry) => entry.value);

		if (binding.dataType === DevicesModbusPluginDataType.float32) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapFloat';
		} else if (binding.scale !== 1 || binding.offset !== 0) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapScaled';
		} else if (raws.some((raw) => typeof raw !== 'number' || !Number.isFinite(raw))) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapRaw';
		} else if (raws.some((raw) => !rawFits(raw, binding))) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapRawRange';
		} else if (new Set(raws).size !== raws.length) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapRawUnique';
		} else if (new Set(values).size !== values.length) {
			issues.valueMap = 'devicesModbusPlugin.wizard.points.errors.valueMapValueUnique';
		}

		if (binding.invert) {
			issues.invert = 'devicesModbusPlugin.wizard.points.errors.valueMapInvert';
		}
	}

	if (kind === 'write' && binding.writeFunction === DevicesModbusPluginWriteFunction.single && span > 1) {
		issues.writeFunction = 'devicesModbusPlugin.wizard.points.errors.singleWrite32';
	}

	return issues;
}
