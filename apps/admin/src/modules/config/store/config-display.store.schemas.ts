import { z } from 'zod';

// Note: Display configuration has been moved to the DisplaysModule.
// This store now provides compatibility by mapping to DisplaysModule data.

// STORE STATE
// ===========

export const ConfigDisplaySchema = z.object({
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

export const ConfigDisplayUpdateReqSchema = z.object({
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});

export const ConfigDisplayResSchema = z.object({
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});
