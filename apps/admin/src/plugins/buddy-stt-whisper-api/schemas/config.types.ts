import type { z } from 'zod';

import type { SttWhisperApiConfigEditFormSchema } from './config.schemas';

export type ISttWhisperApiConfigEditForm = z.infer<typeof SttWhisperApiConfigEditFormSchema>;
