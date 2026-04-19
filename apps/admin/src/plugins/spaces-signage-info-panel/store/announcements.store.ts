import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend, useLogger } from '../../../common';
import type { ISpace } from '../../../modules/spaces';
import { SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX } from '../spaces-signage-info-panel.constants';

import type {
	AnnouncementsStoreSetup,
	IAnnouncement,
	IAnnouncementCreateData,
	IAnnouncementUpdateData,
	IAnnouncementsActions,
	IAnnouncementsState,
	IReorderEntry,
} from './announcements.store.types';
import {
	type ApiAnnouncement,
	transformAnnouncementCreateRequest,
	transformAnnouncementResponse,
	transformAnnouncementUpdateRequest,
} from './announcements.transformers';

const STORE_ID = 'spaces_signage_info_panel_plugin-announcements';

export const useAnnouncements = defineStore<typeof STORE_ID, AnnouncementsStoreSetup>(STORE_ID, (): AnnouncementsStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const data = ref<{ [key: IAnnouncement['id']]: IAnnouncement }>({});
	const fetching = ref<ISpace['id'][]>([]);
	const saving = ref<IAnnouncement['id'][]>([]);

	const upsert = (announcement: IAnnouncement): void => {
		data.value[announcement.id] = announcement;
	};

	const fetch = async (spaceId: ISpace['id']): Promise<IAnnouncement[]> => {
		if (fetching.value.includes(spaceId)) {
			return Object.values(data.value).filter((a) => a.spaceId === spaceId);
		}

		fetching.value.push(spaceId);

		try {
			const { data: response, error } = await backend.client.GET(
				`/${PLUGINS_PREFIX}/${SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX}/spaces/{spaceId}/announcements`,
				{ params: { path: { spaceId } } },
			);

			if (error || !response) {
				throw new Error('Failed to fetch announcements');
			}

			// Remove stale entries for this space before re-seeding.
			for (const existing of Object.values(data.value)) {
				if (existing.spaceId === spaceId) {
					delete data.value[existing.id];
				}
			}

			const transformed = (response.data ?? []).map((item: ApiAnnouncement) => transformAnnouncementResponse(item));
			for (const announcement of transformed) {
				upsert(announcement);
			}

			return transformed;
		} finally {
			fetching.value = fetching.value.filter((id) => id !== spaceId);
		}
	};

	const listForSpace = (spaceId: ISpace['id']): IAnnouncement[] => {
		return Object.values(data.value)
			.filter((a) => a.spaceId === spaceId)
			.sort((a, b) => {
				if (b.priority !== a.priority) return b.priority - a.priority;
				if (a.order !== b.order) return a.order - b.order;
				return a.createdAt.getTime() - b.createdAt.getTime();
			});
	};

	const create = async (
		spaceId: ISpace['id'],
		payload: IAnnouncementCreateData,
	): Promise<IAnnouncement> => {
		const { data: response, error } = await backend.client.POST(
			`/${PLUGINS_PREFIX}/${SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX}/spaces/{spaceId}/announcements`,
			{
				params: { path: { spaceId } },
				body: { data: transformAnnouncementCreateRequest(payload) },
			},
		);

		if (error || !response) {
			logger.error('[SPACES SIGNAGE INFO PANEL][ANNOUNCEMENTS STORE] Failed to create announcement', { error });
			throw new Error('Failed to create announcement');
		}

		const announcement = transformAnnouncementResponse(response.data);
		upsert(announcement);
		return announcement;
	};

	const update = async (
		spaceId: ISpace['id'],
		id: IAnnouncement['id'],
		payload: IAnnouncementUpdateData,
	): Promise<IAnnouncement> => {
		saving.value.push(id);
		try {
			const { data: response, error } = await backend.client.PATCH(
				`/${PLUGINS_PREFIX}/${SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX}/spaces/{spaceId}/announcements/{id}`,
				{
					params: { path: { spaceId, id } },
					body: { data: transformAnnouncementUpdateRequest(payload) },
				},
			);

			if (error || !response) {
				logger.error('[SPACES SIGNAGE INFO PANEL][ANNOUNCEMENTS STORE] Failed to update announcement', { error });
				throw new Error('Failed to update announcement');
			}

			const announcement = transformAnnouncementResponse(response.data);
			upsert(announcement);
			return announcement;
		} finally {
			saving.value = saving.value.filter((savingId) => savingId !== id);
		}
	};

	const remove = async (spaceId: ISpace['id'], id: IAnnouncement['id']): Promise<void> => {
		const { error } = await backend.client.DELETE(
			`/${PLUGINS_PREFIX}/${SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX}/spaces/{spaceId}/announcements/{id}`,
			{ params: { path: { spaceId, id } } },
		);

		if (error) {
			logger.error('[SPACES SIGNAGE INFO PANEL][ANNOUNCEMENTS STORE] Failed to remove announcement', { error });
			throw new Error('Failed to delete announcement');
		}

		delete data.value[id];
	};

	const reorder = async (spaceId: ISpace['id'], items: IReorderEntry[]): Promise<IAnnouncement[]> => {
		const { data: response, error } = await backend.client.POST(
			`/${PLUGINS_PREFIX}/${SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX}/spaces/{spaceId}/announcements/reorder`,
			{
				params: { path: { spaceId } },
				body: { data: { items } },
			},
		);

		if (error || !response) {
			logger.error('[SPACES SIGNAGE INFO PANEL][ANNOUNCEMENTS STORE] Failed to reorder announcements', { error });
			throw new Error('Failed to reorder announcements');
		}

		const transformed = (response.data ?? []).map((item: ApiAnnouncement) => transformAnnouncementResponse(item));

		// Overwrite cached entries for this space so we don't lose ids that
		// changed position but keep entries intact for unrelated spaces.
		for (const existing of Object.values(data.value)) {
			if (existing.spaceId === spaceId) {
				delete data.value[existing.id];
			}
		}
		for (const announcement of transformed) {
			upsert(announcement);
		}

		return transformed;
	};

	const onEvent = (announcement: IAnnouncement): void => {
		upsert(announcement);
	};

	const unset = (id: IAnnouncement['id']): void => {
		delete data.value[id];
	};

	return {
		data,
		fetching,
		saving,
		fetch,
		listForSpace,
		create,
		update,
		remove,
		reorder,
		onEvent,
		unset,
	};
});

export const registerAnnouncementsStore = (
	pinia: Pinia,
): Store<typeof STORE_ID, IAnnouncementsState, object, IAnnouncementsActions> => {
	return useAnnouncements(pinia) as unknown as Store<typeof STORE_ID, IAnnouncementsState, object, IAnnouncementsActions>;
};
