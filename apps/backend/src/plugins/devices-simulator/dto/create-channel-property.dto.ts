import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginCreateChannelProperty' })
export class CreateSimulatorChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_SIMULATOR_TYPE,
		example: DEVICES_SIMULATOR_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_SIMULATOR_TYPE;
}
