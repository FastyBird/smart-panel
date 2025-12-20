import type { StoreInjectionKey } from '../../../common';

import type { IDiscoveredExtensionsStoreActions, IDiscoveredExtensionsStoreState } from './discovered-extensions.store.types';
import type { IExtensionsStoreActions, IExtensionsStoreState } from './extensions.store.types';
import type { IServicesStoreActions, IServicesStoreState } from './services.store.types';

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

export const servicesStoreKey: StoreInjectionKey<
	'extensions_module-services',
	IServicesStoreState,
	object,
	IServicesStoreActions
> = Symbol('FB-Module-Extensions-Store-Services');
