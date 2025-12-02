import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

import { ConfigAudioResSchema, ConfigAudioSchema } from './config-audio.store.schemas';
import { ConfigDisplayResSchema, ConfigDisplaySchema } from './config-display.store.schemas';
import { ConfigLanguageResSchema, ConfigLanguageSchema } from './config-language.store.schemas';
import { ConfigPluginResSchema, ConfigPluginSchema } from './config-plugins.store.schemas';
import { ConfigSystemResSchema, ConfigSystemSchema } from './config-system.store.schemas';
import {
	ConfigWeatherCityIdResSchema,
	ConfigWeatherCityNameResSchema,
	ConfigWeatherLatLonResSchema,
	ConfigWeatherSchema,
	ConfigWeatherZipCodeResSchema,
} from './config-weather.store.schemas';

type ApiConfigApp = components['schemas']['ConfigModuleDataApp'];

// STORE STATE
// ===========

export const ConfigAppSchema = z.object({
	path: z.string().nonempty(),
	audio: ConfigAudioSchema,
	display: ConfigDisplaySchema,
	language: ConfigLanguageSchema,
	system: ConfigSystemSchema,
	weather: ConfigWeatherSchema,
	plugins: z.array(ConfigPluginSchema),
});

export const ConfigAppStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigAppOnEventActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		audio: ConfigAudioSchema,
		display: ConfigDisplaySchema,
		language: ConfigLanguageSchema,
		system: ConfigSystemSchema,
		weather: ConfigWeatherSchema,
		plugins: z.array(ConfigPluginSchema),
	}),
});

export const ConfigAppSetActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		audio: ConfigAudioSchema,
		display: ConfigDisplaySchema,
		language: ConfigLanguageSchema,
		system: ConfigSystemSchema,
		weather: ConfigWeatherSchema,
		plugins: z.array(ConfigPluginSchema),
	}),
});

// BACKEND API
// ===========

export const ConfigAppResSchema: ZodType<ApiConfigApp> = z.object({
	path: z.string().nonempty(),
	audio: ConfigAudioResSchema,
	display: ConfigDisplayResSchema,
	language: ConfigLanguageResSchema,
	system: ConfigSystemResSchema,
	weather: z.union([ConfigWeatherLatLonResSchema, ConfigWeatherCityNameResSchema, ConfigWeatherCityIdResSchema, ConfigWeatherZipCodeResSchema]),
	plugins: z.array(ConfigPluginResSchema),
});
