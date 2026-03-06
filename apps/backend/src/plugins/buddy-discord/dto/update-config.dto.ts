import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';

@ApiSchema({ name: 'BuddyDiscordPluginUpdateConfig' })
export class UpdateBuddyDiscordConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_DISCORD_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_DISCORD_PLUGIN_NAME;

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
		description: 'Discord Bot Token from the Discord Developer Portal',
		name: 'bot_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'bot_token' })
	@Transform(
		({ obj }: { obj: { bot_token?: string | null; botToken?: string | null } }) => {
			const resolved = obj.bot_token ?? obj.botToken;

			return resolved === '***' ? undefined : resolved;
		},
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"bot_token","reason":"Bot token must be a string."}]' })
	botToken?: string | null;

	@ApiPropertyOptional({
		description: 'Discord Guild (server) ID',
		name: 'guild_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'guild_id' })
	@Transform(({ obj }: { obj: { guild_id?: string | null; guildId?: string | null } }) => obj.guild_id ?? obj.guildId, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString({ message: '[{"field":"guild_id","reason":"Guild ID must be a string."}]' })
	guildId?: string | null;

	@ApiPropertyOptional({
		description: 'General Discord channel ID for cross-space queries',
		name: 'general_channel_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'general_channel_id' })
	@Transform(
		({ obj }: { obj: { general_channel_id?: string | null; generalChannelId?: string | null } }) =>
			obj.general_channel_id ?? obj.generalChannelId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"general_channel_id","reason":"General channel ID must be a string."}]' })
	generalChannelId?: string | null;

	@ApiPropertyOptional({
		description: 'JSON mapping of space IDs to Discord channel IDs, e.g. {"space-uuid":"channel-id"}',
		name: 'space_channel_mappings',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'space_channel_mappings' })
	@Transform(
		({ obj }: { obj: { space_channel_mappings?: string | null; spaceChannelMappings?: string | null } }) =>
			obj.space_channel_mappings ?? obj.spaceChannelMappings,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"space_channel_mappings","reason":"Space channel mappings must be a string."}]' })
	spaceChannelMappings?: string | null;

	@ApiPropertyOptional({
		description: 'Discord role ID required to interact with the bot (empty = allow all server members)',
		name: 'allowed_role_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'allowed_role_id' })
	@Transform(
		({ obj }: { obj: { allowed_role_id?: string | null; allowedRoleId?: string | null } }) =>
			obj.allowed_role_id ?? obj.allowedRoleId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"allowed_role_id","reason":"Allowed role ID must be a string."}]' })
	allowedRoleId?: string | null;
}
