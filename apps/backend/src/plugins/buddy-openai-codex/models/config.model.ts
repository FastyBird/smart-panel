import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

@ApiSchema({ name: 'BuddyOpenaiCodexPluginDataConfig' })
export class BuddyOpenaiCodexConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_OPENAI_CODEX_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

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
	@IsString()
	clientId: string | null = null;

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
	@IsString()
	clientSecret: string | null = null;

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
	@IsString()
	accessToken: string | null = null;

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
	@IsString()
	refreshToken: string | null = null;

	@ApiPropertyOptional({
		description: 'Model name to use (e.g. codex-mini)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;
}
