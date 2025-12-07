import { type ZodType, z } from 'zod';

import type { ConfigModuleAppSchema } from '../../../openapi.constants';

import { ConfigAudioResSchema, ConfigAudioSchema } from './config-audio.store.schemas';
import { ConfigDisplaySchema } from './config-display.store.schemas';
import { ConfigLanguageResSchema, ConfigLanguageSchema } from './config-language.store.schemas';
import { ConfigModuleResSchema, ConfigModuleSchema } from './config-modules.store.schemas';
import { ConfigPluginResSchema, ConfigPluginSchema } from './config-plugins.store.schemas';
import { ConfigSystemResSchema, ConfigSystemSchema } from './config-system.store.schemas';
import {
	ConfigWeatherCityIdResSchema,
	ConfigWeatherCityNameResSchema,
	ConfigWeatherLatLonResSchema,
	ConfigWeatherSchema,
	ConfigWeatherZipCodeResSchema,
} from './config-weather.store.schemas';

type ApiConfigApp = ConfigModuleAppSchema;

// STORE STATE
// ===========
// Note: Display config is now managed separately via DisplaysModule
// but we keep it in the app state for backward compatibility

export const ConfigAppSchema = z.object({
	path: z.string().nonempty(),
	audio: ConfigAudioSchema,
	display: ConfigDisplaySchema.optional(),
	language: ConfigLanguageSchema,
	system: ConfigSystemSchema,
	weather: ConfigWeatherSchema,
	plugins: z.array(ConfigPluginSchema),
	modules: z.array(ConfigModuleSchema),
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
		display: ConfigDisplaySchema.optional(),
		language: ConfigLanguageSchema,
		system: ConfigSystemSchema,
		weather: ConfigWeatherSchema,
		plugins: z.array(ConfigPluginSchema),
		modules: z.array(ConfigModuleSchema),
	}),
});

export const ConfigAppSetActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		audio: ConfigAudioSchema,
		display: ConfigDisplaySchema.optional(),
		language: ConfigLanguageSchema,
		system: ConfigSystemSchema,
		weather: ConfigWeatherSchema,
		plugins: z.array(ConfigPluginSchema),
		modules: z.array(ConfigModuleSchema),
	}),
});

// BACKEND API
// ===========
// Note: display is no longer part of the backend config response

export const ConfigAppResSchema: ZodType<ApiConfigApp> = z.object({
	path: z.string().nonempty(),
	audio: ConfigAudioResSchema,
	language: ConfigLanguageResSchema,
	system: ConfigSystemResSchema,
	weather: z.union([ConfigWeatherLatLonResSchema, ConfigWeatherCityNameResSchema, ConfigWeatherCityIdResSchema, ConfigWeatherZipCodeResSchema]),
	plugins: z.array(ConfigPluginResSchema),
	modules: z.array(ConfigModuleResSchema),
});
