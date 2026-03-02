import type { z } from 'zod';

import type { ClaudeConfigEditFormSchema } from './config.schemas';

export type IClaudeConfigEditForm = z.infer<typeof ClaudeConfigEditFormSchema>;
