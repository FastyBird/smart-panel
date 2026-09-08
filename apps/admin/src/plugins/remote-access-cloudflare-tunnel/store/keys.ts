import type { StoreInjectionKey } from '../../../common';

import type { ICloudflareTunnelStatusStoreActions, ICloudflareTunnelStatusStoreState } from './cloudflare-tunnel-status.store.types';

export const cloudflareTunnelStatusStoreKey: StoreInjectionKey<
	string,
	ICloudflareTunnelStatusStoreState,
	object,
	ICloudflareTunnelStatusStoreActions
> = Symbol('FB-Plugin-RemoteAccessCloudflareTunnel-Store-Status');
