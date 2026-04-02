import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../modules/config/dto/config.dto';

import { MEMORY_PLUGIN_NAME } from './memory-storage.constants';

@ApiSchema({ name: 'StorageMemoryPluginUpdateConfig' })
export class UpdateMemoryConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: MEMORY_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = MEMORY_PLUGIN_NAME;
}
