import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const Zigbee2mqttConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	connectionType: z.enum(['mqtt', 'ws']),
	mqtt: z.object({
		host: z.string().trim().min(1),
		port: z.coerce.number().int().min(1).max(65535),
		username: z.string().nullable(),
		// Absent or blank keeps the stored password and null removes it. The backend never sends
		// the password back, so the field always starts blank - which is why removing one needs a
		// gesture of its own rather than just clearing the input.
		password: z.string().nullable().optional(),
		// What the backend answers with in place of the password. Declared so the form knows
		// whether there is anything to remove; the update request schema drops it again.
		passwordConfigured: z.boolean().optional(),
		baseTopic: z.string().trim().min(1),
		clientId: z.string().nullable(),
		cleanSession: z.boolean(),
		keepalive: z.coerce.number().int().min(10),
		connectTimeout: z.coerce.number().int().min(1000),
		reconnectInterval: z.coerce.number().int().min(1000),
	}),
	ws: z.object({
		host: z.string().trim().min(1),
		port: z.coerce.number().int().min(1).max(65535),
		baseTopic: z.string().trim().min(1),
		secure: z.boolean(),
		connectTimeout: z.coerce.number().int().min(1000),
		reconnectInterval: z.coerce.number().int().min(1000),
	}),
	tls: z.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean(),
		ca: z.string().nullable(),
		cert: z.string().nullable(),
		// Absent or blank keeps the stored key and null removes it. The backend never sends
		// the key back, so the field always starts blank - which is why removing one needs a
		// gesture of its own rather than just clearing the input.
		key: z.string().nullable().optional(),
		// What the backend answers with in place of the key. Declared so the form knows
		// whether there is anything to remove; the update request schema drops it again.
		keyConfigured: z.boolean().optional(),
	}),
	discovery: z.object({
		autoAdd: z.boolean(),
		syncOnStartup: z.boolean(),
	}),
});
