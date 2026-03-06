import { type ZodType, z } from 'zod';

import type { ConfigModuleModuleSchema, ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;
type ApiConfigModule = ConfigModuleModuleSchema;

// STORE STATE
// ===========

export const BuddyConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(BUDDY_MODULE_NAME),
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
	sttPlugin: z.string().optional().default('none'),
	ttsPlugin: z.string().optional().default('none'),
	voiceEnabled: z.boolean().optional().default(false),
});

// BACKEND API
// ===========

export const BuddyConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		name: z.string().optional(),
		provider: z.string().optional(),
		stt_plugin: z.string().optional(),
		tts_plugin: z.string().optional(),
		voice_enabled: z.boolean().optional(),
	})
);

export const BuddyConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(BUDDY_MODULE_NAME),
		name: z.string().optional(),
		provider: z.string().optional(),
		stt_plugin: z.string().optional(),
		tts_plugin: z.string().optional(),
		voice_enabled: z.boolean().optional(),
	})
);
