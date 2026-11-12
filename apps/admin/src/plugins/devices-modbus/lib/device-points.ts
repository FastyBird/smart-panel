import { snakeToCamel } from '../../../common';
import type { DevicesModbusPluginBindingRole } from '../../../openapi.constants';

import { CUSTOM_CAPABILITIES } from './capabilities';
import { type ModbusPoint, type ModbusPointBinding, nextPointKey } from './points';

/** A saved register binding of a device property, as `GET …/devices/{id}/bindings` returns it. */
export interface ModbusDeviceBinding {
	id: string;
	propertyId: string;
	role: DevicesModbusPluginBindingRole;
	binding: ModbusPointBinding;
}

export const deviceBindingFromWire = (wire: Record<string, unknown>): ModbusDeviceBinding => {
	const camel = snakeToCamel(wire) as Partial<ModbusPointBinding> &
		Pick<ModbusPointBinding, 'registerType' | 'address' | 'dataType'> &
		Pick<ModbusDeviceBinding, 'id' | 'role'> & { propertyId: string };

	return {
		id: camel.id,
		propertyId: camel.propertyId,
		role: camel.role,
		binding: {
			registerType: camel.registerType,
			address: camel.address,
			dataType: camel.dataType,
			bit: camel.bit ?? null,
			byteOrder: camel.byteOrder ?? null,
			wordOrder: camel.wordOrder ?? null,
			scale: camel.scale ?? 1,
			offset: camel.offset ?? 0,
			invert: camel.invert ?? false,
			// An empty map is no map, as in the editor and the request.
			valueMap: camel.valueMap?.length ? camel.valueMap.map((entry) => ({ raw: entry.raw, value: entry.value })) : null,
			writeFunction: camel.writeFunction ?? null,
			pollIntervalMs: camel.pollIntervalMs ?? null,
			longPressMs: camel.longPressMs ?? null,
		},
	};
};

/** The fields of a stored property the points of a device are built from. */
export interface ModbusDevicePropertyInput {
	id: string;
	identifier: string | null;
	name: string | null;
	category: string;
	dataType: string;
	permissions: string[];
	unit: string | null;
	format: (string | number | null)[] | null;
	/** The stored value; for a property without bindings it is its static value. */
	value: string | number | boolean | null;
}

/** The fields of a stored channel the points of a device are built from. */
export interface ModbusDeviceChannelInput {
	id: string;
	identifier: string | null;
	name: string;
	category: string;
	properties: ModbusDevicePropertyInput[];
}

/** The channel the core keeps on every device; the points update must not send it. */
export const DEVICE_INFORMATION_CHANNEL = 'device_information';

/** The value a capability gives a static sibling, e.g. `generic` for the type of a valve. */
const staticDefault = (channelCategory: string, propertyCategory: string): string | number | boolean | null =>
	CUSTOM_CAPABILITIES.find((capability) => capability.channelCategory === channelCategory)?.statics.find(
		(entry) => entry.propertyCategory === propertyCategory
	)?.value ?? null;

/**
 * The points of an existing device: one per bound or static property, grouped by channel, each with the IDs of its
 * channel and property so the points update keeps them. The device information channel is left out. A static
 * property without a stored value gets the value its capability gives it, or none.
 */
export function pointsFromDevice(channels: ModbusDeviceChannelInput[], bindings: ModbusDeviceBinding[]): ModbusPoint[] {
	const bindingOf = (propertyId: string, role: 'read' | 'write'): ModbusPointBinding | null => {
		const found = bindings.find((item) => item.propertyId === propertyId && item.role === role);

		return found ? { ...found.binding, valueMap: found.binding.valueMap?.map((entry) => ({ ...entry })) ?? null } : null;
	};

	return channels
		.filter((channel) => channel.category !== DEVICE_INFORMATION_CHANNEL)
		.flatMap((channel) =>
			channel.properties.map((property): ModbusPoint => {
				const read = bindingOf(property.id, 'read');
				const write = bindingOf(property.id, 'write');
				const staticValue = read === null && write === null ? (property.value ?? staticDefault(channel.category, property.category)) : null;

				return {
					key: nextPointKey(),
					name: channel.name,
					channelId: channel.id,
					propertyId: property.id,
					channelCategory: channel.category,
					// Points are grouped by identifier; a channel without one is grouped by its id.
					channelIdentifier: channel.identifier ?? channel.id,
					propertyCategory: property.category,
					propertyIdentifier: property.identifier,
					propertyName: property.name,
					// An open numeric bound is stored as null; it goes back exactly as stored.
					format: property.format ? ([...property.format] as (string | number)[]) : null,
					dataType: property.dataType,
					permissions: [...property.permissions],
					staticValue,
					unit: property.unit,
					read,
					write,
				};
			})
		);
}
