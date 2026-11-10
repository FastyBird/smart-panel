import type {
	ApiCreateModbusDeviceStructure,
	DevicesModbusPluginByteOrder,
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
}

export interface ModbusPoint {
	/** Local identity of the row, not part of the point's content */
	key: string;
	name: string;
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

type PointBase = Omit<ModbusPoint, 'key' | 'name' | 'channelIdentifier'>;

let keySequence = 0;

const nextKey = (): string => `point-${++keySequence}`;

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

export function pointsFromRange(base: PointBase, parsed: ParsedAddress, namePrefix: string, existingIdentifiers: string[] = []): ModbusPoint[] {
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

		points.push({
			...base,
			permissions: [...base.permissions],
			read: shift(base.read),
			write: shift(base.write),
			key: nextKey(),
			propertyIdentifier: base.propertyIdentifier ?? null,
			propertyName: base.propertyName ?? null,
			format: base.format ? [...base.format] : null,
			name: `${namePrefix} ${i + 1}`,
			channelIdentifier: uniqueIdentifier(slug(`${namePrefix} ${i + 1}`), taken),
		});
	}

	return points;
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
				valueMap: binding.valueMap ? binding.valueMap.map((entry) => ({ raw: entry.raw, value: entry.value })) : null,
				writeFunction: binding.writeFunction ?? null,
				pollIntervalMs: binding.pollIntervalMs ?? null,
			};

export function pointsFromPreview(preview: IModbusTemplatePreview): ModbusPoint[] {
	return preview.channels.flatMap((channel) =>
		channel.properties.map((property) => ({
			key: nextKey(),
			name: channel.name,
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

export function suggestCategory(points: ModbusPoint[]): 'switcher' | 'input_controller' {
	return points.some((point) => point.write !== null) ? 'switcher' : 'input_controller';
}

type Body = ApiCreateModbusDeviceStructure['data'];
type Channel = Body['channels'][number];
type Property = Channel['properties'][number];
type RequestBinding = NonNullable<Property['read']>;

const toRequestBinding = (binding: ModbusPointBinding): RequestBinding => ({
	register_type: binding.registerType,
	address: binding.address,
	data_type: binding.dataType,
	...(binding.bit !== null ? { bit: binding.bit } : {}),
	...(binding.byteOrder !== null ? { byte_order: binding.byteOrder } : {}),
	...(binding.wordOrder !== null ? { word_order: binding.wordOrder } : {}),
	...(binding.valueMap !== null
		? { value_map: binding.valueMap.map((entry) => ({ raw: entry.raw, value: entry.value })) }
		: {
				...(binding.scale !== 1 ? { scale: binding.scale } : {}),
				...(binding.offset !== 0 ? { offset: binding.offset } : {}),
			}),
	...(binding.invert ? { invert: true } : {}),
	...(binding.writeFunction !== null ? { write_function: binding.writeFunction } : {}),
	...(binding.pollIntervalMs !== null ? { poll_interval_ms: binding.pollIntervalMs } : {}),
});

const toRequestProperty = (point: ModbusPoint): Property => ({
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

export function toCreateRequest(input: ModbusCreateInput): ApiCreateModbusDeviceStructure {
	const channels = new Map<string, Channel>();

	for (const point of input.points) {
		const existing = channels.get(point.channelIdentifier);

		if (existing) {
			if (existing.name !== point.name || existing.category !== point.channelCategory) {
				throw new Error(`Points of channel "${point.channelIdentifier}" disagree on the channel name or category`);
			}

			existing.properties.push(toRequestProperty(point));
		} else {
			channels.set(point.channelIdentifier, {
				identifier: point.channelIdentifier,
				name: point.name,
				category: point.channelCategory as Channel['category'],
				properties: [toRequestProperty(point)],
			});
		}
	}

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
			...(input.maxReadRegisters != null ? { max_read_registers: input.maxReadRegisters } : {}),
			...(input.maxReadBits != null ? { max_read_bits: input.maxReadBits } : {}),
			...(input.maxReadGap != null ? { max_read_gap: input.maxReadGap } : {}),
			...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
			...(input.model !== undefined ? { model: input.model } : {}),
			...(fromTemplate && input.template ? { template_id: input.template.id, template_revision: input.template.revision } : {}),
			channels: [...channels.values()],
		},
	};
}
