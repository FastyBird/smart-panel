import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

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

	/**
	 * Security is a core module and cannot be disabled.
	 * Always returns true regardless of configuration.
	 */
	@ApiProperty({
		description: 'Module enabled state (always true for core modules)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	override enabled: boolean = true;
}
