import { Accessory, Categories, Characteristic, CharacteristicValue, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class ThermostatMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return (
			device.category === DeviceCategory.THERMOSTAT ||
			device.category === DeviceCategory.HEATING_UNIT ||
			!!this.findChannel(device, ChannelCategory.THERMOSTAT) ||
			!!this.findChannel(device, ChannelCategory.HEATER) ||
			!!this.findChannel(device, ChannelCategory.COOLER)
		);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'thermostat';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const climateChannel =
			this.findChannel(device, ChannelCategory.THERMOSTAT) ??
			this.findChannel(device, ChannelCategory.HEATER) ??
			this.findChannel(device, ChannelCategory.COOLER);

		if (!climateChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.THERMOSTAT);
		const service = accessory.addService(Service.Thermostat, device.name);

		// Current temperature reading channel (if separate) or climate channel
		const tempChannel = this.findChannel(device, ChannelCategory.TEMPERATURE) ?? climateChannel;
		const currentTempProp = this.findProperty(tempChannel, PropertyCategory.TEMPERATURE);

		if (currentTempProp) {
			const currentTempChar = service.getCharacteristic(Characteristic.CurrentTemperature);
			this.bindCharacteristic(context, device, tempChannel, currentTempProp, currentTempChar, (val) => {
				const num = Number(val);
				return isNaN(num) ? 20 : num;
			});
		}

		// Target temperature setpoint on climate channel
		const targetTempProp = this.findProperty(climateChannel, PropertyCategory.TEMPERATURE);
		if (targetTempProp) {
			const targetTempChar = service.getCharacteristic(Characteristic.TargetTemperature);
			targetTempChar.setProps({
				minValue: 10,
				maxValue: 38,
				minStep: 0.5,
			});

			this.bindCharacteristic(
				context,
				device,
				climateChannel,
				targetTempProp,
				targetTempChar,
				(val) => {
					const num = Number(val);
					return isNaN(num) ? 21 : Math.min(38, Math.max(10, num));
				},
				(val) => Number(val),
			);
		}

		// Mode / State
		const modeProp = this.findProperty(climateChannel, PropertyCategory.MODE);
		const currentHeatingCoolingChar = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
		const targetHeatingCoolingChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);

		if (modeProp) {
			const toHapMode = (val: unknown): CharacteristicValue => {
				const str =
					typeof val === 'string'
						? val.toLowerCase()
						: typeof val === 'number' || typeof val === 'boolean'
							? String(val).toLowerCase()
							: '';
				if (str === 'off') return Characteristic.TargetHeatingCoolingState.OFF;
				if (str === 'heat' || str === 'heating') return Characteristic.TargetHeatingCoolingState.HEAT;
				if (str === 'cool' || str === 'cooling') return Characteristic.TargetHeatingCoolingState.COOL;
				if (str === 'auto') return Characteristic.TargetHeatingCoolingState.AUTO;
				return Characteristic.TargetHeatingCoolingState.HEAT;
			};

			const fromHapMode = (val: CharacteristicValue): string => {
				switch (val) {
					case Characteristic.TargetHeatingCoolingState.OFF:
						return 'off';
					case Characteristic.TargetHeatingCoolingState.HEAT:
						return 'heat';
					case Characteristic.TargetHeatingCoolingState.COOL:
						return 'cool';
					case Characteristic.TargetHeatingCoolingState.AUTO:
						return 'auto';
					default:
						return 'heat';
				}
			};

			this.bindCharacteristic(
				context,
				device,
				climateChannel,
				modeProp,
				targetHeatingCoolingChar,
				toHapMode,
				fromHapMode,
			);

			this.bindCharacteristic(context, device, climateChannel, modeProp, currentHeatingCoolingChar, (val) => {
				const target = toHapMode(val);
				return target === Characteristic.TargetHeatingCoolingState.AUTO
					? Characteristic.CurrentHeatingCoolingState.HEAT
					: (target as number);
			});
		} else {
			// Default static heating mode if no explicit mode property
			currentHeatingCoolingChar.onGet(() => Characteristic.CurrentHeatingCoolingState.HEAT);
			targetHeatingCoolingChar.onGet(() => Characteristic.TargetHeatingCoolingState.HEAT);
		}

		// Units (Celsius = 0)
		service
			.getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.onGet(() => Characteristic.TemperatureDisplayUnits.CELSIUS);

		return accessory;
	}
}
