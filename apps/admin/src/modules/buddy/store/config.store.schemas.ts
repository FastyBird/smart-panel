import { type ZodType, z } from 'zod';

import type { ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const BuddyConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(BUDDY_MODULE_NAME),
	provider: z.string().optional().default('none'),
	sttProvider: z.string().optional().default('none'),
	sttApiKey: z.string().nullable().optional().default(null),
	sttModel: z.string().nullable().optional().default(null),
	sttLanguage: z.string().nullable().optional().default(null),
});

// BACKEND API
// ===========

export const BuddyConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		provider: z.string().optional(),
		stt_provider: z.string().optional(),
		stt_api_key: z.string().nullable().optional(),
		stt_model: z.string().nullable().optional(),
		stt_language: z.string().nullable().optional(),
	})
);

