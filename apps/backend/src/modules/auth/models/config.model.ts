import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { AUTH_MODULE_NAME } from '../auth.constants';

@ApiSchema({ name: 'ConfigModuleDataAuth' })
export class AuthConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: AUTH_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = AUTH_MODULE_NAME;
}
