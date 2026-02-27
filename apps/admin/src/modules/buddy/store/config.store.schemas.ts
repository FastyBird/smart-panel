import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { BUDDY_MODULE_NAME, LlmProvider } from '../buddy.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

const llmProviderEnum = z.enum([LlmProvider.CLAUDE, LlmProvider.OPENAI, LlmProvider.OLLAMA, LlmProvider.NONE]);

// STORE STATE
// ===========

export const BuddyConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(BUDDY_MODULE_NAME),
	llmProvider: llmProviderEnum.default(LlmProvider.NONE),
	apiKey: z.string().nullable().optional().default(null),
	llmModel: z.string().nullable().optional().default(null),
	ollamaUrl: z.string().nullable().optional().default(null),
});

// BACKEND API
// ===========

export const BuddyConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		llm_provider: llmProviderEnum.optional(),
		api_key: z.string().nullable().optional(),
		llm_model: z.string().nullable().optional(),
		ollama_url: z.string().nullable().optional(),
	})
);

export const BuddyConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		llm_provider: llmProviderEnum.optional(),
		api_key: z.string().nullable().optional(),
		llm_model: z.string().nullable().optional(),
		ollama_url: z.string().nullable().optional(),
	})
);
