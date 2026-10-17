import { createHash } from 'node:crypto';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualChannelPropertyEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';

import { DewPointRole } from './virtual-dew-point.utils';

export function dewPointSourceContract(property: ChannelPropertyEntity, role: DewPointRole): boolean {
	const channel = property?.channel as ChannelEntity;
	const device = channel?.device as DeviceEntity;
	const temperature = role === 'dry_bulb';
	return (
		!!device &&
		channel.category === (temperature ? ChannelCategory.TEMPERATURE : ChannelCategory.HUMIDITY) &&
		property.category === (temperature ? PropertyCategory.TEMPERATURE : PropertyCategory.HUMIDITY) &&
		(!(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity ||
			(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity ===
				String(property.category)) &&
		resolvePropertyUnit(property) === (temperature ? '°C' : '%') &&
		[
			DataTypeType.FLOAT,
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
		].includes(property.dataType) &&
		property.permissions?.some((permission) =>
			[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
		)
	);
}

export function dewPointOutputContract(property: ChannelPropertyEntity): boolean {
	const channel = property?.channel as ChannelEntity;
	const device = channel?.device as DeviceEntity & { mode?: VirtualDeviceMode };
	return (
		property instanceof VirtualChannelPropertyEntity &&
		property.isDerived &&
		!property.sourcePropertyId &&
		device?.type === 'virtual' &&
		device.mode === VirtualDeviceMode.SENSOR_TRANSFORM &&
		channel.category === ChannelCategory.ANALOG_INPUT &&
		property.category === PropertyCategory.VALUE &&
		property.dataType === DataTypeType.FLOAT &&
		property.permissions?.includes(PermissionType.READ_ONLY) &&
		!property.permissions.some((permission) =>
			[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
		)
	);
}

export function dewPointSourceFingerprint(property: ChannelPropertyEntity): string {
	const channel = property.channel as ChannelEntity;
	const device = channel.device as DeviceEntity;
	return createHash('sha256')
		.update(
			JSON.stringify([
				property.id,
				channel.id,
				device.id,
				device.type,
				channel.category,
				channel.identifier,
				property.category,
				property.identifier,
				property.dataType,
				resolvePropertyUnit(property),
				(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity ??
					String(property.category),
				[...property.permissions].sort(),
				property.format,
				property.invalid,
			]),
		)
		.digest('hex');
}
