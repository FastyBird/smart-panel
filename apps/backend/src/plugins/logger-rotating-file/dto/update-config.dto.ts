import { Expose } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Min,
	ValidationArguments,
	ValidationOptions,
	registerDecorator,
} from 'class-validator';
import { CronTime } from 'cron';

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

export class RotatingFileLoggerUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof LOGGER_ROTATING_FILE_PLUGIN_NAME;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"dir","reason":"Directory must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"dir","reason":"Directory must be a non-empty string."}]' })
	dir?: string;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"retention_days","reason":"Retention days must be an integer."}]' })
	@Min(1, { message: '[{"field":"retention_days","reason":"Retention days must be at least 1."}]' })
	retention_days?: number;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"cleanup_cron","reason":"Cleanup cron must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"cleanup_cron","reason":"Cleanup cron must be a non-empty string."}]' })
	@IsCronExpression()
	cleanup_cron?: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"file_prefix","reason":"File prefix must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"file_prefix","reason":"File prefix must be a non-empty string."}]' })
	@Matches(/^[A-Za-z0-9._-]+$/, {
		message:
			'[{"field":"file_prefix","reason":"File prefix may contain letters, numbers, dot, underscore and hyphen only."}]',
	})
	file_prefix?: string;
}
