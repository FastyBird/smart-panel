import type { z } from 'zod';

import type { ClaudeSetupTokenConfigEditFormSchema } from './config.schemas';

export type IClaudeSetupTokenConfigEditForm = z.infer<typeof ClaudeSetupTokenConfigEditFormSchema>;
