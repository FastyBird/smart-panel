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
import type { MeasurementAlias } from '../composables/use-virtual-device-extensions';

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
export type MeasurementSourceChannel = Pick<IChannel, 'id' | 'device' | 'category' | 'name'> & { identifier?: string | null };
export type MeasurementSourceProperty = Pick<IChannelProperty, 'id' | 'channel' | 'category' | 'dataType' | 'permissions' | 'unit' | 'name'> & {
	valueOrigin?: string;
	sourceProperty?: string | null;
	measurementQuantity?: string;
	identifier?: string | null;
};
export interface MeasurementCandidate {
	id: string;
	label: string;
	quantity: string;
	unit: string;
	thermistorVoltage?: boolean;
}

/** Backend validation remains authoritative; this filters only structurally supported source choices. */
export function measurementCandidates(
	mode: MeasurementMode,
	devices: MeasurementSourceDevice[],
	channels: MeasurementSourceChannel[],
	properties: MeasurementSourceProperty[]
): MeasurementCandidate[] {
	const channelById = new Map(channels.map((channel) => [channel.id, channel]));
	const deviceById = new Map(devices.map((device) => [device.id, device]));
	return properties.flatMap((property) => {
		const channel = channelById.get(property.channel);
		const device = channel && deviceById.get(channel.device);
		if (
			!device ||
			!channel ||
			!property.permissions.some((permission) =>
				[DevicesModuleChannelPropertyPermissions.ro, DevicesModuleChannelPropertyPermissions.rw].includes(permission)
			)
		)
			return [];
		const { unit } = property;
		const voltageMeasurement =
			unit === 'V' &&
			(property.category === DevicesModuleChannelPropertyCategory.voltage ||
				(channel.category === DevicesModuleChannelCategory.analog_input &&
					property.category === DevicesModuleChannelPropertyCategory.value &&
					!property.permissions.some((permission) =>
						[DevicesModuleChannelPropertyPermissions.rw, DevicesModuleChannelPropertyPermissions.wo].includes(permission)
					)));
		if (mode === DevicesVirtualPluginDeviceMode.sensor_transform) {
			if (device.type === 'virtual' || !unit || !['float', 'char', 'uchar', 'short', 'ushort', 'int', 'uint'].includes(property.dataType)) return [];
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
				unit: unit ?? '',
				...(voltageMeasurement ? { thermistorVoltage: true } : {}),
			},
		];
	});
}

/** Sample range rejection does not invalidate a policy accepted by the backend. */
export function isBlockingTransformPreviewError(error: string | null | undefined): boolean {
	return !!error && error !== 'input_out_of_range' && error !== 'output_out_of_range';
}

/** Prefer a unique canonical source when its integration identifies two catalogue entries for one reading. */
export function preferCanonicalMeasurementSources<T extends { id: string }>(
	sources: T[],
	devices: MeasurementSourceDevice[],
	channels: MeasurementSourceChannel[],
	properties: MeasurementSourceProperty[],
	identify: MeasurementAlias
): T[] {
	const deviceById = new Map(devices.map((device) => [device.id, device]));
	const channelById = new Map(channels.map((channel) => [channel.id, channel]));
	const propertyById = new Map(properties.map((property) => [property.id, property]));
	const identities = sources.map((source) => {
		const property = propertyById.get(source.id);
		const channel = property && channelById.get(property.channel);
		const device = channel && deviceById.get(channel.device);
		return device && channel && property ? identify(device, channel, property) : null;
	});
	const canonicalCounts = new Map<string, number>();
	for (const identity of identities) {
		if (identity?.canonical) canonicalCounts.set(identity.key, (canonicalCounts.get(identity.key) ?? 0) + 1);
	}
	return sources.filter((_, index) => {
		const identity = identities[index];
		return !identity || identity.canonical || canonicalCounts.get(identity.key) !== 1;
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

/** Room and zones are sent only when chosen, so an unplaced draft keeps the payload it always had. */
export function withPlacement<T extends object>(device: T, placement: { roomId: string | null; zoneIds: string[] }): T {
	return {
		...device,
		...(placement.roomId ? { room_id: placement.roomId } : {}),
		...(placement.zoneIds.length ? { zone_ids: [...placement.zoneIds] } : {}),
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
	const deviceById = new Map(devices.map((device) => [device.id, device]));
	const channelById = new Map(channels.map((channel) => [channel.id, channel]));
	const propertyById = new Map(properties.map((property) => [property.id, property]));
	return sources.map((source) => {
		const device = deviceById.get(source.device);
		const channel = channelById.get(source.channel);
		const property = propertyById.get(source.property);
		return {
			id: source.property,
			label: [device?.name, channel?.name, property?.name ?? source.property].filter(Boolean).join(' / '),
			quantity: profile.quantity,
			unit: profile.unit ?? '',
		};
	});
}

/** Keep unsupported persisted SDK contracts distinct from an available v1 descriptor until explicit repair. */
export function numericOperatorKey(policy: { operatorId: string; operatorVersion: number; contractVersion: number }): string {
	const key = `${policy.operatorId}@${policy.operatorVersion}`;
	return policy.contractVersion === 1 ? key : `${key} / contract ${policy.contractVersion}`;
}
