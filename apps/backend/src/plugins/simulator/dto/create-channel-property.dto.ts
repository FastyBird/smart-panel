import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { SIMULATOR_TYPE } from '../simulator.constants';

@ApiSchema({ name: 'SimulatorPluginCreateChannelProperty' })
export class CreateSimulatorChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: SIMULATOR_TYPE,
		example: SIMULATOR_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof SIMULATOR_TYPE;
}
