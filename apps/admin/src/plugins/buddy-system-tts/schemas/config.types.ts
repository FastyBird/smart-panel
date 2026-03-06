import type { z } from 'zod';

import type { SystemTtsConfigEditFormSchema } from './config.schemas';

export type ISystemTtsConfigEditForm = z.infer<typeof SystemTtsConfigEditFormSchema>;
