import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';

@ApiSchema({ name: 'ConfigModuleDataDashboard' })
export class DashboardConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: DASHBOARD_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = DASHBOARD_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
