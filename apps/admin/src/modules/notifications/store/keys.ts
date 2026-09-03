import type { StoreInjectionKey } from '../../../common';

import type { INotificationsStoreActions, INotificationsStoreState } from './notifications.store';

export const notificationsStoreKey: StoreInjectionKey<string, INotificationsStoreState, object, INotificationsStoreActions> =
	Symbol('FB-Module-Notifications');
