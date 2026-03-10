import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { SECURITY_MODULE_NAME } from '../security.constants';

@ApiSchema({ name: 'ConfigModuleDataSecurity' })
export class SecurityConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'security-module',
	})
	@Expose()
	@IsString()
	type: string = SECURITY_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
