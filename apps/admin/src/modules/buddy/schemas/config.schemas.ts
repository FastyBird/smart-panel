import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	provider: z.string().optional().default('none'),
});
