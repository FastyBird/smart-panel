import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IPlugin } from '../../../common';
import {
	ConfigModuleLanguageLanguage,
	ConfigModuleLanguageTime_format,
	ConfigModuleWeatherUnit,
	PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type,
} from '../../../openapi';
import type { FormResultType } from '../config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';
import type { IConfigPluginEditForm } from '../schemas/plugins.types';
import type { IConfigAudio } from '../store/config-audio.store.types';
import type { IConfigDisplay } from '../store/config-display.store.types';
import type { IConfigLanguage } from '../store/config-language.store.types';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import type { IConfigWeather } from '../store/config-weather.store.types';

export interface IConfigAudioEditForm {
	speaker: boolean;
	speakerVolume: number;
	microphone: boolean;
	microphoneVolume: number;
}

export interface IConfigDisplayEditForm {
	darkMode: boolean;
	brightness: number;
	screenLockDuration: number;
	screenSaver: boolean;
}

export interface IConfigLanguageEditForm {
	language: ConfigModuleLanguageLanguage;
	timezone: string;
	timeFormat: ConfigModuleLanguageTime_format;
}

export interface IConfigWeatherEditForm {
	location: string;
	locationType: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type;
	unit: ConfigModuleWeatherUnit;
	openWeatherApiKey: string;
}

export interface IUseConfigAudio {
	configAudio: ComputedRef<IConfigAudio | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigAudio: () => Promise<void>;
}

export interface IUseConfigAudioEditForm {
	model: IConfigAudioEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseConfigDisplay {
	configDisplay: ComputedRef<IConfigDisplay | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigDisplay: () => Promise<void>;
}

export interface IUseConfigDisplayEditForm {
	screenLockDurationOptions: { value: number; label: string }[];
	model: IConfigDisplayEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseConfigLanguage {
	configLanguage: ComputedRef<IConfigLanguage | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigLanguage: () => Promise<void>;
}

export interface IUseConfigLanguageEditForm {
	languageOptions: { value: ConfigModuleLanguageLanguage; label: string }[];
	timezoneOptions: { value: string; label: string }[];
	timeFormatOptions: { value: ConfigModuleLanguageTime_format; label: string }[];
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
	locationTypeOptions: { value: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type; label: string }[];
	unitOptions: { value: ConfigModuleWeatherUnit; label: string }[];
	model: IConfigWeatherEditForm;
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
}

export interface IUsePlugins {
	plugins: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IPluginsComponents, IPluginsSchemas> | undefined;
}
