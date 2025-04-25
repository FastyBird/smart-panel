import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { ParentDto } from './common.dto';

type ReqUpdateTile = components['schemas']['DashboardModuleReqUpdateTile'];
type UpdateTile = components['schemas']['DashboardModuleUpdateTile'];

export abstract class UpdateTileDto implements UpdateTile {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	readonly type: string;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Row minimum value must be greater than 0."}]' })
	row?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col","reason":"Column minimum value must be greater than 0."}]' })
	col?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"row_span","reason":"Row span minimum value must be greater than 0."}]' })
	row_span?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	@Min(1, { message: '[{"field":"col_span","reason":"Column span minimum value must be greater than 0."}]' })
	col_span?: number;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Hidden attribute must be a valid true or false."}]' })
	hidden?: boolean;
}

export class UpdateSingleTileDto extends UpdateTileDto {
	@Expose()
	@ValidateNested()
	@Type(() => ParentDto)
	readonly parent: ParentDto;
}

export class ReqUpdateTileDto implements ReqUpdateTile {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateTileDto)
	data: UpdateTileDto;
}

export class ReqUpdateTileWithParentDto implements ReqUpdateTile {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSingleTileDto)
	data: UpdateSingleTileDto;
}
