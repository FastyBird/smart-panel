import { ApiSchema } from '@nestjs/swagger';

import { CreateProtectDeviceChannelPropertyDto } from './create-device-channel-property.dto';

@ApiSchema({ name: 'DevicesUnifiProtectPluginCreateChannelProperty' })
export class CreateProtectChannelPropertyDto extends CreateProtectDeviceChannelPropertyDto {}
