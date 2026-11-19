import { z } from 'zod';

// STORE STATE
// ===========

export const CameraProfileSchema = z.object({
	id: z.string(),
	channelId: z.string().nullable(),
	width: z.number().nullable(),
	height: z.number().nullable(),
	fps: z.number().nullable(),
	videoCodec: z.string().nullable(),
	audioCodec: z.string().nullable(),
	available: z.boolean(),
	unavailableReason: z.string().nullable(),
});

export const CameraSchema = z.object({
	deviceId: z.string(),
	name: z.string(),
	category: z.string(),
	type: z.string(),
	liveView: z.boolean(),
	profiles: z.array(CameraProfileSchema),
});

export const CamerasStateSemaphoreSchema = z.object({
	fetching: z.boolean(),
	getting: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const CamerasGetActionPayloadSchema = z.object({
	deviceId: z.string(),
});
