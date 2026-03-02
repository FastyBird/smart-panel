import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_CLAUDE_OAUTH_PLUGIN_NAME } from '../buddy-claude-oauth.constants';

export const ClaudeOauthConfigSchema = ConfigPluginSchema.extend({
	accessToken: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const ClaudeOauthConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME),
		access_token: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const ClaudeOauthConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_OAUTH_PLUGIN_NAME),
		access_token: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
	})
);
