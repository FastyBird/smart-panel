import { type ZodType, z } from 'zod';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_WHATSAPP_PLUGIN_NAME } from '../buddy-whatsapp.constants';

export const WhatsappConfigSchema = ConfigPluginSchema.extend({
	phoneNumberId: z.string().trim().nullable(),
	accessToken: z.string().trim().nullable(),
	webhookVerifyToken: z.string().trim().nullable(),
	allowedPhoneNumbers: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const WhatsappConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_WHATSAPP_PLUGIN_NAME),
		phone_number_id: z.string().trim().nullable().optional(),
		access_token: z.string().trim().nullable().optional(),
		webhook_verify_token: z.string().trim().nullable().optional(),
		allowed_phone_numbers: z.string().trim().nullable().optional(),
	})
);
