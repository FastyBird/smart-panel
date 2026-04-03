import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	INFLUXDB_V2_DEFAULT_BUCKET,
	INFLUXDB_V2_DEFAULT_ORG,
	INFLUXDB_V2_DEFAULT_URL,
	INFLUX_V2_PLUGIN_NAME,
} from '../influx-v2.constants';

@ApiSchema({ name: 'StorageInfluxV2PluginDataConfig' })
export class InfluxV2ConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: INFLUX_V2_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = INFLUX_V2_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = false;

	@ApiProperty({
		description: 'InfluxDB v2 server URL',
		type: 'string',
		example: 'http://127.0.0.1:8086',
	})
	@Expose()
	@IsString()
	url: string = INFLUXDB_V2_DEFAULT_URL;

	@ApiPropertyOptional({
		description: 'InfluxDB v2 API token for authentication',
		type: 'string',
		example: 'my-token',
	})
	@Expose()
	@IsOptional()
	@IsString()
	token?: string;

	@ApiProperty({
		description: 'InfluxDB v2 organization name',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsString()
	org: string = INFLUXDB_V2_DEFAULT_ORG;

	@ApiProperty({
		description: 'InfluxDB v2 bucket name',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsString()
	bucket: string = INFLUXDB_V2_DEFAULT_BUCKET;
}
