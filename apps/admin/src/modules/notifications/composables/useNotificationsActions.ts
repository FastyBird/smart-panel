import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { notificationsStoreKey } from '../store/keys';
import type { INotification } from '../store/notifications.store.schemas';

export interface IUseNotificationsActions {
	markRead: (id: INotification['id'], read?: boolean) => Promise<void>;
	markAllRead: (ids: INotification['id'][]) => Promise<void>;
	dismiss: (id: INotification['id'], dismissed?: boolean) => Promise<void>;
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

	const markAllRead = async (ids: INotification['id'][]): Promise<void> => {
		if (ids.length === 0) {
			return;
		}

		try {
			await notificationsStore.bulkUpdate({ ids, read: true });
		} catch {
			flashMessage.error(t('notificationsModule.messages.notifications.notMarkedRead'));
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

	return {
		markRead,
		markAllRead,
		dismiss,
	};
};
