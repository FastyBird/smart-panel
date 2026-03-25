import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { PLATFORM_MODULE_NAME } from '../platform.constants';

@ApiSchema({ name: 'ConfigModuleDataPlatform' })
export class PlatformConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'platform-module',
	})
	@Expose()
	@IsString()
	type: string = PLATFORM_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;
}
