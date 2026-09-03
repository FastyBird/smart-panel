import { Injectable } from '@nestjs/common';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import {
	BaseNotificationChannel,
	ChannelDeliveryError,
} from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsWebhookConfigModel } from '../models/config.model';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from '../notifications-webhook.constants';

/**
 * Body posted to the configured webhook URL. Deliberately narrower than the full
 * {@link NotificationEntity} - no `data`, no lifecycle timestamps beyond `created_at` - so a
 * receiver only ever sees what a channel needs to render the notification.
 */
interface WebhookPayload {
	id: string;
	source: string;
	kind: string;
	severity: string;
	title: string;
	message: string | null;
	occurrences: number;
	created_at: string;
	actions: unknown;
}

/**
 * Generic webhook channel: `POST`s a JSON body to an administrator-configured URL, plus
 * whatever extra headers they configured (e.g. an `Authorization` bearer token). Accepts
 * `http:` for trusted-network targets (n8n, Node-RED, Home Assistant on the LAN); the
 * combination of an `http:` URL and custom headers is rejected at config validation, not here.
 */
@Injectable()
export class WebhookChannelPlatform extends BaseNotificationChannel {
	constructor(configService: ConfigService) {
		super(configService, NOTIFICATIONS_WEBHOOK_PLUGIN_NAME);
	}

	protected hasRequiredConfig(config: PluginConfigModel): boolean {
		const webhookConfig = config as NotificationsWebhookConfigModel;

		return typeof webhookConfig.url === 'string' && webhookConfig.url.trim().length > 0;
	}

	async send(notification: NotificationEntity, signal: AbortSignal): Promise<void> {
		const config = this.configService.getPluginConfig<NotificationsWebhookConfigModel>(this.type);

		if (!this.hasRequiredConfig(config)) {
			throw new ChannelDeliveryError('Webhook URL is not configured.', false);
		}

		const payload: WebhookPayload = {
			id: notification.id,
			source: notification.source,
			kind: notification.kind,
			severity: notification.severity,
			title: notification.title,
			message: notification.message,
			occurrences: notification.occurrences,
			created_at: toIsoString(notification.createdAt),
			actions: notification.actions,
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(config.headers ?? {}),
		};

		const response = await this.fetchWithSignal(
			config.url,
			{
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
			},
			signal,
		);

		if (!response.ok) {
			throw this.classify(undefined, response);
		}
	}
}

function toIsoString(value: Date | string): string {
	return typeof value === 'string' ? value : value.toISOString();
}
