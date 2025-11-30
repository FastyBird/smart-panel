import { type ZodType, z } from 'zod';

import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTime_format } from '../../../openapi.constants';
import { ConfigModuleDataLanguageType } from '../../../openapi.constants';
import { type components } from '../../../openapi';

type ApiConfigLanguage = components['schemas']['ConfigModuleDataLanguage'];
type ApiConfigUpdateLanguage = components['schemas']['ConfigModuleUpdateLanguage'];

// STORE STATE
// ===========

export const ConfigLanguageSchema = z.object({
	type: z.nativeEnum(ConfigModuleDataLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	timeFormat: z.nativeEnum(ConfigModuleLanguageTime_format),
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
		timeFormat: z.nativeEnum(ConfigModuleLanguageTime_format),
	}),
});

export const ConfigLanguageEditActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigModuleLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigModuleLanguageTime_format),
	}),
});

// BACKEND API
// ===========

export const ConfigLanguageUpdateReqSchema: ZodType<ApiConfigUpdateLanguage> = z.object({
	type: z.nativeEnum(ConfigModuleDataLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigModuleLanguageTime_format),
});

export const ConfigLanguageResSchema: ZodType<ApiConfigLanguage> = z.object({
	type: z.nativeEnum(ConfigModuleDataLanguageType),
	language: z.nativeEnum(ConfigModuleLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigModuleLanguageTime_format),
});
