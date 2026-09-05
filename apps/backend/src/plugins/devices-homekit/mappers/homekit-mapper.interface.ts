import { Characteristic, CharacteristicValue } from '@homebridge/hap-nodejs';

import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

export interface CharacteristicBinding {
	deviceId: string;
	channelId: string;
	propertyId: string;
	characteristic: Characteristic;
	toHomeKit?: (value: unknown) => CharacteristicValue;
	fromHomeKit?: (value: CharacteristicValue) => unknown;
	currentValue: CharacteristicValue;
	revision: number;
}

export interface PropertyEventListener {
	deviceId: string;
	propertyId: string;
	onPropertyChanged: (property: ChannelPropertyEntity, rawValue: unknown) => void;
}

export interface HomeKitMapperContext {
	readonly commandDispatcher: HomeKitCommandDispatcher;
	registerBinding(binding: CharacteristicBinding): void;
	registerPropertyListener(listener: PropertyEventListener): void;
}

export interface IHomeKitAccessoryMapper {
	canMap(device: DeviceEntity): boolean;
	getSuggestedServiceType(device: DeviceEntity): string;
	buildAccessory(
		device: DeviceEntity,
		context: HomeKitMapperContext,
	): import('@homebridge/hap-nodejs').Accessory | null;
}
