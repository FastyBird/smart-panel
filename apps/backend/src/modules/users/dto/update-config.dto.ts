import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { USERS_MODULE_NAME } from '../users.constants';

@ApiSchema({ name: 'ConfigModuleUpdateUsers' })
export class UpdateUsersConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: USERS_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = USERS_MODULE_NAME;
}
