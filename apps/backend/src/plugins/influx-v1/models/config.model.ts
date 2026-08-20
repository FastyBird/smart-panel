import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { INFLUXDB_DEFAULT_DATABASE, INFLUXDB_DEFAULT_HOST, INFLUX_V1_PLUGIN_NAME } from '../influx-v1.constants';

@ApiSchema({ name: 'StorageInfluxV1PluginDataConfig' })
export class InfluxV1ConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: INFLUX_V1_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = INFLUX_V1_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

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
		description: 'InfluxDB password for authentication. This value is accepted on write and never returned.',
		type: 'string',
		example: 'secret',
		writeOnly: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	password?: string;

	@ApiProperty({
		description: 'Whether an InfluxDB password is configured',
		name: 'password_configured',
	})
	@Expose({ name: 'password_configured' })
	@IsOptional()
	@IsBoolean()
	passwordConfigured?: boolean;
}
