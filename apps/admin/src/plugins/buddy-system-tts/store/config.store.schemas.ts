import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { BUDDY_SYSTEM_TTS_PLUGIN_NAME } from '../buddy-system-tts.constants';

export const SystemTtsConfigSchema = ConfigPluginSchema.extend({
	engine: z.string().trim().nullable(),
	voice: z.string().trim().nullable(),
});

// BACKEND API
// ===========

export const SystemTtsConfigUpdateReqSchema: ZodType = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_SYSTEM_TTS_PLUGIN_NAME),
		engine: z.string().trim().nullable().optional(),
		voice: z.string().trim().nullable().optional(),
	})
);

export const SystemTtsConfigResSchema: ZodType = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(BUDDY_SYSTEM_TTS_PLUGIN_NAME),
		engine: z.string().trim().nullable(),
		voice: z.string().trim().nullable(),
	})
);
