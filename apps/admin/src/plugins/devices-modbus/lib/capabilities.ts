import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../openapi.constants';

import { type ModbusPoint, type ModbusPointBase, type ModbusPointBinding, NUMERIC_DATA_TYPES, nextPointKey } from './points';

/** bool: an on/off or state point; number: a measured value; button: events synthesised from a boolean level. */
export type ModbusCapabilityKind = 'bool' | 'number' | 'button';

/** A property with a fixed value the channel of a capability needs next to its bound point. */
export interface ModbusCapabilityStatic {
	propertyCategory: string;
	dataType: string;
	permissions: string[];
	value: string | number | boolean;
	format: string[] | null;
}

export interface ModbusCapability {
	key: string;
	channelCategory: string;
	propertyCategory: string;
	kind: ModbusCapabilityKind;
	readable: boolean;
	writable: boolean;
	/** spec data type of the property: bool, float, uchar, enum … */
	dataType: string;
	permissions: string[];
	unit: string | null;
	format: string[] | null;
	/** Static sibling properties the channel needs, e.g. valve.type = generic. */
	statics: ModbusCapabilityStatic[];
}

const bool = (channelCategory: string, propertyCategory: string, writable: boolean, statics: ModbusCapabilityStatic[] = []): ModbusCapability => ({
	key: `${channelCategory}.${propertyCategory}`,
	channelCategory,
	propertyCategory,
	kind: 'bool',
	readable: true,
	writable,
	dataType: 'bool',
	permissions: [writable ? 'rw' : 'ro'],
	unit: null,
	format: null,
	statics,
});

const measured = (channelCategory: string, propertyCategory: string, dataType: string, unit: string | null): ModbusCapability => ({
	key: `${channelCategory}.${propertyCategory}`,
	channelCategory,
	propertyCategory,
	kind: 'number',
	readable: true,
	writable: false,
	dataType,
	permissions: ['ro'],
	unit,
	format: null,
	statics: [],
});

/** Capabilities a custom (template-less) Modbus device can map. Template points may carry others. */
export const CUSTOM_CAPABILITIES: ModbusCapability[] = [
	bool('binary_input', 'state', false),
	bool('switcher', 'on', true),
	bool('outlet', 'on', true),
	bool('valve', 'on', true, [
		{
			propertyCategory: 'type',
			dataType: 'enum',
			permissions: ['ro'],
			value: 'generic',
			format: ['generic', 'irrigation', 'shower_head', 'water_faucet'],
		},
	]),
	{
		key: 'button.event',
		channelCategory: 'button',
		propertyCategory: 'event',
		kind: 'button',
		readable: true,
		writable: false,
		dataType: 'enum',
		permissions: ['ev'],
		unit: null,
		format: ['press', 'long_press', 'down', 'up'],
		statics: [],
	},
	measured('analog_input', 'value', 'float', null),
	measured('temperature', 'temperature', 'float', '°C'),
	measured('humidity', 'humidity', 'uchar', '%'),
	measured('electrical_power', 'power', 'float', 'W'),
	measured('pressure', 'pressure', 'float', 'kPa'),
	measured('illuminance', 'illuminance', 'float', 'lx'),
];

/** `channelCategory.propertyCategory` of a point, the key of its capability. */
export const capabilityKeyOf = (point: Pick<ModbusPoint, 'channelCategory' | 'propertyCategory'>): string =>
	`${point.channelCategory}.${point.propertyCategory}`;

const isBitTable = (registerType: DevicesModbusPluginRegisterType): boolean =>
	registerType === DevicesModbusPluginRegisterType.coil || registerType === DevicesModbusPluginRegisterType.discrete_input;

/**
 * The register tables a capability can use: writable ones need a table that can be written, numbers need a register,
 * read-only bool points and buttons read a coil, a discrete input or a register (bit).
 */
export const registerTypesFor = (capability: ModbusCapability): DevicesModbusPluginRegisterType[] => {
	if (capability.writable) {
		return [DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register];
	}

	if (capability.kind === 'number') {
		return [DevicesModbusPluginRegisterType.input_register, DevicesModbusPluginRegisterType.holding_register];
	}

	return [
		DevicesModbusPluginRegisterType.discrete_input,
		DevicesModbusPluginRegisterType.coil,
		DevicesModbusPluginRegisterType.input_register,
		DevicesModbusPluginRegisterType.holding_register,
	];
};

export const defaultRegisterTypeFor = (capability: ModbusCapability): DevicesModbusPluginRegisterType => registerTypesFor(capability)[0];

/** A binding as a capability starts it: a number reads an int16, a button reads bit 0 of a register. */
const newBinding = (capability: ModbusCapability, registerType: DevicesModbusPluginRegisterType, address = 0): ModbusPointBinding => ({
	registerType,
	address,
	dataType: capability.kind === 'number' ? DevicesModbusPluginDataType.int16 : DevicesModbusPluginDataType.bool,
	bit: capability.kind === 'button' && !isBitTable(registerType) ? 0 : null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
	longPressMs: null,
});

