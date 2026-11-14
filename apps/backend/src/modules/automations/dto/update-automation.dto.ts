import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
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

@ApiSchema({ name: 'AutomationsModuleUpdateAutomation' })
export class UpdateAutomationDto {
	@ApiProperty({
		description:
			'The revision this update is based on. The update is refused with 409 Conflict when the stored automation has a different revision.',
		type: 'integer',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsInt({ message: '[{"field":"revision","reason":"Revision must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"revision","reason":"Revision must be at least 1."}]' })
	revision: number;

	@ApiPropertyOptional({
		description: 'Automation name',
		type: 'string',
		maxLength: AUTOMATION_NAME_MAX_LENGTH,
		example: 'Hallway motion light',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a valid string."}]' })
	@MaxLength(AUTOMATION_NAME_MAX_LENGTH, {
		message: `[{"field":"name","reason":"Name must be at most ${AUTOMATION_NAME_MAX_LENGTH} characters long."}]`,
	})
	name?: string;

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

	@ApiPropertyOptional({ description: 'Whether the automation is enabled', type: 'boolean', example: true })
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
		description: 'The automation graph. It replaces the stored graph as a whole.',
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

@ApiSchema({ name: 'AutomationsModuleReqUpdateAutomation' })
export class ReqUpdateAutomationDto {
	@ApiProperty({ description: 'Automation data', type: () => UpdateAutomationDto })
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => UpdateAutomationDto)
	data: UpdateAutomationDto;
}
