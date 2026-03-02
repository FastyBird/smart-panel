import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_CLAUDE_OAUTH_PLUGIN_NAME } from '../buddy-claude-oauth.constants';

@ApiSchema({ name: 'BuddyClaudeOauthPluginUpdateConfig' })
export class UpdateBuddyClaudeOauthConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_CLAUDE_OAUTH_PLUGIN_NAME;

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
		description: 'Setup token obtained from claude setup-token command',
		name: 'access_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'access_token' })
	@Transform(
		({ obj }: { obj: { access_token?: string | null; accessToken?: string | null } }) =>
			obj.access_token ?? obj.accessToken,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"access_token","reason":"Access token must be a string."}]' })
	accessToken?: string | null;

	@ApiPropertyOptional({
		description: 'Model name to use',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a string."}]' })
	model?: string | null;
}
