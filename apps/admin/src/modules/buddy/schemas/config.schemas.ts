import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const BuddyConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	name: z.string().optional().default('Buddy'),
	provider: z.string().optional().default('none'),
	sttPlugin: z.string().optional().default('none'),
	ttsPlugin: z.string().optional().default('none'),
	voiceEnabled: z.boolean().optional().default(false),
	ttsVoice: z.string().nullable().optional().default(null),
	ttsSpeed: z.number().optional().default(1.0),
});
