import { z } from 'zod';

export const ConfigPluginEditFormSchema = z.object({
	type: z.string().trim().nonempty(),
	enabled: z.boolean().default(false),
});
