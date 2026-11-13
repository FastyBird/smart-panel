import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';

@ApiSchema({ name: 'CamerasModuleDataConfig' })
export class CamerasConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'cameras-module',
	})
	@Expose()
	@IsString()
	type: string = CAMERAS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
