import { z } from 'zod';

import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from '../../../modules/devices';

export const HomeAssistantChannelPropertyAddFormSchema = ChannelPropertyAddFormSchema.extend({
	haEntityId: z.string(),
	haAttribute: z.string(),
});

export const HomeAssistantChannelPropertyEditFormSchema = ChannelPropertyEditFormSchema.extend({
	haEntityId: z.string().optional(),
	haAttribute: z.string().optional(),
});
