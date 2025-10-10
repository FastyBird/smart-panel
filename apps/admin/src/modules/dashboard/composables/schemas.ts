import { z } from 'zod';

export const PagesFilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()),
	displays: z.array(z.string()),
});

export const TilesFilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()),
});

export const DataSourcesFilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()),
});
