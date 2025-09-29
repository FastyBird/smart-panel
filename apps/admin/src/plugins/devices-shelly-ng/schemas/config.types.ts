import { z } from 'zod';

import type { ShellyNgConfigEditFormSchema } from './config.schemas';

export type IShellyNgConfigEditForm = z.infer<typeof ShellyNgConfigEditFormSchema>;
