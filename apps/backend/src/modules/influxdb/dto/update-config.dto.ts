import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { INFLUXDB_MODULE_NAME } from '../influxdb.constants';

@ApiSchema({ name: 'ConfigModuleUpdateInfluxdb' })
export class UpdateInfluxDbConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'influxdb-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = INFLUXDB_MODULE_NAME;

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
