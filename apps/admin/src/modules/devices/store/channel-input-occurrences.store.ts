import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useLogger } from '../../../common';
import type { IChannel } from './channels.store.types';
import type { IDevice } from './devices.store.types';
import type {
	ChannelInputOccurrencesStoreSetup,
	IChannelInputOccurrence,
	IChannelInputOccurrencesStoreActions,
	IChannelInputOccurrencesStoreState,
} from './channel-input-occurrences.store.types';

export const MAX_OCCURRENCES_STORED = 100;

export const useChannelInputOccurrencesStore = defineStore<'devices_module-channel_input_occurrences', ChannelInputOccurrencesStoreSetup>(
	'devices_module-channel_input_occurrences',
	(): ChannelInputOccurrencesStoreSetup => {
		const logger = useLogger();
		const occurrences = ref<IChannelInputOccurrence[]>([]);

		const onEvent = (payload: Record<string, unknown>): void => {
			if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') {
				logger.warn('Received invalid channel input occurrence payload:', payload);
				return;
			}

			const occurrence: IChannelInputOccurrence = {
				id: String(payload.id),
				deviceId: String(payload.deviceId ?? payload.device_id ?? ''),
				channelId: String(payload.channelId ?? payload.channel_id ?? ''),
				propertyId: payload.propertyId || payload.property_id ? String(payload.propertyId ?? payload.property_id) : null,
				deviceCategory: payload.deviceCategory || payload.device_category ? String(payload.deviceCategory ?? payload.device_category) : null,
				channelCategory: payload.channelCategory || payload.channel_category ? String(payload.channelCategory ?? payload.channel_category) : null,
				propertyCategory: payload.propertyCategory || payload.property_category ? String(payload.propertyCategory ?? payload.property_category) : null,
				event: String(payload.event ?? ''),
				timestamp: String(payload.timestamp ?? new Date().toISOString()),
				sourceTimestamp: payload.sourceTimestamp || payload.source_timestamp ? String(payload.sourceTimestamp ?? payload.source_timestamp) : null,
				sourceOccurrenceId:
					payload.sourceOccurrenceId || payload.source_occurrence_id ? String(payload.sourceOccurrenceId ?? payload.source_occurrence_id) : null,
				nativeEventType: payload.nativeEventType || payload.native_event_type ? String(payload.nativeEventType ?? payload.native_event_type) : null,
				data: payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null,
				integration: payload.integration ? String(payload.integration) : null,
				endpoint: payload.endpoint ? String(payload.endpoint) : null,
				receivedAt: Date.now(),
			};

			// Insert at beginning (newest first)
			occurrences.value.unshift(occurrence);

			if (occurrences.value.length > MAX_OCCURRENCES_STORED) {
				occurrences.value = occurrences.value.slice(0, MAX_OCCURRENCES_STORED);
			}
		};

		const clear = (channelId?: IChannel['id']): void => {
			if (channelId) {
				occurrences.value = occurrences.value.filter((occ) => occ.channelId !== channelId);
			} else {
				occurrences.value = [];
			}
		};

		const findByChannel = (channelId: IChannel['id']): IChannelInputOccurrence[] => {
			return occurrences.value.filter((occ) => occ.channelId === channelId);
		};

		const findByDevice = (deviceId: IDevice['id']): IChannelInputOccurrence[] => {
			return occurrences.value.filter((occ) => occ.deviceId === deviceId);
		};

		const findLatestForChannel = (channelId: IChannel['id']): IChannelInputOccurrence | null => {
			return occurrences.value.find((occ) => occ.channelId === channelId) ?? null;
		};

		return {
			occurrences,
			onEvent,
			clear,
			findByChannel,
			findByDevice,
			findLatestForChannel,
		};
	}
);

export const registerChannelInputOccurrencesStore = (
	pinia: Pinia
): Store<string, IChannelInputOccurrencesStoreState, object, IChannelInputOccurrencesStoreActions> => {
	return useChannelInputOccurrencesStore(pinia);
};
