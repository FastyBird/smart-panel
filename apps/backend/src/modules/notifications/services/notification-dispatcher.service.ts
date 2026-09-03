import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { PluginConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { NotificationEntity } from '../entities/notifications.entity';
import {
	EventType,
	NOTIFICATIONS_MODULE_NAME,
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
	SEVERITY_RANK,
} from '../notifications.constants';
import { sanitizeErrorMessage } from '../notifications.utils';
import { ChannelDeliveryError, INotificationChannel } from '../platforms/notification-channel.platform';

import { NotificationChannelRegistryService } from './notification-channel-registry.service';
import { NotificationEventPayload, NotificationsService } from './notifications.service';

/** DI token for the delay function between retries, so a test can inject a fake that resolves immediately. */
export const NOTIFICATION_DISPATCHER_SLEEP = Symbol('NOTIFICATION_DISPATCHER_SLEEP');

export type NotificationDispatcherSleep = (ms: number) => Promise<void>;

const DELIVERY_FAILED_KEY = 'delivery-failed';

/**
 * Fans a newly created notification out to every registered channel.
 *
 * One delivery chain per channel type, so a burst of notifications keeps its order for that
 * channel, but a slow or retrying channel never delays another. Each attempt is bounded by its own
 * 10-second timeout and, for a connection-establishment failure or an HTTP 429/5xx, retried up to
 * twice more before the channel self-reports through the very system it failed to notify.
 */
@Injectable()
export class NotificationDispatcherService {
	private static readonly DELIVERY_TIMEOUT_MS = 10_000; // 10 seconds

	private static readonly MAX_ATTEMPTS = 3;

	private static readonly RETRY_DELAYS_MS = [1_000, 5_000]; // 1 second, then 5 seconds

	private readonly logger = createExtensionLogger(NOTIFICATIONS_MODULE_NAME, 'NotificationDispatcherService');

	/** The in-flight (or most recently settled) delivery promise per channel type. */
	private readonly deliveryChains = new Map<string, Promise<void>>();

	constructor(
		private readonly registry: NotificationChannelRegistryService,
		private readonly notificationsService: NotificationsService,
		private readonly configService: ConfigService,
		@Inject(NOTIFICATION_DISPATCHER_SLEEP) private readonly sleep: NotificationDispatcherSleep,
	) {}

	@OnEvent(EventType.NOTIFICATION_CREATED)
	async handleNotificationCreated(payload: NotificationEventPayload): Promise<void> {
		try {
			const notification = await this.notificationsService.findOne(payload.id);

			if (notification === null) {
				this.logger.debug(`Notification id=${payload.id} was gone by the time dispatch ran, skipping`);

				return;
			}

			await this.dispatch(notification);
		} catch (error) {
			this.logger.warn(
				`Failed to dispatch notification id=${payload.id}: ${sanitizeErrorMessage(normaliseErrorMessage(error))}`,
			);
		}
	}

	/**
	 * Fans `notification` out to every registered channel in parallel, one delivery each queued
	 * behind that channel's own chain. Skips entirely when `notification.source` is itself a
	 * registered channel type - the loop guard that stops a channel's own `delivery-failed` report
	 * from being forwarded to every channel in turn.
	 */
	async dispatch(notification: NotificationEntity): Promise<void> {
		if (this.registry.isChannel(notification.source)) {
			return;
		}

		const channels = this.registry.getChannels();

		await Promise.allSettled(channels.map((channel) => this.enqueue(channel, notification)));
	}

	/**
	 * Creates the per-attempt abort signal. Overridden in tests with a manually controlled
	 * `AbortController` signal, because `AbortSignal.timeout` schedules through Node's internal
	 * timer, not the global `setTimeout` fake timers can advance.
	 */
	protected createDeliverySignal(): AbortSignal {
		return AbortSignal.timeout(NotificationDispatcherService.DELIVERY_TIMEOUT_MS);
	}

	/** Chains this delivery behind whatever is already queued for `channel`'s type. */
	private enqueue(channel: INotificationChannel, notification: NotificationEntity): Promise<void> {
		const type = channel.getType();
		const previous = this.deliveryChains.get(type) ?? Promise.resolve();
		const next = previous.then(() => this.deliverToChannel(channel, notification));

		this.deliveryChains.set(type, next);

		return next;
	}

	/**
	 * One channel, one notification: filters, then attempts delivery. Never rejects - a throw here
	 * would poison this channel's chain and silently drop every notification queued behind it.
	 */
	private async deliverToChannel(channel: INotificationChannel, notification: NotificationEntity): Promise<void> {
		try {
			if (await this.shouldSkip(channel, notification)) {
				return;
			}

			await this.deliverWithRetries(channel, notification);
		} catch (error) {
			this.logger.error(
				`Unexpected error delivering to channel type=${channel.getType()}: ${sanitizeErrorMessage(normaliseErrorMessage(error))}`,
			);
		}
	}

	private async shouldSkip(channel: INotificationChannel, notification: NotificationEntity): Promise<boolean> {
		const pluginConfig = this.configService.getPluginConfig<PluginConfigModel>(channel.getType());

		if (pluginConfig.enabled === false) {
			return true;
		}

		if (!(await channel.isConfigured())) {
			return true;
		}

		const minSeverity = await channel.getMinSeverity();

		return SEVERITY_RANK[notification.severity] < SEVERITY_RANK[minSeverity];
	}

	private async deliverWithRetries(channel: INotificationChannel, notification: NotificationEntity): Promise<void> {
		for (let attempt = 1; attempt <= NotificationDispatcherService.MAX_ATTEMPTS; attempt++) {
			try {
				await this.sendOnce(channel, notification);
				await this.notificationsService.resolve(channel.getType(), DELIVERY_FAILED_KEY);

				return;
			} catch (error) {
				const retryable = error instanceof ChannelDeliveryError && error.retryable;
				const hasMoreAttempts = attempt < NotificationDispatcherService.MAX_ATTEMPTS;

				if (retryable && hasMoreAttempts) {
					await this.sleep(NotificationDispatcherService.RETRY_DELAYS_MS[attempt - 1]);

					continue;
				}

				await this.reportFailure(channel, error);

				return;
			}
		}
	}

	/** One attempt: `send` raced against its own signal, so a channel that ignores it still settles. */
	private sendOnce(channel: INotificationChannel, notification: NotificationEntity): Promise<void> {
		const signal = this.createDeliverySignal();

		return this.raceAgainstAbort(channel.send(notification, signal), signal);
	}

	private raceAgainstAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
		if (signal.aborted) {
			return Promise.reject(new Error('Channel did not respond before the delivery timeout'));
		}

		return new Promise<T>((resolve, reject) => {
			const onAbort = (): void => reject(new Error('Channel did not respond before the delivery timeout'));

			signal.addEventListener('abort', onAbort, { once: true });

			promise.then(resolve, reject).finally(() => {
				signal.removeEventListener('abort', onAbort);
			});
		});
	}

	private async reportFailure(channel: INotificationChannel, error: unknown): Promise<void> {
		const message = sanitizeErrorMessage(normaliseErrorMessage(error));
		const type = channel.getType();

		this.logger.error(`Failed to deliver a notification via channel type=${type}: ${message}`);

		await this.notificationsService.notify({
			source: type,
			kind: NotificationKind.ISSUE,
			key: DELIVERY_FAILED_KEY,
			severity: NotificationSeverity.WARNING,
			title: 'Notification delivery failed',
			message,
			actions: [
				{
					type: NotificationActionType.LINK,
					label: 'Open channel settings',
					url: `/config/plugins/${type}`,
				},
			],
		});
	}
}

/** `error instanceof Error ? error.message : String(error)`, guarded against a throwing `toString`. */
function normaliseErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- error is genuinely unknown; still needs a message
		return String(error);
	} catch {
		return 'unknown error';
	}
}
