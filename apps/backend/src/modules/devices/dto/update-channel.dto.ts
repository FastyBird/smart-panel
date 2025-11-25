import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceChannelDto } from './update-device-channel.dto';

@ApiSchema({ name: 'DevicesModuleUpdateChannel' })
export class UpdateChannelDto extends UpdateDeviceChannelDto {}

@ApiSchema({ name: 'DevicesModuleReqUpdateChannel' })
export class ReqUpdateChannelDto {
	@ApiProperty({ description: 'Channel data', type: UpdateChannelDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelDto)
	data: UpdateChannelDto;
}
