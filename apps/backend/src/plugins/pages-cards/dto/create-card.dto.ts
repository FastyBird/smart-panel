import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { ValidateDataSourceType } from '../../../modules/dashboard/validators/data-source-type-constraint.validator';
import { ValidateTileType } from '../../../modules/dashboard/validators/tile-type-constraint.validator';

@ApiSchema({ name: 'PagesCardsPluginCreateCard' })
export class CreateCardDto {
	@ApiPropertyOptional({
		description: 'Card unique identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({
		description: 'Card title',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title: string;

	@ApiPropertyOptional({
		description: 'Card icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-home',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiProperty({
		description: 'Card order position',
		type: 'integer',
		example: 1,
	})
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order: number;

	@ApiPropertyOptional({
		description: 'Card tiles',
		type: 'array',
		items: { $ref: getSchemaPath(CreateTileDto) },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileType()
	@Type(() => CreateTileDto)
	tiles?: CreateTileDto[] = [];

	@ApiPropertyOptional({
		description: 'Card data sources',
		name: 'data_source',
		type: 'array',
		items: { $ref: getSchemaPath(CreateDataSourceDto) },
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateDataSourceType()
	@Type(() => CreateDataSourceDto)
	data_source?: CreateDataSourceDto[] = [];
}

@ApiSchema({ name: 'PagesCardsPluginCreateSingleCard' })
export class CreateSingleCardDto extends CreateCardDto {
	@ApiProperty({
		description: 'Page identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"page","reason":"Page ID must be a valid UUID (version 4)."}]' })
	readonly page: string;
}

@ApiSchema({ name: 'PagesCardsPluginReqCreateCard' })
export class ReqCreateCardDto {
	@ApiProperty({
		description: 'Card creation data',
		type: CreateSingleCardDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateSingleCardDto)
	data: CreateSingleCardDto;
}
