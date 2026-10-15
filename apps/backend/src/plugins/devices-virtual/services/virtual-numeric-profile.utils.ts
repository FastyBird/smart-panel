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
import { VirtualAggregateOperator, VirtualAggregateProfile } from '../entities/virtual-producer.entity';

/** Legacy Celsius composition remains deliberately restricted to temperature. */
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
		((property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity == null ||
			(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity ===
				String(profile.quantity)) &&
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
		!!device &&
		!!aggregateProfile(source, channel) &&
		source.permissions?.some((permission) =>
			[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
		) &&
		(device?.type !== 'virtual' ||
			isDerivedNumericMeasurement(source, channel, device, VirtualDeviceMode.SENSOR_TRANSFORM))
	);
}

export interface AggregateProfilePolicy {
	id: VirtualAggregateProfile;
	channel: ChannelCategory;
	quantity: PropertyCategory;
	unit: string | null;
	dataTypes: readonly DataTypeType[];
	binary: boolean;
	/** Null preserves the legacy temperature output's declared grid (or full floating precision). */
	outputStep: number | null;
	minimum?: number;
	maximum?: number;
}

export const aggregateProfiles: readonly AggregateProfilePolicy[] = [
	{ id: VirtualAggregateProfile.TEMPERATURE, ...temperatureAggregateProfile, binary: false, outputStep: null },
	{
		id: VirtualAggregateProfile.HUMIDITY,
		channel: ChannelCategory.HUMIDITY,
		quantity: PropertyCategory.HUMIDITY,
		unit: '%',
		dataTypes: [DataTypeType.UCHAR],
		binary: false,
		outputStep: 1,
		minimum: 0,
		maximum: 100,
	},
	{
		id: VirtualAggregateProfile.CARBON_DIOXIDE,
		channel: ChannelCategory.CARBON_DIOXIDE,
		quantity: PropertyCategory.CONCENTRATION,
		unit: 'ppm',
		dataTypes: [DataTypeType.FLOAT],
		binary: false,
		outputStep: 1,
		minimum: 0,
		maximum: 100000,
	},
	{
		id: VirtualAggregateProfile.ILLUMINANCE,
		channel: ChannelCategory.ILLUMINANCE,
		quantity: PropertyCategory.ILLUMINANCE,
		unit: 'lx',
		dataTypes: [DataTypeType.FLOAT],
		binary: false,
		outputStep: 0.1,
		minimum: 0,
		maximum: 100000,
	},
	...(
		[
			[VirtualAggregateProfile.CONTACT, ChannelCategory.CONTACT],
			[VirtualAggregateProfile.MOTION, ChannelCategory.MOTION],
			[VirtualAggregateProfile.OCCUPANCY, ChannelCategory.OCCUPANCY],
		] as const
	).map(([id, channel]) => ({
		id,
		channel,
		quantity: PropertyCategory.DETECTED,
		unit: null,
		dataTypes: [DataTypeType.BOOL],
		binary: true,
		outputStep: null,
	})),
];

/** Exact channel/category/type/unit policy, shared by authoring, persistence, pickers and runtime. */
export function aggregateProfile(
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
): AggregateProfilePolicy | undefined {
	return aggregateProfiles.find(
		(profile) =>
			channel?.category === profile.channel &&
			property.category === profile.quantity &&
			((property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity == null ||
				(property as ChannelPropertyEntity & { measurementQuantity?: string }).measurementQuantity ===
					String(profile.quantity)) &&
			profile.dataTypes.includes(property.dataType) &&
			(resolvePropertyUnit({ ...property, channel } as ChannelPropertyEntity) ?? null) === profile.unit &&
			(property.unit == null || property.unit === profile.unit),
	);
}

export function isEligibleAggregateOutput(
	property: ChannelPropertyEntity,
	channel: ChannelEntity,
	device: DeviceEntity,
): boolean {
	const profile = aggregateProfile(property, channel);
	const derived = property as ChannelPropertyEntity & { valueOrigin?: VirtualValueOrigin; sourcePropertyId?: string };
	return (
		!!profile &&
		device?.category === DeviceCategory.SENSOR &&
		device?.type === 'virtual' &&
		(device as DeviceEntity & { mode?: VirtualDeviceMode }).mode === VirtualDeviceMode.SENSOR_AGGREGATE &&
		derived.valueOrigin === VirtualValueOrigin.DERIVED &&
		!derived.sourcePropertyId &&
		property.permissions?.length === 1 &&
		property.permissions[0] === PermissionType.READ_ONLY &&
		(profile.binary
			? property.step == null
			: profile.outputStep == null || property.step == null || property.step === profile.outputStep)
	);
}

export function aggregateOperatorAllowed(profile: AggregateProfilePolicy, operator: VirtualAggregateOperator): boolean {
	const binary = operator === VirtualAggregateOperator.ANY || operator === VirtualAggregateOperator.ALL;
	return Object.values(VirtualAggregateOperator).includes(operator) && profile.binary === binary;
}

export function aggregateValueAllowed(profile: AggregateProfilePolicy, value: unknown): boolean {
	return profile.binary
		? typeof value === 'boolean'
		: typeof value === 'number' &&
				Number.isFinite(value) &&
				(profile.minimum == null || value >= profile.minimum) &&
				(profile.maximum == null || value <= profile.maximum);
}
