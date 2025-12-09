import { z } from 'zod';

export const DisplaysFilterSchema = z.object({
	search: z.string().optional(),
	darkMode: z.enum(['all', 'enabled', 'disabled']).default('all'),
	screenSaver: z.enum(['all', 'enabled', 'disabled']).default('all'),
});
