import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginDataConfig' })
export class SimulatorConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DEVICES_SIMULATOR_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_SIMULATOR_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
