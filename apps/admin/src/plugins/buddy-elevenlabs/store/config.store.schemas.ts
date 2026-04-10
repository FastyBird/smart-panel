import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyElevenlabsPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';

type ApiConfig = BuddyElevenlabsPluginConfigSchema;

export const ElevenlabsConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
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
		api_key: z.string().trim().nullable(),
		voice_id: z.string().trim().nullable(),
	})
);
