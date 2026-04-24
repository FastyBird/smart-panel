import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME } from '../spaces-synthetic-entry.constants';

@ApiSchema({ name: 'SpacesSyntheticEntryPluginUpdateConfig' })
export class SpacesSyntheticEntryUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME;
}
