import { type ZodType, z } from 'zod';

import { ConfigLanguageLanguage, ConfigLanguageTime_format, ConfigLanguageType, type components } from '../../../openapi';

type ApiConfigLanguage = components['schemas']['ConfigLanguage'];
type ApiConfigUpdateLanguage = components['schemas']['ConfigUpdateLanguage'];

// STORE STATE
// ===========

export const ConfigLanguageSchema = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	timeFormat: z.nativeEnum(ConfigLanguageTime_format),
});

export const ConfigLanguageStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigLanguageSetActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigLanguageTime_format),
	}),
});

export const ConfigLanguageEditActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigLanguageTime_format),
	}),
});

// BACKEND API
// ===========

export const ConfigLanguageUpdateReqSchema: ZodType<ApiConfigUpdateLanguage> = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigLanguageTime_format),
});

export const ConfigLanguageResSchema: ZodType<ApiConfigLanguage> = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigLanguageTime_format),
});
