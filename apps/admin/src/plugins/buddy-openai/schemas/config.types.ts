import type { z } from 'zod';

import type { OpenAiConfigEditFormSchema } from './config.schemas';

export type IOpenAiConfigEditForm = z.infer<typeof OpenAiConfigEditFormSchema>;
