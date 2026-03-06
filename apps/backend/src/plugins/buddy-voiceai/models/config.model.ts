import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_VOICEAI_PLUGIN_NAME } from '../buddy-voiceai.constants';

@ApiSchema({ name: 'BuddyVoiceaiPluginDataConfig' })
export class BuddyVoiceaiConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_VOICEAI_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_VOICEAI_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Voice.ai API key',
		name: 'api_key',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@Transform(({ obj }: { obj: { api_key?: string | null; apiKey?: string | null } }) => obj.api_key ?? obj.apiKey, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		description: 'Voice.ai voice ID',
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
