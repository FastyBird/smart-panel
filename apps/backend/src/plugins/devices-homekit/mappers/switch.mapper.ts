import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class SwitchMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return device.category === DeviceCategory.SWITCHER || !!this.findChannel(device, ChannelCategory.SWITCHER);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'switch';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const switchChannel = this.findChannel(device, ChannelCategory.SWITCHER);
		if (!switchChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.SWITCH);
		const service = accessory.addService(Service.Switch, device.name);

		const onProp = this.findProperty(switchChannel, PropertyCategory.ON);
		if (onProp) {
			const onChar = service.getCharacteristic(Characteristic.On);
			this.bindCharacteristic(
				context,
				device,
				switchChannel,
				onProp,
				onChar,
				(val) => Boolean(val === true || val === 'true' || val === 1 || val === '1'),
				(val) => Boolean(val),
			);
		}

		return accessory;
	}
}
