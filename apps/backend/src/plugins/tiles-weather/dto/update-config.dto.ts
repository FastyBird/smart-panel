import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TILES_WEATHER_PLUGIN_NAME } from '../tiles-weather.constants';

@ApiSchema({ name: 'TilesWeatherPluginUpdateConfig' })
export class WeatherUpdateConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: TILES_WEATHER_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof TILES_WEATHER_PLUGIN_NAME;
}
