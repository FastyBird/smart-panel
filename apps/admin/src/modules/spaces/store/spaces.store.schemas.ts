import { z } from 'zod';

import { EnergyWidgetRange, HeaderWidgetType, SpaceType } from '../spaces.constants';

const EnergyWidgetSettingsSchema = z.object({
	range: z.nativeEnum(EnergyWidgetRange).optional(),
	showProduction: z.boolean().optional(),
});

export const HeaderWidgetSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal(HeaderWidgetType.ENERGY),
		order: z.number().int().min(0),
		settings: EnergyWidgetSettingsSchema,
	}),
]);

export const SpaceSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().nullable(),
	type: z.nativeEnum(SpaceType),
	icon: z.string().nullable(),
	displayOrder: z.number().int().min(0),
	headerWidgets: z.array(HeaderWidgetSchema).nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date().nullable(),
	draft: z.boolean().default(false),
});

export const SpaceCreateSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	description: z.string().nullable().optional(),
	type: z.nativeEnum(SpaceType).optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).optional(),
	headerWidgets: z.array(HeaderWidgetSchema).nullable().optional(),
});

export const SpaceEditSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	type: z.nativeEnum(SpaceType).optional(),
	icon: z.string().nullable().optional(),
	displayOrder: z.number().int().min(0).optional(),
	headerWidgets: z.array(HeaderWidgetSchema).nullable().optional(),
});
