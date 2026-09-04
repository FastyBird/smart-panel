import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class LightbulbMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return device.category === DeviceCategory.LIGHTING || !!this.findChannel(device, ChannelCategory.LIGHT);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'lightbulb';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const lightChannel = this.findChannel(device, ChannelCategory.LIGHT);
		if (!lightChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.LIGHTBULB);
		const service = accessory.addService(Service.Lightbulb, device.name);

		// 1. ON / OFF
		const onProp = this.findProperty(lightChannel, PropertyCategory.ON);
		if (onProp) {
			const onChar = service.getCharacteristic(Characteristic.On);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				onProp,
				onChar,
				(val) => Boolean(val === true || val === 'true' || val === 1 || val === '1'),
				(val) => Boolean(val),
			);
		}

		// 2. BRIGHTNESS
		const brightnessProp = this.findProperty(lightChannel, PropertyCategory.BRIGHTNESS);
		if (brightnessProp) {
			const brightnessChar = service.getCharacteristic(Characteristic.Brightness);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				brightnessProp,
				brightnessChar,
				(val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
				},
				(val) => Math.min(100, Math.max(0, Math.round(Number(val)))),
			);
		}

		// 3. COLOR TEMPERATURE
		const ctProp = this.findProperty(lightChannel, PropertyCategory.COLOR_TEMPERATURE);
		if (ctProp) {
			const ctChar = service.getCharacteristic(Characteristic.ColorTemperature);
			const isKelvin = ctProp.unit === 'K';
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				ctProp,
				ctChar,
				(val) => {
					const num = Number(val);
					if (isNaN(num) || num <= 0) return 300;
					// If in Kelvin (e.g. 2000-6500), convert to Mireds (1000000 / K)
					if (isKelvin || num > 1000) {
						return Math.min(500, Math.max(140, Math.round(1000000 / num)));
					}
					return Math.min(500, Math.max(140, Math.round(num)));
				},
				(val) => {
					const mireds = Number(val);
					if (isNaN(mireds) || mireds <= 0) return mireds;
					if (isKelvin) {
						return Math.round(1_000_000 / mireds);
					}
					return mireds;
				},
			);
		}

		// 4. HUE & SATURATION
		const hueProp = this.findProperty(lightChannel, PropertyCategory.HUE);
		const satProp = this.findProperty(lightChannel, PropertyCategory.SATURATION);

		if (hueProp) {
			const hueChar = service.getCharacteristic(Characteristic.Hue);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				hueProp,
				hueChar,
				(val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : Math.min(360, Math.max(0, Math.round(num)));
				},
				(val) => Math.min(360, Math.max(0, Math.round(Number(val)))),
			);
		}

		if (satProp) {
			const satChar = service.getCharacteristic(Characteristic.Saturation);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				satProp,
				satChar,
				(val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
				},
				(val) => Math.min(100, Math.max(0, Math.round(Number(val)))),
			);
		}

		return accessory;
	}
}
