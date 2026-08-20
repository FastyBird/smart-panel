import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { readSubmittedValue } from '../../../common/utils/transform.utils';
import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

@ApiSchema({ name: 'BuddyOpenaiCodexPluginUpdateConfig' })
export class UpdateBuddyOpenaiCodexConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_OPENAI_CODEX_PLUGIN_NAME;

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
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'client_secret', 'clientSecret'), { toClassOnly: true })
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
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'access_token', 'accessToken'), { toClassOnly: true })
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
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'refresh_token', 'refreshToken'), { toClassOnly: true })
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
