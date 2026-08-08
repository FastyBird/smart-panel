import { z } from 'zod';

import type { McpConfigEditFormSchema } from './config.schemas';

export type IMcpConfigEditForm = z.infer<typeof McpConfigEditFormSchema>;
