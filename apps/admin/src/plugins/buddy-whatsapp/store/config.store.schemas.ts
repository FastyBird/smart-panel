import { z } from 'zod';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_WHATSAPP_PLUGIN_NAME } from '../buddy-whatsapp.constants';

export const WhatsappConfigSchema = ConfigPluginSchema.extend({
	allowedPhoneNumbers: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const WhatsappConfigUpdateReqSchema= ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_WHATSAPP_PLUGIN_NAME),
		allowed_phone_numbers: z.string().trim().nullable().optional(),
	})
);
