import { Accessory, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext } from './homekit-mapper.interface';

export class BatteryMapper {
	static attachBatteryService(accessory: Accessory, device: DeviceEntity, context: HomeKitMapperContext): void {
		const batteryChannel = device.channels?.find((c) => c.category === ChannelCategory.BATTERY);
		if (!batteryChannel) {
			return;
		}

		const levelProp = batteryChannel.properties?.find(
			(p) => p.category === PropertyCategory.PERCENTAGE || p.category === PropertyCategory.LEVEL,
		);

		if (!levelProp) {
			return;
		}

		const batteryService = accessory.addService(Service.Battery, `${device.name} Battery`);
		const levelChar = batteryService.getCharacteristic(Characteristic.BatteryLevel);
		const lowBatChar = batteryService.getCharacteristic(Characteristic.StatusLowBattery);
		const chargingChar = batteryService.getCharacteristic(Characteristic.ChargingState);

		const toLevel = (val: unknown): number => {
			const num = Number(val);
			return isNaN(num) ? 100 : Math.min(100, Math.max(0, Math.round(num)));
		};

		levelChar.onGet(() => toLevel(levelProp.value));
		lowBatChar.onGet(() =>
			toLevel(levelProp.value) < 20
				? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
				: Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
		);
		chargingChar.onGet(() => Characteristic.ChargingState.NOT_CHARGING);

		context.registerBinding({
			deviceId: device.id,
			channelId: batteryChannel.id,
			propertyId: levelProp.id,
			characteristic: levelChar,
			toHomeKit: toLevel,
		});
	}
}
