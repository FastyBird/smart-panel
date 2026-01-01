import { z } from 'zod';

export const LocalSceneActionAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	deviceId: z.string().uuid(),
	channelId: z.string().uuid().nullable().optional(),
	propertyId: z.string().uuid(),
	value: z.union([z.string(), z.number(), z.boolean()]),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().default(true),
});

export const LocalSceneActionEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	deviceId: z.string().uuid().optional(),
	channelId: z.string().uuid().nullable().optional(),
	propertyId: z.string().uuid().optional(),
	value: z.union([z.string(), z.number(), z.boolean()]).optional(),
	order: z.number().int().min(0).optional(),
	enabled: z.boolean().optional(),
});
