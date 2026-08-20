import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';

@ApiSchema({ name: 'BuddyElevenlabsPluginDataConfig' })
export class BuddyElevenlabsConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_ELEVENLABS_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_ELEVENLABS_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'ElevenLabs API key. This value is accepted on write and never returned.',
		name: 'api_key',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'api_key' })
	@Transform(({ obj }: { obj: { api_key?: string | null; apiKey?: string | null } }) => obj.api_key ?? obj.apiKey, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiProperty({
		description: 'Whether an ElevenLabs API key is configured',
		name: 'api_key_configured',
	})
	@Expose({ name: 'api_key_configured' })
	@IsOptional()
	@IsBoolean()
	apiKeyConfigured?: boolean;

	@ApiPropertyOptional({
		description: 'ElevenLabs voice ID (e.g. 21m00Tcm4TlvDq8ikWAM for Rachel)',
		name: 'voice_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'voice_id' })
	@Transform(({ obj }: { obj: { voice_id?: string | null; voiceId?: string | null } }) => obj.voice_id ?? obj.voiceId, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	voiceId: string | null = null;
}
