import { z } from 'zod';

import type { HomeAssistantConfigEditFormSchema } from './config.schemas';

export type IHomeAssistantConfigEditForm = z.infer<typeof HomeAssistantConfigEditFormSchema>;
