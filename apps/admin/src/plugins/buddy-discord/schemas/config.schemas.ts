import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const DiscordConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	botToken: z.string().nullable(),
	guildId: z.string().nullable(),
	generalChannelId: z.string().nullable(),
	spaceChannelMappings: z.string().nullable(),
	allowedRoleId: z.string().nullable(),
});
