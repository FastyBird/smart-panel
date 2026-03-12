import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

@ApiSchema({ name: 'BuddyModuleDataMessagingProviderStatus' })
export class MessagingProviderStatusDataModel {
	@ApiProperty({ description: 'Plugin type identifier', type: 'string', example: 'buddy-telegram-plugin' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Human-readable provider name', type: 'string', example: 'Telegram' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Provider description', type: 'string' })
	@Expose()
	description: string;

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
}

@ApiSchema({ name: 'BuddyModuleResMessagingProviderStatuses' })
export class MessagingProviderStatusesResponseModel extends BaseSuccessResponseModel<
	MessagingProviderStatusDataModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { type: 'object', $ref: '#/components/schemas/BuddyModuleDataMessagingProviderStatus' },
	})
	@Expose()
	@Type(() => MessagingProviderStatusDataModel)
	declare data: MessagingProviderStatusDataModel[];
}
