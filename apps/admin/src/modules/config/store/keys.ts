import type { StoreInjectionKey } from '../../../common';

import type { IConfigAppStoreActions, IConfigAppStoreState } from './config-app.store.types';
// Language, weather, and system store types removed - these configs are now accessed via modules
import type { IConfigModulesStoreActions, IConfigModulesStoreState } from './config-modules.store.types';
import type { IConfigPluginsStoreActions, IConfigPluginsStoreState } from './config-plugins.store.types';

export const configAppStoreKey: StoreInjectionKey<string, IConfigAppStoreState, object, IConfigAppStoreActions> =
	Symbol('FB-Module-Config-ConfigApp');

// Language, weather, and system store keys removed - these configs are now accessed via modules

export const configPluginsStoreKey: StoreInjectionKey<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions> =
	Symbol('FB-Module-Config-ConfigPlugins');

export const configModulesStoreKey: StoreInjectionKey<string, IConfigModulesStoreState, object, IConfigModulesStoreActions> =
	Symbol('FB-Module-Config-ConfigModules');
