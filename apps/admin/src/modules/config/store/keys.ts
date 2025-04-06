import type { StoreInjectionKey } from '../../../common';

import type { IConfigAudioStoreActions, IConfigAudioStoreState } from './config-audio.store.types';
import type { IConfigDisplayStoreActions, IConfigDisplayStoreState } from './config-display.store.types';
import type { IConfigLanguageStoreActions, IConfigLanguageStoreState } from './config-language.store.types';
import type { IConfigWeatherStoreActions, IConfigWeatherStoreState } from './config-weather.store.types';

export const configAudioStoreKey: StoreInjectionKey<string, IConfigAudioStoreState, object, IConfigAudioStoreActions> =
	Symbol('FB-ConfigModuleConfigAudio');

export const configDisplayStoreKey: StoreInjectionKey<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions> =
	Symbol('FB-ConfigModuleConfigDisplay');

export const configLanguageStoreKey: StoreInjectionKey<string, IConfigLanguageStoreState, object, IConfigLanguageStoreActions> =
	Symbol('FB-ConfigModuleConfigLanguage');

export const configWeatherStoreKey: StoreInjectionKey<string, IConfigWeatherStoreState, object, IConfigWeatherStoreActions> =
	Symbol('FB-ConfigModuleConfigWeather');
