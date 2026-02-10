import { Expose, Transform } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { DEFAULT_RETENTION_DAYS, ENERGY_MODULE_NAME } from '../energy.constants';

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
	@Transform(
		({ obj }: { obj: { retention_days?: number; retentionDays?: number } }) =>
			obj.retention_days ?? obj.retentionDays ?? DEFAULT_RETENTION_DAYS,
		{ toClassOnly: true },
	)
	retentionDays: number = DEFAULT_RETENTION_DAYS;
}
