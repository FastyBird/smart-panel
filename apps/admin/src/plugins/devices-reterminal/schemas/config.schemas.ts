import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ReTerminalConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	polling: z.object({
		interval: z.coerce.number().int().min(1000),
	}),
});
