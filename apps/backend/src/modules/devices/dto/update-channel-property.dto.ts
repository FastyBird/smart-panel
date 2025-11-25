import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { UpdateDeviceChannelPropertyDto } from './update-device-channel-property.dto';

type ReqUpdateChannelProperty = components['schemas']['DevicesModuleReqUpdateChannelProperty'];
type UpdateChannelProperty = components['schemas']['DevicesModuleUpdateChannelProperty'];

@ApiSchema({ name: 'DevicesModuleUpdateChannelProperty' })
export class UpdateChannelPropertyDto extends UpdateDeviceChannelPropertyDto implements UpdateChannelProperty {}

@ApiSchema({ name: 'DevicesModuleReqUpdateChannelProperty' })
export class ReqUpdateChannelPropertyDto implements ReqUpdateChannelProperty {
	@ApiProperty({ description: 'Channel property data', type: UpdateChannelPropertyDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelPropertyDto)
	data: UpdateChannelPropertyDto;
}
