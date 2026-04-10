import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyOllamaPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_OLLAMA_PLUGIN_NAME } from '../buddy-ollama.constants';

type ApiConfig = BuddyOllamaPluginConfigSchema;

export const OllamaConfigSchema = ConfigPluginSchema.extend({
	model: z.string().trim().nullable(),
	baseUrl: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const OllamaConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_OLLAMA_PLUGIN_NAME),
		model: z.string().trim().nullable().optional(),
		base_url: z.string().trim().nullable().optional(),
	})
);

export const OllamaConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_OLLAMA_PLUGIN_NAME),
		model: z.string().trim().nullable(),
		base_url: z.string().trim().nullable(),
	})
);
