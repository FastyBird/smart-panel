import { Expose, Type } from 'class-transformer';
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

import { CreateCardDto } from './create-card.dto';
import {
	CreatePageDayWeatherTileDto,
	CreatePageDeviceTileDto,
	CreatePageForecastWeatherTileDto,
	CreatePageTimeTileDto,
} from './create-page-tile.dto';

type ReqCreatePage = components['schemas']['DashboardReqCreatePage'];
type CreatePageBase = components['schemas']['DashboardCreatePageBase'];
type CreateCardsPage = components['schemas']['DashboardCreateCardsPage'];
type CreateTilesPage = components['schemas']['DashboardCreateTilesPage'];
type CreateDevicePage = components['schemas']['DashboardCreateDevicePage'];

const determinePageDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		switch ((obj.data as { type: string }).type) {
			case 'cards':
				return CreateCardsPageDto;
			case 'tiles':
				return CreateTilesPageDto;
			case 'device':
				return CreateDevicePageDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining page DTO');
};

export abstract class CreatePageDto implements CreatePageBase {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	readonly type: string;

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
	@IsArray({ message: '[{"field":"tiles","reason":"Cards must be a valid array."}]' })
	@ValidateNested({ each: true })
	cards?: CreateCardDto[];
}

export class CreateTilesPageDto extends CreatePageDto implements CreateTilesPage {
	readonly type: 'tiles';

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"tiles","reason":"Tiles must be a valid array."}]' })
	@ValidateNested({ each: true })
	@ValidatePageTiles()
	tiles?: (
		| CreatePageDeviceTileDto
		| CreatePageTimeTileDto
		| CreatePageDayWeatherTileDto
		| CreatePageForecastWeatherTileDto
	)[];
}

export class CreateDevicePageDto extends CreatePageDto implements CreateDevicePage {
	readonly type: 'device';

	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}

export class ReqCreatePageDto implements ReqCreatePage {
	@Expose()
	@ValidateNested()
	@Type((options) => determinePageDto(options?.object ?? {}))
	data: CreateCardsPageDto | CreateTilesPageDto | CreateDevicePageDto;
}
