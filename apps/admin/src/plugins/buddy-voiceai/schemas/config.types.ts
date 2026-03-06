import type { z } from 'zod';

import type { VoiceaiConfigEditFormSchema } from './config.schemas';

export type IVoiceaiConfigEditForm = z.infer<typeof VoiceaiConfigEditFormSchema>;
