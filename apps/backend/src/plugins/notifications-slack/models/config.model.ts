import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_SLACK_PLUGIN_NAME } from '../notifications-slack.constants';
import { IsValidSlackWebhookUrl } from '../validators/slack-webhook-url.validator';

@ApiSchema({ name: 'NotificationsSlackPluginDataConfig' })
export class NotificationsSlackConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: NOTIFICATIONS_SLACK_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = NOTIFICATIONS_SLACK_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description:
			'Slack incoming webhook URL, from a channel App settings page. Must start with https://. ' +
			'This value is accepted on write and never returned.',
		name: 'webhook_url',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'webhook_url' })
	@ValidateIf((config: NotificationsSlackConfigModel) => config.webhookUrl !== null)
	@IsNotEmpty()
	@IsValidSlackWebhookUrl()
	webhookUrl: string | null = null;

	@ApiProperty({
		description: 'Whether a Slack webhook URL is configured',
		name: 'webhook_url_configured',
	})
	@Expose({ name: 'webhook_url_configured' })
	@IsOptional()
	@IsBoolean()
	webhookUrlConfigured?: boolean;

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
