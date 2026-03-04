import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
});
