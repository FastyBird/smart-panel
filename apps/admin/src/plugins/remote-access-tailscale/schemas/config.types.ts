import { z } from 'zod';

import type { TailscaleConfigEditFormSchema } from './config.schemas';

export type ITailscaleConfigEditForm = z.infer<typeof TailscaleConfigEditFormSchema>;
