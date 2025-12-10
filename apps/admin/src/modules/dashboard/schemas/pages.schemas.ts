import { z } from 'zod';

export const PageAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
	title: z.string().trim().nonempty(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number(),
	showTopBar: z.boolean().optional(),
	displays: z.array(z.string().uuid()).nullable().optional(),
});

export const PageEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	title: z.string().trim().nonempty().optional(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	order: z.number().optional(),
	showTopBar: z.boolean().optional(),
	displays: z.array(z.string().uuid()).nullable().optional(),
});
