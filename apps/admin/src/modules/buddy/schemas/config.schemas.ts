import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
	sttProvider: z.string().optional().default('none'),
	sttApiKey: z.string().nullable().optional().default(null),
	sttModel: z.string().nullable().optional().default(null),
	sttLanguage: z.string().nullable().optional().default(null),
});
