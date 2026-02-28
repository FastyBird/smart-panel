import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const BuddyConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(BUDDY_MODULE_NAME),
	provider: z.enum(['claude', 'openai', 'ollama', 'none']).optional().default('none'),
	apiKey: z.string().nullable().optional(),
	model: z.string().nullable().optional(),
	ollamaUrl: z.string().nullable().optional(),
});

// BACKEND API
// ===========

export const BuddyConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		provider: z.enum(['claude', 'openai', 'ollama', 'none']).optional(),
		api_key: z.string().nullable().optional(),
		model: z.string().nullable().optional(),
		ollama_url: z.string().nullable().optional(),
	})
);

export const BuddyConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		provider: z.enum(['claude', 'openai', 'ollama', 'none']).optional(),
		api_key: z.string().nullable().optional(),
		model: z.string().nullable().optional(),
		ollama_url: z.string().nullable().optional(),
	})
);
