import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { SCENES_MODULE_NAME } from '../scenes.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const ScenesConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(SCENES_MODULE_NAME),
	executionTimeoutMs: z.number().int().min(1000).max(300000).default(30000),
	maxConcurrentExecutions: z.number().int().min(1).max(100).default(10),
	continueOnActionFailure: z.boolean().default(true),
});

// BACKEND API
// ===========

export const ScenesConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(SCENES_MODULE_NAME),
		execution_timeout_ms: z.number().int().min(1000).max(300000).optional(),
		max_concurrent_executions: z.number().int().min(1).max(100).optional(),
		continue_on_action_failure: z.boolean().optional(),
	})
);

export const ScenesConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(SCENES_MODULE_NAME),
		execution_timeout_ms: z.number().int().min(1000).max(300000),
		max_concurrent_executions: z.number().int().min(1).max(100),
		continue_on_action_failure: z.boolean(),
	})
);
