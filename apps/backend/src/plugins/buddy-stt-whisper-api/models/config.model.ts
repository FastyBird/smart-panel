import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_STT_WHISPER_API_PLUGIN_NAME } from '../buddy-stt-whisper-api.constants';

@ApiSchema({ name: 'BuddySttWhisperApiPluginDataConfig' })
export class BuddySttWhisperApiConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_STT_WHISPER_API_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_STT_WHISPER_API_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable the plugin',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'OpenAI API key for Whisper STT',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@Transform(({ obj }: { obj: { api_key?: string | null; apiKey?: string | null } }) => obj.api_key ?? obj.apiKey, {
		toClassOnly: true,
	})
	@Transform(
		({ value }): string | null => (typeof value === 'string' && value.length > 0 ? '***' : (value as string | null)),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		description: 'Whisper model name',
		type: 'string',
		nullable: true,
		example: 'whisper-1',
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;

	@ApiPropertyOptional({
		description: 'ISO 639-1 language code for transcription (e.g. en, cs)',
		type: 'string',
		nullable: true,
		example: 'en',
	})
	@Expose()
	@IsOptional()
	@IsString()
	language: string | null = null;
}
