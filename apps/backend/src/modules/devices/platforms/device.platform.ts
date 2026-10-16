import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

export interface IDevicePropertyData {
	device: DeviceEntity;
	channel: ChannelEntity;
	property: ChannelPropertyEntity;
	value: string | number | boolean;
}

/** Internal sibling-observation contract. Never accepted from command DTOs. */
export interface PreparedCoverAction {
	readonly kind: 'cover_action';
	readonly effectScope: string;
	readonly commandPropertyId: string;
	readonly status: ChannelPropertyEntity;
	readonly position: ChannelPropertyEntity;
	readonly effects: readonly ChannelPropertyEntity[];
}
export interface CoverActionObservation {
	readonly state: 'open' | 'closed' | 'opening' | 'closing' | 'stopped';
	readonly position: number;
	readonly tag: unknown;
	readonly observedAt: Date;
	readonly preflightState: string;
	readonly acceptanceBoundary: number;
	readonly statusAcceptance: number;
	readonly positionAcceptance: number;
}
export interface CoverActionDispatchContext {
	readonly tag: string;
	readonly observationToken: object;
	readonly isCurrent: () => boolean;
	/** Called only after the matched action RPC returns successfully. */
	readonly accepted: () => void;
	/** Only qualified, normally admitted STATUS/POSITION samples can settle this generation. */
	readonly observe: (observation: CoverActionObservation) => boolean;
}

/** Internal platform lease for a composite batch; no DTO can supply or serialize dispatch authority. */
export interface PreparedCompositeDeviceBatch {
	readonly updates: readonly IDevicePropertyData[];
	readonly isCurrent: () => boolean;
	readonly coverAction?: PreparedCoverAction;
	readonly dispatch: (isAdmitted: () => boolean, cover?: CoverActionDispatchContext) => Promise<boolean>;
	readonly dispose?: () => void;
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

	getCoverEffectScope?(update: IDevicePropertyData): string | null;
	getCommandReadiness?(update: IDevicePropertyData): Promise<{ commandable: boolean; reasons: string[] }>;
	getCommandTimeoutMs?(commandCount: number): number;

	usesAuthoritativePropertyReadback?(property: ChannelPropertyEntity): boolean;

	getType(): string;
}
