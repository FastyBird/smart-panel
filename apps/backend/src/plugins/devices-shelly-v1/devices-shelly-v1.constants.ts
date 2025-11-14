import { DeviceCategory } from '../../modules/devices/devices.constants';

export const DEVICES_SHELLY_V1_PLUGIN_PREFIX = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_PLUGIN_NAME = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_TYPE = 'devices-shelly-v1';

export enum ComponentType {
	RELAY = 'relay',
	LIGHT = 'light',
	DIMMER = 'dimmer',
	ROLLER = 'roller',
	INPUT = 'input',
	TEMPERATURE = 'temperature',
	HUMIDITY = 'humidity',
	POWER_METER = 'powerMeter',
	VOLTAGE = 'voltage',
	MOTION = 'motion',
	FLOOD = 'flood',
	SMOKE = 'smoke',
	GAS = 'gas',
	DOOR_WINDOW = 'doorWindow',
}

export interface ComponentSpec {
	type: ComponentType;
	id: number;
}

export interface DeviceDescriptor {
	name: string;
	models: string[];
	components: ComponentSpec[];
	categories: DeviceCategory[];
}

// Device descriptors for common Shelly Gen 1 devices
// This is a minimal set to start with, can be extended later
export const DESCRIPTORS: Record<string, DeviceDescriptor> = {
	SHELLY1: {
		name: 'Shelly 1',
		models: ['SHSW-1'],
		components: [
			{ type: ComponentType.RELAY, id: 0 },
			{ type: ComponentType.INPUT, id: 0 },
		],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
	},
	SHELLY1PM: {
		name: 'Shelly 1PM',
		models: ['SHSW-PM'],
		components: [
			{ type: ComponentType.RELAY, id: 0 },
			{ type: ComponentType.INPUT, id: 0 },
			{ type: ComponentType.POWER_METER, id: 0 },
		],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
	},
	SHELLY25: {
		name: 'Shelly 2.5',
		models: ['SHSW-25'],
		components: [
			{ type: ComponentType.RELAY, id: 0 },
			{ type: ComponentType.RELAY, id: 1 },
			{ type: ComponentType.ROLLER, id: 0 },
			{ type: ComponentType.INPUT, id: 0 },
			{ type: ComponentType.INPUT, id: 1 },
			{ type: ComponentType.POWER_METER, id: 0 },
			{ type: ComponentType.POWER_METER, id: 1 },
		],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
			DeviceCategory.WINDOW_COVERING,
		],
	},
	SHELLYDIMMER: {
		name: 'Shelly Dimmer',
		models: ['SHDM-1'],
		components: [
			{ type: ComponentType.DIMMER, id: 0 },
			{ type: ComponentType.INPUT, id: 0 },
			{ type: ComponentType.INPUT, id: 1 },
			{ type: ComponentType.POWER_METER, id: 0 },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYDIMMER2: {
		name: 'Shelly Dimmer 2',
		models: ['SHDM-2'],
		components: [
			{ type: ComponentType.DIMMER, id: 0 },
			{ type: ComponentType.INPUT, id: 0 },
			{ type: ComponentType.INPUT, id: 1 },
			{ type: ComponentType.POWER_METER, id: 0 },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYHT: {
		name: 'Shelly H&T',
		models: ['SHHT-1'],
		components: [
			{ type: ComponentType.TEMPERATURE, id: 0 },
			{ type: ComponentType.HUMIDITY, id: 0 },
		],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYRGBW2: {
		name: 'Shelly RGBW2',
		models: ['SHRGBW2'],
		components: [
			{ type: ComponentType.LIGHT, id: 0 },
			{ type: ComponentType.LIGHT, id: 1 },
			{ type: ComponentType.LIGHT, id: 2 },
			{ type: ComponentType.LIGHT, id: 3 },
			{ type: ComponentType.POWER_METER, id: 0 },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYBULB: {
		name: 'Shelly Bulb',
		models: ['SHBLB-1'],
		components: [
			{ type: ComponentType.LIGHT, id: 0 },
			{ type: ComponentType.POWER_METER, id: 0 },
		],
		categories: [DeviceCategory.LIGHTING],
	},
};
