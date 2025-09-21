import {
	Cover,
	DevicePower,
	Ethernet,
	Humidity,
	Input,
	Light,
	Pm1,
	ShellyDimmer,
	ShellyGen32Pm,
	ShellyPlus1,
	ShellyPlus1Mini,
	ShellyPlus1MiniV3,
	ShellyPlus1Pm,
	ShellyPlus1PmMini,
	ShellyPlus1PmMiniV3,
	ShellyPlus1PmUl,
	ShellyPlus1PmV3,
	ShellyPlus1Ul,
	ShellyPlus1V3,
	ShellyPlus2Pm,
	ShellyPlus2PmRev1,
	ShellyPlusDimmer,
	ShellyPlusHt,
	ShellyPlusHtV3,
	ShellyPlusI4,
	ShellyPlusI4V3,
	ShellyPlusPMDimmer,
	ShellyPlusPlugEu,
	ShellyPlusPlugIt,
	ShellyPlusPlugUk,
	ShellyPlusPlugUs,
	ShellyPlusPmMini,
	ShellyPlusPmMiniV3,
	ShellyPro1,
	ShellyPro1Pm,
	ShellyPro1PmRev1,
	ShellyPro1PmRev2,
	ShellyPro1Rev1,
	ShellyPro1Rev2,
	ShellyPro2,
	ShellyPro2Pm,
	ShellyPro2PmRev1,
	ShellyPro2PmRev2,
	ShellyPro2Rev1,
	ShellyPro2Rev2,
	ShellyPro3,
	ShellyPro4Pm,
	ShellyPro4PmV2,
	ShellyProDimmer1Pm,
	ShellyProDimmer1Pm2,
	ShellyProDimmer2Pm,
	ShellyProDualCoverPm,
	Switch,
	Temperature,
	WiFi,
} from 'shellies-ds9';

import { DeviceCategory } from '../../modules/devices/devices.constants';

export const DEVICES_SHELLY_NG_PLUGIN_PREFIX = 'devices-shelly-ng';

export const DEVICES_SHELLY_NG_PLUGIN_NAME = 'devices-shelly-ng';

export const DEVICES_SHELLY_NG_TYPE = 'devices-shelly-ng';

export enum ComponentType {
	SWITCH = 'switch',
	COVER = 'cover',
	LIGHT = 'light',
	INPUT = 'input',
	DEVICE_POWER = 'devicePower',
	HUMIDITY = 'humidity',
	TEMPERATURE = 'temperature',
	PM = 'pm',
	WIFI = 'wifi',
	ETHERNET = 'ethernet',
}

export enum DeviceProfile {
	SWITCH = 'switch',
	COVER = 'cover',
}

type Ctor<T> = abstract new (...args: any[]) => T;

export type ComponentSpec =
	| { type: ComponentType.SWITCH; cls: Ctor<Switch>; ids: number[] }
	| { type: ComponentType.COVER; cls: Ctor<Cover>; ids: number[] }
	| { type: ComponentType.LIGHT; cls: Ctor<Light>; ids: number[] }
	| { type: ComponentType.INPUT; cls: Ctor<Input>; ids: number[] }
	| { type: ComponentType.DEVICE_POWER; cls: Ctor<DevicePower>; ids: number[] }
	| { type: ComponentType.HUMIDITY; cls: Ctor<Humidity>; ids: number[] }
	| { type: ComponentType.TEMPERATURE; cls: Ctor<Temperature>; ids: number[] }
	| { type: ComponentType.PM; cls: Ctor<Pm1>; ids: number[] };

export type SystemSpec =
	| { type: ComponentType.WIFI; cls: Ctor<WiFi> }
	| { type: ComponentType.ETHERNET; cls: Ctor<Ethernet> };

export interface DeviceDescriptor {
	name: string;
	models: string[];
	components: ComponentSpec[];
	system: SystemSpec[];
	categories: DeviceCategory[];
}

