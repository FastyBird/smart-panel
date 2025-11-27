import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateDeviceChannelPropertyDto } from './update-device-channel-property.dto';

@ApiSchema({ name: 'DevicesModuleUpdateChannelProperty' })
export class UpdateChannelPropertyDto extends UpdateDeviceChannelPropertyDto {}

@ApiSchema({ name: 'DevicesModuleReqUpdateChannelProperty' })
export class ReqUpdateChannelPropertyDto {
	@ApiProperty({ description: 'Channel property data', type: () => UpdateChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelPropertyDto)
	data: UpdateChannelPropertyDto;
}
