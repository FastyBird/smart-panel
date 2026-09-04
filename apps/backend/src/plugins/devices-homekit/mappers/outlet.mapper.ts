import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class OutletMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return device.category === DeviceCategory.OUTLET || !!this.findChannel(device, ChannelCategory.OUTLET);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'outlet';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const outletChannel = this.findChannel(device, ChannelCategory.OUTLET);
		if (!outletChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.OUTLET);
		const service = accessory.addService(Service.Outlet, device.name);

		const onProp = this.findProperty(outletChannel, PropertyCategory.ON);
		if (onProp) {
			const onChar = service.getCharacteristic(Characteristic.On);
			this.bindCharacteristic(
				context,
				device,
				outletChannel,
				onProp,
				onChar,
				(val) => Boolean(val === true || val === 'true' || val === 1 || val === '1'),
				(val) => Boolean(val),
			);
		}

		const inUseProp = this.findProperty(outletChannel, PropertyCategory.IN_USE);
		const inUseChar = service.getCharacteristic(Characteristic.OutletInUse);
		if (inUseProp) {
			this.bindCharacteristic(context, device, outletChannel, inUseProp, inUseChar, (val) =>
				Boolean(val === true || val === 'true' || val === 1 || val === '1'),
			);
		} else if (onProp) {
			// If no explicit in_use property, reflect the on state
			inUseChar.onGet(() => {
				const v = onProp.value?.value;
				return Boolean(v === true || v === 'true' || v === 1 || v === '1');
			});
		}

		return accessory;
	}
}
