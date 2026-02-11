import { Expose, Transform } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	DEFAULT_CACHE_TTL_SECONDS,
	DEFAULT_RETENTION_DAYS,
	ENERGY_MODULE_NAME,
	MAX_RETENTION_DAYS,
} from '../energy.constants';

@ApiSchema({ name: 'ConfigModuleDataEnergy' })
export class EnergyConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'energy-module',
	})
	@Expose()
	@IsString()
	type: string = ENERGY_MODULE_NAME;

	@ApiProperty({
		name: 'retention_days',
		description: 'Number of days to retain energy delta records before cleanup.',
		type: 'integer',
		example: 90,
	})
	@Expose({ name: 'retention_days' })
	@IsInt()
	@Min(1)
	@Max(MAX_RETENTION_DAYS)
	@Transform(
		({ obj }: { obj: { retention_days?: number; retentionDays?: number } }) =>
			obj.retention_days ?? obj.retentionDays ?? DEFAULT_RETENTION_DAYS,
		{ toClassOnly: true },
	)
	retentionDays: number = DEFAULT_RETENTION_DAYS;

	@ApiProperty({
		name: 'cache_ttl_seconds',
		description: 'TTL in seconds for cached energy query results.',
		type: 'integer',
		example: 30,
	})
	@Expose({ name: 'cache_ttl_seconds' })
	@IsInt()
	@Min(0)
	@Max(3600)
	@Transform(
		({ obj }: { obj: { cache_ttl_seconds?: number; cacheTtlSeconds?: number } }) =>
			obj.cache_ttl_seconds ?? obj.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
		{ toClassOnly: true },
	)
	cacheTtlSeconds: number = DEFAULT_CACHE_TTL_SECONDS;
}
