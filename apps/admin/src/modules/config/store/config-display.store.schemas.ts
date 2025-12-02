import { type ZodType, z } from 'zod';

import type {
	ConfigModuleDisplaySchema,
	ConfigModuleUpdateDisplaySchema,
} from '../../../openapi.constants';
import { ConfigModuleDisplayType } from '../../../openapi.constants';

type ApiConfigDisplay = ConfigModuleDisplaySchema;
type ApiConfigUpdateDisplay = ConfigModuleUpdateDisplaySchema;

// STORE STATE
// ===========

export const ConfigDisplaySchema = z.object({
	type: z.nativeEnum(ConfigModuleDisplayType),
	darkMode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screenLockDuration: z.number(),
	screenSaver: z.boolean(),
});

export const ConfigDisplayStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigDisplayOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ConfigDisplaySetActionPayloadSchema = z.object({
	data: z.object({
		darkMode: z.boolean(),
		brightness: z.number().min(0).max(100),
		screenLockDuration: z.number(),
		screenSaver: z.boolean(),
	}),
});

export const ConfigDisplayEditActionPayloadSchema = z.object({
	data: z.object({
		darkMode: z.boolean(),
		brightness: z.number().min(0).max(100),
		screenLockDuration: z.number(),
		screenSaver: z.boolean(),
	}),
});

// BACKEND API
// ===========

export const ConfigDisplayUpdateReqSchema: ZodType<ApiConfigUpdateDisplay> = z.object({
	type: z.nativeEnum(ConfigModuleDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});

export const ConfigDisplayResSchema: ZodType<ApiConfigDisplay> = z.object({
	type: z.nativeEnum(ConfigModuleDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});
