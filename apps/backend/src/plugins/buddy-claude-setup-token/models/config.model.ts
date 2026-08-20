import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME } from '../buddy-claude-setup-token.constants';

@ApiSchema({ name: 'BuddyClaudeSetupTokenPluginDataConfig' })
export class BuddyClaudeSetupTokenConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description:
			'Setup token obtained from claude setup-token command. This value is accepted on write and never returned.',
		name: 'access_token',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'access_token' })
	@Transform(
		({ obj }: { obj: { access_token?: string | null; accessToken?: string | null } }) => {
			const raw = obj.access_token ?? obj.accessToken;

			return typeof raw === 'string' ? raw.replace(/\s+/g, '') || null : raw;
		},
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	accessToken: string | null = null;

	@ApiProperty({
		description: 'Whether a Claude setup token is configured',
		name: 'access_token_configured',
	})
	@Expose({ name: 'access_token_configured' })
	@IsOptional()
	@IsBoolean()
	accessTokenConfigured?: boolean;

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
