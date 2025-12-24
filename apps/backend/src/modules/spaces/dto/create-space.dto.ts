import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SpaceType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleCreateSpace' })
export class CreateSpaceDto {
	@ApiProperty({
		description: 'Space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name is required."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	name: string;

	@ApiPropertyOptional({
		description: 'Space description',
		type: 'string',
		nullable: true,
		example: 'Main living area on the ground floor',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"description","reason":"Description must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	@IsOptional()
	@IsEnum(SpaceType, { message: '[{"field":"type","reason":"Type must be a valid space type."}]' })
	type?: SpaceType;

	@ApiPropertyOptional({
		description: 'Icon identifier for the space',
		type: 'string',
		nullable: true,
		example: 'mdi:sofa',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		name: 'display_order',
		description: 'Display order for sorting spaces',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsOptional()
	@IsInt({ message: '[{"field":"display_order","reason":"Display order must be an integer."}]' })
	@Min(0, { message: '[{"field":"display_order","reason":"Display order must be at least 0."}]' })
	@Transform(
		({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder,
		{ toClassOnly: true },
	)
	displayOrder?: number;
}

@ApiSchema({ name: 'SpacesModuleReqCreateSpace' })
export class ReqCreateSpaceDto {
	@ApiProperty({
		description: 'Space creation data',
		type: () => CreateSpaceDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateSpaceDto)
	data: CreateSpaceDto;
}
