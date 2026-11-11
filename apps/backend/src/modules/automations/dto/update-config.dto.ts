import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';

@ApiSchema({ name: 'ConfigModuleUpdateAutomations' })
export class UpdateAutomationsConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'automations-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = AUTOMATIONS_MODULE_NAME;
}
