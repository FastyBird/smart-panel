import { Expose, Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateLocationDto } from '../../../modules/weather/dto/update-location.dto';

@ApiSchema({ name: 'WeatherOpenweathermapOnecallPluginUpdateLocation' })
export class UpdateOpenWeatherMapOneCallLocationDto extends UpdateLocationDto {
	@ApiPropertyOptional({
		description: 'Latitude coordinate',
		type: 'number',
		example: 50.0755,
	})
	@Expose()
	@Transform(({ value }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"latitude","reason":"Latitude must be a number."}]' })
	@Min(-90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	@Max(90, { message: '[{"field":"latitude","reason":"Latitude must be between -90 and 90."}]' })
	latitude?: number;

	@ApiPropertyOptional({
		description: 'Longitude coordinate',
		type: 'number',
		example: 14.4378,
	})
	@Expose()
	@Transform(({ value }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"longitude","reason":"Longitude must be a number."}]' })
	@Min(-180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	@Max(180, { message: '[{"field":"longitude","reason":"Longitude must be between -180 and 180."}]' })
	longitude?: number;

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
