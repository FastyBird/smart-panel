import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ElevenlabsConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	apiKey: z.string().nullable(),
	voiceId: z.string().nullable(),
});
