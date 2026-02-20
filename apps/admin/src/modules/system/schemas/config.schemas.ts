import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const SystemConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	language: z.enum(['en_US', 'cs_CZ']),
	timezone: z.string().min(1),
	timeFormat: z.enum(['12h', '24h']),
	temperatureUnit: z.enum(['celsius', 'fahrenheit']),
	logLevels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])).min(1),
	houseMode: z.enum(['home', 'away', 'night']),
});
