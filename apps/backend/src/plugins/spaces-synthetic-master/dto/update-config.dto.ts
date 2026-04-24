import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { SPACES_SYNTHETIC_MASTER_PLUGIN_NAME } from '../spaces-synthetic-master.constants';

@ApiSchema({ name: 'SpacesSyntheticMasterPluginUpdateConfig' })
export class SpacesSyntheticMasterUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof SPACES_SYNTHETIC_MASTER_PLUGIN_NAME;
}
