import { z } from 'zod';

export const LocationAddFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	name: z.string().trim().min(1, 'Name is required'),
});

export const LocationEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
	name: z.string().trim().min(1, 'Name is required'),
});

export type LocationAddFormSchemaType = z.infer<typeof LocationAddFormSchema>;
export type LocationEditFormSchemaType = z.infer<typeof LocationEditFormSchema>;
