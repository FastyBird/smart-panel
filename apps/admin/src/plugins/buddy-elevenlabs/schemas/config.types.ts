import type { z } from 'zod';

import type { ElevenlabsConfigEditFormSchema } from './config.schemas';

export type IElevenlabsConfigEditForm = z.infer<typeof ElevenlabsConfigEditFormSchema>;
