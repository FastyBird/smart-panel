import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

export interface IDevicePropertyData {
	device: DeviceEntity;
	channel: ChannelEntity;
	property: ChannelPropertyEntity;
	value: string | number | boolean;
}

export interface IDevicePlatform {
	process({ device, channel, property, value }: IDevicePropertyData): Promise<boolean>;

	processBatch(updates: Array<IDevicePropertyData>): Promise<boolean>;

	getType(): string;
}
