import { Accessory, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext, PropertyEventListener } from './homekit-mapper.interface';

export class BatteryMapper {
	static attachBatteryService(accessory: Accessory, device: DeviceEntity, context: HomeKitMapperContext): void {
		const batteryChannel = device.channels?.find((c) => c.category === ChannelCategory.BATTERY);
		if (!batteryChannel) {
			return;
		}

		const levelProp = batteryChannel.properties?.find(
			(p) => p.category === PropertyCategory.PERCENTAGE || p.category === PropertyCategory.LEVEL,
		);

		const statusProp = batteryChannel.properties?.find((p) => p.category === PropertyCategory.STATUS);

		if (!levelProp && !statusProp) {
			return;
		}

		const batteryService = accessory.addService(Service.Battery, `${device.name} Battery`);
		const levelChar = batteryService.getCharacteristic(Characteristic.BatteryLevel);
		const lowBatChar = batteryService.getCharacteristic(Characteristic.StatusLowBattery);
		const chargingChar = batteryService.getCharacteristic(Characteristic.ChargingState);

		const unwrap = (val: unknown): unknown => {
			if (val !== null && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
				return (val as Record<string, unknown>).value;
			}
			return val;
		};

		let currentLevel = levelProp ? unwrap(levelProp.value?.value) : null;
		let currentStatus = statusProp ? unwrap(statusProp.value?.value) : null;

		const toLevel = (val: unknown): number => {
			const unwrapped = unwrap(val);
			if (unwrapped === null || unwrapped === undefined) return 100;
			if (typeof unwrapped === 'string') {
				const lower = unwrapped.toLowerCase();
				if (lower === 'critical') return 10;
				if (lower === 'low') return 25;
				if (lower === 'medium') return 50;
				if (lower === 'high') return 75;
				if (lower === 'full') return 100;
			}
			const num = Number(unwrapped);
			return isNaN(num) ? 100 : Math.min(100, Math.max(0, Math.round(num)));
		};

		const toCharging = (val: unknown): number => {
			const unwrapped = unwrap(val);
			return unwrapped === 'charging' || unwrapped === true
				? Characteristic.ChargingState.CHARGING
				: Characteristic.ChargingState.NOT_CHARGING;
		};

		const isLowBattery = (level: unknown, status: unknown): number => {
			const unwrappedStatus = unwrap(status);
			if (unwrappedStatus === 'low' || unwrappedStatus === 'low_battery' || unwrappedStatus === 'critical') {
				return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
			}

			const unwrappedLevel = unwrap(level);
			if (typeof unwrappedLevel === 'string') {
				const lower = unwrappedLevel.toLowerCase();
				if (lower === 'critical' || lower === 'low') {
					return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
				}
			}

			if (unwrappedLevel !== null && unwrappedLevel !== undefined) {
				const num = Number(unwrappedLevel);
				if (!isNaN(num) && num <= 20) {
					return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
				}
			}

			return Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
		};

		levelChar.onGet(() => toLevel(currentLevel));
		lowBatChar.onGet(() => isLowBattery(currentLevel, currentStatus));
		chargingChar.onGet(() => toCharging(currentStatus));

		levelChar.updateValue(toLevel(currentLevel));
		lowBatChar.updateValue(isLowBattery(currentLevel, currentStatus));
		chargingChar.updateValue(toCharging(currentStatus));

		const recomputeLowBattery = () => {
			const lowState = isLowBattery(currentLevel, currentStatus);
			lowBatChar.updateValue(lowState);
		};

		if (levelProp) {
			const levelListener: PropertyEventListener = {
				deviceId: device.id,
				propertyId: levelProp.id,
				onPropertyChanged: (_prop, rawVal) => {
					currentLevel = unwrap(rawVal);
					levelChar.updateValue(toLevel(currentLevel));
					recomputeLowBattery();
				},
			};
			context.registerPropertyListener(levelListener);

			context.registerBinding({
				deviceId: device.id,
				channelId: batteryChannel.id,
				propertyId: levelProp.id,
				characteristic: levelChar,
				toHomeKit: toLevel,
				currentValue: toLevel(currentLevel),
				revision: 0,
			});
		}

		if (statusProp) {
			const statusListener: PropertyEventListener = {
				deviceId: device.id,
				propertyId: statusProp.id,
				onPropertyChanged: (_prop, rawVal) => {
					currentStatus = unwrap(rawVal);
					chargingChar.updateValue(toCharging(currentStatus));
					recomputeLowBattery();
				},
			};
			context.registerPropertyListener(statusListener);

			context.registerBinding({
				deviceId: device.id,
				channelId: batteryChannel.id,
				propertyId: statusProp.id,
				characteristic: chargingChar,
				toHomeKit: toCharging,
				currentValue: toCharging(currentStatus),
				revision: 0,
			});
		}
	}
}
