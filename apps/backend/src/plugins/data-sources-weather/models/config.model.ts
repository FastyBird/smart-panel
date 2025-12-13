import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DATA_SOURCES_WEATHER_PLUGIN_NAME } from '../data-sources-weather.constants';

@ApiSchema({ name: 'DataSourcesWeatherPluginDataConfig' })
export class WeatherDataSourceConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DATA_SOURCES_WEATHER_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DATA_SOURCES_WEATHER_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
