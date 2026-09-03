import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { notificationsStoreKey } from '../store/keys';
import type { INotification } from '../store/notifications.store.schemas';

export interface IUseNotificationsActions {
	markRead: (id: INotification['id'], read?: boolean) => Promise<void>;
	// Reports whether every id in the selection actually succeeded - `bulkUpdate` can resolve
	// (HTTP-level success) while still carrying per-row failures in `result.failed`, and a caller
	// that only fires-and-forgets this still gets the failure surfaced through the flash message.
	markAllRead: (ids: INotification['id'][]) => Promise<boolean>;
	dismiss: (id: INotification['id'], dismissed?: boolean) => Promise<void>;
	remove: (id: INotification['id']) => Promise<void>;
	bulkMarkUnread: (ids: INotification['id'][]) => Promise<void>;
	bulkDismiss: (ids: INotification['id'][]) => Promise<void>;
	bulkRemove: (ids: INotification['id'][]) => Promise<void>;
}

export const useNotificationsActions = (): IUseNotificationsActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const notificationsStore = storesManager.getStore(notificationsStoreKey);

	// Quiet on success - a toast for every read/unread click on a row the operator is already
	// looking at would be noise. A failure still needs to surface, since the badge would
	// otherwise silently disagree with what the operator just did.
	const markRead = async (id: INotification['id'], read = true): Promise<void> => {
		try {
			await notificationsStore.markRead({ id, read });
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notMarkedRead'));
		}
	};

	const markAllRead = async (ids: INotification['id'][]): Promise<boolean> => {
		if (ids.length === 0) {
			return true;
		}

		try {
			const result = await notificationsStore.bulkUpdate({ ids, read: true });

			// The request can come back 200 OK while individual rows in the batch were refused -
			// that partial failure must not be silently swallowed, or "Mark all as read" can leave
			// rows unread with nothing telling the operator it did not fully apply.
			if (result.failed.length > 0) {
				flashMessage.error(t('notificationsModule.messages.notifications.notAllMarkedRead'));

				return false;
			}

			return true;
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notMarkedRead'));

			return false;
		}
	};

	// Confirmation and the request itself are kept in separate `try` blocks: a cancelled
	// confirmation must not be reported as a failed dismissal, and a failed request must not be
	// reported as a cancellation.
	const dismiss = async (id: INotification['id'], dismissed = true): Promise<void> => {
		const notification = notificationsStore.findById(id);

		if (notification === null) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('notificationsModule.texts.notifications.confirmDismiss', { title: notification.title }),
				t('notificationsModule.headings.notifications.dismiss'),
				{
					confirmButtonText: t('notificationsModule.buttons.yes.title'),
					cancelButtonText: t('notificationsModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			flashMessage.info(t('notificationsModule.messages.notifications.dismissCanceled'));

			return;
		}

		try {
			await notificationsStore.dismiss({ id, dismissed });

			flashMessage.success(t('notificationsModule.messages.notifications.dismissed'));
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notDismissed'));
		}
	};

	// Same confirm/request split as `dismiss`, for the single-notification delete in the detail
	// drawer.
	const remove = async (id: INotification['id']): Promise<void> => {
		const notification = notificationsStore.findById(id);

		if (notification === null) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('notificationsModule.texts.notifications.confirmRemove', { title: notification.title }),
				t('notificationsModule.headings.notifications.remove'),
				{
					confirmButtonText: t('notificationsModule.buttons.yes.title'),
					cancelButtonText: t('notificationsModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			flashMessage.info(t('notificationsModule.messages.notifications.removeCanceled'));

			return;
		}

		try {
			await notificationsStore.remove({ id });

			flashMessage.success(t('notificationsModule.messages.notifications.removed'));
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notRemoved'));
		}
	};

	// Bulk toolbar actions. Only the destructive one (`bulkRemove`, below) confirms - a selection
	// is already a deliberate act, and mark read/unread/dismiss are all easily reversible.
	const bulkMarkUnread = async (ids: INotification['id'][]): Promise<void> => {
		if (ids.length === 0) {
			return;
		}

		try {
			await notificationsStore.bulkUpdate({ ids, read: false });
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notMarkedRead'));
		}
	};

	const bulkDismiss = async (ids: INotification['id'][]): Promise<void> => {
		if (ids.length === 0) {
			return;
		}

		try {
			await notificationsStore.bulkUpdate({ ids, dismissed: true });

			flashMessage.success(t('notificationsModule.messages.notifications.dismissed'));
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notDismissed'));
		}
	};

	const bulkRemove = async (ids: INotification['id'][]): Promise<void> => {
		if (ids.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('notificationsModule.texts.notifications.confirmBulkRemove', { count: ids.length }),
				t('notificationsModule.headings.notifications.bulkRemove'),
				{
					confirmButtonText: t('notificationsModule.buttons.yes.title'),
					cancelButtonText: t('notificationsModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			flashMessage.info(t('notificationsModule.messages.notifications.removeCanceled'));

			return;
		}

		// One request for the whole selection - see `devices.store.ts`'s `bulkRemove` for why
		// (the backend's shared rate limit refuses one request per row past a small selection).
		try {
			const result = await notificationsStore.bulkRemove({ ids });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('notificationsModule.messages.notifications.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('notificationsModule.messages.notifications.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.bulkRemoveFailed', { count: ids.length }));
		}
	};

	return {
		markRead,
		markAllRead,
		dismiss,
		remove,
		bulkMarkUnread,
		bulkDismiss,
		bulkRemove,
	};
};
