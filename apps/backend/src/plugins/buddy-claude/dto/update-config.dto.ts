import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_CLAUDE_PLUGIN_NAME } from '../buddy-claude.constants';

@ApiSchema({ name: 'BuddyClaudePluginUpdateConfig' })
export class UpdateBuddyClaudeConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_CLAUDE_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_CLAUDE_PLUGIN_NAME;

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
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a string."}]' })
	apiKey?: string | null;

	@ApiPropertyOptional({
		description: 'Model name to use (e.g. claude-sonnet-4-20250514)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a string."}]' })
	model?: string | null;
}
