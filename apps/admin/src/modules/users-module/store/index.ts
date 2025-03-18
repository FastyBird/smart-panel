import type { StoreInjectionKey } from '../../../common';

import type { IUsersStoreActions, IUsersStoreState } from './users.store.types';

export { registerUsersStore } from './users.store';
export * from './users.store.types';

export const usersStoreKey: StoreInjectionKey<string, IUsersStoreState, object, IUsersStoreActions> = Symbol('FB-UsersModuleUsersStore');

export * from './users.transformers';
