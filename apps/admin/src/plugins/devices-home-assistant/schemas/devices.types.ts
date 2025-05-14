import { z } from 'zod';

import { HomeAssistantDeviceAddFormSchema, HomeAssistantDeviceEditFormSchema } from './devices.schemas';

export type IHomeAssistantDeviceAddForm = z.infer<typeof HomeAssistantDeviceAddFormSchema>;

export type IHomeAssistantDeviceEditForm = z.infer<typeof HomeAssistantDeviceEditFormSchema>;
