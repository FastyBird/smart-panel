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
		description: 'OAuth client ID',
		name: 'client_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'client_id' })
	@Transform(
		({ obj }: { obj: { client_id?: string | null; clientId?: string | null } }) => obj.client_id ?? obj.clientId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"client_id","reason":"Client ID must be a string."}]' })
	clientId?: string | null;

	@ApiPropertyOptional({
		description: 'OAuth client secret',
		name: 'client_secret',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'client_secret' })
	@Transform(
		({ obj }: { obj: { client_secret?: string | null; clientSecret?: string | null } }) =>
			obj.client_secret ?? obj.clientSecret,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"client_secret","reason":"Client secret must be a string."}]' })
	clientSecret?: string | null;

	@ApiPropertyOptional({
		description: 'OAuth access token',
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
		description: 'OAuth refresh token',
		name: 'refresh_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'refresh_token' })
	@Transform(
		({ obj }: { obj: { refresh_token?: string | null; refreshToken?: string | null } }) =>
			obj.refresh_token ?? obj.refreshToken,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"refresh_token","reason":"Refresh token must be a string."}]' })
	refreshToken?: string | null;

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
