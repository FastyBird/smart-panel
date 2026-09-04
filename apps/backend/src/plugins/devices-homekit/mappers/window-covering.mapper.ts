import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class WindowCoveringMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return (
			device.category === DeviceCategory.WINDOW_COVERING || !!this.findChannel(device, ChannelCategory.WINDOW_COVERING)
		);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'window_covering';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const coveringChannel = this.findChannel(device, ChannelCategory.WINDOW_COVERING);
		if (!coveringChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.WINDOW_COVERING);
		const service = accessory.addService(Service.WindowCovering, device.name);

		const posProp = this.findProperty(coveringChannel, PropertyCategory.POSITION);
		if (posProp) {
			const currentPosChar = service.getCharacteristic(Characteristic.CurrentPosition);
			const targetPosChar = service.getCharacteristic(Characteristic.TargetPosition);

			this.bindCharacteristic(context, device, coveringChannel, posProp, currentPosChar, (val) => {
				const num = Number(val);
				return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
			});

			this.bindCharacteristic(
				context,
				device,
				coveringChannel,
				posProp,
				targetPosChar,
				(val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
				},
				(val) => Math.min(100, Math.max(0, Math.round(Number(val)))),
			);
		}

		// Position State defaults to STOPPED (2)
		service.getCharacteristic(Characteristic.PositionState).onGet(() => Characteristic.PositionState.STOPPED);

		return accessory;
	}
}
