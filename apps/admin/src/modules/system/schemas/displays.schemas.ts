import { z } from 'zod';

export const DisplayEditFormSchema = z.object({
	id: z.string().uuid(),
	unitSize: z.number(),
	rows: z.number(),
	cols: z.number(),
});
