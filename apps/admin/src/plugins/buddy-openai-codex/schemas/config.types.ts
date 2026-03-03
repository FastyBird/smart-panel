import type { z } from 'zod';

import type { OpenAiCodexConfigEditFormSchema } from './config.schemas';

export type IOpenAiCodexConfigEditForm = z.infer<typeof OpenAiCodexConfigEditFormSchema>;
