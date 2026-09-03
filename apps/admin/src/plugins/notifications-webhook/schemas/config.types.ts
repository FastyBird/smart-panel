import type { z } from 'zod';

import type { WebhookConfigEditFormSchema } from './config.schemas';

export type IWebhookConfigEditForm = z.infer<typeof WebhookConfigEditFormSchema>;
