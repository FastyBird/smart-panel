import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiSchema } from '../../../common/decorators/api-schema.decorator';
import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import type { components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type UpdateHomeAssistantChannel = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantChannel'];

@ApiSchema('DevicesHomeAssistantPluginUpdateHomeAssistantChannel')
export class UpdateHomeAssistantChannelDto extends UpdateChannelDto implements UpdateHomeAssistantChannel {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	@ApiProperty({
		description: 'Channel type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
