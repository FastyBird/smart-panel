import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IModule, IModuleElement, IPlugin, IPluginElement } from '../../../common';
import {
	ConfigModuleLanguageLanguage,
	ConfigModuleLanguageTimeFormat,
	ConfigModuleWeatherCityIdLocationType,
	ConfigModuleWeatherCityNameLocationType,
	ConfigModuleWeatherLatLonLocationType,
	ConfigModuleWeatherZipCodeLocationType,
} from '../../../openapi.constants';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import type { ConfigModuleWeatherUnit } from '../../../openapi.constants';
import type { FormResultType } from '../config.constants';
import type { IModulesComponents, IModulesSchemas, IPluginsComponents, IPluginsSchemas } from '../config.types';
import type { IConfigModuleEditForm } from '../schemas/modules.types';
import type { IConfigPluginEditForm } from '../schemas/plugins.types';
import type { IConfigApp } from '../store/config-app.store.types';
import type { IConfigLanguage } from '../store/config-language.store.types';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import type { IConfigModule } from '../store/config-modules.store.types';
import type { IConfigSystem } from '../store/config-system.store.types';
import type { IConfigWeather } from '../store/config-weather.store.types';

export interface IConfigLanguageEditForm {
	language: ConfigModuleLanguageLanguage;
	timezone: string;
	timeFormat: ConfigModuleLanguageTimeFormat;
}

export interface IConfigWeatherEditForm {
	longitude: number | null;
	latitude: number | null;
	cityId: number | null;
	cityName: string | null;
	zipCode: string | null;
	locationType:
		| ConfigModuleWeatherLatLonLocationType
		| ConfigModuleWeatherCityNameLocationType
		| ConfigModuleWeatherCityIdLocationType
		| ConfigModuleWeatherZipCodeLocationType;
	unit: ConfigModuleWeatherUnit;
	openWeatherApiKey: string;
}

export interface IConfigSystemEditForm {
	logLevels: SystemModuleLogEntryType[];
}

export interface IUseConfigApp {
	configApp: ComputedRef<IConfigApp | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigApp: () => Promise<void>;
}

export interface IUseConfigLanguage {
	configLanguage: ComputedRef<IConfigLanguage | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigLanguage: () => Promise<void>;
}

export interface IUseConfigLanguageEditForm {
	languageOptions: { value: ConfigModuleLanguageLanguage; label: string }[];
	timezoneOptions: { value: string; label: string }[];
	timeFormatOptions: { value: ConfigModuleLanguageTimeFormat; label: string }[];
	model: IConfigLanguageEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseConfigWeather {
	configWeather: ComputedRef<IConfigWeather | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigWeather: () => Promise<void>;
}

export interface IUseConfigWeatherEditForm {
	locationTypeOptions: {
		value:
			| ConfigModuleWeatherLatLonLocationType
			| ConfigModuleWeatherCityNameLocationType
			| ConfigModuleWeatherCityIdLocationType
			| ConfigModuleWeatherZipCodeLocationType;
		label: string;
	}[];
	unitOptions: { value: ConfigModuleWeatherUnit; label: string }[];
	model: IConfigWeatherEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseConfigSystem {
	configSystem: ComputedRef<IConfigSystem | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigSystem: () => Promise<void>;
}

export interface IUseConfigSystemEditForm {
	logLevelsOptions: { value: SystemModuleLogEntryType; label: string }[];
	model: IConfigSystemEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseConfigPlugin {
	configPlugin: ComputedRef<IConfigPlugin | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigPlugin: () => Promise<void>;
}

export interface IUseConfigPlugins {
	configPlugins: ComputedRef<IConfigPlugin[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	enabled: (type: IConfigPlugin['type']) => boolean;
	fetchConfigPlugins: (force?: boolean) => Promise<void>;
}

export interface IUseConfigPluginEditForm<TForm extends IConfigPluginEditForm = IConfigPluginEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUsePlugin {
	plugin: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>;
	element: ComputedRef<IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined>;
}

export interface IUsePlugins {
	plugins: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<IPluginsComponents, IPluginsSchemas> | undefined;
	getElement: (type: IPlugin['type']) => IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined;
}

export interface IUseConfigModule {
	configModule: ComputedRef<IConfigModule | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigModule: () => Promise<void>;
}

export interface IUseConfigModules {
	configModules: ComputedRef<IConfigModule[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	enabled: (type: IConfigModule['type']) => boolean;
	fetchConfigModules: (force?: boolean) => Promise<void>;
}

export interface IUseConfigModuleEditForm<TForm extends IConfigModuleEditForm = IConfigModuleEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseModule {
	module: ComputedRef<IModule<IModulesComponents, IModulesSchemas> | undefined>;
	element: ComputedRef<IModuleElement<IModulesComponents, IModulesSchemas> | undefined>;
}

export interface IUseModules {
	modules: ComputedRef<IModule<IModulesComponents, IModulesSchemas>[]>;
	options: ComputedRef<{ value: IModule['type']; label: IModule['name'] }[]>;
	getByName: (type: IModule['type']) => IModule<IModulesComponents, IModulesSchemas> | undefined;
	getElement: (type: IModule['type']) => IModuleElement<IModulesComponents, IModulesSchemas> | undefined;
}
