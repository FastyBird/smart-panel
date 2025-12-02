import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';
import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTimeFormat } from '../../../openapi.constants';
import { ConfigModuleLanguageType } from '../../../openapi.constants';

type ApiConfigLanguage = components['schemas']['ConfigModuleDataLanguage'];
type ApiConfigUpdateLanguage = components['schemas']['ConfigModuleUpdateLanguage'];

// STORE STATE
// ===========

export const ConfigLanguageSchema = z.object({
	type: z.nativeEnum(ConfigModuleLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	timeFormat: z.nativeEnum(ConfigModuleLanguageTimeFormat),
});

export const ConfigLanguageStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigLanguageOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ConfigLanguageSetActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigModuleLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigModuleLanguageTimeFormat),
	}),
});

export const ConfigLanguageEditActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigModuleLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigModuleLanguageTimeFormat),
	}),
});

// BACKEND API
// ===========

export const ConfigLanguageUpdateReqSchema: ZodType<ApiConfigUpdateLanguage> = z.object({
	type: z.nativeEnum(ConfigModuleLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigModuleLanguageTimeFormat),
});

export const ConfigLanguageResSchema: ZodType<ApiConfigLanguage> = z.object({
	type: z.nativeEnum(ConfigModuleLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigModuleLanguageTimeFormat),
});
