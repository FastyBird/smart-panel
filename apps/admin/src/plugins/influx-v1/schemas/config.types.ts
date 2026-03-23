import { z } from 'zod';

import type { InfluxV1ConfigEditFormSchema } from './config.schemas';

export type IInfluxV1ConfigEditForm = z.infer<typeof InfluxV1ConfigEditFormSchema>;
