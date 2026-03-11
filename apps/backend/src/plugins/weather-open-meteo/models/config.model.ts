import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TemperatureUnitType } from '../../../modules/system/system.constants';
import { WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

@ApiSchema({ name: 'WeatherOpenMeteoPluginDataConfig' })
export class OpenMeteoConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: WEATHER_OPEN_METEO_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = WEATHER_OPEN_METEO_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;

	@ApiProperty({
		description: 'Temperature unit',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;
}
