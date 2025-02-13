import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import {
	CreateDayWeatherTileDto,
	CreateDeviceTileDto,
	CreateForecastWeatherTileDto,
	CreateTimeTileDto,
} from './create-tile.dto';

type ReqCreateCardTile = components['schemas']['DashboardReqCreateCardTile'];

const determineTileDto = (obj: unknown): new () => object => {
	if (typeof obj === 'object' && obj !== null && 'type' in obj) {
		switch ((obj as { type: string }).type) {
			case 'device':
				return CreateCardDeviceTileDto;
			case 'clock':
				return CreateCardTimeTileDto;
			case 'weather-day':
				return CreateCardDayWeatherTileDto;
			case 'weather-forecast':
				return CreateCardForecastWeatherTileDto;
			default:
				throw new Error(`Unknown type ${(obj as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining tile DTO');
};

export class CreateCardDeviceTileDto extends CreateDeviceTileDto {}

export class CreateCardTimeTileDto extends CreateTimeTileDto {}

export class CreateCardDayWeatherTileDto extends CreateDayWeatherTileDto {}

export class CreateCardForecastWeatherTileDto extends CreateForecastWeatherTileDto {}

export class ReqCreateCardTileDto implements ReqCreateCardTile {
	@Expose()
	@ValidateNested()
	@Type((options) => determineTileDto(options?.object ?? {}))
	data:
		| CreateCardDeviceTileDto
		| CreateCardTimeTileDto
		| CreateCardDayWeatherTileDto
		| CreateCardForecastWeatherTileDto;
}
