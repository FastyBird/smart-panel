import { Expose } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

type UpdateTileBase = components['schemas']['DashboardUpdateTileBase'];
type UpdateDeviceTile = components['schemas']['DashboardUpdateDeviceTile'];
type UpdateTimeTile = components['schemas']['DashboardUpdateTimeTile'];
type UpdateDayWeatherTile = components['schemas']['DashboardUpdateDayWeatherTile'];
type UpdateForecastWeatherTile = components['schemas']['DashboardUpdateForecastWeatherTile'];

export abstract class UpdateTileDto implements UpdateTileBase {
	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	row?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	col?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	row_span?: number;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	col_span?: number;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"page","reason":"Page must be a valid UUID (version 4)."}]' })
	page?: string;
}

export class UpdateDeviceTileDto extends UpdateTileDto implements UpdateDeviceTile {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}

export class UpdateTimeTileDto extends UpdateTileDto implements UpdateTimeTile {}

export class UpdateDayWeatherTileDto extends UpdateTileDto implements UpdateDayWeatherTile {}

export class UpdateForecastWeatherTileDto extends UpdateTileDto implements UpdateForecastWeatherTile {}
