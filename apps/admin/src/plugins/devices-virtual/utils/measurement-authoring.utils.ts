import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import type { components } from '../../../openapi';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
	type DevicesVirtualPluginCreateDeviceSchema,
	DevicesVirtualPluginDeviceMode,
	DevicesVirtualPluginValueOrigin,
} from '../../../openapi.constants';

export type NumericOperator = components['schemas']['DevicesVirtualPluginDataNumericOperator'];
export type TransformPolicy = components['schemas']['DevicesVirtualPluginNumericTransformPolicy'];
export type TransformConfiguration = components['schemas']['DevicesVirtualPluginConfigureTransform'];
export type AggregateConfiguration = components['schemas']['DevicesVirtualPluginConfigureAggregate'];
export type TransformState = components['schemas']['DevicesVirtualPluginDataTransformConfiguration'];
export type AggregateProfile = components['schemas']['DevicesVirtualPluginDataAggregateProfile'];
export type AggregateSource = components['schemas']['DevicesVirtualPluginDataAggregateSource'];
export type AggregateState = components['schemas']['DevicesVirtualPluginDataAggregateConfiguration'];
export type MeasurementMode = DevicesVirtualPluginDeviceMode.sensor_aggregate | DevicesVirtualPluginDeviceMode.sensor_transform;
export type MeasurementSourceDevice = Pick<IDevice, 'id' | 'type' | 'name'> & { mode?: string };
export type MeasurementSourceChannel = Pick<IChannel, 'id' | 'device' | 'category' | 'name'>;
export type MeasurementSourceProperty = Pick<IChannelProperty, 'id' | 'channel' | 'category' | 'dataType' | 'permissions' | 'unit' | 'name'> & {
	valueOrigin?: string;
	sourceProperty?: string | null;
	measurementQuantity?: string;
};
export interface MeasurementCandidate {
	id: string;
	label: string;
	quantity: string;
	unit: string;
}

/** Backend validation remains authoritative; this filters only structurally supported source choices. */
export function measurementCandidates(
	mode: MeasurementMode,
	devices: MeasurementSourceDevice[],
	channels: MeasurementSourceChannel[],
	properties: MeasurementSourceProperty[]
): MeasurementCandidate[] {
	return properties.flatMap((property) => {
		const channel = channels.find((entry) => entry.id === property.channel);
		const device = devices.find((entry) => entry.id === channel?.device);
		if (
			!device ||
			!channel ||
			!property.permissions.some((permission) =>
				[DevicesModuleChannelPropertyPermissions.ro, DevicesModuleChannelPropertyPermissions.rw].includes(permission)
			)
		)
			return [];
		if (mode === DevicesVirtualPluginDeviceMode.sensor_transform) {
			if (device.type === 'virtual' || !property.unit || !['float', 'char', 'uchar', 'short', 'ushort', 'int', 'uint'].includes(property.dataType))
				return [];
		} else {
			const virtual = device;
			const derived = property;
			if (
				channel.category !== DevicesModuleChannelCategory.temperature ||
				property.category !== DevicesModuleChannelPropertyCategory.temperature ||
				property.unit !== '°C' ||
				property.dataType !== DevicesModuleChannelPropertyDataType.float
			)
				return [];
			if (
				device.type === 'virtual' &&
				(virtual.mode !== DevicesVirtualPluginDeviceMode.sensor_transform ||
					derived.valueOrigin !== DevicesVirtualPluginValueOrigin.derived ||
					derived.sourceProperty ||
					property.permissions.some((permission) => permission !== DevicesModuleChannelPropertyPermissions.ro))
			)
				return [];
		}
		return [
			{
				id: property.id,
				label: `${device.name} / ${channel.name} / ${property.name ?? property.category}`,
				quantity: property.category,
				unit: property.unit ?? '',
			},
		];
	});
}

/** Builds the virtual sensor catalog payload with the stable output UUID and selected measurement metadata. */
export function measurementDraft(
	mode: MeasurementMode,
	name: string,
	temperature: boolean,
	outputId: string,
	deviceId: string,
	channelId: string,
	range?: { minimum: number; maximum: number }
): DevicesVirtualPluginCreateDeviceSchema {
	return {
		id: deviceId,
		type: 'virtual',
		mode,
		name,
		category: DevicesModuleDeviceCategory.sensor,
		channels: [
			{
				id: channelId,
				type: 'virtual',
				name,
				category: temperature ? DevicesModuleChannelCategory.temperature : DevicesModuleChannelCategory.analog_input,
				properties: [
					{
						id: outputId,
						type: 'virtual',
						category: temperature ? DevicesModuleChannelPropertyCategory.temperature : DevicesModuleChannelPropertyCategory.value,
						data_type: DevicesModuleChannelPropertyDataType.float,
						permissions: [DevicesModuleChannelPropertyPermissions.ro],
						value_origin: DevicesVirtualPluginValueOrigin.derived,
						...(range ? { format: [range.minimum, range.maximum] } : {}),
					},
				],
			},
		],
	};
}

/** Materialize the backend capability contract without inferring units or numeric types. */
export function aggregateDraft(
	profile: AggregateProfile,
	name: string,
	outputId: string,
	deviceId: string,
	channelId: string
): DevicesVirtualPluginCreateDeviceSchema {
	const draft = measurementDraft(DevicesVirtualPluginDeviceMode.sensor_aggregate, name, true, outputId, deviceId, channelId);
	const channel = draft.channels![0];
	channel.category = profile.channel as DevicesModuleChannelCategory;
	const property = channel.properties![0];
	property.category = profile.quantity as DevicesModuleChannelPropertyCategory;
	property.data_type = profile.data_types[0];
	if (profile.numeric_policy && profile.output_step !== null) property.step = profile.output_step;
	return draft;
}

/** Candidate admission belongs to the backend; the local catalog supplies labels only. */
export function aggregateCandidates(
	sources: AggregateSource[],
	devices: MeasurementSourceDevice[],
	channels: MeasurementSourceChannel[],
	properties: MeasurementSourceProperty[],
	profile: AggregateProfile
): MeasurementCandidate[] {
	return sources.map((source) => {
		const device = devices.find((entry) => entry.id === source.device);
		const channel = channels.find((entry) => entry.id === source.channel);
		const property = properties.find((entry) => entry.id === source.property);
		return {
			id: source.property,
			label: [device?.name, channel?.name, property?.name ?? source.property].filter(Boolean).join(' / '),
			quantity: profile.quantity,
			unit: profile.unit ?? '',
		};
	});
}
