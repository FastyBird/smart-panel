import { v4 as uuid } from 'uuid';
import { z } from 'zod';

export const DisplayIdSchema = z.string().uuid();

// STORE STATE
// ===========

// Accept legacy 'first_page' value for backward compatibility but normalize to 'auto_space'
export const HomeModeSchema = z.enum(['auto_space', 'explicit', 'first_page']).transform((val) =>
	val === 'first_page' ? 'auto_space' : val
) as z.ZodType<'auto_space' | 'explicit'>;

export const DisplayRoleSchema = z.enum(['room', 'master', 'entry']);

export const DisplaySchema = z.object({
	id: DisplayIdSchema,
	draft: z.boolean().default(false),
	macAddress: z.string().trim().nonempty(),
	name: z.string().nullable().default(null),
	role: DisplayRoleSchema.default('room'),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nullable().default(null),
	screenWidth: z.number().default(0),
	screenHeight: z.number().default(0),
	pixelRatio: z.number().default(1),
	unitSize: z.number().default(8),
	rows: z.number().default(12),
	cols: z.number().default(24),
	darkMode: z.boolean().default(false),
	brightness: z.number().min(0).max(100).default(100),
	screenLockDuration: z.number().default(30),
	screenSaver: z.boolean().default(true),
	// Audio capabilities
	audioOutputSupported: z.boolean().default(false),
	audioInputSupported: z.boolean().default(false),
	// Audio settings
	speaker: z.boolean().default(false),
	speakerVolume: z.number().min(0).max(100).default(50),
	microphone: z.boolean().default(false),
	microphoneVolume: z.number().min(0).max(100).default(50),
	// Home page configuration
	homeMode: HomeModeSchema.default('auto_space'),
	homePageId: z.string().uuid().nullable().default(null),
	resolvedHomePageId: z.string().uuid().nullable().optional().default(null),
	// Room assignment (only for role=room displays)
	roomId: z.string().uuid().nullable().default(null),
	registeredFromIp: z.string().nullable().default(null),
	currentIpAddress: z.string().nullable().default(null),
	online: z.boolean().default(false),
	status: z.enum(['connected', 'disconnected', 'lost', 'unknown']).default('unknown'),
	createdAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date))),
	updatedAt: z
		.union([z.string().datetime({ offset: true }), z.date()])
		.transform((date) => (date instanceof Date ? date : new Date(date)))
		.optional()
		.nullable()
		.default(null),
});

export const DisplaysStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(DisplayIdSchema),
	}),
	creating: z.array(DisplayIdSchema),
	updating: z.array(DisplayIdSchema),
	deleting: z.array(DisplayIdSchema),
});

// STORE ACTIONS
// =============

export const DisplaysOnEventActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({}),
});

export const DisplaysSetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({
		macAddress: z.string().trim().nonempty().optional(),
		name: z.string().nullable().optional(),
		role: DisplayRoleSchema.optional(),
		version: z.string().trim().nonempty().optional(),
		build: z.string().trim().nullable().optional(),
		screenWidth: z.number().optional(),
		screenHeight: z.number().optional(),
		pixelRatio: z.number().optional(),
		unitSize: z.number().optional(),
		rows: z.number().optional(),
		cols: z.number().optional(),
		darkMode: z.boolean().optional(),
		brightness: z.number().min(0).max(100).optional(),
		screenLockDuration: z.number().optional(),
		screenSaver: z.boolean().optional(),
		// Audio capabilities
		audioOutputSupported: z.boolean().optional(),
		audioInputSupported: z.boolean().optional(),
		// Audio settings
		speaker: z.boolean().optional(),
		speakerVolume: z.number().min(0).max(100).optional(),
		microphone: z.boolean().optional(),
		microphoneVolume: z.number().min(0).max(100).optional(),
	}),
});

export const DisplaysUnsetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysGetActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysAddActionPayloadSchema = z.object({
	id: DisplayIdSchema.optional().default(uuid()),
	draft: z.boolean().optional().default(false),
	data: z.object({
		macAddress: z.string().trim().nonempty(),
		version: z.string().trim().nonempty(),
		build: z.string().trim().nullable().optional().default(null),
		screenWidth: z.number().optional().default(0),
		screenHeight: z.number().optional().default(0),
		pixelRatio: z.number().optional().default(1),
		unitSize: z.number().optional().default(8),
		rows: z.number().optional().default(12),
		cols: z.number().optional().default(24),
	}),
});

