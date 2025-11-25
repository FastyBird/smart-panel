import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { DEVICES_THIRD_PARTY_PLUGIN_NAME } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginUpdateConfig' })
export class ThirdPartyUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_THIRD_PARTY_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_THIRD_PARTY_PLUGIN_NAME;
}
