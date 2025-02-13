import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import {
	CreateDayWeatherTileDto,
	CreateDeviceTileDto,
	CreateForecastWeatherTileDto,
	CreateTimeTileDto,
} from './create-tile.dto';

type ReqCreatePageTile = components['schemas']['DashboardReqCreatePageTile'];

const determineTileDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		switch ((obj.data as { type: string }).type) {
			case 'device':
				return CreatePageDeviceTileDto;
			case 'clock':
				return CreatePageTimeTileDto;
			case 'weather-day':
				return CreatePageDayWeatherTileDto;
			case 'weather-forecast':
				return CreatePageForecastWeatherTileDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining tile DTO');
};

export class CreatePageDeviceTileDto extends CreateDeviceTileDto {}

export class CreatePageTimeTileDto extends CreateTimeTileDto {}

export class CreatePageDayWeatherTileDto extends CreateDayWeatherTileDto {}

export class CreatePageForecastWeatherTileDto extends CreateForecastWeatherTileDto {}

export class ReqCreatePageTileDto implements ReqCreatePageTile {
	@Expose()
	@ValidateNested()
	@Type((options) => determineTileDto(options?.object ?? {}))
	data:
		| CreatePageDeviceTileDto
		| CreatePageTimeTileDto
		| CreatePageDayWeatherTileDto
		| CreatePageForecastWeatherTileDto;
}
