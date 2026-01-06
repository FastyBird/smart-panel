import { z } from 'zod';

import { INTENT_ORIGINS, IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

export const IntentTargetSchema = z.object({
	deviceId: z.string().uuid().nullable(),
	channelId: z.string().uuid().nullable(),
	propertyId: z.string().uuid().nullable(),
	sceneId: z.string().uuid().nullable(),
});

export const IntentTargetResultSchema = z.object({
	deviceId: z.string().uuid().nullable(),
	channelId: z.string().uuid().nullable(),
	propertyId: z.string().uuid().nullable(),
	sceneId: z.string().uuid().nullable(),
	status: z.nativeEnum(IntentTargetStatus),
	error: z.string().nullable(),
});

export const IntentContextSchema = z.object({
	origin: z.enum(INTENT_ORIGINS as [string, ...string[]]).nullable(),
	displayId: z.string().uuid().nullable(),
	spaceId: z.string().uuid().nullable(),
	roleKey: z.string().nullable(),
});

export const IntentSchema = z.object({
	id: z.string().uuid(),
	requestId: z.string().uuid().nullable(),
	type: z.nativeEnum(IntentType),
	context: IntentContextSchema,
	targets: z.array(IntentTargetSchema),
	value: z.unknown().transform((val) => val ?? null),
	status: z.nativeEnum(IntentStatus),
	ttlMs: z.number(),
	createdAt: z.coerce.date(),
	expiresAt: z.coerce.date(),
	completedAt: z.coerce.date().nullable(),
	results: z.array(IntentTargetResultSchema).nullable(),
});

export type IntentSchemaType = z.infer<typeof IntentSchema>;
