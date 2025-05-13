import { z } from 'zod';

import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from '../../../modules/devices';
import { DEVICE_NO_ENTITY, ENTITY_NO_ATTRIBUTE } from '../devices-home-assistant.constants.ts';

export const HomeAssistantChannelPropertyAddFormSchema = ChannelPropertyAddFormSchema.extend({
	haEntityId: z.string(),
	haAttribute: z.string(),
});

export const HomeAssistantChannelPropertyEditFormSchema = ChannelPropertyEditFormSchema.extend({
	haEntityId: z.string().optional(),
	haAttribute: z.string().optional(),
});
