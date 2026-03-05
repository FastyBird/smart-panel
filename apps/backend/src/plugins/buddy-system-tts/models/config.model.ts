import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_SYSTEM_TTS_PLUGIN_NAME } from '../buddy-system-tts.constants';

@ApiSchema({ name: 'BuddySystemTtsPluginDataConfig' })
export class BuddySystemTtsConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_SYSTEM_TTS_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_SYSTEM_TTS_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Preferred TTS engine (piper or espeak). Auto-detected if not set.',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	engine: string | null = null;

	@ApiPropertyOptional({
		description: 'Voice identifier (piper model name or espeak voice code)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	voice: string | null = null;
}
