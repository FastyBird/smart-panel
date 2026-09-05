import type { z } from 'zod';

import type { HomeKitConfigEditFormSchema } from './config.schemas';

export type IHomeKitConfigEditForm = z.infer<typeof HomeKitConfigEditFormSchema>;
