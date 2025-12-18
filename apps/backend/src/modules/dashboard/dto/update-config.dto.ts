import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';

@ApiSchema({ name: 'ConfigModuleUpdateDashboard' })
export class UpdateDashboardConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: DASHBOARD_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = DASHBOARD_MODULE_NAME;
}
