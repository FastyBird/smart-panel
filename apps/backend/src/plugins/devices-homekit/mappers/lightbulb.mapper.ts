import { Accessory, Categories, Characteristic, CharacteristicValue, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class LightbulbMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const lightChannels = this.findChannels(device, ChannelCategory.LIGHT);
		return lightChannels.some((ch) => !!this.findProperty(ch, PropertyCategory.ON));
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'lightbulb';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const lightChannels = this.findChannels(device, ChannelCategory.LIGHT).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.ON),
		);
		if (lightChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.LIGHTBULB);

		for (const lightChannel of lightChannels) {
			const serviceName =
				lightChannels.length === 1 ? device.name : `${device.name} ${lightChannel.name || lightChannel.id}`;
			const service = accessory.addService(Service.Lightbulb, serviceName, lightChannel.id);

			// 1. ON / POWER
			const onProp = this.findProperty(lightChannel, PropertyCategory.ON);
			const onChar = service.getCharacteristic(Characteristic.On);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				onProp,
				onChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					return Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1 || unwrapped === '1');
				},
				(val) => Boolean(val),
			);

			// 2. BRIGHTNESS
			const brightnessProp = this.findProperty(lightChannel, PropertyCategory.BRIGHTNESS);
			if (brightnessProp) {
				const isEnum =
					brightnessProp.dataType === DataTypeType.ENUM ||
					(Array.isArray(brightnessProp.format) && (brightnessProp.format as unknown[]).includes('low')) ||
					(Array.isArray(brightnessProp.format) && (brightnessProp.format as unknown[]).includes('high'));

				const brightnessChar = service.getCharacteristic(Characteristic.Brightness);
				this.bindCharacteristic(
					context,
					device,
					lightChannel,
					brightnessProp,
					brightnessChar,
					(val) => {
						const unwrapped = this.unwrapValue(val);
						if (typeof unwrapped === 'string') {
							const lower = unwrapped.toLowerCase();
							if (lower === 'off') return 0;
							if (lower === 'low') return 25;
							if (lower === 'medium') return 50;
							if (lower === 'high') return 75;
							if (lower === 'full') return 100;
						}
						const num = Number(unwrapped);
						return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
					},
					(val: CharacteristicValue) => {
						const num = Math.min(100, Math.max(0, Math.round(Number(val))));
						if (isEnum) {
							if (num <= 12) return 'off';
							if (num <= 37) return 'low';
							if (num <= 62) return 'medium';
							if (num <= 87) return 'high';
							return 'full';
						}
						return num;
					},
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
						const unwrapped = this.unwrapValue(val);
						const num = Number(unwrapped);
						if (isNaN(num) || num <= 0) return 300;
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
						const unwrapped = this.unwrapValue(val);
						const num = Number(unwrapped);
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
						const unwrapped = this.unwrapValue(val);
						const num = Number(unwrapped);
						return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
					},
					(val) => Math.min(100, Math.max(0, Math.round(Number(val)))),
				);
			}
		}

		return accessory;
	}
}
