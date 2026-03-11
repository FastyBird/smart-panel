import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TemperatureUnitType } from '../../../modules/system/system.constants';
import { WEATHER_OPEN_METEO_PLUGIN_NAME } from '../weather-open-meteo.constants';

@ApiSchema({ name: 'WeatherOpenMeteoPluginUpdateConfig' })
export class UpdateOpenMeteoConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: WEATHER_OPEN_METEO_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof WEATHER_OPEN_METEO_PLUGIN_NAME;

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
