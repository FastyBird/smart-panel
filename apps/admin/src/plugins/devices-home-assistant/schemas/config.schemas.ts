import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const HomeAssistantConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	hostname: z.string(),
});
