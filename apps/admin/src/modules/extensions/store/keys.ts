import type { StoreInjectionKey } from '../../../common';

import type { IDiscoveredExtensionsStoreActions, IDiscoveredExtensionsStoreState } from './discovered-extensions.store.types';
import type { IExtensionsStoreActions, IExtensionsStoreState } from './extensions.store.types';

export const extensionsStoreKey: StoreInjectionKey<
	'extensions_module-extensions',
	IExtensionsStoreState,
	object,
	IExtensionsStoreActions
> = Symbol('FB-Module-Extensions-Store-Extensions');

export const discoveredExtensionsStoreKey: StoreInjectionKey<
	'extensions_module-discovered',
	IDiscoveredExtensionsStoreState,
	object,
	IDiscoveredExtensionsStoreActions
> = Symbol('FB-Module-Extensions-Store-Discovered');
