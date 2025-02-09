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
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';
import { ValidatePageTiles } from '../validators/page-tile-type-constraint.validator';

import { CreateTileDto } from './create-tile.dto';

type CreatePageBase = components['schemas']['DashboardCreatePageBase'];
type CreateCardsPage = components['schemas']['DashboardCreateCardsPage'];
type CreateTilesPage = components['schemas']['DashboardCreateTilesPage'];
type CreateDevicePage = components['schemas']['DashboardCreateDevicePage'];

export abstract class CreatePageDto implements CreatePageBase {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported values."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported values."}]' })
	type: string;

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
}

export class CreateCardsPageDto extends CreatePageDto implements CreateCardsPage {
	readonly type: 'cards';

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidatePageTiles()
	tiles?: CreateTileDto[];
}

export class CreateTilesPageDto extends CreatePageDto implements CreateTilesPage {
	readonly type: 'tiles';

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidatePageTiles()
	tiles?: CreateTileDto[];
}

export class CreateDevicePageDto extends CreatePageDto implements CreateDevicePage {
	readonly type: 'device';

	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}
