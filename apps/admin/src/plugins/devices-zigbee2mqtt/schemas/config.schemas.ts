import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const Zigbee2mqttConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	mqtt: z.object({
		host: z.string().trim().min(1),
		port: z.coerce.number().int().min(1).max(65535),
		username: z.string().nullable(),
		password: z.string().nullable(),
		baseTopic: z.string().trim().min(1),
		clientId: z.string().nullable(),
		cleanSession: z.boolean(),
		keepalive: z.coerce.number().int().min(10),
		connectTimeout: z.coerce.number().int().min(1000),
		reconnectInterval: z.coerce.number().int().min(1000),
	}),
	tls: z.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean(),
		ca: z.string().nullable(),
		cert: z.string().nullable(),
		key: z.string().nullable(),
	}),
	discovery: z.object({
		autoAdd: z.boolean(),
		syncOnStartup: z.boolean(),
	}),
});
