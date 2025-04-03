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
import { ValidateTileDataSources } from '../validators/tile-data-source-type-constraint.validator';

import { CreateDeviceChannelDataSourceDto } from './create-data-source.dto';

type CreateTileBase = components['schemas']['DashboardCreateTileBase'];
type CreateDevicePreviewTile = components['schemas']['DashboardCreateDevicePreviewTile'];
type CreateTimeTile = components['schemas']['DashboardCreateTimeTile'];
type CreateDayWeatherTile = components['schemas']['DashboardCreateDayWeatherTile'];
type CreateForecastWeatherTile = components['schemas']['DashboardCreateForecastWeatherTile'];

export abstract class CreateTileDto implements CreateTileBase {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported tile type."}]' })
	readonly type: string;

	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"data_source","reason":"Data source must be an array."}]' })
	@ValidateNested({ each: true })
	@ValidateTileDataSources()
	data_source?: CreateDeviceChannelDataSourceDto[] = [];

	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row","reason":"Row must be a valid number."}]' },
	)
	row: number;

	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col","reason":"Column must be a valid number."}]' },
	)
	col: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"row_span","reason":"Row span must be a valid number."}]' },
	)
	row_span?: number;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' })
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"col_span","reason":"Column span must be a valid number."}]' },
	)
	col_span?: number;
}

export class CreateDevicePreviewTileDto extends CreateTileDto implements CreateDevicePreviewTile {
	readonly type: 'device-preview';

	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}

export class CreateTimeTileDto extends CreateTileDto implements CreateTimeTile {
	readonly type: 'clock';
}

export class CreateDayWeatherTileDto extends CreateTileDto implements CreateDayWeatherTile {
	readonly type: 'weather-day';
}

export class CreateForecastWeatherTileDto extends CreateTileDto implements CreateForecastWeatherTile {
	readonly type: 'weather-forecast';
}
