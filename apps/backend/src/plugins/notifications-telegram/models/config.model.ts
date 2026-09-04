import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_NAME } from '../notifications-telegram.constants';

@ApiSchema({ name: 'NotificationsTelegramPluginDataConfig' })
export class NotificationsTelegramConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = NOTIFICATIONS_TELEGRAM_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Telegram Bot API token, from @BotFather. This value is accepted on write and never returned.',
		name: 'bot_token',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'bot_token' })
	@ValidateIf((config: NotificationsTelegramConfigModel) => config.botToken !== null)
	@IsNotEmpty()
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
		description: 'Telegram chat id (or @channel username) the bot sends messages to.',
		name: 'chat_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'chat_id' })
	@IsOptional()
	@IsString()
	chatId: string | null = null;

	@ApiProperty({
		description: 'Minimum severity this channel forwards',
		name: 'min_severity',
		enum: NotificationSeverity,
		example: NotificationSeverity.WARNING,
	})
	@Expose({ name: 'min_severity' })
	@IsEnum(NotificationSeverity)
	minSeverity: NotificationSeverity = NotificationSeverity.WARNING;
}
