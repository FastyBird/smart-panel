import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ShellyV1ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	discovery: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
	}),
	timeouts: z.object({
		requestTimeout: z.coerce.number().int().min(1),
		staleTimeout: z.coerce.number().int().min(1),
	}),
});
