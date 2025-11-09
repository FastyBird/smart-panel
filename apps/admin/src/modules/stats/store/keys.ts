import type { StoreInjectionKey } from '../../../common';

import type { IStatsStoreActions, IStatsStoreState } from './stats.store.types';

export const statsStoreKey: StoreInjectionKey<string, IStatsStoreState, object, IStatsStoreActions> = Symbol('FB-Module-Stats-Stats');
