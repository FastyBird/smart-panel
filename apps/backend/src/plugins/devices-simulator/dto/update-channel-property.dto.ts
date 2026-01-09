import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';

@ApiSchema({ name: 'DevicesSimulatorPluginUpdateChannelProperty' })
export class UpdateSimulatorChannelPropertyDto extends UpdateChannelPropertyDto {
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
