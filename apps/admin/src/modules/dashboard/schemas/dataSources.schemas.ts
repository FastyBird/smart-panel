import { z } from 'zod';

export const DataSourceAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().nonempty(),
});

export const DataSourceEditFormSchema = z.object({
	id: z.string().uuid(),
	type: z.string().trim().nonempty(),
});
