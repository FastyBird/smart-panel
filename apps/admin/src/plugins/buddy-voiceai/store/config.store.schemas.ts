import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyVoiceaiPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_VOICEAI_PLUGIN_NAME } from '../buddy-voiceai.constants';

type ApiConfig = BuddyVoiceaiPluginConfigSchema;

export const VoiceaiConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	voiceId: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const VoiceaiConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_VOICEAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		voice_id: z.string().trim().nullable().optional(),
	})
);

export const VoiceaiConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_VOICEAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		voice_id: z.string().trim().nullable(),
	})
);
