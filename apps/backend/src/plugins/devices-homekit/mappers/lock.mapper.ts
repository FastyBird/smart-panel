import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class LockMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return device.category === DeviceCategory.LOCK || !!this.findChannel(device, ChannelCategory.LOCK);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'lock';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const lockChannel = this.findChannel(device, ChannelCategory.LOCK);
		if (!lockChannel) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.DOOR_LOCK);
		const service = accessory.addService(Service.LockMechanism, device.name);

		const lockedProp = this.findProperty(lockChannel, PropertyCategory.LOCKED);
		if (lockedProp) {
			const currentChar = service.getCharacteristic(Characteristic.LockCurrentState);
			const targetChar = service.getCharacteristic(Characteristic.LockTargetState);

			const toHapState = (val: unknown) => {
				const isLocked = Boolean(val === true || val === 'true' || val === 1 || val === 'locked');
				return isLocked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
			};

			const fromHapState = (val: unknown) => {
				return val === Characteristic.LockTargetState.SECURED;
			};

			this.bindCharacteristic(context, device, lockChannel, lockedProp, currentChar, toHapState);
			this.bindCharacteristic(context, device, lockChannel, lockedProp, targetChar, toHapState, fromHapState);
		}

		return accessory;
	}
}
