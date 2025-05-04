import { z } from 'zod';

import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from '../../../modules/devices';

export const HomeAssistantChannelPropertyAddFormSchema = ChannelPropertyAddFormSchema.extend({
	haAttribute: z.string(),
});

export const HomeAssistantChannelPropertyEditFormSchema = ChannelPropertyEditFormSchema.extend({
	haAttribute: z.string().optional(),
});
