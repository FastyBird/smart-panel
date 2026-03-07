import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_VOICEAI_PLUGIN_NAME } from '../buddy-voiceai.constants';

@ApiSchema({ name: 'BuddyVoiceaiPluginUpdateConfig' })
export class UpdateBuddyVoiceaiConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_VOICEAI_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_VOICEAI_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable the plugin',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

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
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a string."}]' })
	apiKey?: string | null;

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
	@IsString({ message: '[{"field":"voice_id","reason":"Voice ID must be a string."}]' })
	voiceId?: string | null;
}
