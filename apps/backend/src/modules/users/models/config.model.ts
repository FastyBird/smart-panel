import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { USERS_MODULE_NAME } from '../users.constants';

@ApiSchema({ name: 'ConfigModuleDataUsers' })
export class UsersConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: USERS_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = USERS_MODULE_NAME;
}
