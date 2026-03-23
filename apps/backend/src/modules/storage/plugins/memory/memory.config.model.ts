import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../config/models/config.model';

import { MEMORY_PLUGIN_NAME } from './memory.constants';

@ApiSchema({ name: 'StorageMemoryPluginDataConfig' })
export class MemoryConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: MEMORY_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = MEMORY_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
