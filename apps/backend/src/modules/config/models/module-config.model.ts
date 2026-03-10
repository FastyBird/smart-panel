import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from './config.model';

@ApiSchema({ name: 'ConfigModuleDataConfigModule' })
export class ConfigModuleConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
