import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
	sttProvider: z.string().optional().default('none'),
	sttApiKey: z.string().nullable().optional().default(null),
	sttModel: z.string().nullable().optional().default(null),
	sttLanguage: z.string().nullable().optional().default(null),
	ttsPlugin: z.string().optional().default('none'),
	voiceEnabled: z.boolean().optional().default(false),
	ttsVoice: z.string().nullable().optional().default(null),
	ttsSpeed: z.number().optional().default(1.0),
	telegramEnabled: z.boolean().optional().default(false),
	telegramBotToken: z.string().nullable().optional().default(null),
	telegramAllowedUserIds: z.string().nullable().optional().default(null),
});
