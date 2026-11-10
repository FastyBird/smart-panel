import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const ModbusConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	defaultConnectTimeoutMs: z.coerce.number().int().min(1).max(60_000),
	defaultRequestTimeoutMs: z.coerce.number().int().min(1).max(60_000),
	defaultPollIntervalMs: z.coerce.number().int().min(100).max(86_400_000),
});
