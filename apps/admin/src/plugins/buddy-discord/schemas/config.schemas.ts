import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const DiscordConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored token" - the backend never sends it back.
	botToken: z.string().nullable().optional(),
	guildId: z.string().nullable(),
	generalChannelId: z.string().nullable(),
	spaceChannelMappings: z.string().nullable(),
	allowedRoleId: z.string().nullable(),
});
