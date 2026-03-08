import { z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME } from '../buddy-stt-whisper-local.constants';

export const SttWhisperLocalConfigSchema = ConfigPluginSchema.extend({
	model: z.string().trim().nullable(),
	language: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const SttWhisperLocalConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME),
		model: z.string().trim().nullable().optional(),
		language: z.string().trim().nullable().optional(),
	})
);

export const SttWhisperLocalConfigResSchema= ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME),
		model: z.string().trim().nullable(),
		language: z.string().trim().nullable(),
	})
);
