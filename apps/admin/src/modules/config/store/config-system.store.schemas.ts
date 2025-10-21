import { type ZodType, z } from 'zod';

import { ConfigModuleSystemLog_levels, ConfigModuleSystemType, type components } from '../../../openapi';

type ApiConfigSystem = components['schemas']['ConfigModuleSystem'];
type ApiConfigUpdateSystem = components['schemas']['ConfigModuleUpdateSystem'];

// STORE STATE
// ===========

export const ConfigSystemSchema = z.object({
	type: z.nativeEnum(ConfigModuleSystemType),
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
	type: z.nativeEnum(ConfigModuleSystemType),
	log_levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
});

export const ConfigSystemResSchema: ZodType<ApiConfigSystem> = z.object({
	type: z.nativeEnum(ConfigModuleSystemType),
	log_levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)),
});
