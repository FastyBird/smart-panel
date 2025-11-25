import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';

import { ParentDto } from './common.dto';

type ReqUpdateTile = components['schemas']['DashboardModuleReqUpdateTile'];
type UpdateTile = components['schemas']['DashboardModuleUpdateTile'];

@ApiSchema({ name: 'DashboardModuleUpdateTile' })
export abstract class UpdateTileDto implements UpdateTile {
	@ApiProperty({ description: 'Tile type', type: 'string', example: 'default' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	readonly type: string;

	@ApiPropertyOptional({ description: 'Grid row position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Row minimum value must be greater than 0."}]' })
	row?: number;

	@ApiPropertyOptional({ description: 'Grid column position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Column minimum value must be greater than 0."}]' })
	col?: number;

	@ApiPropertyOptional({
		name: 'row_span',
		description: 'Number of rows the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"row_span","reason":"Row span minimum value must be greater than 0."}]' })
	row_span?: number;

	@ApiPropertyOptional({
		name: 'col_span',
		description: 'Number of columns the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col_span","reason":"Column span minimum value must be greater than 0."}]' })
	col_span?: number;

	@ApiPropertyOptional({ description: 'Whether tile is hidden', type: 'boolean', example: false })
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Hidden attribute must be a valid true or false."}]' })
	hidden?: boolean;
}

@ApiSchema({ name: 'DashboardModuleUpdateSingleTile' })
export class UpdateSingleTileDto extends UpdateTileDto {
	@ApiProperty({ description: 'Parent entity information', type: () => ParentDto })
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

@ApiSchema({ name: 'DashboardModuleReqUpdateTile' })
export class ReqUpdateTileDto implements ReqUpdateTile {
	@ApiProperty({ description: 'Tile data', type: () => UpdateTileDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateTileDto)
	data: UpdateTileDto;
}

@ApiSchema({ name: 'DashboardModuleReqUpdateTileWithParent' })
export class ReqUpdateTileWithParentDto implements ReqUpdateTile {
	@ApiProperty({ description: 'Tile data', type: () => UpdateSingleTileDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSingleTileDto)
	data: UpdateSingleTileDto;
}
