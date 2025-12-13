import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { WeatherLocationEntity } from '../../../modules/weather/entities/locations.entity';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE } from '../weather-openweathermap-onecall.constants';

@ApiSchema({ name: 'WeatherOpenweathermapOnecallPluginDataLocation' })
@ChildEntity()
export class OpenWeatherMapOneCallLocationEntity extends WeatherLocationEntity {
	@ApiProperty({
		description: 'Location type',
		type: 'string',
		default: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
		example: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
	})
	@Expose()
	get type(): string {
		return WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE;
	}

	@ApiProperty({
		description: 'Latitude coordinate',
		type: 'number',
		example: 50.0755,
	})
	@Expose()
	@IsNumber()
	@Min(-90)
	@Max(90)
	@Column({ type: 'real' })
	latitude: number;

	@ApiProperty({
		description: 'Longitude coordinate',
		type: 'number',
		example: 14.4378,
	})
	@Expose()
	@IsNumber()
	@Min(-180)
	@Max(180)
	@Column({ type: 'real' })
	longitude: number;

	@ApiPropertyOptional({
		description: 'Country code',
		name: 'country_code',
		type: 'string',
		example: 'CZ',
		nullable: true,
	})
	@Expose({ name: 'country_code' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	countryCode: string | null;
}
