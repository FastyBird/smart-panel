import type { z } from 'zod';

import type { TelegramConfigEditFormSchema } from './config.schemas';

export type ITelegramConfigEditForm = z.infer<typeof TelegramConfigEditFormSchema>;
