import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_OPENAI_PLUGIN_NAME } from '../buddy-openai.constants';

export const OpenAiConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const OpenAiConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const OpenAiConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
	})
);
