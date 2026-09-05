import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class SwitchMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const switchChannels = this.findChannels(device, ChannelCategory.SWITCHER);
		return switchChannels.some((ch) => !!this.findProperty(ch, PropertyCategory.ON));
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'switch';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const switchChannels = this.findChannels(device, ChannelCategory.SWITCHER).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.ON),
		);
		if (switchChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.SWITCH);

		for (const switchChannel of switchChannels) {
			const serviceName =
				switchChannels.length === 1 ? device.name : `${device.name} ${switchChannel.name || switchChannel.id}`;
			const service = accessory.addService(Service.Switch, serviceName, switchChannel.id);

			const onProp = this.findProperty(switchChannel, PropertyCategory.ON);
			const onChar = service.getCharacteristic(Characteristic.On);

			this.bindCharacteristic(
				context,
				device,
				switchChannel,
				onProp,
				onChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					return Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1 || unwrapped === '1');
				},
				(val) => Boolean(val),
			);
		}

		return accessory;
	}
}
