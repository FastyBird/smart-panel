import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_STT_WHISPER_API_PLUGIN_NAME } from '../buddy-stt-whisper-api.constants';

export const SttWhisperApiConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
	language: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const SttWhisperApiConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_STT_WHISPER_API_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
		language: z.string().trim().nullable().optional(),
	})
);

export const SttWhisperApiConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_STT_WHISPER_API_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
		language: z.string().trim().nullable(),
	})
);
