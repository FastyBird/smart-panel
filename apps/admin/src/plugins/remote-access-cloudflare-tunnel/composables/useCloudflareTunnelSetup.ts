import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { useRemoteAccessSetup } from '../../../modules/remote-access/composables/useRemoteAccessSetup';
import { CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import { cloudflareTunnelStatusStoreKey } from '../store/keys';

import type { IUseCloudflareTunnelSetup } from './types';

export const useCloudflareTunnelSetup = (): IUseCloudflareTunnelSetup => {
	const store = injectStoresManager().getStore(cloudflareTunnelStatusStoreKey);
	const { data, setupProgress, semaphore } = storeToRefs(store);
	const setup = useRemoteAccessSetup(
		store,
		{ data, setupProgress, get: store.get, install: store.install },
		REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		CLOUDFLARE_TUNNEL_SETUP_POLL_INTERVAL_MS
	);

	return {
		...setup,
		isInstalling: computed(() => semaphore.value.installing),
	};
};
