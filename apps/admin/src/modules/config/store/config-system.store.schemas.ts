import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import { ConfigModuleSystemType } from '../../../openapi.constants';

type ApiConfigSystem = components['schemas']['ConfigModuleDataSystem'];
type ApiConfigUpdateSystem = components['schemas']['ConfigModuleUpdateSystem'];

// STORE STATE
// ===========

export const ConfigSystemSchema = z.object({
	type: z.nativeEnum(ConfigModuleSystemType),
	logLevels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
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
		logLevels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
	}),
});

export const ConfigSystemEditActionPayloadSchema = z.object({
	data: z.object({
		logLevels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
	}),
});

// BACKEND API
// ===========

export const ConfigSystemUpdateReqSchema: ZodType<ApiConfigUpdateSystem> = z.object({
	type: z.nativeEnum(ConfigModuleSystemType),
	log_levels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
});

export const ConfigSystemResSchema: ZodType<ApiConfigSystem> = z.object({
	type: z.nativeEnum(ConfigModuleSystemType),
	log_levels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
});
