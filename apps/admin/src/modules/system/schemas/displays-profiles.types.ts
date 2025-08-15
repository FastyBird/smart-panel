import { z } from 'zod';

import { DisplayProfileEditFormSchema } from './displays-profiles.schemas';

export type IDisplayProfileEditForm = z.infer<typeof DisplayProfileEditFormSchema>;
