import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	AUTOMATION_DESCRIPTION_MAX_LENGTH,
	AUTOMATION_ICON_MAX_LENGTH,
	AUTOMATION_NAME_MAX_LENGTH,
	AutomationMode,
} from '../automations.constants';

import { AutomationGraphDto } from './automation-graph.dto';

@ApiSchema({ name: 'AutomationsModuleCreateAutomation' })
export class CreateAutomationDto {
	@ApiPropertyOptional({
		description: 'Automation ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Automation name',
		type: 'string',
		maxLength: AUTOMATION_NAME_MAX_LENGTH,
		example: 'Hallway motion light',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_NAME_MAX_LENGTH, {
		message: `[{"field":"name","reason":"Name must be at most ${AUTOMATION_NAME_MAX_LENGTH} characters long."}]`,
	})
	name: string;

	@ApiPropertyOptional({
		description: 'Automation description',
		type: 'string',
		nullable: true,
		maxLength: AUTOMATION_DESCRIPTION_MAX_LENGTH,
		example: 'Turns the hallway light on when somebody walks in',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@IsString({ message: '[{"field":"description","reason":"Description must be a valid string."}]' })
	@MaxLength(AUTOMATION_DESCRIPTION_MAX_LENGTH, {
		message: `[{"field":"description","reason":"Description must be at most ${AUTOMATION_DESCRIPTION_MAX_LENGTH} characters long."}]`,
	})
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Icon identifier for the automation',
		type: 'string',
		nullable: true,
		maxLength: AUTOMATION_ICON_MAX_LENGTH,
		example: 'mdi:motion-sensor',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@MaxLength(AUTOMATION_ICON_MAX_LENGTH, {
		message: `[{"field":"icon","reason":"Icon must be at most ${AUTOMATION_ICON_MAX_LENGTH} characters long."}]`,
	})
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		description: 'Whether the automation is enabled. New automations are disabled unless stated otherwise.',
		type: 'boolean',
		example: false,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => (obj.enabled === null ? undefined : obj.enabled), {
		toClassOnly: true,
	})
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Optional owning space, used for filtering',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value !== null)
	space_id?: string | null;

	@ApiPropertyOptional({
		description: 'What happens when the automation is triggered while it is already running',
		enum: AutomationMode,
		example: AutomationMode.RESTART,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(AutomationMode, {
		message: '[{"field":"mode","reason":"Mode must be one of single, restart or parallel."}]',
	})
	mode?: AutomationMode;

	@ApiPropertyOptional({
		description: 'The automation graph. An empty graph is stored when it is left out.',
		type: () => AutomationGraphDto,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsObject({ message: '[{"field":"graph","reason":"Graph must be an object."}]' })
	@ValidateNested()
	@Type(() => AutomationGraphDto)
	graph?: AutomationGraphDto;
}

@ApiSchema({ name: 'AutomationsModuleReqCreateAutomation' })
export class ReqCreateAutomationDto {
	@ApiProperty({ description: 'Automation data', type: () => CreateAutomationDto })
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => CreateAutomationDto)
	data: CreateAutomationDto;
}
