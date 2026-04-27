import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ZigbeeHerdsmanConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	serial: z.object({
		path: z.string().trim().min(1),
		baudRate: z.coerce.number().int().min(1),
		adapterType: z.string().trim().min(1),
	}),
	network: z.object({
		channel: z.coerce.number().int().min(11).max(26),
	}),
	discovery: z.object({
		permitJoinTimeout: z.coerce.number().int().min(0),
		mainsDeviceTimeout: z.coerce.number().int().min(60),
		batteryDeviceTimeout: z.coerce.number().int().min(60),
		commandRetries: z.coerce.number().int().min(1),
		syncOnStartup: z.boolean(),
	}),
	databasePath: z.string().trim().min(1),
});
