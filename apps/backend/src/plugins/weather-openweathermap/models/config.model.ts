import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TemperatureUnitType } from '../../../modules/system/system.constants';
import { WEATHER_OPENWEATHERMAP_PLUGIN_NAME } from '../weather-openweathermap.constants';

@ApiSchema({ name: 'WeatherOpenweathermapPluginDataConfig' })
export class OpenWeatherMapConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = WEATHER_OPENWEATHERMAP_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap API key',
		name: 'api_key',
		type: 'string',
		example: 'your-api-key-here',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@Transform(({ obj }: { obj: { api_key?: string | null; apiKey?: string | null } }) => obj.api_key ?? obj.apiKey, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiProperty({
		description: 'Temperature unit',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@IsEnum(TemperatureUnitType)
	unit: TemperatureUnitType = TemperatureUnitType.CELSIUS;
}
