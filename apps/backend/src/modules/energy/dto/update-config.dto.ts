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
}
