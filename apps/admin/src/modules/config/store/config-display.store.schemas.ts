import { type ZodType, z } from 'zod';

import { ConfigDisplayType, type components } from '../../../openapi';

type ApiConfigDisplay = components['schemas']['ConfigDisplay'];
type ApiConfigUpdateDisplay = components['schemas']['ConfigUpdateDisplay'];

// STORE STATE
// ===========

export const ConfigDisplaySchema = z.object({
	type: z.nativeEnum(ConfigDisplayType),
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
	type: z.nativeEnum(ConfigDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});

export const ConfigDisplayResSchema: ZodType<ApiConfigDisplay> = z.object({
	type: z.nativeEnum(ConfigDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});
