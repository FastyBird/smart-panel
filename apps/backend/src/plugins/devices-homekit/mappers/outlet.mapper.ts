import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class OutletMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const outletChannels = this.findChannels(device, ChannelCategory.OUTLET);
		return outletChannels.some((ch) => !!this.findProperty(ch, PropertyCategory.ON));
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'outlet';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const outletChannels = this.findChannels(device, ChannelCategory.OUTLET).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.ON),
		);
		if (outletChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.OUTLET);

		for (const outletChannel of outletChannels) {
			const serviceName =
				outletChannels.length === 1 ? device.name : `${device.name} ${outletChannel.name || outletChannel.id}`;
			const service = accessory.addService(Service.Outlet, serviceName, outletChannel.id);

			const onProp = this.findProperty(outletChannel, PropertyCategory.ON);
			const onChar = service.getCharacteristic(Characteristic.On);

			const toBool = (val: unknown) => {
				const unwrapped = this.unwrapValue(val);
				return Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1 || unwrapped === '1');
			};

			this.bindCharacteristic(context, device, outletChannel, onProp, onChar, toBool, (val) => Boolean(val));

			const inUseProp = this.findProperty(outletChannel, PropertyCategory.IN_USE);
			const inUseChar = service.getCharacteristic(Characteristic.OutletInUse);
			if (inUseProp) {
				this.bindCharacteristic(context, device, outletChannel, inUseProp, inUseChar, toBool);
			} else {
				this.bindCharacteristic(context, device, outletChannel, onProp, inUseChar, toBool);
			}
		}

		return accessory;
	}
}
