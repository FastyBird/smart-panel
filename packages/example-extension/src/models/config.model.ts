import { Expose } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '@fastybird/smart-panel-backend';

import { EXAMPLE_EXTENSION_PLUGIN_NAME } from '../example-extension.constants.js';

@ApiSchema({ name: 'ExampleExtensionPluginDataConfig' })
export class ExampleExtensionConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: EXAMPLE_EXTENSION_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = EXAMPLE_EXTENSION_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = true;
}
