import { type ZodType, z } from 'zod';

import type { ConfigModuleDisplaysSchema, ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';

type ApiConfigModule = ConfigModuleDisplaysSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const DisplaysConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(DISPLAYS_MODULE_NAME),
	deploymentMode: z.nativeEnum(DeploymentMode),
	permitJoinDurationMs: z.number().int().min(1000),
});

// BACKEND API
// ===========

export const DisplaysConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(DISPLAYS_MODULE_NAME),
		deployment_mode: z.nativeEnum(DeploymentMode).optional(),
		permit_join_duration_ms: z.number().int().min(1000).optional(),
	})
);

export const DisplaysConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(DISPLAYS_MODULE_NAME),
		deployment_mode: z.nativeEnum(DeploymentMode),
		permit_join_duration_ms: z.number().int().min(1000),
	})
);
