import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { DEVICES_MODULE_NAME } from '../devices.constants';

@ApiSchema({ name: 'ConfigModuleDataDevices' })
export class DevicesConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: DEVICES_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_MODULE_NAME;
}
