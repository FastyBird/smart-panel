import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME } from '../buddy-claude-setup-token.constants';

export const ClaudeSetupTokenConfigSchema = ConfigPluginSchema.extend({
	accessToken: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const ClaudeSetupTokenConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME),
		access_token: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const ClaudeSetupTokenConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME),
		access_token: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
	})
);
