import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { STORAGE_MODULE_NAME } from '../storage.constants';

@ApiSchema({ name: 'ConfigModuleUpdateStorageInflux' })
export class UpdateInfluxConfigDto {
	@ApiPropertyOptional({
		description: 'InfluxDB server host.',
		type: 'string',
		example: 'localhost',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"influx.host","reason":"Host must be a valid string."}]' })
	host?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB database name.',
		type: 'string',
		example: 'fastybird',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"influx.database","reason":"Database must be a valid string."}]' })
	database?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB username for authentication.',
		type: 'string',
		example: 'admin',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"influx.username","reason":"Username must be a valid string."}]' })
	username?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB password for authentication.',
		type: 'string',
		example: 'secret',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"influx.password","reason":"Password must be a valid string."}]' })
	password?: string;
}

@ApiSchema({ name: 'ConfigModuleUpdateStorage' })
export class UpdateStorageConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'storage-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = STORAGE_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'Primary storage plugin.',
		type: 'string',
		example: 'influx-v1-plugin',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"primaryStorage","reason":"Primary storage must be a valid string."}]' })
	primaryStorage?: string;

	@ApiPropertyOptional({
		description: 'Fallback storage plugin.',
		type: 'string',
		example: 'memory-storage-plugin',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"fallbackStorage","reason":"Fallback storage must be a valid string."}]' })
	fallbackStorage?: string;

	@ApiPropertyOptional({
		description: 'InfluxDB plugin configuration.',
		type: () => UpdateInfluxConfigDto,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateInfluxConfigDto)
	influx?: UpdateInfluxConfigDto;
}
