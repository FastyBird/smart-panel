import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyVoiceaiPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_VOICEAI_PLUGIN_NAME } from '../buddy-voiceai.constants';

type ApiConfig = BuddyVoiceaiPluginConfigSchema;

export const VoiceaiConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the key on read and answers with apiKeyConfigured
	// instead, so the stored config has no apiKey at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	apiKey: z.string().trim().nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
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
		api_key: z.string().trim().nullable().optional(),
		api_key_configured: z.boolean(),
		voice_id: z.string().trim().nullable(),
	})
);
