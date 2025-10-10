import type { StoreInjectionKey } from '../services/types';

import type { IListQueryStoreActions, IListQueryStoreState } from './list.query.store.types';

export const listQueryStoreKey: StoreInjectionKey<string, IListQueryStoreState, object, IListQueryStoreActions> = Symbol('FB-Common-ListQueryStore');
