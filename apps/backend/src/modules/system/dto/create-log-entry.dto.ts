import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsISO8601,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	IsUrl,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { LogEntrySource, LogEntryType } from '../system.constants';

@ApiSchema({ name: 'SystemModuleCreateLogEntryUser' })
export class CreateLogEntryUserDto {
	@ApiPropertyOptional({
		description: 'User ID (UUID v4)',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;
}

@ApiSchema({ name: 'SystemModuleCreateLogEntryContext' })
export class CreateLogEntryContextDto {
	@ApiPropertyOptional({
		name: 'app_version',
		description: 'Application version',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"app_version","reason":"App version must be a non-empty string."}]' })
	app_version?: string;

	@ApiPropertyOptional({
		description: 'Request URL',
		type: 'string',
		format: 'uri',
		example: 'https://example.com/page',
	})
	@Expose()
	@IsOptional()
	@IsUrl({ require_tld: false }, { message: '[{"field":"url","reason":"URL must be a valid URI."}]' })
	url?: string;

	@ApiPropertyOptional({
		name: 'user_agent',
		description: 'User agent string',
		type: 'string',
		example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"user_agent","reason":"User-Agent must be a non-empty string."}]' })
	user_agent?: string;

	@ApiPropertyOptional({
		description: 'User locale',
		type: 'string',
		example: 'en-US',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"locale","reason":"Locale must be a non-empty string."}]' })
	locale?: string;
}

@ApiSchema({ name: 'SystemModuleCreateLogEntry' })
export class CreateLogEntryDto {
	@ApiProperty({
		description: 'Log entry timestamp (ISO 8601 format)',
		type: 'string',
		format: 'date-time',
		example: '2024-01-24T10:30:00.000Z',
	})
	@Expose()
	@IsISO8601(
		{ strict: true },
		{ message: '[{"field":"ts","reason":"Timestamp must be an ISO 8601 date-time string."}]' },
	)
	ts: string;

	@ApiProperty({
		description: 'Log entry source',
		enum: LogEntrySource,
		example: LogEntrySource.DISPLAY,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"level","reason":"Source is required."}]' })
	@IsEnum(LogEntrySource, {
		message: '[{"field":"source","reason":"Source must be one of admin, display, backend, other."}]',
	})
	source: LogEntrySource;

	@ApiProperty({
		description: 'Log level (0-6)',
		type: 'integer',
		minimum: 0,
		maximum: 6,
		example: 3,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"level","reason":"Level is required."}]' })
	@IsInt({ message: '[{"field":"level","reason":"Level must be an integer."}]' })
	@Min(0, { message: '[{"field":"level","reason":"Level must be between 0 and 6."}]' })
	@Max(6, { message: '[{"field":"level","reason":"Level must be between 0 and 6."}]' })
	level: number;

	@ApiProperty({
		description: 'Log entry type',
		enum: LogEntryType,
		example: LogEntryType.INFO,
	})
	@Expose()
	@IsEnum(LogEntryType, {
		message: '[{"field":"type","reason":"Type must be one of trace, debug, info, warn, error, fatal."}]',
	})
	type: LogEntryType;

	@ApiPropertyOptional({
		description: 'Log entry tag',
		type: 'string',
		maxLength: 64,
		example: 'user-action',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"tag","reason":"Tag must be a string."}]' })
	@MaxLength(64, { message: '[{"field":"tag","reason":"Tag must be at most 64 characters."}]' })
	tag?: string;

	@ApiPropertyOptional({
		description: 'Log message',
		type: 'string',
		maxLength: 2000,
		example: 'User performed an action',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"message","reason":"Message must be a string."}]' })
	@MaxLength(2000, { message: '[{"field":"message","reason":"Message must be at most 2000 characters."}]' })
	message?: string;

	@ApiPropertyOptional({
		description: 'Additional log arguments',
		type: 'array',
		items: {
			oneOf: [
				{ type: 'string' },
				{ type: 'number' },
				{ type: 'boolean' },
				{ type: 'object' },
				{ type: 'array' },
				{ type: 'null' },
			],
		},
		maxItems: 20,
		example: ['arg1', 123, true],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"args","reason":"Args must be an array."}]' })
	@ArrayMaxSize(20, { message: '[{"field":"args","reason":"Args can contain at most 20 items."}]' })
	args?: (string | number | boolean | Record<string, never> | (string | number | boolean | null)[] | null)[];

	@ApiPropertyOptional({
		description: 'User information associated with the log entry',
		type: CreateLogEntryUserDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateLogEntryUserDto)
	user?: CreateLogEntryUserDto;

	@ApiPropertyOptional({
		description: 'Context information for the log entry',
		type: CreateLogEntryContextDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateLogEntryContextDto)
	context?: CreateLogEntryContextDto;
}

@ApiSchema({ name: 'SystemModuleReqCreateLogEntries' })
export class ReqCreateLogEntriesDto {
	@ApiProperty({
		description: 'Array of log entries to create',
		type: [CreateLogEntryDto],
		minItems: 1,
	})
	@Expose()
	@IsArray({ message: '[{"field":"data","reason":"Data must be an array of log events."}]' })
	@ArrayMinSize(1, { message: '[{"field":"data","reason":"Data array must contain at least one item."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateLogEntryDto)
	data: CreateLogEntryDto[];
}
