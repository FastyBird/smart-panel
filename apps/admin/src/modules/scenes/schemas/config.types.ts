import { z } from 'zod';

import { ScenesConfigEditFormSchema } from './config.schemas';

export type IScenesConfigEditForm = z.infer<typeof ScenesConfigEditFormSchema>;
