import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { INTENTS_MODULE_NAME } from '../intents.constants';

@ApiSchema({ name: 'ConfigModuleUpdateIntents' })
export class UpdateIntentsConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'intents-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = INTENTS_MODULE_NAME;
}
