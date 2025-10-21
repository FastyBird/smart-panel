import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';

export class RotatingFileLoggerConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	type: string = LOGGER_ROTATING_FILE_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@Expose()
	@IsOptional()
	@IsString()
	dir?: string = null;

	@Expose({ name: 'retention_days' })
	@IsInt()
	@IsPositive()
	@Min(1)
	retentionDays: number = 7;

	@Expose({ name: 'cleanup_cron' })
	@IsOptional()
	@IsString()
	cleanupCron?: string = null;

	@Expose({ name: 'file_prefix' })
	@IsOptional()
	@IsString()
	filePrefix?: string = null;
}
