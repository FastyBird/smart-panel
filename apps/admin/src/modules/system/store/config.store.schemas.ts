import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { SYSTEM_MODULE_NAME } from '../system.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const SystemConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(SYSTEM_MODULE_NAME),
	language: z.enum(['en_US', 'cs_CZ']),
	timezone: z.string(),
	timeFormat: z.enum(['12h', '24h']),
	temperatureUnit: z.enum(['celsius', 'fahrenheit']),
	windSpeedUnit: z.enum(['ms', 'kmh', 'mph', 'knots']),
	pressureUnit: z.enum(['hpa', 'mbar', 'inhg', 'mmhg']),
	precipitationUnit: z.enum(['mm', 'inches']),
	distanceUnit: z.enum(['km', 'miles', 'meters', 'feet']),
	logLevels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])),
	houseMode: z.enum(['home', 'away', 'night']),
});

// BACKEND API
// ===========

export const SystemConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.enum(['en_US', 'cs_CZ']).optional(),
		timezone: z.string().optional(),
		time_format: z.enum(['12h', '24h']).optional(),
		temperature_unit: z.enum(['celsius', 'fahrenheit']).optional(),
		wind_speed_unit: z.enum(['ms', 'kmh', 'mph', 'knots']).optional(),
		pressure_unit: z.enum(['hpa', 'mbar', 'inhg', 'mmhg']).optional(),
		precipitation_unit: z.enum(['mm', 'inches']).optional(),
		distance_unit: z.enum(['km', 'miles', 'meters', 'feet']).optional(),
		log_levels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])).optional(),
		house_mode: z.enum(['home', 'away', 'night']).optional(),
	})
);

export const SystemConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.enum(['en_US', 'cs_CZ']),
		timezone: z.string(),
		time_format: z.enum(['12h', '24h']),
		temperature_unit: z.enum(['celsius', 'fahrenheit']),
		wind_speed_unit: z.enum(['ms', 'kmh', 'mph', 'knots']),
		pressure_unit: z.enum(['hpa', 'mbar', 'inhg', 'mmhg']),
		precipitation_unit: z.enum(['mm', 'inches']),
		distance_unit: z.enum(['km', 'miles', 'meters', 'feet']),
		log_levels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])),
		house_mode: z.enum(['home', 'away', 'night']),
	})
);
