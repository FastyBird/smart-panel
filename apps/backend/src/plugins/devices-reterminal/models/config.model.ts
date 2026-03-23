import { Expose, Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEFAULT_SENSOR_POLLING_INTERVAL_MS, DEVICES_RETERMINAL_PLUGIN_NAME } from '../devices-reterminal.constants';

/**
 * reTerminal polling configuration
 */
@ApiSchema({ name: 'DevicesReTerminalPluginDataPollingConfig' })
export class ReTerminalPollingConfigModel {
	@Expose()
	@IsInt()
	@Min(1000)
	@ApiProperty({
		description: 'Sensor polling interval in milliseconds',
		example: DEFAULT_SENSOR_POLLING_INTERVAL_MS,
		minimum: 1000,
	})
	interval: number = DEFAULT_SENSOR_POLLING_INTERVAL_MS;
}

/**
 * Main reTerminal plugin configuration model
 */
@ApiSchema({ name: 'DevicesReTerminalPluginDataConfig' })
export class ReTerminalConfigModel extends PluginConfigModel {
	@Expose()
	@IsString()
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_RETERMINAL_PLUGIN_NAME,
	})
	type: string = DEVICES_RETERMINAL_PLUGIN_NAME;

	@Expose()
	@ValidateNested()
	@Type(() => ReTerminalPollingConfigModel)
	@ApiProperty({
		description: 'Polling configuration',
		type: () => ReTerminalPollingConfigModel,
	})
	polling: ReTerminalPollingConfigModel = new ReTerminalPollingConfigModel();
}
