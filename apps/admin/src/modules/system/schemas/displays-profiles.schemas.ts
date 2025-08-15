import { z } from 'zod';

export const DisplayProfileEditFormSchema = z.object({
	id: z.string().uuid(),
	unitSize: z.number(),
	rows: z.number(),
	cols: z.number(),
});
