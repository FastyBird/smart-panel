import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';

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
		item: z.array(z.string()),
	}),
	updating: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const ConfigModulesOnEventActionPayloadSchema = z.object({
	type: z.string(),
	data: z.looseObject({}),
});

export const ConfigModulesSetActionPayloadSchema = z.object({
	data: z.object({
		type: z.string(),
	}),
});

export const ConfigModulesGetActionPayloadSchema = z.object({
	type: z.string(),
	// Opt-in, default off so existing callers keep coalescing onto an in-flight request. A
	// change-driven refresh sets it to force a genuinely fresh read instead of reusing one that may
	// have been taken before the change it is reacting to. See `get()` in config-modules.store.ts.
	force: z.boolean().optional(),
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

