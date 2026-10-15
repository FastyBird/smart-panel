import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { matchesStep } from '../../../modules/devices/utils/property-command-value.utils';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';
import { communicationFailure, validateHapNumber } from './property-read';
import { enumToHap } from './semantic-conversion';
import { SensorMapper } from './sensor.mapper';

export class FanMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return this.findChannels(device, ChannelCategory.FAN).some(
			(channel) => this.findProperty(channel, PropertyCategory.ON)?.dataType === DataTypeType.BOOL,
		);
	}
	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'fan';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const channels = this.findChannels(device, ChannelCategory.FAN).filter(
			(channel) => this.findProperty(channel, PropertyCategory.ON)?.dataType === DataTypeType.BOOL,
		);
		if (!channels.length) return null;
		const accessory = this.createBaseAccessory(device, Categories.FAN);
		for (const channel of channels) {
			const service = accessory.addService(Service.Fanv2, device.name, channel.id);
			const on = this.findProperty(channel, PropertyCategory.ON);
			const boolean = (value: unknown): number => {
				if (typeof value !== 'boolean') throw communicationFailure();
				return value ? 1 : 0;
			};
			this.bindCharacteristic(
				context,
				device,
				channel,
				on,
				service.getCharacteristic(Characteristic.Active),
				boolean,
				(value) => value === Characteristic.Active.ACTIVE,
			);
			const swing = this.findProperty(channel, PropertyCategory.SWING);
			if (swing?.dataType === DataTypeType.BOOL)
				this.bindCharacteristic(
					context,
					device,
					channel,
					swing,
					service.getCharacteristic(Characteristic.SwingMode),
					boolean,
					(value) => value === Characteristic.SwingMode.SWING_ENABLED,
				);

			const speed = this.findProperty(channel, PropertyCategory.SPEED);
			// Native percentage only. Discrete speed labels have no lossless HAP percentage mapping.
			if (
				speed?.dataType === DataTypeType.UCHAR &&
				speed.unit === '%' &&
				Array.isArray(speed.format) &&
				speed.format.length === 2 &&
				speed.format.every((value) => typeof value === 'number' && Number.isInteger(value)) &&
				Number(speed.format[0]) >= 0 &&
				Number(speed.format[1]) <= 100 &&
				Number(speed.format[0]) < Number(speed.format[1]) &&
				(speed.step == null ||
					(Number.isInteger(speed.step) &&
						speed.step > 0 &&
						matchesStep(Number(speed.format[1]), speed.step, Number(speed.format[0]))))
			) {
				const characteristic = service.getCharacteristic(Characteristic.RotationSpeed);
				const minimum = Number(speed.format[0]),
					maximum = Number(speed.format[1]),
					step = speed.step ?? 1;
				// A new HAP characteristic starts at zero, which may be outside the native grid.
				characteristic.value = null;
				characteristic.setProps({ minValue: minimum, maxValue: maximum, minStep: step });
				this.bindCharacteristic(context, device, channel, speed, characteristic, (value) => {
					const number = validateHapNumber(characteristic, value);
					if (!matchesStep(number, step, minimum)) throw communicationFailure();
					return number;
				});
			}
			for (const [category, type, values] of [
				[
					PropertyCategory.DIRECTION,
					Characteristic.RotationDirection,
					{
						clockwise: Characteristic.RotationDirection.CLOCKWISE,
						counter_clockwise: Characteristic.RotationDirection.COUNTER_CLOCKWISE,
					},
				],
				[
					PropertyCategory.MODE,
					Characteristic.TargetFanState,
					{
						manual: Characteristic.TargetFanState.MANUAL,
						auto: Characteristic.TargetFanState.AUTO,
					},
				],
			] as const) {
				const property = this.findProperty(channel, category);
				if (!this.exactEnum(property, Object.keys(values))) continue;
				const convert = (value: unknown) => enumToHap(property, value, values);
				this.bindCharacteristic(
					context,
					device,
					channel,
					property,
					service.getCharacteristic(type),
					convert,
					(value) => Object.keys(values).find((key) => values[key] === value),
					undefined,
					convert,
				);
			}
			// Active is requested/reported ON, not evidence for the optional CurrentFanState.
		}
		SensorMapper.attachSensorServices(accessory, device, context);
		return accessory;
	}

	private exactEnum(property: ChannelPropertyEntity | undefined, values: string[]): boolean {
		return (
			property?.dataType === DataTypeType.ENUM &&
			Array.isArray(property.format) &&
			property.format.length === values.length &&
			new Set<string | number>(property.format).size === values.length &&
			property.format.every((value) => values.includes(value as string))
		);
	}
}
