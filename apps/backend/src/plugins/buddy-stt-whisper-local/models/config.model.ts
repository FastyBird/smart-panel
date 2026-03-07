import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME } from '../buddy-stt-whisper-local.constants';

@ApiSchema({ name: 'BuddySttWhisperLocalPluginDataConfig' })
export class BuddySttWhisperLocalConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME;

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
		description: 'Whisper model name (e.g. tiny, base, small, medium, large)',
		type: 'string',
		nullable: true,
		example: 'base',
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
