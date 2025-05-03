import { z } from 'zod';

import { ChannelAddFormSchema, ChannelEditFormSchema } from '../../../modules/devices';

export const HomeAssistantChannelAddFormSchema = ChannelAddFormSchema.extend({
	haChannelId: z.string(),
});

export const HomeAssistantChannelEditFormSchema = ChannelEditFormSchema.extend({
	haChannelId: z.string().optional(),
});
