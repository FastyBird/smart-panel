import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { notificationsStoreKey } from '../store/keys';
import type { INotification } from '../store/notifications.store.schemas';

// What a bulk (or otherwise confirmable) action actually did, so a caller can decide whether its
// list needs to refresh:
// - `cancelled` - the user backed out of the confirmation, or there was nothing to act on; the
//   store was never called.
// - `failed` - the store was called but nothing succeeded (a thrown error, or every id came back
//   in `result.failed`).
// - `mutated` - at least one row actually changed, even if others in the same batch failed - a
//   partial success still needs the list to catch up with what no longer matches its filter.
export type NotificationsBulkActionOutcome = 'cancelled' | 'failed' | 'mutated';

export interface IUseNotificationsActions {
	markRead: (id: INotification['id'], read?: boolean) => Promise<void>;
	// Boolean projection of the same outcome as the bulk actions below (`false` covers both
	// `failed` and the empty-selection no-op, since this action never confirms and so never
	// cancels) - `true` whenever at least one id actually mutated, even if others in the same
	// batch failed. `bulkUpdate` can resolve (HTTP-level success) while still carrying per-row
	// failures in `result.failed`; those are still flashed, but a partial success is still a
	// mutation the caller needs to know about.
	markAllRead: (ids: INotification['id'][]) => Promise<boolean>;
	dismiss: (id: INotification['id'], dismissed?: boolean) => Promise<void>;
	remove: (id: INotification['id']) => Promise<void>;
	bulkMarkUnread: (ids: INotification['id'][]) => Promise<NotificationsBulkActionOutcome>;
	bulkDismiss: (ids: INotification['id'][]) => Promise<NotificationsBulkActionOutcome>;
	bulkRemove: (ids: INotification['id'][]) => Promise<NotificationsBulkActionOutcome>;
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
			return false;
		}

		try {
			const result = await notificationsStore.bulkUpdate({ ids, read: true });

			// The request can come back 200 OK while individual rows in the batch were refused -
			// that partial failure must not be silently swallowed, or "Mark all as read" can leave
			// rows unread with nothing telling the operator it did not fully apply. The rows that
			// did succeed still mutated the list, though, so that is still reported as `true`.
			if (result.failed.length > 0) {
				flashMessage.error(t('notificationsModule.messages.notifications.notAllMarkedRead'));
			}

			return result.succeeded.length > 0;
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
	const bulkMarkUnread = async (ids: INotification['id'][]): Promise<NotificationsBulkActionOutcome> => {
		if (ids.length === 0) {
			return 'cancelled';
		}

		try {
			const result = await notificationsStore.bulkUpdate({ ids, read: false });

			// Same partial-failure handling as `markAllRead` - a 200 response can still carry
			// per-row failures in `result.failed`, and those must not be silently ignored.
			if (result.failed.length > 0) {
				flashMessage.error(t('notificationsModule.messages.notifications.notAllMarkedUnread'));
			}

			return result.succeeded.length > 0 ? 'mutated' : 'failed';
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notMarkedRead'));

			return 'failed';
		}
	};

	const bulkDismiss = async (ids: INotification['id'][]): Promise<NotificationsBulkActionOutcome> => {
		if (ids.length === 0) {
			return 'cancelled';
		}

		try {
			const result = await notificationsStore.bulkUpdate({ ids, dismissed: true });

			// Success is reported only for the rows that actually succeeded - a 200 response whose
			// `result.failed` covers the whole batch must not still claim it worked.
			if (result.succeeded.length > 0) {
				flashMessage.success(t('notificationsModule.messages.notifications.dismissed'));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('notificationsModule.messages.notifications.notAllDismissed'));
			}

			return result.succeeded.length > 0 ? 'mutated' : 'failed';
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notDismissed'));

			return 'failed';
		}
	};

	const bulkRemove = async (ids: INotification['id'][]): Promise<NotificationsBulkActionOutcome> => {
		if (ids.length === 0) {
			return 'cancelled';
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

			return 'cancelled';
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

			return result.succeeded.length > 0 ? 'mutated' : 'failed';
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.bulkRemoveFailed', { count: ids.length }));

			return 'failed';
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
