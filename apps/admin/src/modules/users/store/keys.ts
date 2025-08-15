import type { StoreInjectionKey } from '../../../common';

import type { IDisplaysInstancesStoreActions, IDisplaysInstancesStoreState } from './displays-instances.store.types';
import type { IUsersStoreActions, IUsersStoreState } from './users.store.types';

export const usersStoreKey: StoreInjectionKey<string, IUsersStoreState, object, IUsersStoreActions> = Symbol('FB-Module-Users-UsersStore');

export const displaysInstancesStoreKey: StoreInjectionKey<string, IDisplaysInstancesStoreState, object, IDisplaysInstancesStoreActions> = Symbol(
	'FB-Module-Users-DisplaysInstancesStore'
);
