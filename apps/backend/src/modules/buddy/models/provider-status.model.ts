import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

@ApiSchema({ name: 'BuddyModuleDataProviderStatus' })
export class ProviderStatusDataModel {
	@ApiProperty({ description: 'Plugin type identifier', type: 'string', example: 'buddy-openai-plugin' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Human-readable provider name', type: 'string', example: 'OpenAI' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Provider description', type: 'string' })
	@Expose()
	description: string;

	@ApiProperty({
		name: 'default_model',
		description: 'Default model name for this provider',
		type: 'string',
		example: 'gpt-4o',
	})
	@Expose({ name: 'default_model' })
	defaultModel: string;

	@ApiProperty({ description: 'Whether the plugin is enabled in configuration', type: 'boolean', example: true })
	@Expose()
	enabled: boolean;

	@ApiProperty({
		description: 'Whether the plugin has the required credentials/settings configured',
		type: 'boolean',
		example: false,
	})
	@Expose()
	configured: boolean;

	@ApiProperty({
		description: 'Whether this provider is currently the active provider',
		type: 'boolean',
		example: false,
	})
	@Expose()
	selected: boolean;
}

@ApiSchema({ name: 'BuddyModuleResProviderStatuses' })
export class ProviderStatusesResponseModel extends BaseSuccessResponseModel<ProviderStatusDataModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { type: 'object', $ref: '#/components/schemas/BuddyModuleDataProviderStatus' },
	})
	@Expose()
	@Type(() => ProviderStatusDataModel)
	declare data: ProviderStatusDataModel[];
}
