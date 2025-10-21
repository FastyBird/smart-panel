import type { StoreInjectionKey } from '../../../common';

import type { IConfigAudioStoreActions, IConfigAudioStoreState } from './config-audio.store.types';
import type { IConfigDisplayStoreActions, IConfigDisplayStoreState } from './config-display.store.types';
import type { IConfigLanguageStoreActions, IConfigLanguageStoreState } from './config-language.store.types';
import type { IConfigPluginsStoreActions, IConfigPluginsStoreState } from './config-plugins.store.types';
import type { IConfigSystemStoreActions, IConfigSystemStoreState } from './config-system.store.types';
import type { IConfigWeatherStoreActions, IConfigWeatherStoreState } from './config-weather.store.types';

export const configAudioStoreKey: StoreInjectionKey<string, IConfigAudioStoreState, object, IConfigAudioStoreActions> =
	Symbol('FB-Module-Config-ConfigAudio');

export const configDisplayStoreKey: StoreInjectionKey<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions> =
	Symbol('FB-Module-Config-ConfigDisplay');

export const configLanguageStoreKey: StoreInjectionKey<string, IConfigLanguageStoreState, object, IConfigLanguageStoreActions> =
	Symbol('FB-Module-Config-ConfigLanguage');

export const configWeatherStoreKey: StoreInjectionKey<string, IConfigWeatherStoreState, object, IConfigWeatherStoreActions> =
	Symbol('FB-Module-Config-ConfigWeather');

export const configSystemStoreKey: StoreInjectionKey<string, IConfigSystemStoreState, object, IConfigSystemStoreActions> =
	Symbol('FB-Module-Config-ConfigSystem');

export const configPluginsStoreKey: StoreInjectionKey<string, IConfigPluginsStoreState, object, IConfigPluginsStoreActions> =
	Symbol('FB-Module-Config-ConfigPlugins');
