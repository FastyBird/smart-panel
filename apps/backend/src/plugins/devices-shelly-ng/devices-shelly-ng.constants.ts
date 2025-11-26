import {
	Cct,
	Cover,
	DevicePower,
	Ethernet,
	Humidity,
	Input,
	Light,
	Pm1,
	Rgb,
	Rgbw,
	Shelly1Gen3,
	Shelly1Gen4,
	Shelly1LGen3,
	Shelly1MiniGen3,
	Shelly1MiniGen4,
	Shelly1PmGen3,
	Shelly1PmGen4,
	Shelly1PmMiniGen3,
	Shelly1PmMiniGen4,
	Shelly2LGen3,
	Shelly2PmGen3,
	Shelly2PmGen4,
	ShellyDaliDimmerGen3,
	ShellyDimmerGen3,
	ShellyDimmerPmGen3,
	ShellyI4Gen3,
	ShellyOutdoorPlugSGen3,
	ShellyPlugAzGen3,
	ShellyPlugSGen3,
	ShellyPlus1,
	ShellyPlus1Mini,
	ShellyPlus1Pm,
	ShellyPlus1PmMini,
	ShellyPlus1PmUl,
	ShellyPlus1Ul,
	ShellyPlus2Pm,
	ShellyPlus2PmRev1,
	ShellyPlusDimmer,
	ShellyPlusHt,
	ShellyPlusI4,
	ShellyPlusI4Dc,
	ShellyPlusPlugIt,
	ShellyPlusPlugS,
	ShellyPlusPlugUk,
	ShellyPlusPlugUs,
	ShellyPlusPmMini,
	ShellyPlusRGBWPm,
	ShellyPlusUni,
	ShellyPlusWallDimmer,
	ShellyPmMiniGen3,
	ShellyPowerStripGen4,
	ShellyPro1,
	ShellyPro1Pm,
	ShellyPro1PmRev1,
	ShellyPro1PmRev2,
	ShellyPro1PmRev3,
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
	ShellyProDimmer,
	ShellyProDimmer1Pm,
	ShellyProDimmer2Pm,
	ShellyProDualCoverPm,
	ShellyProRGBWPm,
	Switch,
	Temperature,
	WiFi,
} from 'shellies-ds9';

import { DeviceCategory } from '../../modules/devices/devices.constants';

export const DEVICES_SHELLY_NG_PLUGIN_PREFIX = 'devices-shelly-ng';

export const DEVICES_SHELLY_NG_PLUGIN_NAME = 'devices-shelly-ng-plugin';

export const DEVICES_SHELLY_NG_TYPE = 'devices-shelly-ng';

export const DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME = 'Devices Shelly NG plugin';

export const DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for interacting with Shelly Next-Generation (NG) devices and their states. This plugin allows discovery, inspection, and potential adoption of Shelly Next-Generation devices into the Smart Panel ecosystem.';

export enum ComponentType {
	SWITCH = 'switch',
	COVER = 'cover',
	LIGHT = 'light',
	RGB = 'rgb',
	RGBW = 'rgbw',
	CCT = 'cct',
	INPUT = 'input',
	DEVICE_POWER = 'devicePower',
	HUMIDITY = 'humidity',
	TEMPERATURE = 'temperature',
	PM1 = 'pm1',
	WIFI = 'wifi',
	ETHERNET = 'ethernet',
}

export enum DeviceProfile {
	SWITCH = 'switch',
	COVER = 'cover',
	LIGHT = 'light',
	RGB = 'rgb',
	RGBW = 'rgbw',
	RGB_X2_LIGHT = 'rgbx2light',
	RGB_CCT = 'rgbcct',
	CCT_X2 = 'cctx2',
}

type Ctor<T> = abstract new (...args: any[]) => T;

