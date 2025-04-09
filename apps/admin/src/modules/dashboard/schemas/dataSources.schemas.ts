import { z } from 'zod';

export const DataSourceCreateSchema = z.object({
	id: z.string().uuid().optional(),
});

export const DataSourceUpdateSchema = z.object({});