export const DESCRIPTORS: Record<string, DeviceDescriptor> = {
	SHELLYPLUS1: {
		name: ShellyPlus1.modelName,
		models: [ShellyPlus1.model.toUpperCase(), ShellyPlus1Ul.model.toUpperCase(), ShellyPlus1V3.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS1MINI: {
		name: ShellyPlus1Mini.modelName,
		models: [ShellyPlus1Mini.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS1MINIV3: {
		name: ShellyPlus1MiniV3.modelName,
		models: [ShellyPlus1MiniV3.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS1PM: {
		name: ShellyPlus1Pm.modelName,
		models: [
			ShellyPlus1Pm.model.toUpperCase(),
			ShellyPlus1PmUl.model.toUpperCase(),
			ShellyPlus1PmV3.model.toUpperCase(),
		],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS1PMMINI: {
		name: ShellyPlus1PmMini.modelName,
		models: [ShellyPlus1PmMini.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS1PMMINIV3: {
		name: ShellyPlus1PmMiniV3.modelName,
		models: [ShellyPlus1PmMiniV3.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPLUS2PM: {
		name: ShellyPlus2Pm.modelName,
		models: [ShellyPlus2Pm.model.toUpperCase(), ShellyPlus2PmRev1.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.COVER, cls: Cover, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYGEN32PM: {
		name: ShellyGen32Pm.modelName,
		models: [ShellyGen32Pm.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.COVER, cls: Cover, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPRO1: {
		name: ShellyPro1.modelName,
		models: [ShellyPro1.model.toUpperCase(), ShellyPro1Rev1.model.toUpperCase(), ShellyPro1Rev2.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPRO1PM: {
		name: ShellyPro1Pm.modelName,
		models: [
			ShellyPro1Pm.model.toUpperCase(),
			ShellyPro1PmRev1.model.toUpperCase(),
			ShellyPro1PmRev2.model.toUpperCase(),
		],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPRO2: {
		name: ShellyPro2.modelName,
		models: [ShellyPro2.model.toUpperCase(), ShellyPro2Rev1.model.toUpperCase(), ShellyPro2Rev2.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPRO2PM: {
		name: ShellyPro2Pm.modelName,
		models: [
			ShellyPro2Pm.model.toUpperCase(),
			ShellyPro2PmRev1.model.toUpperCase(),
			ShellyPro2PmRev2.model.toUpperCase(),
		],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.COVER, cls: Cover, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
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
	SHELLYPRO3: {
		name: ShellyPro3.modelName,
		models: [ShellyPro3.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1, 2] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
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
	SHELLYPRO4PM: {
		name: ShellyPro4Pm.modelName,
		models: [ShellyPro4Pm.model.toUpperCase(), ShellyPro4PmV2.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1, 2, 3] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
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
	SHELLYPLUSPLUGUS: {
		name: ShellyPlusPlugUs.modelName,
		models: [ShellyPlusPlugUs.model.toUpperCase()],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYPLUSPLUGEU: {
		name: ShellyPlusPlugEu.modelName,
		models: [ShellyPlusPlugEu.model.toUpperCase()],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYPLUSPLUGUK: {
		name: ShellyPlusPlugUk.modelName,
		models: [ShellyPlusPlugUk.model.toUpperCase()],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYPLUSPLUGIT: {
		name: ShellyPlusPlugIt.modelName,
		models: [ShellyPlusPlugIt.model.toUpperCase()],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYPLUSPM: {
		name: ShellyPlusPmMini.modelName,
		models: [ShellyPlusPmMini.model.toUpperCase(), ShellyPlusPmMiniV3.model.toUpperCase()],
		components: [{ type: ComponentType.PM, cls: Pm1, ids: [1] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPRODUALCOVERPM: {
		name: ShellyProDualCoverPm.modelName,
		models: [ShellyProDualCoverPm.model.toUpperCase()],
		components: [
			{ type: ComponentType.COVER, cls: Cover, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.WINDOW_COVERING],
	},
	SHELLYPRODIMMER1PM: {
		name: ShellyProDimmer1Pm.modelName,
		models: [ShellyProDimmer1Pm.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPRODIMMER1PM2: {
		name: ShellyProDimmer1Pm2.modelName,
		models: [ShellyProDimmer1Pm2.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYDIMMER: {
		name: ShellyDimmer.modelName,
		models: [ShellyDimmer.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPRODIMMER2PM: {
		name: ShellyProDimmer2Pm.modelName,
		models: [ShellyProDimmer2Pm.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSDIMMER: {
		name: ShellyPlusDimmer.modelName,
		models: [ShellyPlusDimmer.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSDIMMERPM: {
		name: ShellyPlusPMDimmer.modelName,
		models: [ShellyPlusPMDimmer.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSHT: {
		name: ShellyPlusHt.modelName,
		models: [ShellyPlusHt.model.toUpperCase(), ShellyPlusHtV3.model.toUpperCase()],
		components: [
			{ type: ComponentType.TEMPERATURE, cls: Temperature, ids: [0] },
			{ type: ComponentType.HUMIDITY, cls: Humidity, ids: [0] },
			{ type: ComponentType.DEVICE_POWER, cls: DevicePower, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPLUSI4: {
		name: ShellyPlusI4.modelName,
		models: [ShellyPlusI4.model.toUpperCase(), ShellyPlusI4V3.model.toUpperCase()],
		components: [{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
};
