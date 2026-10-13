import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

export interface IDevicePropertyData {
	device: DeviceEntity;
	channel: ChannelEntity;
	property: ChannelPropertyEntity;
	value: string | number | boolean;
}

/** Internal platform lease for a composite batch; no DTO can supply or serialize dispatch authority. */
export interface PreparedCompositeDeviceBatch {
	readonly updates: readonly IDevicePropertyData[];
	readonly isCurrent: () => boolean;
	readonly dispatch: (isAdmitted: () => boolean) => Promise<boolean>;
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

	/** Captures exact physical targets and a provider identity lease before core admission. */
	prepareCompositeBatch?(updates: Array<IDevicePropertyData>): Promise<PreparedCompositeDeviceBatch | null>;

	getCommandTimeoutMs?(commandCount: number): number;

	usesAuthoritativePropertyReadback?(property: ChannelPropertyEntity): boolean;

	getType(): string;
}
