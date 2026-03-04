import type { z } from 'zod';

import type { ClaudeOauthConfigEditFormSchema } from './config.schemas';

export type IClaudeOauthConfigEditForm = z.infer<typeof ClaudeOauthConfigEditFormSchema>;
