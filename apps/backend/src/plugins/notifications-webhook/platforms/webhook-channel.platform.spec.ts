import { ConfigService } from '../../../modules/config/services/config.service';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../../modules/notifications/notifications.constants';
import { ChannelDeliveryError } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationsWebhookConfigModel } from '../models/config.model';

import { WebhookChannelPlatform } from './webhook-channel.platform';

const mockedFetch = jest.spyOn(global, 'fetch').mockImplementation();

const createMockResponse = (status: number): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
	}) as Response;

describe('WebhookChannelPlatform', () => {
	let configService: { getPluginConfig: jest.Mock };
	let platform: WebhookChannelPlatform;

	const notification: NotificationEntity = {
		id: 'notif-1',
		source: 'devices-home-assistant-plugin',
		kind: NotificationKind.ISSUE,
		key: 'connection-lost',
		severity: NotificationSeverity.ERROR,
		title: 'Home Assistant connection lost',
		message: 'The websocket connection was refused',
		actions: [{ type: NotificationActionType.LINK, label: 'Open system info', url: '/system/info' }],
		data: null,
		persistent: false,
		occurrences: 3,
		readAt: null,
		dismissedAt: null,
		resolvedAt: null,
		createdAt: new Date('2026-09-02T10:00:00.000Z'),
		updatedAt: new Date('2026-09-02T10:00:00.000Z'),
	} as NotificationEntity;

	const withConfig = (overrides: Partial<NotificationsWebhookConfigModel> = {}): void => {
		configService.getPluginConfig.mockReturnValue({
			type: 'notifications-webhook-plugin',
			enabled: true,
			url: 'https://example.com/hooks/panel',
			headers: null,
			minSeverity: NotificationSeverity.WARNING,
			...overrides,
		});
	};

	beforeEach(() => {
		configService = { getPluginConfig: jest.fn() };
		platform = new WebhookChannelPlatform(configService as unknown as ConfigService);
		mockedFetch.mockReset();
	});

	describe('getType', () => {
		it('returns the plugin type', () => {
			expect(platform.getType()).toBe('notifications-webhook-plugin');
		});
	});

	describe('isConfigured', () => {
		it('is false without a URL', async () => {
			withConfig({ url: null });

			await expect(platform.isConfigured()).resolves.toBe(false);
		});

		it('is false for a blank URL', async () => {
			withConfig({ url: '   ' });

			await expect(platform.isConfigured()).resolves.toBe(false);
		});

		it('is true once a URL is configured', async () => {
			withConfig();

			await expect(platform.isConfigured()).resolves.toBe(true);
		});
	});

	describe('send', () => {
		it('posts the notification as JSON to the configured URL', async () => {
			withConfig();
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

			const signal = new AbortController().signal;

			await platform.send(notification, signal);

			expect(mockedFetch).toHaveBeenCalledTimes(1);

			const [url, init] = mockedFetch.mock.calls[0];

			expect(url).toBe('https://example.com/hooks/panel');
			expect(init).toMatchObject({
				method: 'POST',
				redirect: 'error',
				signal,
			});
			expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
			expect(JSON.parse(init.body as string)).toEqual({
				id: 'notif-1',
				source: 'devices-home-assistant-plugin',
				kind: NotificationKind.ISSUE,
				severity: NotificationSeverity.ERROR,
				title: 'Home Assistant connection lost',
				message: 'The websocket connection was refused',
				occurrences: 3,
				created_at: '2026-09-02T10:00:00.000Z',
				actions: [{ type: NotificationActionType.LINK, label: 'Open system info', url: '/system/info' }],
			});
		});

		it('sends configured extra headers alongside the JSON content type', async () => {
			withConfig({ headers: { Authorization: 'Bearer secret-token', 'X-Custom': '1' } });
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

			await platform.send(notification, new AbortController().signal);

			const [, init] = mockedFetch.mock.calls[0];

			expect(init.headers).toMatchObject({
				'Content-Type': 'application/json',
				Authorization: 'Bearer secret-token',
				'X-Custom': '1',
			});
		});

		it('accepts an http: URL when no custom headers are configured', async () => {
			withConfig({ url: 'http://n8n.local/webhook/panel', headers: null });
			mockedFetch.mockResolvedValueOnce(createMockResponse(200));

			await expect(platform.send(notification, new AbortController().signal)).resolves.toBeUndefined();
		});

		it('throws a non-retryable error without a configured URL', async () => {
			withConfig({ url: null });

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
