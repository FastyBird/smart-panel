import { z } from 'zod';

import { SystemConfigEditFormSchema } from './config.schemas';

export type ISystemConfigEditForm = z.infer<typeof SystemConfigEditFormSchema>;
