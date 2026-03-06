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
		description: 'Telegram Bot API token (from @BotFather)',
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
