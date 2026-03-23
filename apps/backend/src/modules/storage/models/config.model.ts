import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { INFLUX_V1_PLUGIN_NAME } from '../plugins/influx-v1/influx-v1.constants';
import { MEMORY_PLUGIN_NAME } from '../plugins/memory/memory.constants';
import { STORAGE_MODULE_NAME } from '../storage.constants';

@ApiSchema({ name: 'ConfigModuleDataStorage' })
export class StorageConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'storage-module',
	})
	@Expose()
	@IsString()
	type: string = STORAGE_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

	@ApiProperty({
		description: 'Primary storage plugin',
		type: 'string',
		example: 'influx-v1-plugin',
	})
	@Expose({ name: 'primary_storage' })
	@IsString()
	primaryStorage: string = INFLUX_V1_PLUGIN_NAME;

	@ApiProperty({
		description: 'Fallback storage plugin (used when primary is unavailable)',
		type: 'string',
		example: 'memory-storage-plugin',
	})
	@Expose({ name: 'fallback_storage' })
	@IsString()
	fallbackStorage: string = MEMORY_PLUGIN_NAME;
}
