import { z } from 'zod';

import { HomeAssistantChannelAddFormSchema, HomeAssistantChannelEditFormSchema } from './channels.schemas';

export type IHomeAssistantChannelAddForm = z.infer<typeof HomeAssistantChannelAddFormSchema>;

export type IHomeAssistantChannelEditForm = z.infer<typeof HomeAssistantChannelEditFormSchema>;
