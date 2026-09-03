import type { StoreInjectionKey } from '../../../common';

import type { ITailscaleStatusStoreActions, ITailscaleStatusStoreState } from './tailscale-status.store.types';

export const tailscaleStatusStoreKey: StoreInjectionKey<string, ITailscaleStatusStoreState, object, ITailscaleStatusStoreActions> = Symbol(
	'FB-Plugin-RemoteAccessTailscale-Store-Status'
);
