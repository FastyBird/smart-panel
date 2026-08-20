import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyOpenaiCodexPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

type ApiConfig = BuddyOpenaiCodexPluginConfigSchema;

export const OpenAiCodexConfigSchema = ConfigPluginSchema.extend({
	clientId: z.string().trim().nullable(),
	// The backend redacts these on read and answers with the matching
	// *Configured booleans instead, so the stored config has none of these
	// values. They stay declared because the edit form writes replacements
	// into them before submitting.
	clientSecret: z.string().trim().nullable().optional(),
	clientSecretConfigured: z.boolean().default(false),
	accessToken: z.string().trim().nullable().optional(),
	accessTokenConfigured: z.boolean().default(false),
	refreshToken: z.string().trim().nullable().optional(),
	refreshTokenConfigured: z.boolean().default(false),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const OpenAiCodexConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_CODEX_PLUGIN_NAME),
		client_id: z.string().trim().nullable().optional(),
		client_secret: z.string().trim().nullable().optional(),
		access_token: z.string().trim().nullable().optional(),
		refresh_token: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const OpenAiCodexConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_OPENAI_CODEX_PLUGIN_NAME),
		client_id: z.string().trim().nullable(),
		client_secret: z.string().trim().nullable().optional(),
		client_secret_configured: z.boolean(),
		access_token: z.string().trim().nullable().optional(),
		access_token_configured: z.boolean(),
		refresh_token: z.string().trim().nullable().optional(),
		refresh_token_configured: z.boolean(),
		model: z.string().trim().nullable(),
	})
);
