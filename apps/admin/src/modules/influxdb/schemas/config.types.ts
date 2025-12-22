import { z } from 'zod';

import type { InfluxDbConfigEditFormSchema } from './config.schemas';

export type IInfluxDbConfigEditForm = z.infer<typeof InfluxDbConfigEditFormSchema>;
