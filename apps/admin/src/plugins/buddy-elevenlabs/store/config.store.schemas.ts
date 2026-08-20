import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyElevenlabsPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';

type ApiConfig = BuddyElevenlabsPluginConfigSchema;

export const ElevenlabsConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the key on read and answers with apiKeyConfigured
	// instead, so the stored config has no apiKey at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	apiKey: z.string().trim().nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
	voiceId: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const ElevenlabsConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_ELEVENLABS_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		voice_id: z.string().trim().nullable().optional(),
	})
);

export const ElevenlabsConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_ELEVENLABS_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		api_key_configured: z.boolean(),
		voice_id: z.string().trim().nullable(),
	})
);
