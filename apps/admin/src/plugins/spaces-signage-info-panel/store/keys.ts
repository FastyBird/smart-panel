import type { StoreInjectionKey } from '../../../common';

import type { IAnnouncementsActions, IAnnouncementsState } from './announcements.store.types';

export const announcementsStoreKey: StoreInjectionKey<string, IAnnouncementsState, object, IAnnouncementsActions> = Symbol(
	'FB-Plugin-SpacesSignageInfoPanelAnnouncementsStore',
);
