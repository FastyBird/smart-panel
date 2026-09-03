import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import {
	BaseNotificationChannel,
	ChannelDeliveryError,
} from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsTelegramConfigModel } from '../models/config.model';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_NAME } from '../notifications-telegram.constants';

const TELEGRAM_API_HOST = 'api.telegram.org';

interface TelegramSendMessagePayload {
	chat_id: string;
	text: string;
	parse_mode: 'HTML';
	disable_web_page_preview: true;
}

/** The Telegram Bot API's own envelope - a 200 response can still carry `ok: false`. */
interface TelegramApiReply {
	ok: boolean;
	description?: string;
}

/** Escapes the three characters Telegram's HTML parse mode treats as markup. */
function escapeTelegramHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Telegram channel: posts to a bot's `sendMessage` endpoint, which embeds the bot token in the
 * URL path itself - the only credential this channel has, and the reason nothing here ever logs
 * the built URL. Every log line and every `ChannelDeliveryError` message this file produces names
 * only the host (`api.telegram.org`) and, where relevant, the HTTP status - never the token.
 */
@Injectable()
export class TelegramChannelPlatform extends BaseNotificationChannel {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
		'TelegramChannelPlatform',
	);

	constructor(configService: ConfigService) {
		super(configService, NOTIFICATIONS_TELEGRAM_PLUGIN_NAME);
	}

	protected hasRequiredConfig(config: PluginConfigModel): boolean {
		const telegramConfig = config as NotificationsTelegramConfigModel;

		return (
			typeof telegramConfig.botToken === 'string' &&
			telegramConfig.botToken.trim().length > 0 &&
			typeof telegramConfig.chatId === 'string' &&
			telegramConfig.chatId.trim().length > 0
		);
	}

	async send(notification: NotificationEntity, signal: AbortSignal): Promise<void> {
		const config = this.configService.getPluginConfig<NotificationsTelegramConfigModel>(this.type);

		if (!this.hasRequiredConfig(config)) {
			throw new ChannelDeliveryError('Telegram bot token or chat id is not configured.', false);
		}

		const text = this.formatHtmlText(notification);

		const payload: TelegramSendMessagePayload = {
			chat_id: config.chatId,
			text,
			parse_mode: 'HTML',
			disable_web_page_preview: true,
		};

		// The bot token travels only in this URL, never in a log or an error message below.
		const url = `https://${TELEGRAM_API_HOST}/bot${config.botToken}/sendMessage`;

		const response = await this.fetchWithSignal(
			url,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			},
			signal,
		);

		if (!response.ok) {
			// Only the host and status are logged - never the URL above, which carries the bot token.
			this.logger.warn(`Telegram request failed: host=${TELEGRAM_API_HOST} status=${response.status}`);

			throw this.classify(undefined, response);
		}

		const reply = await this.parseReply(response);

		if (reply.ok !== true) {
			// Same rule: the log line names only the host and status, never the token or the reply body.
			this.logger.warn(`Telegram request rejected: host=${TELEGRAM_API_HOST} status=${response.status}`);

			throw new ChannelDeliveryError(
				`Telegram rejected the request (host=${TELEGRAM_API_HOST}, status=${response.status}): ${reply.description ?? 'unknown error'}`,
				false,
				response.status,
			);
		}
	}

	/** `<b>Title</b>` followed by the message on its own line, both HTML-escaped. */
	private formatHtmlText(notification: NotificationEntity): string {
		const title = `<b>${escapeTelegramHtml(notification.title)}</b>`;

		if (!notification.message) {
			return title;
		}

		return `${title}\n${escapeTelegramHtml(notification.message)}`;
	}

	/**
	 * The Bot API answers HTTP 200 even for some errors, distinguishing them only through
	 * `ok: false` in the JSON body - so a 2xx response still needs its body parsed and checked.
	 * A body that fails to parse, or does not carry a boolean `ok`, is treated the same as
	 * `ok: false`: the delivery did not provably succeed.
	 */
	private async parseReply(response: Response): Promise<TelegramApiReply> {
		try {
			const body: unknown = await response.json();

			if (body !== null && typeof body === 'object' && typeof (body as { ok?: unknown }).ok === 'boolean') {
				return body as TelegramApiReply;
			}

			return { ok: false, description: 'Malformed response body' };
		} catch {
			return { ok: false, description: 'Response body was not valid JSON' };
		}
	}
}
