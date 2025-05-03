import { z } from 'zod';

import { HomeAssistantChannelPropertyAddFormSchema, HomeAssistantChannelPropertyEditFormSchema } from './channels.properties.schemas';

export type IHomeAssistantChannelPropertyAddForm = z.infer<typeof HomeAssistantChannelPropertyAddFormSchema>;

export type IHomeAssistantChannelPropertyEditForm = z.infer<typeof HomeAssistantChannelPropertyEditFormSchema>;
