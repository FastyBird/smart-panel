import { z } from 'zod';

import { ChannelAddFormSchema, ChannelEditFormSchema } from '../../../modules/devices';

export const HomeAssistantChannelAddFormSchema = ChannelAddFormSchema.extend({
	haEntityId: z.string(),
});

export const HomeAssistantChannelEditFormSchema = ChannelEditFormSchema.extend({
	haEntityId: z.string().optional(),
});
