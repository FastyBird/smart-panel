import { type ZodType, z } from 'zod';

import type { ConfigModuleModuleSchema, ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;
type ApiConfigModule = ConfigModuleModuleSchema;

// STORE STATE
// ===========

export const BuddyConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(BUDDY_MODULE_NAME),
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
	sttProvider: z.string().optional().default('none'),
	sttApiKey: z.string().nullable().optional().default(null),
	sttModel: z.string().nullable().optional().default(null),
	sttLanguage: z.string().nullable().optional().default(null),
	ttsProvider: z.string().optional().default('none'),
	ttsApiKey: z.string().nullable().optional().default(null),
	ttsVoice: z.string().nullable().optional().default(null),
	ttsSpeed: z.number().optional().default(1.0),
});

// BACKEND API
// ===========

export const BuddyConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		name: z.string().optional(),
		provider: z.string().optional(),
		stt_provider: z.string().optional(),
		stt_api_key: z.string().nullable().optional(),
		stt_model: z.string().nullable().optional(),
		stt_language: z.string().nullable().optional(),
		tts_provider: z.string().optional(),
		tts_api_key: z.string().nullable().optional(),
		tts_voice: z.string().nullable().optional(),
		tts_speed: z.number().optional(),
	})
);

export const BuddyConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		name: z.string().optional(),
		provider: z.string().optional(),
		stt_provider: z.string().optional(),
		stt_api_key: z.string().nullable().optional(),
		stt_model: z.string().nullable().optional(),
		stt_language: z.string().nullable().optional(),
		tts_provider: z.string().optional(),
		tts_api_key: z.string().nullable().optional(),
		tts_voice: z.string().nullable().optional(),
		tts_speed: z.number().optional(),
	})
);
