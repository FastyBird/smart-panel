import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type BuddyClaudePluginConfigSchema } from '../../../openapi.constants';
import { BUDDY_CLAUDE_PLUGIN_NAME } from '../buddy-claude.constants';

type ApiConfig = BuddyClaudePluginConfigSchema;

export const ClaudeConfigSchema = ConfigPluginSchema.extend({
	apiKey: z.string().trim().nullable(),
	model: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const ClaudeConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_PLUGIN_NAME),
		api_key: z.string().trim().nullable().optional(),
		model: z.string().trim().nullable().optional(),
	})
);

export const ClaudeConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_CLAUDE_PLUGIN_NAME),
		api_key: z.string().trim().nullable(),
		model: z.string().trim().nullable(),
	})
);
