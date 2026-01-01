import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { SPACES_MODULE_NAME } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleUpdateConfig' })
export class UpdateSpacesConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module type',
		type: 'string',
		example: SPACES_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof SPACES_MODULE_NAME;
}
