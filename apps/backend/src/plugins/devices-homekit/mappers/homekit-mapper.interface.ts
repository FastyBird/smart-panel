import { Characteristic, CharacteristicValue } from '@homebridge/hap-nodejs';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

export interface CharacteristicBinding {
	deviceId: string;
	channelId: string;
	propertyId: string;
	characteristic: Characteristic;
	toHomeKit?: (value: unknown) => CharacteristicValue;
	fromHomeKit?: (value: CharacteristicValue) => unknown;
}

export interface HomeKitMapperContext {
	readonly commandDispatcher: HomeKitCommandDispatcher;
	registerBinding(binding: CharacteristicBinding): void;
}

export interface IHomeKitAccessoryMapper {
	canMap(device: DeviceEntity): boolean;
	getSuggestedServiceType(device: DeviceEntity): string;
	buildAccessory(
		device: DeviceEntity,
		context: HomeKitMapperContext,
	): import('@homebridge/hap-nodejs').Accessory | null;
}
