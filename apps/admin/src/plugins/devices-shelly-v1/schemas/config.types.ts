import { z } from 'zod';

import type { ShellyV1ConfigEditFormSchema } from './config.schemas';

export type IShellyV1ConfigEditForm = z.infer<typeof ShellyV1ConfigEditFormSchema>;
