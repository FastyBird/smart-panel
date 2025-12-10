import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ValidateDisplayExists } from '../../displays/validators/display-exists-constraint.validator';

@ApiSchema({ name: 'DashboardModuleUpdatePage' })
export abstract class UpdatePageDto {
	@ApiProperty({ description: 'Page type', type: 'string', example: 'default' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	readonly type: string;

	@ApiPropertyOptional({ description: 'Page title', type: 'string', example: 'Dashboard' })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title?: string;

	@ApiPropertyOptional({ description: 'Page icon name', type: 'string', example: 'mdi:home', nullable: true })
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({ description: 'Display order', type: 'integer', example: 1 })
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number greater than zero."}]' },
	)
	order?: number;

	@ApiPropertyOptional({
		description: 'Whether to show top bar',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_top_bar","reason":"Show top bar attribute must be a valid true or false."}]' })
	show_top_bar?: boolean;

	@ApiPropertyOptional({
		description:
			'Display IDs. Empty array or null means visible to all displays. If not provided, existing assignments are preserved.',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['123e4567-e89b-12d3-a456-426614174000'],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"displays","reason":"Displays must be an array."}]' })
	@IsUUID('4', {
		each: true,
		message: '[{"field":"displays","reason":"Each display must be a valid UUID (version 4)."}]',
	})
	@ValidateIf((_, value) => value !== null && Array.isArray(value) && value.length > 0)
	@ValidateDisplayExists({ message: '[{"field":"displays","reason":"One or more specified displays do not exist."}]' })
	displays?: string[] | null;
}

@ApiSchema({ name: 'DashboardModuleReqUpdatePage' })
export class ReqUpdatePageDto {
	@ApiProperty({ description: 'Page data', type: () => UpdatePageDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePageDto)
	data: UpdatePageDto;
}
