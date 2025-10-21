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

import type { components } from '../../../openapi';
import { LogEntrySource, LogEntryType } from '../system.constants';

type ReqCreateLogEntries = components['schemas']['SystemModuleReqCreateLogEntries'];
type CreateLogEntry = components['schemas']['SystemModuleCreateLogEntry'];

export class CreateLogEntryUserDto {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;
}

export class CreateLogEntryContextDto {
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"app_version","reason":"App version must be a non-empty string."}]' })
	app_version?: string;

	@Expose()
	@IsOptional()
	@IsUrl({ require_tld: false }, { message: '[{"field":"url","reason":"URL must be a valid URI."}]' })
	url?: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"user_agent","reason":"User-Agent must be a non-empty string."}]' })
	user_agent?: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"locale","reason":"Locale must be a non-empty string."}]' })
	locale?: string;
}

export class CreateLogEntryDto implements CreateLogEntry {
	@Expose()
	@IsISO8601(
		{ strict: true },
		{ message: '[{"field":"ts","reason":"Timestamp must be an ISO 8601 date-time string."}]' },
	)
	ts: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"level","reason":"Source is required."}]' })
	@IsEnum(LogEntrySource, {
		message: '[{"field":"source","reason":"Source must be one of admin, display, backend, other."}]',
	})
	source: LogEntrySource;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"level","reason":"Level is required."}]' })
	@IsInt({ message: '[{"field":"level","reason":"Level must be an integer."}]' })
	@Min(0, { message: '[{"field":"level","reason":"Level must be between 0 and 6."}]' })
	@Max(6, { message: '[{"field":"level","reason":"Level must be between 0 and 6."}]' })
	level: number;

	@Expose()
	@IsEnum(LogEntryType, {
		message: '[{"field":"type","reason":"Type must be one of trace, debug, info, warn, error, fatal."}]',
	})
	type: LogEntryType;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"tag","reason":"Tag must be a string."}]' })
	@MaxLength(64, { message: '[{"field":"tag","reason":"Tag must be at most 64 characters."}]' })
	tag?: string;

	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"message","reason":"Message must be a string."}]' })
	@MaxLength(2000, { message: '[{"field":"message","reason":"Message must be at most 2000 characters."}]' })
	message?: string;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"args","reason":"Args must be an array."}]' })
	@ArrayMaxSize(20, { message: '[{"field":"args","reason":"Args can contain at most 20 items."}]' })
	args?: (string | number | boolean | Record<string, never> | (string | number | boolean | null)[] | null)[];

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateLogEntryUserDto)
	user?: CreateLogEntryUserDto;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateLogEntryContextDto)
	context?: CreateLogEntryContextDto;
}

export class ReqCreateLogEntriesDto implements ReqCreateLogEntries {
	@Expose()
	@IsArray({ message: '[{"field":"data","reason":"Data must be an array of log events."}]' })
	@ArrayMinSize(1, { message: '[{"field":"data","reason":"Data array must contain at least one item."}]' })
	@ValidateNested({ each: true })
	@Type(() => CreateLogEntryDto)
	data: CreateLogEntryDto[];
}
