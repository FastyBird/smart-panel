import type { z } from 'zod';

import type { DiscordConfigEditFormSchema } from './config.schemas';

export type IDiscordConfigEditForm = z.infer<typeof DiscordConfigEditFormSchema>;
