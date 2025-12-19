import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { AUTH_MODULE_NAME } from '../auth.constants';

@ApiSchema({ name: 'ConfigModuleUpdateAuth' })
export class UpdateAuthConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: AUTH_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = AUTH_MODULE_NAME;
}
