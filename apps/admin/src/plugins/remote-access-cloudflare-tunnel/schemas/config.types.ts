import type { z } from 'zod';

import type { CloudflareTunnelConfigEditFormSchema } from './config.schemas';

export type ICloudflareTunnelConfigEditForm = z.infer<typeof CloudflareTunnelConfigEditFormSchema>;
