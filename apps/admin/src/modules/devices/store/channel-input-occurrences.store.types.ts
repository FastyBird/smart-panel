import type { Ref } from 'vue';

import type { IChannelProperty } from './channels.properties.store.types';
import type { IChannel } from './channels.store.types';
import type { IDevice } from './devices.store.types';

export interface IChannelInputOccurrence {
	id: string;
	deviceId: IDevice['id'];
	channelId: IChannel['id'];
	propertyId: IChannelProperty['id'] | null;
	deviceCategory: string | null;
	channelCategory: string | null;
	propertyCategory: string | null;
	event: string;
	timestamp: string;
	sourceTimestamp: string | null;
	sourceOccurrenceId: string | null;
	nativeEventType: string | null;
	data: Record<string, unknown> | null;
	integration: string | null;
	endpoint: string | null;
	receivedAt: number;
}

export interface IChannelInputOccurrencesStoreState {
	occurrences: Ref<IChannelInputOccurrence[]>;
}

export interface IChannelInputOccurrencesStoreActions {
	onEvent(payload: Record<string, unknown>): void;
	clear(channelId?: IChannel['id']): void;
	findByChannel(channelId: IChannel['id']): IChannelInputOccurrence[];
	findByDevice(deviceId: IDevice['id']): IChannelInputOccurrence[];
	findLatestForChannel(channelId: IChannel['id']): IChannelInputOccurrence | null;
}

export type ChannelInputOccurrencesStoreSetup = IChannelInputOccurrencesStoreState & IChannelInputOccurrencesStoreActions;
