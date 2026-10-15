import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualDeviceMode } from '../entities/devices-virtual.entity';

import { isDerivedNumericMeasurement } from './virtual-numeric-profile.utils';

/** Deliberately narrow: materialized temperature measurements, never virtual forwarding or controls. */
export const isEligibleVirtualMeasurement = (
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean => isDerivedNumericMeasurement(property, channel, device, VirtualDeviceMode.SENSOR_AGGREGATE);

/** Runtime qualification still requires its live producer overlay. */
export const isEligibleVirtualTransformedTemperature = (
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean => isDerivedNumericMeasurement(property, channel, device, VirtualDeviceMode.SENSOR_TRANSFORM);
