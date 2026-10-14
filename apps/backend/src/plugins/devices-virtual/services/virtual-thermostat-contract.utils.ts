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
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';

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
/** Canonical hardware identity, independent of device/property UUIDs and transport aliases. */
export function thermostatActuatorIdentity(
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): string | null {
	const component = /^switch:(\d+)$/.exec(channel.identifier ?? '');
	const mac = device instanceof ShellyNgDeviceEntity ? device.canonicalMac : null;
	const permissions = new Set(property.permissions ?? []);
	if (
		!component ||
		!mac ||
		!/^[\da-f]{12}$/i.test(mac) ||
		!['output', 'on'].includes(property.identifier) ||
		property.category !== PropertyCategory.ON ||
		property.dataType !== DataTypeType.BOOL ||
		!permissionSatisfied(PermissionType.READ_ONLY, permissions) ||
		!permissionSatisfied(PermissionType.WRITE_ONLY, permissions)
	)
		return null;
	return `shelly-ng:${mac.toUpperCase()}:switch:${Number(component[1])}:output`;
}
export const isThermostatTemperature = (property: ChannelPropertyEntity, channel: ChannelEntity): boolean =>
	channel.category === ChannelCategory.TEMPERATURE &&
	property.category === PropertyCategory.TEMPERATURE &&
	[DataTypeType.FLOAT, DataTypeType.INT, DataTypeType.SHORT, DataTypeType.UCHAR].includes(property.dataType) &&
	permissionSatisfied(PermissionType.READ_ONLY, new Set(property.permissions ?? [])) &&
	!property.permissions.some((permission) =>
		[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
	) &&
	['°C', 'C', 'Celsius', 'celsius'].includes(resolvePropertyUnit(property));
