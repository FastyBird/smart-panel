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
	logLevels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])),
});

// BACKEND API
// ===========

export const SystemConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.enum(['en_US', 'cs_CZ']).optional(),
		timezone: z.string().optional(),
		time_format: z.enum(['12h', '24h']).optional(),
		log_levels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])).optional(),
	})
);

export const SystemConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.enum(['en_US', 'cs_CZ']),
		timezone: z.string(),
		time_format: z.enum(['12h', '24h']),
		log_levels: z.array(z.enum(['silent', 'verbose', 'debug', 'trace', 'log', 'info', 'success', 'warn', 'error', 'fail', 'fatal'])),
	})
);
