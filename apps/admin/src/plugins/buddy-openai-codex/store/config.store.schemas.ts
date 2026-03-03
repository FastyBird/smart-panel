import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

export const OpenAiCodexConfigSchema = ConfigPluginSchema.extend({
	clientId: z.string().trim().nullable(),
	clientSecret: z.string().trim().nullable(),
	accessToken: z.string().trim().nullable(),
	refreshToken: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const OpenAiCodexConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_CODEX_PLUGIN_NAME),
		client_id: z.string().trim().nullable().optional(),
		client_secret: z.string().trim().nullable().optional(),
		access_token: z.string().trim().nullable().optional(),
		refresh_token: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const OpenAiCodexConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_CODEX_PLUGIN_NAME),
		client_id: z.string().trim().nullable(),
		client_secret: z.string().trim().nullable(),
		access_token: z.string().trim().nullable(),
		refresh_token: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
	})
);
