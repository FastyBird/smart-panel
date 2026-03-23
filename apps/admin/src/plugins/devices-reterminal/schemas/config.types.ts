import type { z } from 'zod';

import type { ReTerminalConfigEditFormSchema } from './config.schemas';

export type IReTerminalConfigEditForm = z.infer<typeof ReTerminalConfigEditFormSchema>;
