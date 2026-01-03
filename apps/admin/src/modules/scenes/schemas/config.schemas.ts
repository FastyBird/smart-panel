import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const ScenesConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	executionTimeoutMs: z.number().int().min(1000).max(300000).default(30000),
	maxConcurrentExecutions: z.number().int().min(1).max(100).default(10),
	continueOnActionFailure: z.boolean().default(true),
});
