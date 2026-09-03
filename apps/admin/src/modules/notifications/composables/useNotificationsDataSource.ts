import { type ComputedRef, type Ref, computed, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager, useListQuery } from '../../../common';
import { NOTIFICATIONS_MODULE_NAME } from '../notifications.constants';
import { NotificationsFilterSchema } from '../schemas/list.schemas';
import type { INotificationsFilter } from '../schemas/list.schemas';
import { notificationsStoreKey } from '../store/keys';
import type { INotificationsFetchActionPayload } from '../store/notifications.store';
import type { INotification } from '../store/notifications.store.schemas';

export const defaultNotificationsFilter: INotificationsFilter = {
	status: 'all',
	severity: [],
	source: undefined,
	unread: false,
};

export interface IUseNotificationsDataSource {
	notifications: ComputedRef<INotification[]>;
	hasMore: Ref<boolean>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	filters: Ref<INotificationsFilter>;
	fetchNotifications: () => Promise<void>;
	loadMoreNotifications: () => Promise<void>;
}

/**
 * Unlike the client-filtered data sources elsewhere in the admin (devices, users, system logs -
 * every row loaded once, filters applied in memory), notifications are filtered server-side: the
 * backend returns only the rows matching `status`/`severity`/`source`/`unread`, and the store's
 * `listIds` reflects exactly that query rather than the full collection. Every filter change
 * therefore has to re-issue the request from the first page (`append: false`), never narrow what
 * is already in `listIds`.
 */
export const useNotificationsDataSource = (): IUseNotificationsDataSource => {
	const storesManager = injectStoresManager();

	const notificationsStore = storesManager.getStore(notificationsStoreKey);

	const { hasMore, nextCursor, semaphore, firstLoad } = storeToRefs(notificationsStore);

	const { filters } = useListQuery<typeof NotificationsFilterSchema>({
		key: `${NOTIFICATIONS_MODULE_NAME}:notifications:list`,
		filters: {
			schema: NotificationsFilterSchema,
			defaults: defaultNotificationsFilter,
		},
		syncQuery: true,
		version: 1,
	});

	const notifications = computed<INotification[]>((): INotification[] => notificationsStore.list());

	const areLoading = computed<boolean>((): boolean => semaphore.value.fetching.items || !firstLoad.value);

	const loaded = computed<boolean>((): boolean => firstLoad.value);

	// `'all'`/an empty selection/`false` are the filter bar's rest state, not a real constraint -
	// sent as `undefined` so the request reads the same as visiting the page with no filters at all.
	const buildFilterPayload = (): Pick<INotificationsFetchActionPayload, 'status' | 'severity' | 'source' | 'unread'> => ({
		status: filters.value.status === 'all' ? undefined : filters.value.status,
		severity: filters.value.severity.length > 0 ? filters.value.severity : undefined,
		source: filters.value.source || undefined,
		unread: filters.value.unread ? true : undefined,
	});

	const fetchNotifications = async (): Promise<void> => {
		await notificationsStore.fetch({ ...buildFilterPayload(), append: false });
	};

	const loadMoreNotifications = async (): Promise<void> => {
		if (!hasMore.value) {
			return;
		}

		await notificationsStore.fetch({ ...buildFilterPayload(), afterId: nextCursor.value, append: true });
	};

	// The initial load is the caller's responsibility (matching every other data source's
	// `onMounted`/`onBeforeMount` convention) - this watcher only reacts to what changes
	// afterwards, since a plain `watch` never fires for the value it was set up with.
	watch(
		filters,
		(): void => {
			fetchNotifications().catch((): void => undefined);
		},
		{ deep: true }
	);

	return {
		notifications,
		hasMore,
		areLoading,
		loaded,
		filters,
		fetchNotifications,
		loadMoreNotifications,
	};
};
