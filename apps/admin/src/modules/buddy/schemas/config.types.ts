import { z } from 'zod';

import { BuddyConfigEditFormSchema } from './config.schemas';

export type IBuddyConfigEditForm = z.infer<typeof BuddyConfigEditFormSchema>;
