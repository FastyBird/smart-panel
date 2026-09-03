import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { readSubmittedValue } from '../../../common/utils/transform.utils';
import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_NAME } from '../notifications-telegram.constants';

@ApiSchema({ name: 'NotificationsTelegramPluginUpdateConfig' })
export class UpdateNotificationsTelegramConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof NOTIFICATIONS_TELEGRAM_PLUGIN_NAME;

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
		description: 'Replacement Telegram Bot API token. Omit to preserve the stored token or send null to clear it.',
		name: 'bot_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'bot_token' })
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'bot_token', 'botToken'), { toClassOnly: true })
	@IsOptional()
	@IsString({ message: '[{"field":"bot_token","reason":"Bot token must be a string."}]' })
	botToken?: string | null;

	@ApiPropertyOptional({
		description: 'Telegram chat id (or @channel username) the bot sends messages to.',
		name: 'chat_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'chat_id' })
	@IsOptional()
	@IsString({ message: '[{"field":"chat_id","reason":"Chat id must be a string."}]' })
	chatId?: string | null;

	@ApiPropertyOptional({
		description: 'Minimum severity this channel forwards',
		name: 'min_severity',
		enum: NotificationSeverity,
		example: NotificationSeverity.WARNING,
	})
	@Expose({ name: 'min_severity' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(NotificationSeverity, {
		message: '[{"field":"min_severity","reason":"Minimum severity must be a valid severity level."}]',
	})
	minSeverity?: NotificationSeverity;
}
