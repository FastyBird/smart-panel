import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tailscaleStatusStoreKey } from '../store/keys';
import type { ITailscaleSetupProgress } from '../store/tailscale-status.store.types';

import type { IUseTailscaleSetup } from './types';

/**
 * Starts the privileged setup job and exposes its live progress - `progress` is updated by the
 * store's `onEvent()` as `RemoteAccessModule.Setup.Progress` events arrive (wired up once in
 * `remote-access-tailscale.plugin.ts`), not by polling.
 */
export const useTailscaleSetup = (): IUseTailscaleSetup => {
	const storesManager = injectStoresManager();

	const tailscaleStatusStore = storesManager.getStore(tailscaleStatusStoreKey);

	const { setupProgress, semaphore } = storeToRefs(tailscaleStatusStore);

	const progress = computed<ITailscaleSetupProgress | null>((): ITailscaleSetupProgress | null => setupProgress.value);

	const isInstalling = computed<boolean>((): boolean => semaphore.value.installing);

	const install = async (): Promise<string> => {
		const result = await tailscaleStatusStore.install();

		return result.job;
	};

	return {
		progress,
		isInstalling,
		install,
	};
};
