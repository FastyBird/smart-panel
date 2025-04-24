import { z } from 'zod';

export const TileAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	row: z.number(),
	col: z.number(),
	rowSpan: z.number(),
	colSpan: z.number(),
	hidden: z.boolean(),
});

export const TileEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	row: z.number().optional(),
	col: z.number().optional(),
	rowSpan: z.number().optional(),
	colSpan: z.number().optional(),
	hidden: z.boolean(),
});
