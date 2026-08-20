import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const VoiceaiConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Empty means "keep the stored key" - the backend never sends it back.
	apiKey: z.string().nullable().optional(),
	voiceId: z.string().nullable(),
});
