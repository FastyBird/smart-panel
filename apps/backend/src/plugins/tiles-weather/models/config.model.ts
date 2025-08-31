import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { TILES_WEATHER_PLUGIN_NAME } from '../tiles-weather.constants';

export class WeatherConfigModel extends PluginConfigModel {
	@Expose({ groups: ['api'] })
	@IsString()
	type: string = TILES_WEATHER_PLUGIN_NAME;

	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
