import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const HomeKitConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	bridgeName: z.string().trim().min(1),
	port: z.number().int().min(1024).max(65535),
	pincode: z.string().trim().regex(/^\d{3}-\d{2}-\d{3}$/),
	username: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
	setupId: z.string().trim().length(4),
	mappedDeviceIds: z.array(z.string().uuid()).default([]),
});
