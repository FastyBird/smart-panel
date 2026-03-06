import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

@ApiSchema({ name: 'BuddyModuleDataVoiceProviderStatus' })
export class VoiceProviderStatusDataModel {
	@ApiProperty({ description: 'Plugin type identifier', type: 'string', example: 'buddy-stt-whisper-api-plugin' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Human-readable provider name', type: 'string', example: 'Whisper API' })
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

	@ApiProperty({
		description: 'Whether this provider is currently the active provider',
		type: 'boolean',
		example: false,
	})
	@Expose()
	selected: boolean;
}

@ApiSchema({ name: 'BuddyModuleResSttProviderStatuses' })
export class SttProviderStatusesResponseModel extends BaseSuccessResponseModel<VoiceProviderStatusDataModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { type: 'object', $ref: '#/components/schemas/BuddyModuleDataVoiceProviderStatus' },
	})
	@Expose()
	@Type(() => VoiceProviderStatusDataModel)
	declare data: VoiceProviderStatusDataModel[];
}

@ApiSchema({ name: 'BuddyModuleResTtsProviderStatuses' })
export class TtsProviderStatusesResponseModel extends BaseSuccessResponseModel<VoiceProviderStatusDataModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { type: 'object', $ref: '#/components/schemas/BuddyModuleDataVoiceProviderStatus' },
	})
	@Expose()
	@Type(() => VoiceProviderStatusDataModel)
	declare data: VoiceProviderStatusDataModel[];
}
