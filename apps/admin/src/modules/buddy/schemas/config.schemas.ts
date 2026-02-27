import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';
import { LlmProvider } from '../buddy.constants';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	llmProvider: z.enum([LlmProvider.CLAUDE, LlmProvider.OPENAI, LlmProvider.OLLAMA, LlmProvider.NONE]).default(LlmProvider.NONE),
	apiKey: z.string().nullable().optional().default(null),
	llmModel: z.string().nullable().optional().default(null),
	ollamaUrl: z.string().nullable().optional().default(null),
});
