import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_TELEGRAM_PLUGIN_NAME } from '../buddy-telegram.constants';

@ApiSchema({ name: 'BuddyTelegramPluginDataConfig' })
export class BuddyTelegramConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_TELEGRAM_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_TELEGRAM_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Telegram Bot API token (from @BotFather). This value is accepted on write and never returned.',
		name: 'bot_token',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'bot_token' })
	@Transform(
		({ obj }: { obj: { bot_token?: string | null; botToken?: string | null } }) => obj.bot_token ?? obj.botToken,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	botToken: string | null = null;

	@ApiProperty({
		description: 'Whether a Telegram Bot API token is configured',
		name: 'bot_token_configured',
	})
	@Expose({ name: 'bot_token_configured' })
	@IsOptional()
	@IsBoolean()
	botTokenConfigured?: boolean;

	@ApiPropertyOptional({
		description: 'Comma-separated list of Telegram user IDs allowed to interact with the bot (empty = allow all)',
		name: 'allowed_user_ids',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'allowed_user_ids' })
	@Transform(
		({ obj }: { obj: { allowed_user_ids?: string | null; allowedUserIds?: string | null } }) =>
			obj.allowed_user_ids ?? obj.allowedUserIds,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	allowedUserIds: string | null = null;
}
