import { z } from 'zod';

export const PageCreateSchema = z.object({
	id: z.string().uuid().optional(),
	title: z.string().trim().nonempty(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
});

export const PageUpdateSchema = z.object({
	title: z.string().trim().nonempty().optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
});
