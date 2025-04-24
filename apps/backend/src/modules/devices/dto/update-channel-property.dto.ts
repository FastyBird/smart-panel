import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

import { UpdateDeviceChannelPropertyDto } from './update-device-channel-property.dto';

type ReqUpdateChannelProperty = components['schemas']['DevicesModuleReqUpdateChannelProperty'];
type UpdateChannelProperty = components['schemas']['DevicesModuleUpdateChannelProperty'];

export class UpdateChannelPropertyDto extends UpdateDeviceChannelPropertyDto implements UpdateChannelProperty {}

export class ReqUpdateChannelPropertyDto implements ReqUpdateChannelProperty {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateChannelPropertyDto)
	data: UpdateChannelPropertyDto;
}
