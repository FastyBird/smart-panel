import { type Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElMessageBox } from 'element-plus';

import { useFlashMessage } from '../../../common';
import { NotificationsModuleNotificationActionOperation, NotificationsModuleNotificationActionType } from '../../../openapi.constants';
import { type IExtensionActionDescriptor, useActions } from '../../extensions/composables/useActions';
import { useServiceActions } from '../../extensions/composables/useServiceActions';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

export interface IUseNotificationAction {
	execute: (notification: INotification, action: INotificationAction) => Promise<void>;
	isExecuting: Ref<boolean>;
}

/**
 * Executes one of a notification's three call-to-action types. Executing an action never mutates
 * the notification itself - the source that raised it resolves the issue once it observes the
 * effect (the service reports started, the update installs). A CTA that fails simply leaves the
 * issue in place, which is the truthful state.
 */
export const useNotificationAction = (): IUseNotificationAction => {
	const { t } = useI18n();
	const router = useRouter();
	const flashMessage = useFlashMessage();

	// Created here rather than inside `executeExtensionAction`/`executeService` below, and reused
	// by every `execute()` call. Both composables' first operation needs an active component
	// instance (`useServiceActions`'s is `useI18n()`; `useActions`'s is an `inject()` by way of
	// `useBackend()`) - that is only guaranteed while `useNotificationAction()` itself is being
	// called (synchronously, during the caller's own `setup()`), not later when `execute()` runs
	// from a click handler.
	const { fetchActions, actions, executeAction } = useActions();
	const { startService, stopService, restartService } = useServiceActions();

	const isExecuting = ref<boolean>(false);

	const confirm = async (message: string, title: string): Promise<boolean> => {
		try {
			await ElMessageBox.confirm(message, title, {
				confirmButtonText: t('notificationsModule.buttons.yes.title'),
				cancelButtonText: t('notificationsModule.buttons.no.title'),
				type: 'warning',
			});

			return true;
		} catch {
			// Cancelled - not an error, just nothing further to do.
			return false;
		}
	};

	const executeLink = async (action: INotificationAction): Promise<void> => {
		const url = action.url;

		if (!url) {
			flashMessage.error(t('notificationsModule.messages.actions.invalidLink'));

			return;
		}

		if (/^https?:\/\//i.test(url)) {
			window.open(url, '_blank', 'noopener');

			return;
		}

		if (url.startsWith('/')) {
			await router.push(url);

			return;
		}

		// Any other scheme is refused - `notify()` already rejects these on the way in, but the
		// admin never trusts a payload blindly.
		flashMessage.error(t('notificationsModule.messages.actions.invalidLink'));
	};

	const executeExtensionAction = async (notification: INotification, action: INotificationAction): Promise<void> => {
		if (!action.extensionType || !action.actionId) {
			flashMessage.error(t('notificationsModule.messages.actions.notFound'));

			return;
		}

		let descriptor: IExtensionActionDescriptor | undefined;

		try {
			await fetchActions(action.extensionType);

			descriptor = actions.value.find((candidate) => candidate.id === action.actionId);
		} catch {
			descriptor = undefined;
		}

		// Fails closed: the descriptors could not be fetched, or none of them matches this
		// action's id - either way there is nothing safe to execute.
		if (!descriptor) {
			flashMessage.error(t('notificationsModule.messages.actions.notFound'));

			return;
		}

		if (descriptor.dangerous) {
			const confirmed = await confirm(
				t('notificationsModule.texts.actions.confirmDangerous', { title: notification.title, label: descriptor.label }),
				descriptor.label
			);

			if (!confirmed) {
				return;
			}
		}

		const result = await executeAction(action.extensionType, action.actionId, action.params);

		if (!result.success) {
			flashMessage.error(result.message ?? t('notificationsModule.messages.actions.failed'));
		}
	};

	const executeService = async (notification: INotification, action: INotificationAction): Promise<void> => {
		if (!action.extensionKind || !action.extensionType || !action.serviceId || !action.operation) {
			flashMessage.error(t('notificationsModule.messages.actions.notFound'));

			return;
		}

		const operation = action.operation;

		// Starting a stopped service is the safe default; stopping or restarting an already
		// running one always confirms first.
		if (operation === NotificationsModuleNotificationActionOperation.stop || operation === NotificationsModuleNotificationActionOperation.restart) {
			const confirmed = await confirm(
				t(`notificationsModule.texts.actions.confirm${operation === NotificationsModuleNotificationActionOperation.stop ? 'Stop' : 'Restart'}`, {
					title: notification.title,
				}),
				action.label
			);

			if (!confirmed) {
				return;
			}
		}

		switch (operation) {
			case NotificationsModuleNotificationActionOperation.start:
				await startService(action.extensionKind, action.extensionType, action.serviceId);
				break;
			case NotificationsModuleNotificationActionOperation.stop:
				await stopService(action.extensionKind, action.extensionType, action.serviceId);
				break;
			case NotificationsModuleNotificationActionOperation.restart:
				await restartService(action.extensionKind, action.extensionType, action.serviceId);
				break;
		}
	};

	const execute = async (notification: INotification, action: INotificationAction): Promise<void> => {
		// A second `action`/click firing before the first settles must not repeat an extension
		// action or a service start/stop/restart - ignored outright rather than queued, since
		// nothing about the notification has changed in between.
		if (isExecuting.value) {
			return;
		}

		isExecuting.value = true;

		try {
			switch (action.type) {
				case NotificationsModuleNotificationActionType.link:
					await executeLink(action);
					break;
				case NotificationsModuleNotificationActionType.extension_action:
					await executeExtensionAction(notification, action);
					break;
				case NotificationsModuleNotificationActionType.service:
					await executeService(notification, action);
					break;
				default:
					flashMessage.error(t('notificationsModule.messages.actions.notFound'));
			}
		} finally {
			isExecuting.value = false;
		}
	};

	return {
		execute,
		isExecuting,
	};
};
