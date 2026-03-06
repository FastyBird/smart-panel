import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const WhatsappConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	phoneNumberId: z.string().nullable(),
	accessToken: z.string().nullable(),
	webhookVerifyToken: z.string().nullable(),
	allowedPhoneNumbers: z.string().nullable(),
});
