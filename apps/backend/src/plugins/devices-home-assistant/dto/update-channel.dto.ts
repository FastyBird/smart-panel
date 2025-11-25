import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateChannelDto } from '../../../modules/devices/dto/update-channel.dto';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

@ApiSchema({ name: 'DevicesHomeAssistantPluginUpdateHomeAssistantChannel' })
export class UpdateHomeAssistantChannelDto extends UpdateChannelDto {
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel type string."}]' })
	@ApiProperty({
		description: 'Channel type identifier',
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	type: typeof DEVICES_HOME_ASSISTANT_TYPE;
}
