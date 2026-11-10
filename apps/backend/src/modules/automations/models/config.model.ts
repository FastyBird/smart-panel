import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';

@ApiSchema({ name: 'ConfigModuleDataAutomations' })
export class AutomationsConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'automations-module',
	})
	@Expose()
	@IsString()
	type: string = AUTOMATIONS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
