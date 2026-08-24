import { z } from 'zod';

import { HomeyConfigEditFormSchema } from './config.schemas';

export type IHomeyConfigEditForm = z.infer<typeof HomeyConfigEditFormSchema>;
