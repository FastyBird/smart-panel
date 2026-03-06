import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';

@ApiSchema({ name: 'BuddyDiscordPluginDataConfig' })
export class BuddyDiscordConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_DISCORD_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_DISCORD_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Discord Bot Token from the Discord Developer Portal',
		name: 'bot_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'bot_token' })
	@Transform(
		({ obj }: { obj: { bot_token?: string | null; botToken?: string | null } }) => obj.bot_token ?? obj.botToken,
		{ toClassOnly: true },
	)
	@Transform(
		({ value }): string | null => (typeof value === 'string' && value.length > 0 ? '***' : (value as string | null)),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	botToken: string | null = null;

	@ApiPropertyOptional({
		description: 'Discord Guild (server) ID',
		name: 'guild_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'guild_id' })
	@Transform(
		({ obj }: { obj: { guild_id?: string | null; guildId?: string | null } }) => obj.guild_id ?? obj.guildId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	guildId: string | null = null;

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
	@IsString()
	generalChannelId: string | null = null;

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
	@IsString()
	spaceChannelMappings: string | null = null;

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
	@IsString()
	allowedRoleId: string | null = null;
}
