import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateLocationDto } from '../../../modules/weather/dto/create-location.dto';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE } from '../weather-openweathermap-onecall.constants';

@ApiSchema({ name: 'WeatherOpenweathermapOnecallPluginCreateLocation' })
export class CreateOpenWeatherMapOneCallLocationDto extends CreateLocationDto {
	@ApiProperty({
		description: 'Location type',
		type: 'string',
		default: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
		example: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid location type string."}]' })
	readonly type: typeof WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE;

	@ApiProperty({
		description: 'Latitude coordinate',
		type: 'number',
		example: 50.0755,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"latitude","reason":"Latitude is required."}]' })
	@IsNumber({}, { message: '[{"field":"latitude","reason":"Latitude must be a number."}]' })
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	latitude: number;

	@ApiProperty({
		description: 'Longitude coordinate',
		type: 'number',
		example: 14.4378,
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"longitude","reason":"Longitude is required."}]' })
	@IsNumber({}, { message: '[{"field":"longitude","reason":"Longitude must be a number."}]' })
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	longitude: number;

	@ApiPropertyOptional({
		description: 'Country code',
		name: 'country_code',
		type: 'string',
		example: 'CZ',
	})
	@Expose({ name: 'country_code' })
	@Transform(
		({ obj }: { obj: { country_code?: string | null; countryCode?: string | null } }) => {
			const value = obj.country_code || obj.countryCode;
			return value === null ? undefined : value;
		},
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"country_code","reason":"Country code must be a string."}]' })
	countryCode?: string;
}
