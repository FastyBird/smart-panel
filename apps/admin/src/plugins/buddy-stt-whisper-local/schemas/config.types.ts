import type { z } from 'zod';

import type { SttWhisperLocalConfigEditFormSchema } from './config.schemas';

export type ISttWhisperLocalConfigEditForm = z.infer<typeof SttWhisperLocalConfigEditFormSchema>;
