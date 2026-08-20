import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyClaudeSetupTokenPluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME } from '../buddy-claude-setup-token.constants';

type ApiConfig = BuddyClaudeSetupTokenPluginConfigSchema;

export const ClaudeSetupTokenConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the token on read and answers with
	// accessTokenConfigured instead, so the stored config has no accessToken
	// at all. It stays declared because the edit form writes a replacement
	// into it before submitting.
	accessToken: z.string().trim().nullable().optional(),
	accessTokenConfigured: z.boolean().default(false),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const ClaudeSetupTokenConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME),
		access_token: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const ClaudeSetupTokenConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME),
		access_token: z.string().trim().nullable().optional(),
		access_token_configured: z.boolean(),
		model: z.string().trim().nullable(),
	})
);
