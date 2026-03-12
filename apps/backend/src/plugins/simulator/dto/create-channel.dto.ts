import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import { SIMULATOR_TYPE } from '../simulator.constants';

@ApiSchema({ name: 'SimulatorPluginCreateChannel' })
export class CreateSimulatorChannelDto extends CreateChannelDto {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: SIMULATOR_TYPE,
		example: SIMULATOR_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	readonly type: typeof SIMULATOR_TYPE;
}
