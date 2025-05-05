import channelsMappingSchema from '../../../../../spec/devices/channels.json';
import devicesMappingSchema from '../../../../../spec/devices/devices.json';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../openapi';

type ChannelProperty = {
	category: DevicesModuleChannelPropertyCategory;
	required: boolean;
	description: { en: string };
	permissions: DevicesModuleChannelPropertyPermissions[];
	data_type: DevicesModuleChannelPropertyData_type;
	unit: string | null;
	format: string[] | number[] | null;
	invalid?: string[] | null;
	step?: number[] | null;
};

type ChannelSpec = {
	category: DevicesModuleChannelCategory;
	properties: ChannelProperty[];
};

type DeviceChannel = {
	category: DevicesModuleChannelCategory;
	required: boolean;
	multiple: boolean;
	description: { en: string };
};

type DeviceSpec = {
	category: DevicesModuleChannelCategory;
	description: { en: string };
	channels: DeviceChannel[];
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
	[DevicesModuleDeviceCategory.heater]: [
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
	[DevicesModuleDeviceCategory.window_covering]: [
		DevicesModuleChannelCategory.window_covering,
		DevicesModuleChannelCategory.battery,
		DevicesModuleChannelCategory.electrical_energy,
		DevicesModuleChannelCategory.electrical_power,
		DevicesModuleChannelCategory.device_information,
	],
};

export const deviceChannelsSpecificationOrder: Record<string, DevicesModuleChannelCategory[]> = Object.fromEntries(
	Object.entries<DeviceSpec>(devicesMappingSchema as unknown as Record<DevicesModuleDeviceCategory, DeviceSpec>).map(
		([deviceCategory, deviceSpec]) => {
			const unsortedChannels = Object.values<DeviceChannel>(deviceSpec.channels).map((ch) => ch.category);

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
		}
	)
);

export const deviceChannelsSpecificationMappers: Record<
	string,
	{
		required: DevicesModuleChannelCategory[];
		optional: DevicesModuleChannelCategory[];
		multiple: DevicesModuleChannelCategory[];
	}
> = Object.fromEntries(
	Object.entries<DeviceSpec>(devicesMappingSchema as unknown as Record<DevicesModuleDeviceCategory, DeviceSpec>).map(
		([deviceCategory, deviceSpec]) => {
			const required = Object.values<DeviceChannel>(deviceSpec.channels)
				.filter((channelSpec) => channelSpec.required)
				.map((channelSpec) => channelSpec.category);

			const optional = Object.values<DeviceChannel>(deviceSpec.channels)
				.filter((channelSpec) => !channelSpec.required)
				.map((channelSpec) => channelSpec.category);

			const multiple = Object.values<DeviceChannel>(deviceSpec.channels)
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
		}
	)
);

export const channelChannelsPropertiesSpecificationMappers: Record<
	string,
	{
		required: DevicesModuleChannelPropertyCategory[];
		optional: DevicesModuleChannelPropertyCategory[];
	}
> = Object.fromEntries(
	Object.entries<ChannelSpec>(channelsMappingSchema as unknown as Record<DevicesModuleChannelCategory, ChannelSpec>).map(
		([channelCategory, channelSpec]) => {
			const required = Object.values<ChannelProperty>(channelSpec.properties)
				.filter((prop) => prop.required)
				.map((prop) => prop.category);

			const optional = Object.values<ChannelProperty>(channelSpec.properties)
				.filter((prop) => !prop.required)
				.map((prop) => prop.category);

			return [channelCategory, { required, optional }];
		}
	)
);

export function getChannelPropertySpecification(
	channelCategory: DevicesModuleChannelCategory,
	propertyCategory: DevicesModuleChannelPropertyCategory
): ChannelProperty | undefined {
	const channelSpec = (channelsMappingSchema as unknown as Record<DevicesModuleChannelCategory, ChannelSpec>)[channelCategory];

	if (!channelSpec) {
		return undefined;
	}

	return Object.values<ChannelProperty>(channelSpec.properties).find((prop) => prop.category === propertyCategory);
}
