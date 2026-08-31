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

	/**
	 * Returns the exact property values the platform can apply for a batch before it is executed.
	 * Platforms may use this to project a richer Smart Panel contract onto a narrower upstream one and add
	 * sibling property updates when one upstream value authoritatively changes multiple panel properties.
	 */
	prepareBatch?(updates: Array<IDevicePropertyData>): Array<IDevicePropertyData> | null;

	getCommandTimeoutMs?(commandCount: number): number;

	usesAuthoritativePropertyReadback?(property: ChannelPropertyEntity): boolean;

	getType(): string;
}
