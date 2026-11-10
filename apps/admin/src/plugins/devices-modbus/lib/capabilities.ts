import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../openapi.constants';

import type { ModbusPoint, ModbusPointBinding } from './points';

export interface ModbusCapability {
	key: string;
	channelCategory: string;
	propertyCategory: string;
	readable: boolean;
	writable: boolean;
	dataType: 'bool';
}

/** Capabilities a custom (template-less) Modbus device can map. Template points may carry others. */
export const CUSTOM_CAPABILITIES: ModbusCapability[] = [
	{ key: 'binary_input.state', channelCategory: 'binary_input', propertyCategory: 'state', readable: true, writable: false, dataType: 'bool' },
	{ key: 'switcher.on', channelCategory: 'switcher', propertyCategory: 'on', readable: true, writable: true, dataType: 'bool' },
	{ key: 'outlet.on', channelCategory: 'outlet', propertyCategory: 'on', readable: true, writable: true, dataType: 'bool' },
];

/** `channelCategory.propertyCategory` of a point, the key of its capability. */
export const capabilityKeyOf = (point: Pick<ModbusPoint, 'channelCategory' | 'propertyCategory'>): string =>
	`${point.channelCategory}.${point.propertyCategory}`;

const ACCESS_TABLES = {
	readOnly: DevicesModbusPluginRegisterType.discrete_input,
	readWrite: DevicesModbusPluginRegisterType.coil,
} as const;

/** The register tables a capability can use: writable ones need a table that can be written. */
export const registerTypesFor = (capability: ModbusCapability): DevicesModbusPluginRegisterType[] =>
	capability.writable
		? [DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register]
		: [
				DevicesModbusPluginRegisterType.discrete_input,
				DevicesModbusPluginRegisterType.coil,
				DevicesModbusPluginRegisterType.input_register,
				DevicesModbusPluginRegisterType.holding_register,
			];

export const defaultRegisterTypeFor = (capability: ModbusCapability): DevicesModbusPluginRegisterType =>
	capability.writable ? ACCESS_TABLES.readWrite : ACCESS_TABLES.readOnly;

const newBinding = (registerType: DevicesModbusPluginRegisterType): ModbusPointBinding => ({
	registerType,
	address: 0,
	dataType: DevicesModbusPluginDataType.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
});

/** The point a new row of a custom capability starts from (address 0, to be shifted by `pointsFromRange`). */
export function pointBaseFor(
	capability: ModbusCapability,
	registerType: DevicesModbusPluginRegisterType
): Omit<ModbusPoint, 'key' | 'name' | 'channelIdentifier'> {
	return {
		channelCategory: capability.channelCategory,
		propertyCategory: capability.propertyCategory,
		propertyIdentifier: null,
		propertyName: null,
		format: null,
		dataType: capability.dataType,
		permissions: [capability.writable ? 'rw' : 'ro'],
		staticValue: null,
		unit: null,
		read: capability.readable ? newBinding(registerType) : null,
		write: capability.writable ? newBinding(registerType) : null,
	};
}

/** Switches a custom point to another capability: its access changes, the read binding is kept, a write binding is added or dropped. */
export function applyCapability(point: ModbusPoint, capability: ModbusCapability): ModbusPoint {
	const read = capability.readable ? (point.read ?? point.write) : null;
	const write = capability.writable ? (point.write ?? (read ? { ...read, valueMap: null, writeFunction: null } : null)) : null;

	return {
		...point,
		channelCategory: capability.channelCategory,
		propertyCategory: capability.propertyCategory,
		dataType: capability.dataType,
		permissions: [capability.writable ? 'rw' : 'ro'],
		read,
		write,
	};
}
