import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { TILES_TIME_PLUGIN_NAME } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginDataUpdateConfig' })
export class TimeUpdateConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: TILES_TIME_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof TILES_TIME_PLUGIN_NAME;
}
