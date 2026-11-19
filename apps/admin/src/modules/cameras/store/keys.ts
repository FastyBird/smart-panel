import type { StoreInjectionKey } from '../../../common';

import type { ICamerasStoreActions, ICamerasStoreState } from './cameras.store.types';
import type { IRelayStatusStoreActions, IRelayStatusStoreState } from './relay-status.store.types';

export const camerasStoreKey: StoreInjectionKey<string, ICamerasStoreState, object, ICamerasStoreActions> = Symbol('FB-Module-Cameras-Cameras');

export const relayStatusStoreKey: StoreInjectionKey<string, IRelayStatusStoreState, object, IRelayStatusStoreActions> =
	Symbol('FB-Module-Cameras-RelayStatus');
