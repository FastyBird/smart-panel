import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';

// Backend uses 'displays' as the module name (not 'displays-module')
// This must match the backend DISPLAYS_MODULE_NAME constant
const DISPLAYS_CONFIG_MODULE_NAME = 'displays';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const DisplaysConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(DISPLAYS_CONFIG_MODULE_NAME),
	deploymentMode: z.enum(['standalone', 'all-in-one', 'combined']),
	permitJoinDurationMs: z.number().int().min(1000),
});

// BACKEND API
// ===========

export const DisplaysConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(DISPLAYS_CONFIG_MODULE_NAME),
		deployment_mode: z.enum(['standalone', 'all-in-one', 'combined']).optional(),
		permit_join_duration_ms: z.number().int().min(1000).optional(),
	})
);

export const DisplaysConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(DISPLAYS_CONFIG_MODULE_NAME),
		deployment_mode: z.enum(['standalone', 'all-in-one', 'combined']),
		permit_join_duration_ms: z.number().int().min(1000),
	})
);
