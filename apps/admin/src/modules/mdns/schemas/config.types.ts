import { z } from 'zod';

import type { MdnsConfigEditFormSchema } from './config.schemas';

export type IMdnsConfigEditForm = z.infer<typeof MdnsConfigEditFormSchema>;
