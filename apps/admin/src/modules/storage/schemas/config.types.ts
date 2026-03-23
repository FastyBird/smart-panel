import { z } from 'zod';

import type { StorageConfigEditFormSchema } from './config.schemas';

export type IStorageConfigEditForm = z.infer<typeof StorageConfigEditFormSchema>;
