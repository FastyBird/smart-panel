import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../openapi.constants';
import { channelsSchema } from '../../spec/channels';
import { devicesSchema } from '../../spec/devices';

export type ChannelPropertySpec = {
	category: DevicesModuleChannelPropertyCategory;
	required: boolean;
	description: { en: string };
	permissions: DevicesModuleChannelPropertyPermissions[];
	data_type: DevicesModuleChannelPropertyDataType;
	unit: string | null;
	format: string[] | number[] | null;
	invalid?: string | number | null;
	step?: number | null;
};

export type ChannelSpec = {
	category: DevicesModuleChannelCategory;
	properties: ChannelPropertySpec[];
};

export type DeviceChannelSpec = {
	category: DevicesModuleChannelCategory;
	required: boolean;
	multiple: boolean;
	description: { en: string };
};

export type DeviceSpec = {
	category: DevicesModuleChannelCategory;
	description: { en: string };
	channels: DeviceChannelSpec[];
};

const deviceChannelsSortingSpecification: Record<DevicesModuleDeviceCategory, DevicesModuleChannelCategory[]> = {
	[DevicesModuleDeviceCategory.generic]: [],
	[DevicesModuleDeviceCategory.air_conditioner]: [
		DevicesModuleChannelCategory.cooler,
		DevicesModuleChannelCategory.heater,
		DevicesModuleChannelCategory.fan,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.air_dehumidifier]: [
		DevicesModuleChannelCategory.cooler,
		DevicesModuleChannelCategory.fan,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.air_humidifier]: [
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.switcher,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.fan,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.air_purifier]: [
		DevicesModuleChannelCategory.fan,
		DevicesModuleChannelCategory.air_particulate,
		DevicesModuleChannelCategory.carbon_dioxide,
		DevicesModuleChannelCategory.carbon_monoxide,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.nitrogen_dioxide,
		DevicesModuleChannelCategory.ozone,
		DevicesModuleChannelCategory.pressure,
		DevicesModuleChannelCategory.sulphur_dioxide,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.volatile_organic_compounds,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.alarm]: [DevicesModuleChannelCategory.alarm, DevicesModuleChannelCategory.device_information],
	[DevicesModuleDeviceCategory.camera]: [
		DevicesModuleChannelCategory.camera,
		DevicesModuleChannelCategory.motion,
		DevicesModuleChannelCategory.microphone,
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.light,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.door]: [
		DevicesModuleChannelCategory.door,
		DevicesModuleChannelCategory.lock,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.motion,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.doorbell]: [
		DevicesModuleChannelCategory.doorbell,
		DevicesModuleChannelCategory.camera,
		DevicesModuleChannelCategory.lock,
		DevicesModuleChannelCategory.motion,
		DevicesModuleChannelCategory.microphone,
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.light,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.fan]: [
		DevicesModuleChannelCategory.fan,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.heating_unit]: [
		DevicesModuleChannelCategory.heater,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.lighting]: [
		DevicesModuleChannelCategory.light,
		DevicesModuleChannelCategory.illuminance,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.lock]: [
		DevicesModuleChannelCategory.lock,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.motion,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.media]: [
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.microphone,
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.av_receiver]: [
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.game_console]: [
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.projector]: [
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.set_top_box]: [
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.streaming_service]: [
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.outlet]: [
		DevicesModuleChannelCategory.outlet,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.pump]: [
		DevicesModuleChannelCategory.flow,
		DevicesModuleChannelCategory.switcher,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.pressure,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.robot_vacuum]: [
		DevicesModuleChannelCategory.robot_vacuum,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.sensor]: [
		DevicesModuleChannelCategory.air_particulate,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.carbon_dioxide,
		DevicesModuleChannelCategory.carbon_monoxide,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.illuminance,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.motion,
		DevicesModuleChannelCategory.nitrogen_dioxide,
		DevicesModuleChannelCategory.occupancy,
		DevicesModuleChannelCategory.ozone,
		DevicesModuleChannelCategory.pressure,
		DevicesModuleChannelCategory.smoke,
		DevicesModuleChannelCategory.sulphur_dioxide,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.volatile_organic_compounds,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.speaker]: [
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.media_input,
		DevicesModuleChannelCategory.media_playback,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.sprinkler]: [
		DevicesModuleChannelCategory.valve,
		DevicesModuleChannelCategory.flow,
		DevicesModuleChannelCategory.pressure,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.switcher]: [
		DevicesModuleChannelCategory.switcher,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.television]: [
		DevicesModuleChannelCategory.television,
		DevicesModuleChannelCategory.speaker,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.thermostat]: [
		DevicesModuleChannelCategory.thermostat,
		DevicesModuleChannelCategory.cooler,
		DevicesModuleChannelCategory.heater,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.humidity,
		DevicesModuleChannelCategory.contact,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.valve]: [
		DevicesModuleChannelCategory.valve,
		DevicesModuleChannelCategory.pressure,
		DevicesModuleChannelCategory.flow,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.water_heater]: [
		DevicesModuleChannelCategory.heater,
		DevicesModuleChannelCategory.temperature,
		DevicesModuleChannelCategory.leak,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
	[DevicesModuleDeviceCategory.window_covering]: [
		DevicesModuleChannelCategory.window_covering,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
};

export const deviceChannelsSpecificationOrder: Record<string, DevicesModuleChannelCategory[]> = Object.fromEntries(
	Object.entries<DeviceSpec>(devicesSchema as unknown as Record<DevicesModuleDeviceCategory, DeviceSpec>).map(([deviceCategory, deviceSpec]) => {
		const unsortedChannels = Object.values<DeviceChannelSpec>(deviceSpec.channels).map((ch) => ch.category);

		const customOrder = deviceChannelsSortingSpecification[deviceCategory as DevicesModuleDeviceCategory];

		const sortedChannels = customOrder
			? [...unsortedChannels].sort((a, b) => {
					const ai = customOrder.indexOf(a);
					const bi = customOrder.indexOf(b);

					if (ai === -1 && bi === -1) return 0; // both not found: keep relative
					if (ai === -1) return 1; // a not found, b found: b first
					if (bi === -1) return -1; // b not found, a found: a first

					return ai - bi; // both found: sort by index
				})
			: unsortedChannels;

		return [deviceCategory, sortedChannels];
	})
);

export const deviceChannelsSpecificationMappers: Record<
	string,
	{
		required: DevicesModuleChannelCategory[];
		optional: DevicesModuleChannelCategory[];
		multiple: DevicesModuleChannelCategory[];
	}
> = Object.fromEntries(
	Object.entries<DeviceSpec>(devicesSchema as unknown as Record<DevicesModuleDeviceCategory, DeviceSpec>).map(([deviceCategory, deviceSpec]) => {
		const required = Object.values<DeviceChannelSpec>(deviceSpec.channels)
			.filter((channelSpec) => channelSpec.required)
			.map((channelSpec) => channelSpec.category);

		const optional = Object.values<DeviceChannelSpec>(deviceSpec.channels)
			.filter((channelSpec) => !channelSpec.required)
			.map((channelSpec) => channelSpec.category);

		const multiple = Object.values<DeviceChannelSpec>(deviceSpec.channels)
			.filter((channelSpec) => channelSpec.multiple)
			.map((channelSpec) => channelSpec.category);

		return [
			deviceCategory,
			{
				required,
				optional,
				multiple,
			},
		];
	})
);

export const channelChannelsPropertiesSpecificationMappers: Record<
	string,
	{
		required: DevicesModuleChannelPropertyCategory[];
		optional: DevicesModuleChannelPropertyCategory[];
	}
> = Object.fromEntries(
	Object.entries<ChannelSpec>(channelsSchema as unknown as Record<DevicesModuleChannelCategory, ChannelSpec>).map(
		([channelCategory, channelSpec]) => {
			const required = Object.values<ChannelPropertySpec>(channelSpec.properties)
				.filter((prop) => prop.required)
				.map((prop) => prop.category);

			const optional = Object.values<ChannelPropertySpec>(channelSpec.properties)
				.filter((prop) => !prop.required)
				.map((prop) => prop.category);

			return [channelCategory, { required, optional }];
		}
	)
);

// Raw property spec from channels.ts - may have data_types array instead of data_type
type RawChannelPropertySpec = {
	category: DevicesModuleChannelPropertyCategory;
	required: boolean;
	description?: { en: string };
	permissions: DevicesModuleChannelPropertyPermissions[];
	// Single data type format
	data_type?: DevicesModuleChannelPropertyDataType;
	unit?: string | null;
	format?: string[] | number[] | null;
	invalid?: string | number | null;
	step?: number | null;
	// Multiple data types format (e.g., brightness with percentage or level options)
	data_types?: Array<{
		id: string;
		data_type: DevicesModuleChannelPropertyDataType;
		unit?: string | null;
		format?: string[] | number[] | null;
		step?: number | null;
		description?: { en: string };
	}>;
};

export const getChannelPropertySpecification = (
	channelCategory: DevicesModuleChannelCategory,
	propertyCategory: DevicesModuleChannelPropertyCategory
): ChannelPropertySpec | undefined => {
	const channelSpec = (channelsSchema as unknown as Record<DevicesModuleChannelCategory, ChannelSpec>)[channelCategory];

	if (!channelSpec) {
		return undefined;
	}

	const rawProp = Object.values<RawChannelPropertySpec>(channelSpec.properties as unknown as Record<string, RawChannelPropertySpec>).find(
		(prop) => prop.category === propertyCategory
	);

	if (!rawProp) {
		return undefined;
	}

	// Handle properties with multiple data type options (e.g., brightness)
	// Use the first data type option as the default
	const firstDataType = rawProp.data_types?.[0];
	if (firstDataType) {
		return {
			category: rawProp.category,
			required: rawProp.required,
			description: firstDataType.description ?? rawProp.description ?? { en: '' },
			permissions: rawProp.permissions,
			data_type: firstDataType.data_type,
			unit: firstDataType.unit ?? null,
			format: firstDataType.format ?? null,
			invalid: rawProp.invalid,
			step: firstDataType.step ?? null,
		};
	}

	// Handle properties with single data type
	return {
		category: rawProp.category,
		required: rawProp.required,
		description: rawProp.description ?? { en: '' },
		permissions: rawProp.permissions,
		data_type: rawProp.data_type!,
		unit: rawProp.unit ?? null,
		format: rawProp.format ?? null,
		invalid: rawProp.invalid,
		step: rawProp.step ?? null,
	};
};
