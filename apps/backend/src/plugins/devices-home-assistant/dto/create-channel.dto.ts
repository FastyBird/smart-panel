import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { CreateChannelDto } from '../../../modules/devices/dto/create-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type CreateHomeAssistantChannel = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantChannel'];

@ApiSchema('DevicesHomeAssistantPluginCreateHomeAssistantChannel')
export class CreateHomeAssistantChannelDto extends CreateChannelDto implements CreateHomeAssistantChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	@ApiProperty({
		description: 'Channel type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	readonly type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
