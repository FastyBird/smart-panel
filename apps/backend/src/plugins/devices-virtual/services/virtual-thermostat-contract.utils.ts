import { createHash } from 'crypto';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { permissionSatisfied } from '../../../modules/devices/utils/property-permissions.utils';

export const thermostatFingerprint = (value: unknown): string =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const thermostatPropertyContract = (
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): string =>
	thermostatFingerprint({
		propertyId: property.id,
		identifier: property.identifier,
		category: property.category,
		dataType: property.dataType,
		permissions: [...(property.permissions ?? [])].sort(),
		unit: resolvePropertyUnit(property),
		format: property.format ?? null,
		channelId: channel.id,
		channelIdentifier: channel.identifier,
		channelCategory: channel.category,
		deviceId: device.id,
		deviceType: device.type,
	});
/** Reserve the provider's hardware identity when available, otherwise the exact catalog endpoint. */
export function thermostatActuatorIdentity(
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): string | null {
	if (
		device.type === 'virtual' ||
		property.category !== PropertyCategory.ON ||
		property.dataType !== DataTypeType.BOOL ||
		!permissionSatisfied(PermissionType.WRITE_ONLY, new Set(property.permissions ?? []))
	)
		return null;
	const hardware = device.getPhysicalSwitchIdentity?.(channel, property);
	if (hardware) return hardware;
	return device.id && channel.id && property.id ? `property:${device.id}:${channel.id}:${property.id}` : null;
}
export const isThermostatTemperature = (property: ChannelPropertyEntity, channel: ChannelEntity): boolean =>
	channel.category === ChannelCategory.TEMPERATURE &&
	((property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity == null ||
		(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity === 'temperature') &&
	property.category === PropertyCategory.TEMPERATURE &&
	[
		DataTypeType.FLOAT,
		DataTypeType.INT,
		DataTypeType.UINT,
		DataTypeType.SHORT,
		DataTypeType.USHORT,
		DataTypeType.CHAR,
		DataTypeType.UCHAR,
	].includes(property.dataType) &&
	permissionSatisfied(PermissionType.READ_ONLY, new Set(property.permissions ?? [])) &&
	!property.permissions.some((permission) =>
		[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
	) &&
	['°C', 'C', 'Celsius', 'celsius'].includes(resolvePropertyUnit(property));
