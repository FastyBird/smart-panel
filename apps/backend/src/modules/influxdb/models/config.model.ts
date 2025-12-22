import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { INFLUXDB_DEFAULT_DATABASE, INFLUXDB_DEFAULT_HOST, INFLUXDB_MODULE_NAME } from '../influxdb.constants';

@ApiSchema({ name: 'ConfigModuleDataInfluxdb' })
export class InfluxDbConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'influxdb-module',
	})
	@Expose()
	@IsString()
	type: string = INFLUXDB_MODULE_NAME;

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
