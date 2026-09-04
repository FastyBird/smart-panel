import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import { NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { ChannelDeliveryError } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsSlackConfigModel } from '../models/config.model';

import { SlackChannelPlatform } from './slack-channel.platform';

const mockedFetch = jest.spyOn(global, 'fetch').mockImplementation();

const createMockResponse = (status: number): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
	}) as Response;

interface SlackWebhookTestPayload {
	text: string;
	attachments: {
		color: string;
		title: string;
		text?: string;
		footer: string;
	}[];
}

const parseBody = (body: BodyInit | null | undefined): SlackWebhookTestPayload =>
	JSON.parse(body as string) as SlackWebhookTestPayload;

describe('SlackChannelPlatform', () => {
	let configService: { getPluginConfig: jest.Mock };
	let platform: SlackChannelPlatform;

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

	const webhookUrl = 'https://hooks.slack.com/services/T0/B0/XYZ';

	const withConfig = (overrides: Partial<NotificationsSlackConfigModel> = {}): void => {
		configService.getPluginConfig.mockReturnValue({
			type: 'notifications-slack-plugin',
			enabled: true,
			webhookUrl,
			minSeverity: NotificationSeverity.WARNING,
			...overrides,
		});
	};

	beforeEach(() => {
		configService = { getPluginConfig: jest.fn() };
		platform = new SlackChannelPlatform(configService as unknown as ConfigService);
		mockedFetch.mockReset();
	});

	describe('getType', () => {
		it('returns the plugin type', () => {
			expect(platform.getType()).toBe('notifications-slack-plugin');
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
		it('posts a Slack attachment with the severity colour and footer', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

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
				text: 'Home Assistant connection lost',
				attachments: [
					{
						color: '#8e44ad',
						title: 'Home Assistant connection lost',
						text: 'The websocket connection was refused',
						footer: 'devices-home-assistant-plugin · 3 occurrences',
					},
				],
			});
		});

		it('omits attachment text when there is no message', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

			await platform.send({ ...notification, message: null } as NotificationEntity, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.attachments[0].text).toBeUndefined();
		});

		it.each([
			[NotificationSeverity.INFO, '#3498db'],
			[NotificationSeverity.WARNING, '#f39c12'],
			[NotificationSeverity.ERROR, '#e74c3c'],
			[NotificationSeverity.CRITICAL, '#8e44ad'],
		])('uses colour %s -> %s for severity', async (severity, color) => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

			await platform.send({ ...notification, severity } as NotificationEntity, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];
			const body = parseBody(init.body);

			expect(body.attachments[0].color).toBe(color);
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
