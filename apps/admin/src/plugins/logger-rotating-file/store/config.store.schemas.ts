import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { type components } from '../../../openapi';
import { LOGGER_ROTATING_FILE_TYPE } from '../logger-rotating-file.constants';

type ApiUpdateConfig = components['schemas']['LoggerRotatingFilePluginUpdateConfig'];
type ApiConfig = components['schemas']['LoggerRotatingFilePluginDataConfig'];

export const RotatingFileConfigSchema = ConfigPluginSchema.extend({
	dir: z.string().nullable(),
	retentionDays: z.number().min(1),
	cleanupCron: z.string().nullable(),
	filePrefix: z.string().nullable(),
});

// BACKEND API
// ===========

export const RotatingFileConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(LOGGER_ROTATING_FILE_TYPE),
		dir: z.string().nullable().optional(),
		retention_days: z.number().optional(),
		cleanup_cron: z.string().nullable().optional(),
		file_prefix: z.string().nullable().optional(),
	})
);

export const RotatingFileConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(LOGGER_ROTATING_FILE_TYPE),
		dir: z.string().nullable(),
		retention_days: z.number(),
		cleanup_cron: z.string().nullable(),
		file_prefix: z.string().nullable(),
	})
);
