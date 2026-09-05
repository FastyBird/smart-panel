import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class LockMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const lockChannels = this.findChannels(device, ChannelCategory.LOCK);
		return lockChannels.some((ch) => this.isValidLockChannel(ch));
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'lock';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const lockChannels = this.findChannels(device, ChannelCategory.LOCK).filter((ch) => this.isValidLockChannel(ch));
		if (lockChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.DOOR_LOCK);

		for (const lockChannel of lockChannels) {
			const serviceName =
				lockChannels.length === 1 ? device.name : `${device.name} ${lockChannel.name || lockChannel.id}`;
			const service = accessory.addService(Service.LockMechanism, serviceName, lockChannel.id);

			const targetProp =
				this.findProperty(lockChannel, PropertyCategory.ON) ?? this.findProperty(lockChannel, PropertyCategory.LOCKED);
			const currentProp =
				this.findProperty(lockChannel, PropertyCategory.STATUS) ??
				this.findProperty(lockChannel, PropertyCategory.LOCKED) ??
				targetProp;

			const toHapState = (val: unknown) => {
				const unwrapped = this.unwrapValue(val);
				const isLocked = Boolean(
					unwrapped === true || unwrapped === 'true' || unwrapped === 1 || unwrapped === 'locked',
				);
				return isLocked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
			};

			const fromHapState = (val: unknown) => {
				const isSecured = val === Characteristic.LockTargetState.SECURED;
				if (
					targetProp?.dataType === DataTypeType.ENUM ||
					(Array.isArray(targetProp?.format) && (targetProp.format as unknown[]).includes('locked'))
				) {
					return isSecured ? 'locked' : 'unlocked';
				}
				return isSecured;
			};

			if (currentProp) {
				const currentChar = service.getCharacteristic(Characteristic.LockCurrentState);
				this.bindCharacteristic(context, device, lockChannel, currentProp, currentChar, toHapState);
			}

			if (targetProp) {
				const targetChar = service.getCharacteristic(Characteristic.LockTargetState);
				this.bindCharacteristic(context, device, lockChannel, targetProp, targetChar, toHapState, fromHapState);
			}
		}

		return accessory;
	}

	private isValidLockChannel(channel: ChannelEntity): boolean {
		const hasTarget =
			!!this.findProperty(channel, PropertyCategory.ON) || !!this.findProperty(channel, PropertyCategory.LOCKED);
		const hasCurrent =
			!!this.findProperty(channel, PropertyCategory.STATUS) || !!this.findProperty(channel, PropertyCategory.LOCKED);
		return hasTarget && hasCurrent;
	}
}
