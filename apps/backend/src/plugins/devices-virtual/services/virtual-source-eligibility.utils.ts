import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';

/** Deliberately narrow: materialized aggregate measurements, never virtual forwarding or controls. */
export const isEligibleVirtualMeasurement = (
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean =>
	device.type === 'virtual' &&
	(device as DeviceEntity & { mode?: VirtualDeviceMode }).mode === VirtualDeviceMode.SENSOR_AGGREGATE &&
	device.category === DeviceCategory.SENSOR &&
	channel.category === ChannelCategory.TEMPERATURE &&
	property.category === PropertyCategory.TEMPERATURE &&
	(property as ChannelPropertyEntity & { valueOrigin?: VirtualValueOrigin }).valueOrigin ===
		VirtualValueOrigin.DERIVED &&
	!(property as ChannelPropertyEntity & { sourcePropertyId?: string }).sourcePropertyId &&
	property.permissions?.includes(PermissionType.READ_ONLY) &&
	!property.permissions.some(
		(permission) => permission === PermissionType.READ_WRITE || permission === PermissionType.WRITE_ONLY,
	) &&
	property.dataType === DataTypeType.FLOAT;

/** Reserved transform admission contract. Runtime qualification still requires its live producer overlay. */
export const isEligibleVirtualTransformedTemperature = (
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean =>
	device.type === 'virtual' &&
	(device as DeviceEntity & { mode?: VirtualDeviceMode }).mode === VirtualDeviceMode.SENSOR_TRANSFORM &&
	device.category === DeviceCategory.SENSOR &&
	channel.category === ChannelCategory.TEMPERATURE &&
	property.category === PropertyCategory.TEMPERATURE &&
	(property as ChannelPropertyEntity & { valueOrigin?: VirtualValueOrigin }).valueOrigin ===
		VirtualValueOrigin.DERIVED &&
	!(property as ChannelPropertyEntity & { sourcePropertyId?: string }).sourcePropertyId &&
	property.permissions?.includes(PermissionType.READ_ONLY) &&
	!property.permissions.some(
		(permission) => permission === PermissionType.READ_WRITE || permission === PermissionType.WRITE_ONLY,
	) &&
	property.dataType === DataTypeType.FLOAT;
