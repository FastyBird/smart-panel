import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyOpenaiPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_OPENAI_PLUGIN_NAME } from '../buddy-openai.constants';

type ApiConfig = BuddyOpenaiPluginConfigSchema;

export const OpenAiConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the key on read and answers with apiKeyConfigured
	// instead, so the stored config has no apiKey at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	apiKey: z.string().trim().nullable().optional(),
	apiKeyConfigured: z.boolean().default(false),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const OpenAiConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const OpenAiConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		api_key_configured: z.boolean(),
		model: z.string().trim().nullable(),
	})
);
