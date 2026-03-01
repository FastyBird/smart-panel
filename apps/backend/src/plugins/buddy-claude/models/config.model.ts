import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_CLAUDE_PLUGIN_NAME } from '../buddy-claude.constants';

@ApiSchema({ name: 'BuddyClaudePluginDataConfig' })
export class BuddyClaudeConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_CLAUDE_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_CLAUDE_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Anthropic API key',
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
		description: 'Model name to use (e.g. claude-sonnet-4-20250514)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;
}
