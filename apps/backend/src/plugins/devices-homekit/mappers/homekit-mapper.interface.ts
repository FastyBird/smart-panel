import { Characteristic, CharacteristicValue } from '@homebridge/hap-nodejs';

import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

export interface CharacteristicPendingWrite {
	token: number;
	previousValue: CharacteristicValue;
	requestedValue: CharacteristicValue;
	startingRevision: number;
}

export interface CharacteristicBinding {
	deviceId: string;
	channelId: string;
	propertyId: string;
	characteristic: Characteristic;
	toHomeKit?: (value: unknown) => CharacteristicValue;
	fromHomeKit?: (value: CharacteristicValue) => unknown;
	currentValue: CharacteristicValue;
	revision: number;
	nextWriteToken?: number;
	pendingWrite?: CharacteristicPendingWrite;
}

export interface PropertyEventListener {
	deviceId: string;
	propertyId: string;
	onPropertyChanged: (property: ChannelPropertyEntity, rawValue: unknown) => void;
}

export interface InputOccurrenceListener {
	deviceId: string;
	channelId: string;
	propertyId: string;
	onOccurrence: (occurrence: ChannelInputOccurrencePayload) => void;
}

export interface HomeKitMapperContext {
	readonly commandDispatcher: HomeKitCommandDispatcher;
	registerBinding(binding: CharacteristicBinding): void;
	registerPropertyListener(listener: PropertyEventListener): void;
	registerOccurrenceListener(listener: InputOccurrenceListener): void;
}

export interface IHomeKitAccessoryMapper {
	canMap(device: DeviceEntity): boolean;
	getSuggestedServiceType(device: DeviceEntity): string;
	buildAccessory(
		device: DeviceEntity,
		context: HomeKitMapperContext,
	): import('@homebridge/hap-nodejs').Accessory | null;
}
