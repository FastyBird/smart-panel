import { ConfigService } from '../../config/services/config.service';
import { NotificationEntity } from '../entities/notifications.entity';
import { EventType, NotificationActionType, NotificationKind, NotificationSeverity } from '../notifications.constants';
import { ChannelDeliveryError, INotificationChannel } from '../platforms/notification-channel.platform';

import { NotificationChannelRegistryService } from './notification-channel-registry.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationsService } from './notifications.service';

describe('NotificationDispatcherService', () => {
	let registry: NotificationChannelRegistryService;
	let notificationsService: { findOne: jest.Mock; notify: jest.Mock; resolve: jest.Mock };
	let configService: { getPluginConfig: jest.Mock };
	let sleep: jest.Mock;
	let dispatcher: NotificationDispatcherService;

	const baseNotification = (overrides: Partial<NotificationEntity> = {}): NotificationEntity =>
		({
			id: 'notif-1',
			source: 'devices-home-assistant-plugin',
			kind: NotificationKind.ISSUE,
			key: 'connection-lost',
			severity: NotificationSeverity.ERROR,
			title: 'Home Assistant connection lost',
			message: 'The websocket connection was refused',
			actions: [],
			data: null,
			persistent: false,
			occurrences: 1,
			readAt: null,
			dismissedAt: null,
			resolvedAt: null,
			createdAt: new Date('2026-09-02T10:00:00.000Z'),
			updatedAt: new Date('2026-09-02T10:00:00.000Z'),
			...overrides,
		}) as NotificationEntity;

	const createChannel = (
		type: string,
		overrides: Partial<{
			isConfigured: () => Promise<boolean>;
			getMinSeverity: () => Promise<NotificationSeverity>;
			send: jest.Mock;
		}> = {},
	): INotificationChannel => ({
		getType: () => type,
		isConfigured: overrides.isConfigured ?? (() => Promise.resolve(true)),
		getMinSeverity: overrides.getMinSeverity ?? (() => Promise.resolve(NotificationSeverity.INFO)),
		send: overrides.send ?? jest.fn().mockResolvedValue(undefined),
	});

	/** Polls microtasks until `condition` is true, instead of hardcoding a tick count. */
	const waitFor = async (condition: () => boolean): Promise<void> => {
		for (let i = 0; i < 100 && !condition(); i++) {
			await Promise.resolve();
		}
	};

	beforeEach(() => {
		registry = new NotificationChannelRegistryService();
		notificationsService = {
			findOne: jest.fn(),
			notify: jest.fn().mockResolvedValue(null),
			resolve: jest.fn().mockResolvedValue(true),
		};
		configService = {
			getPluginConfig: jest.fn().mockReturnValue({ type: 'notifications-webhook-plugin', enabled: true }),
		};
		sleep = jest.fn().mockResolvedValue(undefined);

		dispatcher = new NotificationDispatcherService(
			registry,
			notificationsService as unknown as NotificationsService,
			configService as unknown as ConfigService,
			sleep,
		);
	});

	describe('filtering', () => {
		it('skips a channel whose extension is disabled', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);
			configService.getPluginConfig.mockReturnValue({ type: channel.getType(), enabled: false });

			await dispatcher.dispatch(baseNotification());

			expect(send).not.toHaveBeenCalled();
			expect(notificationsService.notify).not.toHaveBeenCalled();
		});

		it('skips a channel that reports it is not configured', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', {
				isConfigured: () => Promise.resolve(false),
				send,
			});

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(send).not.toHaveBeenCalled();
		});

		it('skips a channel whose minimum severity ranks above the notification', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', {
				getMinSeverity: () => Promise.resolve(NotificationSeverity.CRITICAL),
				send,
			});

			registry.register(channel);

			await dispatcher.dispatch(baseNotification({ severity: NotificationSeverity.WARNING }));

			expect(send).not.toHaveBeenCalled();
		});

		it('delivers when the notification severity meets the channel minimum', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', {
				getMinSeverity: () => Promise.resolve(NotificationSeverity.WARNING),
				send,
			});

			registry.register(channel);

			await dispatcher.dispatch(baseNotification({ severity: NotificationSeverity.WARNING }));

			expect(send).toHaveBeenCalledTimes(1);
		});
	});

	describe('loop guard', () => {
		it('does not dispatch a notification whose source is itself a registered channel type', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification({ source: 'notifications-webhook-plugin' }));

			expect(send).not.toHaveBeenCalled();
		});
	});

	describe('retries', () => {
		it('retries a retryable failure twice more, sleeping 1000ms then 5000ms, before self-reporting', async () => {
			const error = new ChannelDeliveryError('service unavailable', true, 503);
			const send = jest.fn().mockRejectedValue(error);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(send).toHaveBeenCalledTimes(3);
			expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
			expect(sleep).toHaveBeenNthCalledWith(2, 5_000);
			expect(notificationsService.notify).toHaveBeenCalledTimes(1);
			expect(notificationsService.notify).toHaveBeenCalledWith({
				source: 'notifications-webhook-plugin',
				kind: NotificationKind.ISSUE,
				key: 'delivery-failed',
				severity: NotificationSeverity.WARNING,
				title: 'Notification delivery failed',
				message: 'service unavailable',
				actions: [
					{
						type: NotificationActionType.LINK,
						label: 'Open channel settings',
						url: '/config/plugins/notifications-webhook-plugin',
					},
				],
			});
		});

		it('does not retry a non-retryable HTTP 400', async () => {
			const error = new ChannelDeliveryError('bad request', false, 400);
			const send = jest.fn().mockRejectedValue(error);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(send).toHaveBeenCalledTimes(1);
			expect(sleep).not.toHaveBeenCalled();
			expect(notificationsService.notify).toHaveBeenCalledTimes(1);
		});

		it('does not retry a timeout', async () => {
			const error = new ChannelDeliveryError('timed out', false);
			const send = jest.fn().mockRejectedValue(error);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(send).toHaveBeenCalledTimes(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it('aborts a channel that never settles and counts it as a failed delivery, without retrying', async () => {
			const controller = new AbortController();
			const send = jest.fn().mockImplementation(() => new Promise<void>(() => undefined));
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			class TestDispatcher extends NotificationDispatcherService {
				protected createDeliverySignal(): AbortSignal {
					return controller.signal;
				}
			}

			const testDispatcher = new TestDispatcher(
				registry,
				notificationsService as unknown as NotificationsService,
				configService as unknown as ConfigService,
				sleep,
			);

			// Manually controlled abort - AbortSignal.timeout's own internal timer cannot be
			// advanced by fake timers, so the signal the channel receives is pre-aborted, exactly
			// as it would be once the real 10-second budget ran out while `send` was still pending.
			controller.abort();

			await testDispatcher.dispatch(baseNotification());

			expect(send).toHaveBeenCalledTimes(1);
			expect(sleep).not.toHaveBeenCalled();
			expect(notificationsService.notify).toHaveBeenCalledTimes(1);
			expect(notificationsService.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: 'notifications-webhook-plugin',
					key: 'delivery-failed',
				}),
			);
		});

		it('still produces a sanitized self-report when the channel rejects with null', async () => {
			const send = jest.fn().mockRejectedValue(null);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(send).toHaveBeenCalledTimes(1);
			expect(notificationsService.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'null' }));
		});
	});

	describe('success', () => {
		it('resolves the delivery-failed self-report after a successful delivery', async () => {
			const send = jest.fn().mockResolvedValue(undefined);
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			await dispatcher.dispatch(baseNotification());

			expect(notificationsService.resolve).toHaveBeenCalledWith('notifications-webhook-plugin', 'delivery-failed');
			expect(notificationsService.notify).not.toHaveBeenCalled();
		});
	});

	describe('fan-out across channels', () => {
		it('does not let one failing channel block delivery to another', async () => {
			const failingSend = jest.fn().mockRejectedValue(new ChannelDeliveryError('bad request', false, 400));
			const okSend = jest.fn().mockResolvedValue(undefined);
			const failingChannel = createChannel('notifications-discord-plugin', { send: failingSend });
			const okChannel = createChannel('notifications-slack-plugin', { send: okSend });

			registry.register(failingChannel);
			registry.register(okChannel);
			configService.getPluginConfig.mockReturnValue({ enabled: true });

			await dispatcher.dispatch(baseNotification());

			expect(failingSend).toHaveBeenCalledTimes(1);
			expect(okSend).toHaveBeenCalledTimes(1);
			expect(notificationsService.resolve).toHaveBeenCalledWith('notifications-slack-plugin', 'delivery-failed');
			expect(notificationsService.notify).toHaveBeenCalledWith(
				expect.objectContaining({ source: 'notifications-discord-plugin' }),
			);
		});
	});

	describe('per-channel ordering', () => {
		it('preserves delivery order within one channel across overlapping notifications', async () => {
			const seen: string[] = [];
			let releaseFirst!: () => void;

			const send = jest.fn().mockImplementation((notification: NotificationEntity) => {
				seen.push(notification.id);

				if (notification.id === 'notif-1') {
					return new Promise<void>((resolve) => {
						releaseFirst = resolve;
					});
				}

				return Promise.resolve();
			});
			const channel = createChannel('notifications-webhook-plugin', { send });

			registry.register(channel);

			const first = dispatcher.dispatch(baseNotification({ id: 'notif-1' }));
			const second = dispatcher.dispatch(baseNotification({ id: 'notif-2' }));

			await waitFor(() => send.mock.calls.length >= 1);

			// The second notification must still be queued behind the first, which has not
			// resolved yet.
			expect(seen).toEqual(['notif-1']);

			releaseFirst();

			await first;
			await second;

			expect(seen).toEqual(['notif-1', 'notif-2']);
		});
	});

	describe('@OnEvent wiring', () => {
		it('loads the entity by id and dispatches it', async () => {
			const notification = baseNotification();

			notificationsService.findOne.mockResolvedValue(notification);

			const dispatchSpy = jest.spyOn(dispatcher, 'dispatch').mockResolvedValue(undefined);

			await dispatcher.handleNotificationCreated({
				id: notification.id,
				kind: notification.kind,
				severity: notification.severity,
				source: notification.source,
			});

			expect(notificationsService.findOne).toHaveBeenCalledWith(notification.id);
			expect(dispatchSpy).toHaveBeenCalledWith(notification);
		});

		it('does nothing when the entity is gone by the time it runs', async () => {
			notificationsService.findOne.mockResolvedValue(null);

			const dispatchSpy = jest.spyOn(dispatcher, 'dispatch').mockResolvedValue(undefined);

			await dispatcher.handleNotificationCreated({
				id: 'gone',
				kind: NotificationKind.EVENT,
				severity: NotificationSeverity.INFO,
				source: 'system-module',
			});

			expect(dispatchSpy).not.toHaveBeenCalled();
		});

		it('is registered against the notification created event', () => {
			/* eslint-disable @typescript-eslint/unbound-method -- introspecting the decorator's
			   metadata on the function itself, never calling it unbound */
			const metadata: unknown = Reflect.getMetadata('EVENT_LISTENER_METADATA', dispatcher.handleNotificationCreated);
			/* eslint-enable @typescript-eslint/unbound-method */

			expect(metadata).toEqual([{ event: EventType.NOTIFICATION_CREATED, options: undefined }]);
		});
	});
});
