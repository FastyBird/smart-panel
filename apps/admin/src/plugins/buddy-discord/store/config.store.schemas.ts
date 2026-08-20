import { z } from 'zod';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';

export const DiscordConfigSchema = ConfigPluginSchema.extend({
	// The backend redacts the token on read and answers with botTokenConfigured
	// instead, so the stored config has no botToken at all. It stays declared
	// because the edit form writes a replacement into it before submitting.
	botToken: z.string().trim().nullable().optional(),
	botTokenConfigured: z.boolean().default(false),
	guildId: z.string().trim().nullable().default(null),
	generalChannelId: z.string().trim().nullable().default(null),
	spaceChannelMappings: z.string().trim().nullable().default(null),
	allowedRoleId: z.string().trim().nullable().default(null),
});

// BACKEND API
// ===========

export const DiscordConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_DISCORD_PLUGIN_NAME),
		bot_token: z.string().trim().nullable().optional(),
		guild_id: z.string().trim().nullable().optional(),
		general_channel_id: z.string().trim().nullable().optional(),
		space_channel_mappings: z.string().trim().nullable().optional(),
		allowed_role_id: z.string().trim().nullable().optional(),
	})
);