const staticBasesFor = (capability: ModbusCapability): ModbusPointBase[] =>
	capability.statics.map((entry) => ({
		channelCategory: capability.channelCategory,
		propertyCategory: entry.propertyCategory,
		propertyIdentifier: null,
		propertyName: null,
		format: entry.format ? [...entry.format] : null,
		dataType: entry.dataType,
		permissions: [...entry.permissions],
		staticValue: entry.value,
		unit: null,
		read: null,
		write: null,
	}));

/**
 * The points a new channel of a custom capability starts from (address 0, to be shifted by `pointsFromRange`): the
 * bound point first, then its static siblings.
 */
export function pointBaseFor(capability: ModbusCapability, registerType: DevicesModbusPluginRegisterType): ModbusPointBase[] {
	return [
		{
			channelCategory: capability.channelCategory,
			propertyCategory: capability.propertyCategory,
			propertyIdentifier: null,
			propertyName: null,
			format: capability.format ? [...capability.format] : null,
			dataType: capability.dataType,
			permissions: [...capability.permissions],
			staticValue: null,
			unit: capability.unit,
			read: capability.readable ? newBinding(capability, registerType) : null,
			write: capability.writable ? newBinding(capability, registerType) : null,
		},
		...staticBasesFor(capability),
	];
}

/**
 * The kind of a point, from its spec data type: a button event, a bool, or a number for the numeric types. Any other
 * point (an enum or string of a template, say) has no kind, so no kind-specific rule applies to it.
 */
export const capabilityKindOf = (point: ModbusPoint): ModbusCapabilityKind | null => {
	if (capabilityKeyOf(point) === 'button.event') {
		return 'button';
	}

	if (point.dataType === 'bool') {
		return 'bool';
	}

	return NUMERIC_DATA_TYPES.includes(point.dataType) ? 'number' : null;
};

/**
 * Switches a custom point to another capability. Within one kind the read binding is kept and a write binding is
 * added or dropped; a change of kind starts fresh bindings at the same address, on the same table when the
 * capability can use it.
 */
export function applyCapability(point: ModbusPoint, capability: ModbusCapability): ModbusPoint {
	let read: ModbusPointBinding | null;
	let write: ModbusPointBinding | null;

	if (capabilityKindOf(point) === capability.kind) {
		read = capability.readable ? (point.read ?? point.write) : null;
		write = capability.writable ? (point.write ?? (read ? { ...read, valueMap: null, writeFunction: null, longPressMs: null } : null)) : null;
	} else {
		const current = point.read ?? point.write;
		const tables = registerTypesFor(capability);
		const registerType = current !== null && tables.includes(current.registerType) ? current.registerType : tables[0];
		const address = current?.address ?? 0;

		read = capability.readable ? newBinding(capability, registerType, address) : null;
		write = capability.writable ? newBinding(capability, registerType, address) : null;
	}

	return {
		...point,
		channelCategory: capability.channelCategory,
		propertyCategory: capability.propertyCategory,
		dataType: capability.dataType,
		permissions: [...capability.permissions],
		unit: capability.unit,
		format: capability.format ? [...capability.format] : null,
		read,
		write,
	};
}

/**
 * The points after the capability of a point changed from `previous` to `point`. The static siblings the old custom
 * capability brought are dropped unless the new one needs them too; any other static point of the channel (a stored or
 * template property) is kept with its ID and value. The new capability's statics the channel lacks follow the point.
 */
export function withCapabilityStatics(points: ModbusPoint[], previous: ModbusPoint, point: ModbusPoint): ModbusPoint[] {
	const staticsOf = (key: string): ModbusCapabilityStatic[] => CUSTOM_CAPABILITIES.find((candidate) => candidate.key === key)?.statics ?? [];
	const required = new Set(staticsOf(capabilityKeyOf(point)).map((entry) => entry.propertyCategory));
	const dropped = new Set(
		staticsOf(capabilityKeyOf(previous))
			.map((entry) => entry.propertyCategory)
			.filter((category) => !required.has(category))
	);
	const isStaticSibling = (candidate: ModbusPoint): boolean =>
		candidate.key !== point.key && candidate.channelIdentifier === point.channelIdentifier && candidate.read === null && candidate.write === null;
	const kept = points.filter((candidate) => !(isStaticSibling(candidate) && dropped.has(candidate.propertyCategory)));
	const present = new Set(kept.filter(isStaticSibling).map((candidate) => candidate.propertyCategory));
	const capability = CUSTOM_CAPABILITIES.find((candidate) => candidate.key === capabilityKeyOf(point));
	const added: ModbusPoint[] = (capability ? staticBasesFor(capability) : [])
		.filter((base) => !present.has(base.propertyCategory))
		.map((base) => ({
			...base,
			key: nextPointKey(),
			name: point.name,
			channelId: point.channelId,
			propertyId: null,
			channelIdentifier: point.channelIdentifier,
		}));

	return kept.flatMap((candidate) => (candidate.key === point.key ? [candidate, ...added] : [candidate]));
}
