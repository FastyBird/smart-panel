import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	INFLUXDB_DEFAULT_DATABASE,
	INFLUXDB_DEFAULT_HOST,
	STORAGE_MODULE_NAME,
	STORAGE_PLUGIN_INFLUX_V1,
	STORAGE_PLUGIN_MEMORY,
} from '../storage.constants';

@ApiSchema({ name: 'ConfigModuleDataStorageInflux' })
export class InfluxConfigModel {
	@ApiProperty({
		description: 'InfluxDB server host',
		type: 'string',
		example: '127.0.0.1',
	})
	@Expose()
	@IsString()
	host: string = INFLUXDB_DEFAULT_HOST;

	@ApiProperty({
		description: 'InfluxDB database name',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsString()
	database: string = INFLUXDB_DEFAULT_DATABASE;

	@ApiPropertyOptional({
		description: 'InfluxDB username for authentication',
		type: 'string',
		example: 'admin',
	})
	@Expose()
	@IsOptional()
	@IsString()
	username?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB password for authentication',
		type: 'string',
		example: 'secret',
	})
	@Expose()
	@IsOptional()
	@IsString()
	password?: string;
}

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
	@Expose()
	@IsString()
	primaryStorage: string = STORAGE_PLUGIN_INFLUX_V1;

	@ApiProperty({
		description: 'Fallback storage plugin (used when primary is unavailable)',
		type: 'string',
		example: 'memory-storage-plugin',
	})
	@Expose()
	@IsString()
	fallbackStorage: string = STORAGE_PLUGIN_MEMORY;

	@ApiProperty({
		description: 'InfluxDB plugin configuration',
		type: () => InfluxConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => InfluxConfigModel)
	influx: InfluxConfigModel = new InfluxConfigModel();
}
