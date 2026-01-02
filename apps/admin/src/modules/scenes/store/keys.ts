import type { StoreInjectionKey } from '../../../common';

import type { IScenesActionsStoreActions, IScenesActionsStoreState } from './scenes.actions.store.types';
import type { IScenesStoreActions, IScenesStoreState } from './scenes.store.types';

export const scenesStoreKey: StoreInjectionKey<string, IScenesStoreState, object, IScenesStoreActions> = Symbol('FB-Module-Scenes-ScenesStore');

export const scenesActionsStoreKey: StoreInjectionKey<string, IScenesActionsStoreState, object, IScenesActionsStoreActions> = Symbol(
	'FB-Module-Scenes-ScenesActionsStore'
);
