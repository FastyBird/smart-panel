import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ShellyNgConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	mdns: z.object({
		enabled: z.boolean(),
		interface: z.string().nullable(),
	}),
	websockets: z.object({
		requestTimeout: z.coerce.number().int().min(1),
		pingInterval: z.coerce.number().int().min(0),
		reconnectInterval: z.array(z.coerce.number().int().min(1)).nonempty(),
	}),
});
