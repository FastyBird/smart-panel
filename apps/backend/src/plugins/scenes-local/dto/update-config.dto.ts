import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { SCENES_LOCAL_PLUGIN_NAME } from '../scenes-local.constants';

@ApiSchema({ name: 'ScenesLocalPluginUpdateConfig' })
export class ScenesLocalUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: SCENES_LOCAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof SCENES_LOCAL_PLUGIN_NAME;
}