export type ComponentSpec =
	| { type: ComponentType.SWITCH; cls: Ctor<Switch>; ids: number[] }
	| { type: ComponentType.COVER; cls: Ctor<Cover>; ids: number[] }
	| { type: ComponentType.LIGHT; cls: Ctor<Light>; ids: number[] }
	| { type: ComponentType.RGB; cls: Ctor<Rgb>; ids: number[] }
	| { type: ComponentType.RGBW; cls: Ctor<Rgbw>; ids: number[] }
	| { type: ComponentType.CCT; cls: Ctor<Cct>; ids: number[] }
	| { type: ComponentType.INPUT; cls: Ctor<Input>; ids: number[] }
	| { type: ComponentType.DEVICE_POWER; cls: Ctor<DevicePower>; ids: number[] }
	| { type: ComponentType.HUMIDITY; cls: Ctor<Humidity>; ids: number[] }
	| { type: ComponentType.TEMPERATURE; cls: Ctor<Temperature>; ids: number[] }
	| { type: ComponentType.PM1; cls: Ctor<Pm1>; ids: number[] };

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
		models: [ShellyPlus1.model.toUpperCase(), ShellyPlus1Ul.model.toUpperCase(), ShellyPlus1Mini.model.toUpperCase()],
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
			ShellyPlus1PmMini.model.toUpperCase(),
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
	SHELLYPLUSI4: {
		name: ShellyPlusI4.modelName,
		models: [ShellyPlusI4.model.toUpperCase(), ShellyPlusI4Dc.model.toUpperCase()],
		components: [{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPLUSPLUG: {
		name: ShellyPlusPlugS.modelName,
		models: [
			ShellyPlusPlugS.model.toUpperCase(),
			ShellyPlusPlugUk.model.toUpperCase(),
			ShellyPlusPlugIt.model.toUpperCase(),
			ShellyPlusPlugUs.model.toUpperCase(),
		],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYPLUSHT: {
		name: ShellyPlusHt.modelName,
		models: [ShellyPlusHt.model.toUpperCase()],
		components: [
			{ type: ComponentType.TEMPERATURE, cls: Temperature, ids: [0] },
			{ type: ComponentType.HUMIDITY, cls: Humidity, ids: [0] },
			{ type: ComponentType.DEVICE_POWER, cls: DevicePower, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPLUSWALLDIMMER: {
		name: ShellyPlusWallDimmer.modelName,
		models: [ShellyPlusWallDimmer.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSRGBWPM: {
		name: ShellyPlusRGBWPm.modelName,
		models: [ShellyPlusRGBWPm.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0, 1, 2, 3] },
			{ type: ComponentType.RGB, cls: Rgb, ids: [0] },
			{ type: ComponentType.RGBW, cls: Rgbw, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSDIMMER: {
		name: ShellyPlusDimmer.modelName,
		models: [ShellyPlusDimmer.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYPLUSPM: {
		name: ShellyPlusPmMini.modelName,
		models: [ShellyPlusPmMini.model.toUpperCase()],
		components: [{ type: ComponentType.PM1, cls: Pm1, ids: [1] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPLUSUNI: {
		name: ShellyPlusUni.modelName,
		models: [ShellyPlusUni.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 3] },
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
	SHELLYPRO1: {
		name: ShellyPro1.modelName,
		models: [ShellyPro1.model.toUpperCase(), ShellyPro1Rev1.model.toUpperCase(), ShellyPro1Rev2.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
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
	SHELLYPRO1PM: {
		name: ShellyPro1Pm.modelName,
		models: [
			ShellyPro1Pm.model.toUpperCase(),
			ShellyPro1PmRev1.model.toUpperCase(),
			ShellyPro1PmRev2.model.toUpperCase(),
			ShellyPro1PmRev3.model.toUpperCase(),
		],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
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
	SHELLYPRO2: {
		name: ShellyPro2.modelName,
		models: [ShellyPro2.model.toUpperCase(), ShellyPro2Rev1.model.toUpperCase(), ShellyPro2Rev2.model.toUpperCase()],
		components: [
			{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
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
	SHELLYPRODUALCOVERPM: {
		name: ShellyProDualCoverPm.modelName,
		models: [ShellyProDualCoverPm.model.toUpperCase()],
		components: [
			{ type: ComponentType.COVER, cls: Cover, ids: [0, 1] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
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
	SHELLYPRODIMMER2PM: {
		name: ShellyProDimmer2Pm.modelName,
		models: [ShellyProDimmer2Pm.model.toUpperCase()],
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
		name: ShellyProDimmer.modelName,
		models: [ShellyProDimmer.model.toUpperCase()],
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
	SHELLYPRORGBWPM: {
		name: ShellyProRGBWPm.modelName,
		models: [ShellyProRGBWPm.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0, 1, 2, 3, 4] },
			{ type: ComponentType.RGB, cls: Rgb, ids: [0] },
			{ type: ComponentType.CCT, cls: Cct, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3, 4] },
		],
		system: [
			{ type: ComponentType.WIFI, cls: WiFi },
			{ type: ComponentType.ETHERNET, cls: Ethernet },
		],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLY1GEN3: {
		name: Shelly1Gen3.modelName,
		models: [Shelly1Gen3.model.toUpperCase()],
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
	SHELLY1PMGEN3: {
		name: Shelly1PmGen3.modelName,
		models: [Shelly1PmGen3.model.toUpperCase()],
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
	SHELLY2PMGEN3: {
		name: Shelly2PmGen3.modelName,
		models: [Shelly2PmGen3.model.toUpperCase()],
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
	SHELLYI4GEN3: {
		name: ShellyI4Gen3.modelName,
		models: [ShellyI4Gen3.model.toUpperCase()],
		components: [{ type: ComponentType.INPUT, cls: Input, ids: [0, 1, 2, 3] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLY1LGEN3: {
		name: Shelly1LGen3.modelName,
		models: [Shelly1LGen3.model.toUpperCase()],
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
	SHELLY2LGEN3: {
		name: Shelly2LGen3.modelName,
		models: [Shelly2LGen3.model.toUpperCase()],
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
	SHELLY1MINIGEN3: {
		name: Shelly1MiniGen3.modelName,
		models: [Shelly1MiniGen3.model.toUpperCase()],
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
	SHELLY1PMMINIGEN3: {
		name: Shelly1PmMiniGen3.modelName,
		models: [Shelly1PmMiniGen3.model.toUpperCase()],
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
	SHELLYPMMINIGEN3: {
		name: ShellyPmMiniGen3.modelName,
		models: [ShellyPmMiniGen3.model.toUpperCase()],
		components: [{ type: ComponentType.PM1, cls: Pm1, ids: [1] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.SENSOR],
	},
	SHELLYPLUGSGEN3: {
		name: ShellyPlugSGen3.modelName,
		models: [
			ShellyPlugSGen3.model.toUpperCase(),
			ShellyOutdoorPlugSGen3.model.toUpperCase(),
			ShellyPlugAzGen3.model.toUpperCase(),
		],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
	SHELLYDIMMERPMGEN3: {
		name: ShellyDimmerPmGen3.modelName,
		models: [ShellyDimmerPmGen3.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYDIMMERGEN3: {
		name: ShellyDimmerGen3.modelName,
		models: [ShellyDimmerGen3.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLYDDIMMERGEN3: {
		name: ShellyDaliDimmerGen3.modelName,
		models: [ShellyDaliDimmerGen3.model.toUpperCase()],
		components: [
			{ type: ComponentType.LIGHT, cls: Light, ids: [0] },
			{ type: ComponentType.INPUT, cls: Input, ids: [0, 1] },
		],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.LIGHTING],
	},
	SHELLY1GEN4: {
		name: Shelly1Gen4.modelName,
		models: [Shelly1Gen4.model.toUpperCase()],
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
	SHELLY1PMGEN4: {
		name: Shelly1PmGen4.modelName,
		models: [Shelly1PmGen4.model.toUpperCase()],
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
	SHELLY1MINIGEN4: {
		name: Shelly1MiniGen4.modelName,
		models: [Shelly1MiniGen4.model.toUpperCase()],
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
	SHELLY1PMMINIGEN4: {
		name: Shelly1PmMiniGen4.modelName,
		models: [Shelly1PmMiniGen4.model.toUpperCase()],
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
	SHELLY2PMGEN4: {
		name: Shelly2PmGen4.modelName,
		models: [Shelly2PmGen4.model.toUpperCase()],
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
	SHELLYPOWERSTRIPGEN4: {
		name: ShellyPowerStripGen4.modelName,
		models: [ShellyPowerStripGen4.model.toUpperCase()],
		components: [{ type: ComponentType.SWITCH, cls: Switch, ids: [0, 1, 2, 3] }],
		system: [{ type: ComponentType.WIFI, cls: WiFi }],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
	},
};
