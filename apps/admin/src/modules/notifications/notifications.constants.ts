import { NotificationsModuleNotificationSeverity } from '../../openapi.constants';

export const NOTIFICATIONS_MODULE_PREFIX = 'notifications';

export const NOTIFICATIONS_MODULE_NAME = 'notifications-module';

export const NOTIFICATIONS_MODULE_EVENT_PREFIX = 'NotificationsModule.';

export enum EventType {
	NOTIFICATION_CREATED = 'NotificationsModule.Notification.Created',
	NOTIFICATION_UPDATED = 'NotificationsModule.Notification.Updated',
	NOTIFICATION_DELETED = 'NotificationsModule.Notification.Deleted',
}

export enum RouteNames {
	NOTIFICATIONS = 'notifications_module-notifications',
}

/**
 * Ordering of the severities, so the bell can pick the loudest active notification and the
 * popover can sort by urgency before recency. Mirrors the backend's own `SEVERITY_RANK`.
 */
export const SEVERITY_RANK: Record<NotificationsModuleNotificationSeverity, number> = {
	[NotificationsModuleNotificationSeverity.info]: 0,
	[NotificationsModuleNotificationSeverity.warning]: 1,
	[NotificationsModuleNotificationSeverity.error]: 2,
	[NotificationsModuleNotificationSeverity.critical]: 3,
};

/**
 * How many active rows the bell popover renders before pointing at the full page.
 */
export const NOTIFICATIONS_POPOVER_LIMIT = 8;
