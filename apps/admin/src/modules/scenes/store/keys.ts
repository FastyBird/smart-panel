import type { StoreInjectionKey } from '../../../common';

import type { IScenesStoreActions, IScenesStoreState } from './scenes.store.types';

export const scenesStoreKey: StoreInjectionKey<string, IScenesStoreState, object, IScenesStoreActions> = Symbol('FB-Module-Scenes-ScenesStore');