export const DisplaysEditActionPayloadSchema = z.object({
	id: DisplayIdSchema,
	data: z.object({
		name: z.string().nullable().optional(),
		role: DisplayRoleSchema.optional(),
		unitSize: z.number().min(1).optional(),
		rows: z.number().min(1).optional(),
		cols: z.number().min(1).optional(),
		darkMode: z.boolean().optional(),
		brightness: z.number().min(0).max(100).optional(),
		screenLockDuration: z.number().optional(),
		screenSaver: z.boolean().optional(),
		// Audio settings (only if supported)
		speaker: z.boolean().optional(),
		speakerVolume: z.number().min(0).max(100).optional(),
		microphone: z.boolean().optional(),
		microphoneVolume: z.number().min(0).max(100).optional(),
		// Home page configuration
		homeMode: HomeModeSchema.optional(),
		homePageId: z.string().uuid().nullable().optional(),
		// Room assignment (only for role=room displays)
		roomId: z.string().uuid().nullable().optional(),
	}),
});

export const DisplaysSaveActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysRemoveActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

export const DisplaysRevokeTokenActionPayloadSchema = z.object({
	id: DisplayIdSchema,
});

// BACKEND API
// ===========

export const DisplayCreateReqSchema = z.object({
	mac_address: z.string().trim().nonempty(),
	version: z.string().trim().nonempty(),
	build: z.string().trim().optional(),
	screen_width: z.number().optional(),
	screen_height: z.number().optional(),
	pixel_ratio: z.number().optional(),
	unit_size: z.number().optional(),
	rows: z.number().optional(),
	cols: z.number().optional(),
});

export const DisplayUpdateReqSchema = z.object({
	name: z.string().nullable().optional(),
	role: DisplayRoleSchema.optional(),
	unit_size: z.number().min(1).optional(),
	rows: z.number().min(1).optional(),
	cols: z.number().min(1).optional(),
	dark_mode: z.boolean().optional(),
	brightness: z.number().min(0).max(100).optional(),
	screen_lock_duration: z.number().optional(),
	screen_saver: z.boolean().optional(),
	// Audio settings
	speaker: z.boolean().optional(),
	speaker_volume: z.number().min(0).max(100).optional(),
	microphone: z.boolean().optional(),
	microphone_volume: z.number().min(0).max(100).optional(),
	// Home page configuration
	home_mode: HomeModeSchema.optional(),
	home_page_id: z.string().uuid().nullable().optional(),
	// Room assignment (only for role=room displays)
	room_id: z.string().uuid().nullable().optional(),
});

export const DisplayResSchema = z.object({
	id: z.string().uuid(),
	mac_address: z.string().trim().nonempty(),
	name: z.string().nullable().optional().default(null),
	role: DisplayRoleSchema.optional().default('room'),
	version: z.string().trim().nonempty(),
	build: z.string().trim().nullable().optional().default(null),
	screen_width: z.number(),
	screen_height: z.number(),
	pixel_ratio: z.number(),
	unit_size: z.number(),
	rows: z.number(),
	cols: z.number(),
	dark_mode: z.boolean(),
	brightness: z.number(),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
	// Audio capabilities
	audio_output_supported: z.boolean(),
	audio_input_supported: z.boolean(),
	// Audio settings
	speaker: z.boolean(),
	speaker_volume: z.number(),
	microphone: z.boolean(),
	microphone_volume: z.number(),
	// Home page configuration
	home_mode: HomeModeSchema.optional().default('auto_space'),
	home_page_id: z.string().uuid().nullable().optional().default(null),
	resolved_home_page_id: z.string().uuid().nullable().optional().default(null),
	// Room assignment (only for role=room displays)
	room_id: z.string().uuid().nullable().optional().default(null),
	registered_from_ip: z.string().nullable().optional().default(null),
	current_ip_address: z.string().nullable().optional().default(null),
	online: z.boolean().optional().default(false),
	status: z.enum(['connected', 'disconnected', 'lost', 'unknown']).optional().default('unknown'),
	created_at: z.string(),
	updated_at: z.string().nullable().optional().default(null),
});

// Token response schema
export const DisplayTokenResSchema = z.object({
	id: z.string().uuid(),
	owner_type: z.string(),
	owner_id: z.string().uuid().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	expires_at: z.string().nullable(),
	revoked: z.boolean(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional().default(null),
});
