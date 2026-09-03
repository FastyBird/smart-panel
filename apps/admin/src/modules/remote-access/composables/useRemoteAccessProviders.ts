import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { type IPlugin, type IPluginElement, injectPluginsManager, injectStoresManager } from '../../../common';
import { REMOTE_ACCESS_MODULE_NAME, REMOTE_ACCESS_MODULE_PROVIDER_TYPE } from '../remote-access.constants';
import type { IRemoteAccessProviderPluginsComponents } from '../remote-access.types';
import { remoteAccessStatusStoreKey } from '../store/keys';
import type { IRemoteAccessProvider } from '../store/remote-access-status.store.types';

import type { IUseRemoteAccessProviders } from './types';

export const useRemoteAccessProviders = (): IUseRemoteAccessProviders => {
	const storesManager = injectStoresManager();
	const pluginsManager = injectPluginsManager();

	const remoteAccessStatusStore = storesManager.getStore(remoteAccessStatusStoreKey);

	const { data, semaphore } = storeToRefs(remoteAccessStatusStore);

	const providers = computed<IRemoteAccessProvider[]>((): IRemoteAccessProvider[] => data.value?.providers ?? []);

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	const fetchProviders = async (): Promise<void> => {
		await remoteAccessStatusStore.get();
	};

	// Mirrors `useChannelsPlugin.ts`: the owning plugin is found by its own `IPlugin.type` (matching
	// `provider.type` from the status payload), then its `provider` element is found among that
	// plugin's elements, scoped to this module through `modules`.
	const getElement = (type: string): IPluginElement<IRemoteAccessProviderPluginsComponents> | undefined => {
		const plugin = pluginsManager.getPlugins<IPlugin<IRemoteAccessProviderPluginsComponents>>().find((candidate) => candidate.type === type);

		return (plugin?.elements ?? []).find(
			(element) =>
				element.type === REMOTE_ACCESS_MODULE_PROVIDER_TYPE &&
				(typeof element.modules === 'undefined' || element.modules.includes(REMOTE_ACCESS_MODULE_NAME))
		);
	};

	return {
		providers,
		isLoading,
		fetchProviders,
		getElement,
	};
};
