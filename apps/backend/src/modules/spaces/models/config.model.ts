import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { SPACES_MODULE_NAME } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataConfig' })
export class SpacesConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module type',
		type: 'string',
		example: SPACES_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = SPACES_MODULE_NAME;

	@ApiProperty({
		description: 'Whether the module is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
