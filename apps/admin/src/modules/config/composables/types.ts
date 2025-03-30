import type { ComputedRef, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import {
	ConfigLanguageLanguage,
	ConfigLanguageTime_format,
	ConfigWeatherUnit,
	PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type,
} from '../../../openapi';
import type { FormResultType } from '../config.constants';
import type { IConfigAudio, IConfigDisplay, IConfigLanguage, IConfigWeather } from '../store';

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
	language: ConfigLanguageLanguage;
	timezone: string;
	timeFormat: ConfigLanguageTime_format;
}

export interface IConfigWeatherEditForm {
	location: string;
	locationType: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type;
	unit: ConfigWeatherUnit;
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
	languageOptions: { value: ConfigLanguageLanguage; label: string }[];
	timezoneOptions: { value: string; label: string }[];
	timeFormatOptions: { value: ConfigLanguageTime_format; label: string }[];
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
	unitOptions: { value: ConfigWeatherUnit; label: string }[];
	model: IConfigWeatherEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
