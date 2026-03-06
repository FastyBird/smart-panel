import type { z } from 'zod';

import type { WhatsappConfigEditFormSchema } from './config.schemas';

export type IWhatsappConfigEditForm = z.infer<typeof WhatsappConfigEditFormSchema>;
