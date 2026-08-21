import { ApiSchema } from '@nestjs/swagger';

import { CreateHomeyDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesHomeyPluginCreateChannelProperty' })
export class CreateHomeyChannelPropertyDto extends CreateHomeyDeviceChannelPropertyDto {}
