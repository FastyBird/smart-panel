export * from './keys';

// The raw Pinia hook (`useNotifications`) is deliberately left out here - the composable of the
// same name in `composables/useNotifications.ts` is the module's public read surface, exactly as
// `useDevices` is split between the devices store and its composable.
export { registerNotificationsStore } from './notifications.store';
export type {
	INotificationsBulkRemoveActionPayload,
	INotificationsBulkUpdateActionPayload,
	INotificationsDismissActionPayload,
	INotificationsFetchActionPayload,
	INotificationsGetActionPayload,
	INotificationsMarkReadActionPayload,
	INotificationsOnEventActionPayload,
	INotificationsRemoveActionPayload,
	INotificationsSetActionPayload,
	INotificationsStoreActions,
	INotificationsStoreState,
	INotificationsUnsetActionPayload,
	NotificationsStoreSetup,
} from './notifications.store';

export * from './notifications.store.schemas';
