import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const DisplaysConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	deploymentMode: z.enum(['standalone', 'all-in-one', 'combined']),
	permitJoinDurationMs: z.number().int().min(1000),
});
