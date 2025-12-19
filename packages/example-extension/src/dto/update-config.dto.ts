import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '@fastybird/smart-panel-backend';

import { EXAMPLE_EXTENSION_PLUGIN_NAME } from '../example-extension.constants.js';

@ApiSchema({ name: 'ExampleExtensionPluginDataUpdateConfig' })
export class ExampleExtensionUpdateConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: EXAMPLE_EXTENSION_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	declare type: typeof EXAMPLE_EXTENSION_PLUGIN_NAME;
}
