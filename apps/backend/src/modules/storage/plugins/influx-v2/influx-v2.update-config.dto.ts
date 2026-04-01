import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../config/dto/config.dto';

import { INFLUX_V2_PLUGIN_NAME } from './influx-v2.constants';

@ApiSchema({ name: 'StorageInfluxV2PluginUpdateConfig' })
export class UpdateInfluxV2ConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: INFLUX_V2_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = INFLUX_V2_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'InfluxDB v2 server URL.',
		type: 'string',
		example: 'http://localhost:8086',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"url","reason":"URL must be a valid string."}]' })
	url?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB v2 API token for authentication.',
		type: 'string',
		example: 'my-token',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"token","reason":"Token must be a valid string."}]' })
	token?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB v2 organization name.',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"org","reason":"Organization must be a valid string."}]' })
	org?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB v2 bucket name.',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"bucket","reason":"Bucket must be a valid string."}]' })
	bucket?: string;
}
