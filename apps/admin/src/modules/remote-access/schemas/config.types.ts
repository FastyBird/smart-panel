import { z } from 'zod';

import { RemoteAccessConfigEditFormSchema } from './config.schemas';

export type IRemoteAccessConfigEditForm = z.infer<typeof RemoteAccessConfigEditFormSchema>;
