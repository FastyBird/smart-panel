import type { z } from 'zod';

import type { WledConfigEditFormSchema } from './config.schemas';

export type IWledConfigEditForm = z.infer<typeof WledConfigEditFormSchema>;
