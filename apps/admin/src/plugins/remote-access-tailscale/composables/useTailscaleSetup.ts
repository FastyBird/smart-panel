import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { useRemoteAccessSetup } from '../../../modules/remote-access/composables/useRemoteAccessSetup';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, TAILSCALE_SETUP_POLL_INTERVAL_MS } from '../remote-access-tailscale.constants';
import { tailscaleStatusStoreKey } from '../store/keys';

import type { IUseTailscaleSetup } from './types';

export const useTailscaleSetup = (): IUseTailscaleSetup => {
	const store = injectStoresManager().getStore(tailscaleStatusStoreKey);
	const { data, setupProgress, semaphore } = storeToRefs(store);
	const setup = useRemoteAccessSetup(
		store,
		{ data, setupProgress, get: store.get, install: store.install },
		REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
		TAILSCALE_SETUP_POLL_INTERVAL_MS
	);

	return {
		...setup,
		isInstalling: computed(() => semaphore.value.installing),
	};
};
