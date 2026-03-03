import type { z } from 'zod';

import type { OllamaConfigEditFormSchema } from './config.schemas';

export type IOllamaConfigEditForm = z.infer<typeof OllamaConfigEditFormSchema>;
