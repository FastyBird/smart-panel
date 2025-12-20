import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const WledConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	mdns: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
		autoAdd: z.boolean(),
	}),
	websocket: z.object({
		enabled: z.boolean(),
		reconnectInterval: z.coerce.number().int().min(1000),
	}),
	polling: z.object({
		interval: z.coerce.number().int().min(1000),
	}),
	timeouts: z.object({
		connectionTimeout: z.coerce.number().int().min(1000),
		commandDebounce: z.coerce.number().int().min(0),
	}),
});
