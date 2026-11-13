import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';

@ApiSchema({ name: 'CamerasModuleUpdateConfig' })
export class UpdateCamerasConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'cameras-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = CAMERAS_MODULE_NAME;
}
