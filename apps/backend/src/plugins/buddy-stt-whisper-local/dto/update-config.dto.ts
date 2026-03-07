import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME } from '../buddy-stt-whisper-local.constants';

@ApiSchema({ name: 'BuddySttWhisperLocalPluginUpdateConfig' })
export class UpdateBuddySttWhisperLocalConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME;

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
		description: 'Whisper model name',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a string."}]' })
	model?: string | null;

	@ApiPropertyOptional({
		description: 'ISO 639-1 language code for transcription',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"language","reason":"Language must be a string."}]' })
	language?: string | null;
}
