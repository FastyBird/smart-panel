import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	provider: z.enum(['claude', 'openai', 'ollama', 'none']).optional().default('none'),
	apiKey: z.string().nullable().optional(),
	model: z.string().nullable().optional(),
	ollamaUrl: z.string().nullable().optional(),
});
