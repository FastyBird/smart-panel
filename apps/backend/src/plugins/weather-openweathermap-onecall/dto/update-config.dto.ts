import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TemperatureUnitType } from '../../../modules/system/system.constants';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME } from '../weather-openweathermap-onecall.constants';

@ApiSchema({ name: 'WeatherOpenweathermapOnecallPluginUpdateConfig' })
export class UpdateOpenWeatherMapOneCallConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable the plugin',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'OpenWeatherMap One Call API 3.0 key (requires subscription)',
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
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a string."}]' })
	apiKey?: string | null;

	@ApiPropertyOptional({
		description: 'Temperature unit',
		enum: TemperatureUnitType,
		example: TemperatureUnitType.CELSIUS,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(TemperatureUnitType, { message: '[{"field":"unit","reason":"Unit must be celsius or fahrenheit."}]' })
	unit?: TemperatureUnitType;
}
