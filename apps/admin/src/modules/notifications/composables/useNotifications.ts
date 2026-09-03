import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { notificationsStoreKey } from '../store/keys';
import type { INotificationsFetchActionPayload } from '../store/notifications.store';
import type { INotification } from '../store/notifications.store.schemas';

export interface IUseNotifications {
	active: ComputedRef<INotification[]>;
	unreadCount: ComputedRef<number>;
	highestActiveSeverity: ComputedRef<NotificationsModuleNotificationSeverity | null>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchNotifications: (payload?: INotificationsFetchActionPayload) => Promise<void>;
}

export const useNotifications = (): IUseNotifications => {
	const storesManager = injectStoresManager();

	const notificationsStore = storesManager.getStore(notificationsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(notificationsStore);

	// Read independently of `listIds` - the bell must show what is active regardless of what a
	// filtered page last queried for.
	const active = computed<INotification[]>((): INotification[] => notificationsStore.active());

	const unreadCount = computed<number>((): number => notificationsStore.unreadCount());

	const highestActiveSeverity = computed<NotificationsModuleNotificationSeverity | null>((): NotificationsModuleNotificationSeverity | null =>
		notificationsStore.highestActiveSeverity()
	);

	const areLoading = computed<boolean>((): boolean => semaphore.value.fetching.items);

	const loaded = computed<boolean>((): boolean => firstLoad.value);

	const fetchNotifications = async (payload?: INotificationsFetchActionPayload): Promise<void> => {
		await notificationsStore.fetch(payload);
	};

	return {
		active,
		unreadCount,
		highestActiveSeverity,
		areLoading,
		loaded,
		fetchNotifications,
	};
};
