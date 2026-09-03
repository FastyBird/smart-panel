import type { StoreInjectionKey } from '../../../common';

import type { IRemoteAccessStatusStoreActions, IRemoteAccessStatusStoreState } from './remote-access-status.store.types';

export const remoteAccessStatusStoreKey: StoreInjectionKey<string, IRemoteAccessStatusStoreState, object, IRemoteAccessStatusStoreActions> =
	Symbol('FB-Module-RemoteAccess-Status');
