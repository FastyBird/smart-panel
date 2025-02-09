import { Expose } from 'class-transformer';
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

import type { components } from '../../../openapi';
import { ValidatePageTiles } from '../validators/page-tile-type-constraint.validator';
import { ValidateTileDataSources } from '../validators/tile-data-source-type-constraint.validator';

import { CreateDataSourceDto } from './create-data-source.dto';
import { CreateTileDto } from './create-tile.dto';

type CreateCard = components['schemas']['DashboardCreateCard'];

export class CreateCardDto implements CreateCard {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number."}]' },
	)
	order: number;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidatePageTiles()
	tiles?: CreateTileDto[];

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileDataSources()
	data_source?: CreateDataSourceDto[] = [];
}
