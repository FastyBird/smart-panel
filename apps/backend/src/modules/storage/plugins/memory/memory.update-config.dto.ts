import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../config/dto/config.dto';
import { STORAGE_PLUGIN_MEMORY } from '../../storage.constants';

@ApiSchema({ name: 'StorageMemoryPluginUpdateConfig' })
export class UpdateMemoryConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: STORAGE_PLUGIN_MEMORY,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = STORAGE_PLUGIN_MEMORY;
}
