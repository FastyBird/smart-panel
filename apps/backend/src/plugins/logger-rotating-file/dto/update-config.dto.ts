import { Expose } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Min,
	ValidateIf,
	ValidationArguments,
	ValidationOptions,
	registerDecorator,
} from 'class-validator';
import { CronTime } from 'cron';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';

const IsCronExpression = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'isCronExpression',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: any) {
					if (value === undefined || value === null || value === '') return true; // handled by @IsOptional
					if (typeof value !== 'string') return false;
					try {
						// will throw if invalid
						// supports standard 5-field or 6-field (with seconds) expressions
						new CronTime(value);

						return true;
					} catch {
						return false;
					}
				},
				defaultMessage(args: ValidationArguments) {
					return `[{"field":"${args.property}","reason":"Must be a valid cron expression (e.g. \\"15 3 * * *\\")."}]`;
				},
			},
		});
	};
};

@ApiSchema({ name: 'LoggerRotatingFilePluginUpdateConfig' })
export class RotatingFileUpdateConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: LOGGER_ROTATING_FILE_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof LOGGER_ROTATING_FILE_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Directory path for log files',
		type: 'string',
		example: '/var/log/app',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"dir","reason":"Directory must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"dir","reason":"Directory must be a non-empty string."}]' })
	@ValidateIf((_, value) => value !== null)
	dir?: string | null;

	@ApiPropertyOptional({
		description: 'Number of days to retain log files',
		name: 'retention_days',
		type: 'integer',
		minimum: 1,
		example: 7,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"retention_days","reason":"Retention days must be an integer."}]' })
	@Min(1, { message: '[{"field":"retention_days","reason":"Retention days must be at least 1."}]' })
	retention_days?: number;

	@ApiPropertyOptional({
		description: 'Cron expression for cleanup schedule',
		name: 'cleanup_cron',
		type: 'string',
		example: '0 3 * * *',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"cleanup_cron","reason":"Cleanup cron must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"cleanup_cron","reason":"Cleanup cron must be a non-empty string."}]' })
	@IsCronExpression()
	@ValidateIf((_, value) => value !== null)
	cleanup_cron?: string | null;

	@ApiPropertyOptional({
		description: 'Prefix for log file names',
		name: 'file_prefix',
		type: 'string',
		pattern: '^[A-Za-z0-9._-]+$',
		example: 'app-log',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"file_prefix","reason":"File prefix must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"file_prefix","reason":"File prefix must be a non-empty string."}]' })
	@Matches(/^[A-Za-z0-9._-]+$/, {
		message:
			'[{"field":"file_prefix","reason":"File prefix may contain letters, numbers, dot, underscore and hyphen only."}]',
	})
	@ValidateIf((_, value) => value !== null)
	file_prefix?: string | null;
}
