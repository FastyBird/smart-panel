import { Accessory, Categories, Characteristic, CharacteristicValue, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

export class WindowCoveringMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const channels = this.findChannels(device, ChannelCategory.WINDOW_COVERING);
		return channels.some((ch) => this.isValidCoveringChannel(ch));
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'window_covering';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const coveringChannels = this.findChannels(device, ChannelCategory.WINDOW_COVERING).filter((ch) =>
			this.isValidCoveringChannel(ch),
		);
		if (coveringChannels.length === 0) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.WINDOW_COVERING);

		for (const coveringChannel of coveringChannels) {
			const serviceName =
				coveringChannels.length === 1 ? device.name : `${device.name} ${coveringChannel.name || coveringChannel.id}`;
			const service = accessory.addService(Service.WindowCovering, serviceName, coveringChannel.id);

			const posProp = this.findProperty(coveringChannel, PropertyCategory.POSITION);
			const statusProp = this.findProperty(coveringChannel, PropertyCategory.STATUS);
			const obstructionProp = this.findProperty(coveringChannel, PropertyCategory.OBSTRUCTION);

			const isEnum =
				posProp.dataType === DataTypeType.ENUM ||
				(Array.isArray(posProp.format) && (posProp.format as unknown[]).includes('closed')) ||
				(Array.isArray(posProp.format) && (posProp.format as unknown[]).includes('open'));

			const toPosition = (val: unknown): number => {
				const unwrapped = this.unwrapValue(val);
				if (typeof unwrapped === 'string') {
					const lower = unwrapped.toLowerCase();
					if (lower === 'closed') return 0;
					if (lower === 'quarter') return 25;
					if (lower === 'half') return 50;
					if (lower === 'three_quarter') return 75;
					if (lower === 'open') return 100;
				}
				const num = Number(unwrapped);
				return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
			};

			const fromPosition = (val: CharacteristicValue): unknown => {
				const num = Math.min(100, Math.max(0, Math.round(Number(val))));
				if (isEnum) {
					if (num <= 12) return 'closed';
					if (num <= 37) return 'quarter';
					if (num <= 62) return 'half';
					if (num <= 87) return 'three_quarter';
					return 'open';
				}
				return num;
			};

			const toPositionState = (val: unknown): number => {
				const unwrapped = this.unwrapValue(val);
				if (typeof unwrapped === 'string') {
					const lower = unwrapped.toLowerCase();
					if (lower === 'opening') return Characteristic.PositionState.INCREASING;
					if (lower === 'closing') return Characteristic.PositionState.DECREASING;
				}
				return Characteristic.PositionState.STOPPED;
			};

			const currentPosChar = service.getCharacteristic(Characteristic.CurrentPosition);
			const targetPosChar = service.getCharacteristic(Characteristic.TargetPosition);
			const positionStateChar = service.getCharacteristic(Characteristic.PositionState);

			this.bindCharacteristic(context, device, coveringChannel, posProp, currentPosChar, toPosition);
			this.bindCharacteristic(context, device, coveringChannel, posProp, targetPosChar, toPosition, fromPosition);
			this.bindCharacteristic(context, device, coveringChannel, statusProp, positionStateChar, toPositionState);

			if (obstructionProp) {
				const obstructionChar = service.getCharacteristic(Characteristic.ObstructionDetected);
				this.bindCharacteristic(context, device, coveringChannel, obstructionProp, obstructionChar, (val) =>
					this.unwrapValue(val) === true || this.unwrapValue(val) === 'true' || this.unwrapValue(val) === 1 ? 1 : 0,
				);
			}
		}

		return accessory;
	}

	private isValidCoveringChannel(channel: ChannelEntity): boolean {
		const hasPos = !!this.findProperty(channel, PropertyCategory.POSITION);
		const hasStatus = !!this.findProperty(channel, PropertyCategory.STATUS);
		return hasPos && hasStatus;
	}
}
