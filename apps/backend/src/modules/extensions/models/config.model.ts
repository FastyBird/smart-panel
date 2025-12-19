import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

@ApiSchema({ name: 'ConfigModuleDataExtensions' })
export class ExtensionsConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'extensions-module',
	})
	@Expose()
	@IsString()
	type: string = EXTENSIONS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
