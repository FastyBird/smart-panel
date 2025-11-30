import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';

@ApiSchema({ name: 'LoggerRotatingFilePluginDataConfig' })
export class RotatingFileConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: LOGGER_ROTATING_FILE_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = LOGGER_ROTATING_FILE_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Directory path for log files',
		type: 'string',
		example: '/var/log/app',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	dir?: string | null = null;

	@ApiProperty({
		description: 'Number of days to retain log files',
		name: 'retention_days',
		type: 'integer',
		minimum: 1,
		example: 7,
	})
	@Expose({ name: 'retention_days' })
	@IsInt()
	@IsPositive()
	@Min(1)
	retentionDays: number = 7;

	@ApiPropertyOptional({
		description: 'Cron expression for cleanup schedule',
		name: 'cleanup_cron',
		type: 'string',
		example: '0 3 * * *',
		nullable: true,
	})
	@Expose({ name: 'cleanup_cron' })
	@IsOptional()
	@IsString()
	cleanupCron?: string | null = null;

	@ApiPropertyOptional({
		description: 'Prefix for log file names',
		name: 'file_prefix',
		type: 'string',
		example: 'app-log',
		nullable: true,
	})
	@Expose({ name: 'file_prefix' })
	@IsOptional()
	@IsString()
	filePrefix?: string | null = null;
}
