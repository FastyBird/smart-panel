import { z } from 'zod';

import type { InfluxV2ConfigEditFormSchema } from './config.schemas';

export type IInfluxV2ConfigEditForm = z.infer<typeof InfluxV2ConfigEditFormSchema>;
