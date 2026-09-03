import { ExtensionLoggerService } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { ChannelDeliveryError } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsTelegramConfigModel } from '../models/config.model';

import { TelegramChannelPlatform } from './telegram-channel.platform';

const mockedFetch = jest.spyOn(global, 'fetch').mockImplementation();
const mockedLoggerWarn = jest.spyOn(ExtensionLoggerService.prototype, 'warn').mockImplementation();

const createMockResponse = (status: number, body: unknown = { ok: true }): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	}) as unknown as Response;

interface TelegramSendMessageTestPayload {
	chat_id: string;
	text: string;
	parse_mode: string;
	disable_web_page_preview: boolean;
}

const parseBody = (body: BodyInit | null | undefined): TelegramSendMessageTestPayload =>
	JSON.parse(body as string) as TelegramSendMessageTestPayload;

describe('TelegramChannelPlatform', () => {
	let configService: { getPluginConfig: jest.Mock };
	let platform: TelegramChannelPlatform;

	const notification: NotificationEntity = {
		id: 'notif-1',
		source: 'devices-home-assistant-plugin',
		kind: NotificationKind.ISSUE,
		key: 'connection-lost',
		severity: NotificationSeverity.CRITICAL,
		title: 'Home Assistant connection lost',
		message: 'The websocket connection was refused',
		actions: [],
		data: null,
		persistent: false,
		occurrences: 3,
		readAt: null,
		dismissedAt: null,
		resolvedAt: null,
		createdAt: new Date('2026-09-02T10:00:00.000Z'),
		updatedAt: new Date('2026-09-02T10:00:00.000Z'),
	} as NotificationEntity;

	const botToken = '123456789:AAExampleTelegramBotTokenValue';
	const chatId = '987654321';

	const withConfig = (overrides: Partial<NotificationsTelegramConfigModel> = {}): void => {
		configService.getPluginConfig.mockReturnValue({
			type: 'notifications-telegram-plugin',
			enabled: true,
			botToken,
			chatId,
			minSeverity: NotificationSeverity.WARNING,
			...overrides,
		});
	};

	beforeEach(() => {
		configService = { getPluginConfig: jest.fn() };
		platform = new TelegramChannelPlatform(configService as unknown as ConfigService);
		mockedFetch.mockReset();
		mockedLoggerWarn.mockClear();
	});

	describe('getType', () => {
		it('returns the plugin type', () => {
			expect(platform.getType()).toBe('notifications-telegram-plugin');
		});
	});

	describe('isConfigured', () => {
		it('is false without a bot token', async () => {
			withConfig({ botToken: null });

			await expect(platform.isConfigured()).resolves.toBe(false);
		});

		it('is false without a chat id', async () => {
			withConfig({ chatId: null });

			await expect(platform.isConfigured()).resolves.toBe(false);
		});

		it('is true once both a bot token and a chat id are configured', async () => {
			withConfig();

			await expect(platform.isConfigured()).resolves.toBe(true);
		});
	});

	describe('send', () => {
		it('posts to the bot sendMessage endpoint with the chat id and HTML parse mode', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: true }));

			const signal = new AbortController().signal;

			await platform.send(notification, signal);

			expect(mockedFetch).toHaveBeenCalledTimes(1);

			const [url, init] = mockedFetch.mock.calls[0];

			expect(url).toBe(`https://api.telegram.org/bot${botToken}/sendMessage`);
			expect(init).toMatchObject({
				method: 'POST',
				redirect: 'error',
				signal,
			});
			expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });

			const body = parseBody(init.body);

			expect(body.chat_id).toBe(chatId);
			expect(body.parse_mode).toBe('HTML');
			expect(body.disable_web_page_preview).toBe(true);
			expect(body.text).toBe('<b>Home Assistant connection lost</b>\nThe websocket connection was refused');
		});

		it('HTML-escapes <, > and & in the title and message', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: true }));

			await platform.send(
				{
					...notification,
					title: 'Title <b>bold</b> & more',
					message: '5 < 10 & 10 > 5',
				} as NotificationEntity,
				new AbortController().signal,
			);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.text).toBe('<b>Title &lt;b&gt;bold&lt;/b&gt; &amp; more</b>\n5 &lt; 10 &amp; 10 &gt; 5');
		});

		it('omits the message line when there is no message', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: true }));

			await platform.send({ ...notification, message: null } as NotificationEntity, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.text).toBe('<b>Home Assistant connection lost</b>');
		});

		it('throws a non-retryable error without a configured bot token or chat id', async () => {
			withConfig({ chatId: null });

			await expect(platform.send(notification, new AbortController().signal)).rejects.toMatchObject({
				name: 'ChannelDeliveryError',
				retryable: false,
			});
			expect(mockedFetch).not.toHaveBeenCalled();
		});

		it('throws a non-retryable ChannelDeliveryError for a 400 response', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(400));

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ChannelDeliveryError);
			expect(error).toMatchObject({ retryable: false, status: 400 });
		});

		it('throws a retryable ChannelDeliveryError for a 503 response', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(503));

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ChannelDeliveryError);
			expect(error).toMatchObject({ retryable: true, status: 503 });
		});

		it('throws a non-retryable ChannelDeliveryError when redirected (redirect: error rejects fetch)', async () => {
			withConfig();
			mockedFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ChannelDeliveryError);
			expect(error).toMatchObject({ retryable: false });
		});

		it('throws a non-retryable ChannelDeliveryError when the Bot API answers HTTP 200 with ok: false', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(
				createMockResponse(200, { ok: false, description: 'Bad Request: chat not found' }),
			);

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ChannelDeliveryError);
			expect(error).toMatchObject({ retryable: false });
			expect((error as ChannelDeliveryError).message).toContain('Bad Request: chat not found');
		});

		it('never includes the bot token in the ok: false error message', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: false, description: 'Unauthorized' }));

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect((error as ChannelDeliveryError).message).not.toContain(botToken);
			expect((error as ChannelDeliveryError).message).toContain('api.telegram.org');
		});

		it('logs only the host and status for a non-ok response, never the bot token', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(400));

			await platform.send(notification, new AbortController().signal).catch(() => undefined);

			expect(mockedLoggerWarn).toHaveBeenCalledTimes(1);

			const [message] = mockedLoggerWarn.mock.calls[0] as [string];

			expect(message).toContain('api.telegram.org');
			expect(message).toContain('400');
			expect(message).not.toContain(botToken);
		});

		it('logs only the host and status when the Bot API answers ok: false, never the bot token', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: false, description: 'Unauthorized' }));

			await platform.send(notification, new AbortController().signal).catch(() => undefined);

			expect(mockedLoggerWarn).toHaveBeenCalledTimes(1);

			const [message] = mockedLoggerWarn.mock.calls[0] as [string];

			expect(message).toContain('api.telegram.org');
			expect(message).toContain('200');
			expect(message).not.toContain(botToken);
			expect(message).not.toContain('Unauthorized');
		});

		it('does not log anything on a successful send', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200, { ok: true }));

			await platform.send(notification, new AbortController().signal);

			expect(mockedLoggerWarn).not.toHaveBeenCalled();
		});

		it('treats a malformed JSON reply on a 200 response as a non-retryable failure', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.reject(new Error('Unexpected token')),
			} as unknown as Response);

			const error = await platform.send(notification, new AbortController().signal).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ChannelDeliveryError);
			expect(error).toMatchObject({ retryable: false });
		});
	});
});
