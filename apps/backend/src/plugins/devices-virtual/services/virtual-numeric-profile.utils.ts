import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';

/** Initial numeric profile. Additional quantities require separately reviewed domain/precision policies. */
export const temperatureAggregateProfile = {
	channel: ChannelCategory.TEMPERATURE,
	quantity: PropertyCategory.TEMPERATURE,
	unit: '°C',
	dataTypes: [DataTypeType.FLOAT] as readonly DataTypeType[],
};

export function matchesAggregateNumericProfile(property: ChannelPropertyEntity, channel: ChannelEntity): boolean {
	const profile = temperatureAggregateProfile;
	return (
		channel?.category === profile.channel &&
		property.category === profile.quantity &&
		profile.dataTypes.includes(property.dataType) &&
		resolvePropertyUnit({ ...property, channel } as ChannelPropertyEntity) === profile.unit &&
		(property.unit == null || property.unit === profile.unit)
	);
}

export function isDerivedNumericMeasurement(
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
	mode: VirtualDeviceMode,
): boolean {
	const derived = property as ChannelPropertyEntity & { valueOrigin?: VirtualValueOrigin; sourcePropertyId?: string };
	return (
		device?.category === DeviceCategory.SENSOR &&
		device?.type === 'virtual' &&
		(device as DeviceEntity & { mode?: VirtualDeviceMode }).mode === mode &&
		matchesAggregateNumericProfile(property, channel) &&
		derived.valueOrigin === VirtualValueOrigin.DERIVED &&
		!derived.sourcePropertyId &&
		property.permissions?.includes(PermissionType.READ_ONLY) &&
		!property.permissions.some(
			(permission) => permission === PermissionType.READ_WRITE || permission === PermissionType.WRITE_ONLY,
		)
	);
}

/** Physical canonical sources or the existing restricted transform composition; aggregate nesting is excluded. */
export function isEligibleAggregateSource(
	source: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean {
	return (
		matchesAggregateNumericProfile(source, channel) &&
		source.permissions?.some((permission) =>
			[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
		) &&
		(device?.type !== 'virtual' ||
			isDerivedNumericMeasurement(source, channel, device, VirtualDeviceMode.SENSOR_TRANSFORM))
	);
}
