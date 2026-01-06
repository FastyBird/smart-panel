import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { INTENTS_MODULE_NAME } from '../intents.constants';

@ApiSchema({ name: 'ConfigModuleDataIntents' })
export class IntentsConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'intents-module',
	})
	@Expose()
	@IsString()
	type: string = INTENTS_MODULE_NAME;

	/**
	 * Intents is a core module and cannot be disabled.
	 * Always returns true regardless of configuration.
	 */
	@ApiProperty({
		description: 'Module enabled state (always true for core modules)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	override enabled: boolean = true;
}
