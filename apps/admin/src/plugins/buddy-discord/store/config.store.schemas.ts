import { z } from 'zod';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';

export const DiscordConfigSchema = ConfigPluginSchema.extend({
	botToken: z.string().trim().nullable(),
	guildId: z.string().trim().nullable(),
	generalChannelId: z.string().trim().nullable(),
	spaceChannelMappings: z.string().trim().nullable(),
	allowedRoleId: z.string().trim().nullable(),
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
