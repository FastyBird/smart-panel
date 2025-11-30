import { type ZodType, z } from 'zod';

import { ConfigModuleSystemLog_levels } from '../../../openapi.constants';
import { ConfigModuleDataSystemType } from '../../../openapi.constants';
import { type components } from '../../../openapi';

type ApiConfigSystem = components['schemas']['ConfigModuleDataSystem'];
type ApiConfigUpdateSystem = components['schemas']['ConfigModuleUpdateSystem'];

// STORE STATE
// ===========

export const ConfigSystemSchema = z.object({
	type: z.nativeEnum(ConfigModuleDataSystemType),
	logLevels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
});

export const ConfigSystemStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigSystemOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ConfigSystemSetActionPayloadSchema = z.object({
	data: z.object({
		logLevels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
	}),
});

export const ConfigSystemEditActionPayloadSchema = z.object({
	data: z.object({
		logLevels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
	}),
});

// BACKEND API
// ===========

export const ConfigSystemUpdateReqSchema: ZodType<ApiConfigUpdateSystem> = z.object({
	type: z.nativeEnum(ConfigModuleDataSystemType),
	log_levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
});

export const ConfigSystemResSchema: ZodType<ApiConfigSystem> = z.object({
	type: z.nativeEnum(ConfigModuleDataSystemType),
	log_levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
});
