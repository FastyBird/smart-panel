import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

// An empty input is "not set"; a number input hands over its value as text
const coordinate = (limit: number) =>
	z.preprocess(
		(value: unknown) => (value === '' || value === null || typeof value === 'undefined' ? null : Number(value)),
		z.number().min(-limit).max(limit).nullable()
	);

export const SystemConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	language: z.enum(['en_US', 'cs_CZ', 'de_DE', 'es_ES', 'pl_PL', 'sk_SK']),
	timezone: z.string().min(1),
	latitude: coordinate(90),
	longitude: coordinate(180),
	timeFormat: z.enum(['12h', '24h']),
	numberFormat: z.enum(['comma_dot', 'dot_comma', 'space_comma', 'none']),
	temperatureUnit: z.enum(['celsius', 'fahrenheit']),
	windSpeedUnit: z.enum(['ms', 'kmh', 'mph', 'knots']),
	pressureUnit: z.enum(['hpa', 'mbar', 'inhg', 'mmhg']),
	precipitationUnit: z.enum(['mm', 'inches']),
	distanceUnit: z.enum(['km', 'miles', 'meters', 'feet']),
	logLevels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])).min(1),
	houseMode: z.enum(['home', 'away', 'night']),
	updateChannel: z.enum(['auto', 'stable', 'beta', 'alpha']),
});
