import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginUpdateConfig' })
export class SimulatorUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: DEVICES_SIMULATOR_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_SIMULATOR_PLUGIN_NAME;
}
