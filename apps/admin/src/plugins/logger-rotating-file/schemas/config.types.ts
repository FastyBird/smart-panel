import { z } from 'zod';

import type { RotatingFileConfigEditFormSchema } from './config.schemas';

export type IRotatingFileConfigEditForm = z.infer<typeof RotatingFileConfigEditFormSchema>;
