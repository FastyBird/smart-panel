import { z } from 'zod';

export const TileCreateSchema = z.object({
	id: z.string().uuid().optional(),
	row: z.number(),
	col: z.number(),
	rowSpan: z.number(),
	colSpan: z.number(),
});

export const TileUpdateSchema = z.object({
	row: z.number().optional(),
	col: z.number().optional(),
	rowSpan: z.number().optional(),
	colSpan: z.number().optional(),
});
