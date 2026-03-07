import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const SystemTtsConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	engine: z.string().nullable(),
	voice: z.string().nullable(),
});
