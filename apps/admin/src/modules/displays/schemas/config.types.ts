import { z } from 'zod';

import { DisplaysConfigEditFormSchema } from './config.schemas';

export type IDisplaysConfigEditForm = z.infer<typeof DisplaysConfigEditFormSchema>;
