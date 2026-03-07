import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const WhatsappConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	allowedPhoneNumbers: z.string().nullable(),
});
