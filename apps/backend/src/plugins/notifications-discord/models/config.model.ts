import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from '../notifications-discord.constants';
import { IsValidDiscordWebhookUrl } from '../validators/discord-webhook-url.validator';

@ApiSchema({ name: 'NotificationsDiscordPluginDataConfig' })
export class NotificationsDiscordConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = NOTIFICATIONS_DISCORD_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description:
			'Discord incoming webhook URL, from a channel Integrations settings page. Must start with https://. ' +
			'This value is accepted on write and never returned.',
		name: 'webhook_url',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'webhook_url' })
	@ValidateIf((config: NotificationsDiscordConfigModel) => config.webhookUrl !== null)
	@IsNotEmpty()
	@IsValidDiscordWebhookUrl()
	webhookUrl: string | null = null;

	@ApiProperty({
		description: 'Whether a Discord webhook URL is configured',
		name: 'webhook_url_configured',
	})
	@Expose({ name: 'webhook_url_configured' })
	@IsOptional()
	@IsBoolean()
	webhookUrlConfigured?: boolean;

	@ApiPropertyOptional({
		description: 'Overrides the default username the webhook posts as in Discord',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	username: string | null = null;

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
