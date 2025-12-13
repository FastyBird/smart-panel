import type { StoreInjectionKey } from '../../../common';

import type { IExtensionsStoreActions, IExtensionsStoreState } from './extensions.store.types';

export const extensionsStoreKey: StoreInjectionKey<
	'extensions_module-extensions',
	IExtensionsStoreState,
	object,
	IExtensionsStoreActions
> = Symbol('FB-Module-Extensions-Store-Extensions');
