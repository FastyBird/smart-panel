import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from '../notifications-webhook.constants';
import { WebhookHeadersRequireHttps } from '../validators/webhook-headers-require-https.validator';
import { IsValidHeaderRecord } from '../validators/webhook-headers-shape.validator';
import { IsValidWebhookUrl } from '../validators/webhook-url.validator';

@ApiSchema({ name: 'NotificationsWebhookPluginDataConfig' })
export class NotificationsWebhookConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = NOTIFICATIONS_WEBHOOK_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description:
			'Target URL notifications are POSTed to. HTTPS is required to send custom headers; HTTP is otherwise ' +
			'accepted for trusted-network targets. This value is accepted on write and never returned.',
		type: 'string',
		nullable: true,
		writeOnly: true,
	})
	@Expose()
	@ValidateIf((config: NotificationsWebhookConfigModel) => config.url !== null)
	@IsNotEmpty()
	@IsValidWebhookUrl()
	url: string | null = null;

	@ApiProperty({
		description: 'Whether a webhook URL is configured',
		name: 'url_configured',
	})
	@Expose({ name: 'url_configured' })
	@IsOptional()
	@IsBoolean()
	urlConfigured?: boolean;

	@ApiPropertyOptional({
		description:
			'Extra HTTP headers sent with every request, e.g. an Authorization bearer token. Requires an HTTPS ' +
			'URL. This value is accepted on write and never returned.',
		type: 'object',
		additionalProperties: { type: 'string' },
		nullable: true,
		writeOnly: true,
	})
	@Expose()
	@ValidateIf((config: NotificationsWebhookConfigModel) => config.headers !== null)
	@IsValidHeaderRecord()
	@WebhookHeadersRequireHttps()
	headers: Record<string, string> | null = null;

	@ApiProperty({
		description: 'Whether custom headers are configured',
		name: 'headers_configured',
	})
	@Expose({ name: 'headers_configured' })
	@IsOptional()
	@IsBoolean()
	headersConfigured?: boolean;

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
