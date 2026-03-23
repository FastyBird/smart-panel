import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { STORAGE_MODULE_NAME } from '../storage.constants';

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
}
