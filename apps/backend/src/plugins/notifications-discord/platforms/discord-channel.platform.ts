import { Injectable } from '@nestjs/common';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import {
	BaseNotificationChannel,
	ChannelDeliveryError,
} from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsDiscordConfigModel } from '../models/config.model';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from '../notifications-discord.constants';

/** Discord embed colour per severity, as a decimal integer (Discord's embed `color` field). */
const SEVERITY_COLORS: Record<NotificationSeverity, number> = {
	[NotificationSeverity.INFO]: 0x3498db,
	[NotificationSeverity.WARNING]: 0xf39c12,
	[NotificationSeverity.ERROR]: 0xe74c3c,
	[NotificationSeverity.CRITICAL]: 0x8e44ad,
};

interface DiscordEmbed {
	title: string;
	description?: string;
	color: number;
	footer: { text: string };
	timestamp: string;
}

interface DiscordWebhookPayload {
	username?: string;
	embeds: DiscordEmbed[];
}

/**
 * Discord channel: posts a single-embed message to an incoming webhook URL. Discord rejects a
 * non-`https:` URL at config validation - there is no trusted-network exception, unlike the
 * generic webhook plugin, because the URL itself is the only credential.
 */
@Injectable()
export class DiscordChannelPlatform extends BaseNotificationChannel {
	constructor(configService: ConfigService) {
		super(configService, NOTIFICATIONS_DISCORD_PLUGIN_NAME);
	}

	protected hasRequiredConfig(config: PluginConfigModel): boolean {
		const discordConfig = config as NotificationsDiscordConfigModel;

		return typeof discordConfig.webhookUrl === 'string' && discordConfig.webhookUrl.trim().length > 0;
	}

	async send(notification: NotificationEntity, signal: AbortSignal): Promise<void> {
		const config = this.configService.getPluginConfig<NotificationsDiscordConfigModel>(this.type);

		if (!this.hasRequiredConfig(config)) {
			throw new ChannelDeliveryError('Discord webhook URL is not configured.', false);
		}

		const payload: DiscordWebhookPayload = {
			...(config.username ? { username: config.username } : {}),
			embeds: [
				{
					title: notification.title,
					...(notification.message ? { description: notification.message } : {}),
					color: SEVERITY_COLORS[notification.severity],
					footer: { text: `${notification.source} · ${notification.occurrences} occurrences` },
					timestamp: toIsoString(notification.createdAt),
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

function toIsoString(value: Date | string): string {
	return typeof value === 'string' ? value : value.toISOString();
}
