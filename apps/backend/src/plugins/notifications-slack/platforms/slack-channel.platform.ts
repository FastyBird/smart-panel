import { Injectable } from '@nestjs/common';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import {
	BaseNotificationChannel,
	ChannelDeliveryError,
} from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsSlackConfigModel } from '../models/config.model';
import { NOTIFICATIONS_SLACK_PLUGIN_NAME } from '../notifications-slack.constants';

/** Slack attachment colour per severity, as a hex string (Slack's attachment `color` field). */
const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
	[NotificationSeverity.INFO]: '#3498db',
	[NotificationSeverity.WARNING]: '#f39c12',
	[NotificationSeverity.ERROR]: '#e74c3c',
	[NotificationSeverity.CRITICAL]: '#8e44ad',
};

interface SlackAttachment {
	color: string;
	title: string;
	text?: string;
	footer: string;
}

interface SlackWebhookPayload {
	text: string;
	attachments: SlackAttachment[];
}

/**
 * Slack channel: posts a single-attachment message to an incoming webhook URL. Slack rejects a
 * non-`https:` URL at config validation - there is no trusted-network exception, unlike the
 * generic webhook plugin, because the URL itself is the only credential.
 */
@Injectable()
export class SlackChannelPlatform extends BaseNotificationChannel {
	constructor(configService: ConfigService) {
		super(configService, NOTIFICATIONS_SLACK_PLUGIN_NAME);
	}

	protected hasRequiredConfig(config: PluginConfigModel): boolean {
		const slackConfig = config as NotificationsSlackConfigModel;

		return typeof slackConfig.webhookUrl === 'string' && slackConfig.webhookUrl.trim().length > 0;
	}

	async send(notification: NotificationEntity, signal: AbortSignal): Promise<void> {
		const config = this.configService.getPluginConfig<NotificationsSlackConfigModel>(this.type);

		if (!this.hasRequiredConfig(config)) {
			throw new ChannelDeliveryError('Slack webhook URL is not configured.', false);
		}

		const payload: SlackWebhookPayload = {
			text: notification.title,
			attachments: [
				{
					color: SEVERITY_COLORS[notification.severity],
					title: notification.title,
					...(notification.message ? { text: notification.message } : {}),
					footer: `${notification.source} · ${notification.occurrences} occurrences`,
				},
			],
		};

		const response = await this.fetchWithSignal(
			config.webhookUrl,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			},
			signal,
		);

		if (!response.ok) {
			throw this.classify(undefined, response);
		}
	}
}
