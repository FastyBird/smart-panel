import type { ComputedRef } from 'vue';

import type { IPluginElement } from '../../../common';
import type { IRemoteAccessProviderPluginsComponents } from '../remote-access.types';
import type {
	IRemoteAccessAdvisory,
	IRemoteAccessEndpoint,
	IRemoteAccessProvider,
	IRemoteAccessStatus,
} from '../store/remote-access-status.store.types';

export interface IUseRemoteAccessStatus {
	status: ComputedRef<IRemoteAccessStatus | null>;
	enabled: ComputedRef<boolean>;
	advisories: ComputedRef<IRemoteAccessAdvisory[]>;
	isLoading: ComputedRef<boolean>;
	fetchStatus: () => Promise<void>;
}

export interface IUseRemoteAccessUrls {
	internal: ComputedRef<string | null>;
	candidates: ComputedRef<string[]>;
	external: ComputedRef<IRemoteAccessEndpoint[]>;
	primary: ComputedRef<string | null>;
	isLoading: ComputedRef<boolean>;
	fetchUrls: () => Promise<void>;
}

export interface IUseRemoteAccessProviders {
	providers: ComputedRef<IRemoteAccessProvider[]>;
	isLoading: ComputedRef<boolean>;
	fetchProviders: () => Promise<void>;
	getElement: (type: string) => IPluginElement<IRemoteAccessProviderPluginsComponents> | undefined;
}
