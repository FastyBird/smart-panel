import { Expose } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { ENERGY_MODULE_NAME, MAX_RETENTION_DAYS } from '../energy.constants';

@ApiSchema({ name: 'ConfigModuleUpdateEnergy' })
export class UpdateEnergyConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'energy-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = ENERGY_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'retention_days',
		description: 'Number of days to retain energy delta records before cleanup.',
		type: 'integer',
		example: 90,
	})
	@Expose({ name: 'retention_days' })
	@IsOptional()
	@IsInt({ message: '[{"field":"retention_days","reason":"Retention days must be an integer."}]' })
	@Min(1, { message: '[{"field":"retention_days","reason":"Retention days must be at least 1."}]' })
	@Max(MAX_RETENTION_DAYS, {
		message: `[{"field":"retention_days","reason":"Retention days must not exceed ${MAX_RETENTION_DAYS}."}]`,
	})
	retention_days?: number;

	@ApiPropertyOptional({
		name: 'cache_ttl_seconds',
		description: 'TTL in seconds for cached energy query results. 0 disables caching.',
		type: 'integer',
		example: 30,
	})
	@Expose({ name: 'cache_ttl_seconds' })
	@IsOptional()
	@IsInt({ message: '[{"field":"cache_ttl_seconds","reason":"Cache TTL must be an integer."}]' })
	@Min(0, { message: '[{"field":"cache_ttl_seconds","reason":"Cache TTL must be at least 0."}]' })
	@Max(3600, {
		message: '[{"field":"cache_ttl_seconds","reason":"Cache TTL must not exceed 3600."}]',
	})
	cache_ttl_seconds?: number;
}
