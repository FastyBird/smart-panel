import { z } from 'zod';

import { ProtectConfigEditFormSchema } from './config.schemas';

export type IProtectConfigEditForm = z.infer<typeof ProtectConfigEditFormSchema>;
