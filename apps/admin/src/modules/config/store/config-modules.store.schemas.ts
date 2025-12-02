import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ItemIdSchema } from '../../devices';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const ConfigModuleSchema = z.object({
	type: z.string(),
	enabled: z.boolean().default(false),
});

export const ConfigModulesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	updating: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const ConfigModulesOnEventActionPayloadSchema = z.object({
	type: z.string(),
	data: z.object({}),
});

export const ConfigModulesSetActionPayloadSchema = z.object({
	data: z.object({
		type: z.string(),
	}),
});

export const ConfigModulesGetActionPayloadSchema = z.object({
	type: z.string(),
});

export const ConfigModulesEditActionPayloadSchema = z.object({
	data: z.object({
		type: z.string(),
	}),
});

// BACKEND API
// ===========

export const ConfigModuleUpdateReqSchema: ZodType<ApiConfigUpdateModule> = z.object({
	type: z.string(),
	enabled: z.boolean().optional(),
});

export const ConfigModuleResSchema: ZodType<ApiConfigModule> = z.object({
	type: z.string(),
	enabled: z.boolean(),
});

