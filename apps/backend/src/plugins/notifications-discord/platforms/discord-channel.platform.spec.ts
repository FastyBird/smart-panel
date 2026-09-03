import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { ChannelDeliveryError } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsDiscordConfigModel } from '../models/config.model';

import { DiscordChannelPlatform } from './discord-channel.platform';

const mockedFetch = jest.spyOn(global, 'fetch').mockImplementation();

const createMockResponse = (status: number): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
	}) as Response;

interface DiscordWebhookTestPayload {
	username?: string;
	embeds: {
		title: string;
		description?: string;
		color: number;
		footer: { text: string };
		timestamp: string;
	}[];
}

const parseBody = (body: BodyInit | null | undefined): DiscordWebhookTestPayload =>
	JSON.parse(body as string) as DiscordWebhookTestPayload;

describe('DiscordChannelPlatform', () => {
	let configService: { getPluginConfig: jest.Mock };
	let platform: DiscordChannelPlatform;

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

	const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcDEF-token';

	const withConfig = (overrides: Partial<NotificationsDiscordConfigModel> = {}): void => {
		configService.getPluginConfig.mockReturnValue({
			type: 'notifications-discord-plugin',
			enabled: true,
			webhookUrl,
			username: null,
			minSeverity: NotificationSeverity.WARNING,
			...overrides,
		});
	};

	beforeEach(() => {
		configService = { getPluginConfig: jest.fn() };
		platform = new DiscordChannelPlatform(configService as unknown as ConfigService);
		mockedFetch.mockReset();
	});

	describe('getType', () => {
		it('returns the plugin type', () => {
			expect(platform.getType()).toBe('notifications-discord-plugin');
		});
	});

	describe('isConfigured', () => {
		it('is false without a webhook URL', async () => {
			withConfig({ webhookUrl: null });

			await expect(platform.isConfigured()).resolves.toBe(false);
		});

		it('is true once a webhook URL is configured', async () => {
			withConfig();

			await expect(platform.isConfigured()).resolves.toBe(true);
		});
	});

	describe('send', () => {
		it('posts a Discord embed with the severity colour, footer and timestamp', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(204));

			const signal = new AbortController().signal;

			await platform.send(notification, signal);

			expect(mockedFetch).toHaveBeenCalledTimes(1);

			const [url, init] = mockedFetch.mock.calls[0];

			expect(url).toBe(webhookUrl);
			expect(init).toMatchObject({
				method: 'POST',
				redirect: 'error',
				signal,
			});
			expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });

			const body = parseBody(init.body);

			expect(body).toEqual({
				embeds: [
					{
						title: 'Home Assistant connection lost',
						description: 'The websocket connection was refused',
						color: 0x8e44ad,
						footer: { text: 'devices-home-assistant-plugin · 3 occurrences' },
						timestamp: '2026-09-02T10:00:00.000Z',
					},
				],
			});
			expect(body.username).toBeUndefined();
		});

		it('includes username when configured', async () => {
			withConfig({ username: 'Smart Panel' });
			mockedFetch.mockResolvedValueOnce(createMockResponse(204));

			await platform.send(notification, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.username).toBe('Smart Panel');
		});

		it('omits description when there is no message', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(204));

			await platform.send({ ...notification, message: null } as NotificationEntity, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.embeds[0].description).toBeUndefined();
		});

		it.each([
			[NotificationSeverity.INFO, 0x3498db],
			[NotificationSeverity.WARNING, 0xf39c12],
			[NotificationSeverity.ERROR, 0xe74c3c],
			[NotificationSeverity.CRITICAL, 0x8e44ad],
		])('uses colour %s -> %i for severity', async (severity, color) => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(204));

			await platform.send({ ...notification, severity } as NotificationEntity, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.embeds[0].color).toBe(color);
		});

		it('throws a non-retryable error without a configured webhook URL', async () => {
			withConfig({ webhookUrl: null });

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
	});
});
