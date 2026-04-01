import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const InfluxV2ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: z.string().min(1),
	org: z.string().min(1),
	bucket: z.string().min(1),
	token: z.string().optional(),
});
