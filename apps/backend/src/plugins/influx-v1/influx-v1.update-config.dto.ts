import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../modules/config/dto/config.dto';

import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';

@ApiSchema({ name: 'StorageInfluxV1PluginUpdateConfig' })
export class UpdateInfluxV1ConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin identifier',
		type: 'string',
		example: INFLUX_V1_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = INFLUX_V1_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'InfluxDB server host.',
		type: 'string',
		example: 'localhost',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"host","reason":"Host must be a valid string."}]' })
	host?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB database name.',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"database","reason":"Database must be a valid string."}]' })
	database?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB username for authentication.',
		type: 'string',
		example: 'admin',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"username","reason":"Username must be a valid string."}]' })
	username?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB password for authentication.',
		type: 'string',
		example: 'secret',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"password","reason":"Password must be a valid string."}]' })
	password?: string;
}
