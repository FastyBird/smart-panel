export const NOTIFICATIONS_MODULE_PREFIX = 'notifications';

export const NOTIFICATIONS_MODULE_NAME = 'notifications-module';

export const NOTIFICATIONS_MODULE_API_TAG_NAME = 'Notifications module';

export const NOTIFICATIONS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for reading and managing system notifications - the conditions and events the system wants the administrator to see.';

export enum EventType {
	NOTIFICATION_CREATED = 'NotificationsModule.Notification.Created',
	NOTIFICATION_UPDATED = 'NotificationsModule.Notification.Updated',
	NOTIFICATION_DELETED = 'NotificationsModule.Notification.Deleted',
}

/**
 * An `event` row records something that happened, an `issue` row a condition that
 * holds until its source resolves it.
 */
export enum NotificationKind {
	EVENT = 'event',
	ISSUE = 'issue',
}

export enum NotificationSeverity {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
	CRITICAL = 'critical',
}

/**
 * Ordering of the severities, so channels can compare against their minimum and the
 * admin can sort by urgency.
 */
export const SEVERITY_RANK: Record<NotificationSeverity, number> = {
	[NotificationSeverity.INFO]: 0,
	[NotificationSeverity.WARNING]: 1,
	[NotificationSeverity.ERROR]: 2,
	[NotificationSeverity.CRITICAL]: 3,
};

export enum NotificationActionType {
	LINK = 'link',
	EXTENSION_ACTION = 'extension_action',
	SERVICE = 'service',
}

export const NOTIFICATION_TITLE_MAX_LENGTH = 120;

export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

export const NOTIFICATION_ACTIONS_MAX = 3;

export const NOTIFICATION_DATA_MAX_BYTES = 4096;

export const NOTIFICATION_RATE_LIMIT_PER_MINUTE = 60;

export const NOTIFICATION_RATE_LIMIT_WINDOW_MS = 60_000;

export const NOTIFICATIONS_DEFAULT_PAGE_SIZE = 50;

export const NOTIFICATIONS_MAX_PAGE_SIZE = 200;

/**
 * A bulk request replaces one HTTP round trip per item, so this cap is what stops a
 * single call from turning into unbounded work. Mirrors the devices module's bulk cap.
 */
export const BULK_NOTIFICATIONS_MAX_IDS = 500;

export const DEFAULT_RETENTION_DAYS = 30;

export const RETENTION_DAYS_MIN = 1;

export const RETENTION_DAYS_MAX = 365;

export const DEFAULT_MAX_NOTIFICATIONS = 500;

export const MAX_NOTIFICATIONS_MIN = 50;

export const MAX_NOTIFICATIONS_MAX = 5000;
