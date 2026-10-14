import {
	DevicesModuleChannelCategory as Channel,
	DevicesModuleChannelPropertyDataType as DataType,
	DevicesModuleDeviceCategory as Device,
	type DevicesVirtualPluginCreateDeviceSchema,
	DevicesVirtualPluginDeviceMode as Mode,
	DevicesVirtualPluginValueOrigin as Origin,
	DevicesModuleChannelPropertyPermissions as Permission,
	DevicesModuleChannelPropertyCategory as Property,
} from '../../../openapi.constants';
import { DevicesVirtualPluginThermostatSettingSetting as ThermostatSetting } from '../../../openapi';
import type { ThermostatRequest } from '../services/thermostat-authoring';

type Setting = ThermostatRequest['settings'][number];

/** A complete spec-shaped owned graph. IDs remain stable across preview and create. */
export function thermostatDeviceDraft(
	name: string,
	heating: boolean,
	cooling: boolean
): {
	device: DevicesVirtualPluginCreateDeviceSchema;
	settings: Setting[];
} {
	const settings: Setting[] = [];
	const property = (category: Property, data_type: DataType, format?: (string | number)[], setting?: Setting['setting']) => {
		const id = crypto.randomUUID();
		if (setting) settings.push({ setting, property: id });
		return {
			id,
			type: 'virtual' as const,
			identifier: category,
			category,
			data_type,
			permissions: [Permission.ro],
			value_origin: Origin.local,
			...(format ? { format } : {}),
		};
	};
	const channel = (category: Channel, properties: ReturnType<typeof property>[]) => ({
		id: crypto.randomUUID(),
		type: 'virtual' as const,
		identifier: category,
		name: category === Channel.device_information ? 'Device Information' : category,
		category,
		properties,
	});
	const channels = [
		channel(Channel.temperature, [property(Property.temperature, DataType.float, [0, 100])]),
		channel(Channel.thermostat, [property(Property.locked, DataType.bool, undefined, ThermostatSetting.locked)]),
		channel(Channel.device_information, [
			property(Property.manufacturer, DataType.string),
			property(Property.model, DataType.string),
			property(Property.serial_number, DataType.string),
			property(Property.status, DataType.enum, [
				'connected',
				'disconnected',
				'init',
				'ready',
				'running',
				'sleeping',
				'stopped',
				'lost',
				'alert',
				'unknown',
			]),
		]),
	];
	if (heating)
		channels.push(
			channel(Channel.heater, [
				property(Property.on, DataType.bool, undefined, ThermostatSetting.heating_enabled),
				property(Property.temperature, DataType.float, [0, 100], ThermostatSetting.heating_setpoint),
				property(Property.status, DataType.bool),
			])
		);
	if (cooling)
		channels.push(
			channel(Channel.cooler, [
				property(Property.on, DataType.bool, undefined, ThermostatSetting.cooling_enabled),
				property(Property.temperature, DataType.float, [0, 100], ThermostatSetting.cooling_setpoint),
				property(Property.status, DataType.bool),
			])
		);
	return {
		device: {
			id: crypto.randomUUID(),
			type: 'virtual',
			mode: Mode.climate_controller,
			name,
			category: Device.thermostat,
			channels,
		},
		settings,
	};
}
