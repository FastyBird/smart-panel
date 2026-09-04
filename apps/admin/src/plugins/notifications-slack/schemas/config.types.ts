import type { z } from 'zod';

import type { SlackConfigEditFormSchema } from './config.schemas';

export type ISlackConfigEditForm = z.infer<typeof SlackConfigEditFormSchema>;
