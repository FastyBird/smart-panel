import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { LanguageType, LogLevelType, SectionType, TimeFormatType } from '../config.constants';

const determineConfigDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		const type = (obj.data as { type: string }).type as SectionType;

		if (!Object.values(SectionType).includes(type)) {
			throw new Error(`Unknown type ${type}`);
		}

		switch (type) {
			case SectionType.LANGUAGE:
				return UpdateLanguageConfigDto;
			case SectionType.SYSTEM:
				return UpdateSystemConfigDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining config DTO');
};

export class BaseConfigDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid section string."}]' })
	type: SectionType.LANGUAGE | SectionType.SYSTEM;
}

@ApiSchema({ name: 'ConfigModuleUpdateLanguage' })
export class UpdateLanguageConfigDto extends BaseConfigDto {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.LANGUAGE],
		example: 'language',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.LANGUAGE;

	@ApiPropertyOptional({
		description: 'Sets the application language.',
		enum: LanguageType,
		example: LanguageType.ENGLISH,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LanguageType, { message: '[{"field":"language","reason":"Language must be a valid string."}]' })
	language?: LanguageType;

	@ApiPropertyOptional({
		description: 'Sets the timezone.',
		type: 'string',
		example: 'Europe/Prague',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"timezone","reason":"Timezone must be a valid string."}]' })
	timezone?: string;

	@ApiPropertyOptional({
		description: 'Sets the time format.',
		enum: TimeFormatType,
		example: TimeFormatType.HOUR_24,
	})
	@Expose()
	@IsOptional()
	@IsEnum(TimeFormatType, { message: '[{"field":"time_format","reason":"Time format must be a valid string."}]' })
	time_format?: TimeFormatType;
}

@ApiSchema({ name: 'ConfigModuleUpdateSystem' })
export class UpdateSystemConfigDto extends BaseConfigDto {
	@ApiProperty({
		description: 'Configuration section type',
		enum: [SectionType.SYSTEM],
		example: 'system',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a language string."}]' })
	type: SectionType.SYSTEM;

	@ApiPropertyOptional({
		description: 'Array of log levels to enable.',
		type: 'array',
		items: {
			type: 'string',
			enum: Object.values(LogLevelType),
		},
		example: ['error', 'warn', 'info'],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"log_levels","reason":"Log levels must be provided as an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"log_levels","reason":"At least one log level must be specified."}]' })
	@IsEnum(LogLevelType, {
		each: true,
		message: '[{"field":"log_levels","reason":"Each log level must be one of the predefined values."}]',
	})
	log_levels?: LogLevelType[];
}

@ApiSchema({ name: 'ConfigModuleReqUpdateSection' })
export class ReqUpdateSectionDto {
	@ApiProperty({
		description: 'Configuration section data',
		oneOf: [{ $ref: getSchemaPath(UpdateLanguageConfigDto) }, { $ref: getSchemaPath(UpdateSystemConfigDto) }],
		discriminator: {
			propertyName: 'type',
			mapping: {
				language: getSchemaPath(UpdateLanguageConfigDto),
				system: getSchemaPath(UpdateSystemConfigDto),
			},
		},
	})
	@Expose()
	@ValidateNested()
	@Type((options) => determineConfigDto(options?.object ?? {}))
	data: UpdateLanguageConfigDto | UpdateSystemConfigDto;
}

@ApiSchema({ name: 'ConfigModuleUpdatePlugin' })
export class UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: 'devices-shelly',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;

	@ApiPropertyOptional({
		description: 'Enables or disables the plugin.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ConfigModuleReqUpdatePlugin' })
export class ReqUpdatePluginDto {
	@ApiProperty({
		description: 'Plugin configuration data',
		type: () => UpdatePluginConfigDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePluginConfigDto)
	data: UpdatePluginConfigDto;
}

@ApiSchema({ name: 'ConfigModuleUpdateModule' })
export class UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'devices-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string;

	@ApiPropertyOptional({
		description: 'Enables or disables the module.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'ConfigModuleReqUpdateModule' })
export class ReqUpdateModuleDto {
	@ApiProperty({
		description: 'Module configuration data',
		type: () => UpdateModuleConfigDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateModuleConfigDto)
	data: UpdateModuleConfigDto;
}
