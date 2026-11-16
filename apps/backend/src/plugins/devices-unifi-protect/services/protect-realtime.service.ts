import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../../modules/notifications/notifications.constants';
import { NotificationsService } from '../../../modules/notifications/services/notifications.service';
import { ProtectApiClient } from '../client/protect-api.client';
import { ProtectSubscription, ProtectSubscriptionHandlers } from '../client/protect-subscription';
import {
	DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID,
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_DEFAULT_POLL_INTERVAL_MS,
	PROTECT_DEGRADED_AFTER_FAILURES,
	PROTECT_MAX_BUFFERED_FRAMES,
	PROTECT_MAX_RETRY_AFTER_MS,
	PROTECT_STABLE_STREAM_MS,
	PROTECT_SUBSCRIPTION_TOPICS,
	PROTECT_WS_PING_INTERVAL_MS,
	PROTECT_WS_PONG_TIMEOUT_MS,
	ProtectConnectionState,
	ProtectRealtimeState,
	ProtectSubscriptionTopic,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';
import { ProtectModelKey } from '../mappings/mapping.types';
import { ProtectConfigModel } from '../models/config.model';
import { ProtectStatusModel } from '../models/status.model';

import { ProtectConnectorService, ProtectSession, ProtectSessionEnd } from './protect-connector.service';
import { ProtectFrame, parseProtectFrame } from './protect-frame-merge';
import { ProtectInventoryEntry } from './protect-inventory.service';
import { calculateProtectReconnectDelay } from './protect-reconnect-backoff';
import { ProtectSnapshot, ProtectSynchronizerService } from './protect-synchronizer.service';

export interface ProtectRealtimeTimings {
	pingIntervalMs: number;
	pongTimeoutMs: number;
	degradedAfterFailures: number;
	reconnectDelay(attempt: number): number;
}

export const PROTECT_REALTIME_NOTIFICATION_KEY = 'realtime';

export const PROTECT_REALTIME_TIMINGS = Symbol('PROTECT_REALTIME_TIMINGS');

export const PROTECT_DEFAULT_REALTIME_TIMINGS: ProtectRealtimeTimings = {
	pingIntervalMs: PROTECT_WS_PING_INTERVAL_MS,
	pongTimeoutMs: PROTECT_WS_PONG_TIMEOUT_MS,
	degradedAfterFailures: PROTECT_DEGRADED_AFTER_FAILURES,
	reconnectDelay: (attempt) => calculateProtectReconnectDelay(attempt),
};

type ConsoleSnapshot = ProtectSnapshot & { failure: ProtectApiError | null };

/**
 * Reads the three device lists in order and keeps the first entry per model key and id. A failed list leaves the
 * snapshot incomplete (`complete: false`) with the failure of the first one; the other lists are still returned.
 */
export async function readConsoleSnapshot(client: ProtectApiClient): Promise<ConsoleSnapshot> {
	const readers: [ProtectModelKey, () => Promise<{ id: string; raw: Record<string, unknown> }[]>][] = [
		['camera', () => client.listCameras()],
		['sensor', () => client.listSensors()],
		['light', () => client.listLights()],
	];
	const entries: ProtectInventoryEntry[] = [];
	let failure: ProtectApiError | null = null;

	for (const [modelKey, read] of readers) {
		try {
			const seen = new Set<string>();

			for (const item of await read()) {
				if (!seen.has(item.id)) {
					seen.add(item.id);
					entries.push({ modelKey, id: item.id, raw: item.raw });
				}
			}
		} catch (error) {
			failure ??= toProtectApiError(error, 'system');
		}
	}

	return { complete: failure === null, entries, failure };
}

/**
 * Keeps the two console sockets of one connector session alive: opens both, buffers their frames, primes the
 * synchronizer over REST, applies the buffer in arrival order, then streams. Every await is followed by a generation
 * check, so an ended session or a restarted cycle discards late results and their sockets.
 */
@Injectable()
export class ProtectRealtimeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectRealtimeService');

	private unsubscribe: (() => void) | null = null;
	private session: ProtectSession | null = null;
	private cycle: ProtectRealtimeState = 'stopped';
	private polling = false;
	private pollEpoch = 0;
	private issueActive = false;
	private issueChain: Promise<void> = Promise.resolve();
	private streamingSince: number | null = null;
	private pollTimer: NodeJS.Timeout | null = null;
	private generation = 0;
	private consecutiveFailures = 0;
	private readonly sockets = new Map<ProtectSubscriptionTopic, ProtectSubscription>();
	private buffer: ProtectFrame[] = [];
	private abort: AbortController | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingTimer: NodeJS.Timeout | null = null;
	private pongTimer: NodeJS.Timeout | null = null;
	private stableTimer: NodeJS.Timeout | null = null;
	private awaitingPong = new Set<ProtectSubscriptionTopic>();
	private inflight: Promise<void> | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly synchronizer: ProtectSynchronizerService,
		private readonly notifications: NotificationsService,
		private readonly configService: ConfigService,
		@Inject(PROTECT_REALTIME_TIMINGS) private readonly timings: ProtectRealtimeTimings,
	) {}

	onModuleInit(): void {
		this.unsubscribe ??= this.connector.onSessionChange((session, reason) => this.onSession(session, reason));
	}

	onModuleDestroy(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.endSession('stopped');
	}

	getState(): ProtectRealtimeState {
		return this.polling ? 'polling' : this.cycle;
	}

	/** Applies the realtime view to the connector's status: degraded while polling, plus the realtime fields. */
	decorateStatus(status: ProtectStatusModel): ProtectStatusModel {
		const state = this.getState();

		if (status.connectionState === ProtectConnectionState.CONNECTED && state === 'polling') {
			status.connectionState = ProtectConnectionState.DEGRADED;
		}

		status.realtimeState = state;
		status.ignoredEventCount = this.synchronizer.getCounters().ignoredEventCount;

		return status;
	}

	/** Resolves when the current cycle step (open, prime, buffered apply) has finished (tests, e2e). */
	async settle(): Promise<void> {
		let pending = this.inflight;

		while (pending !== null) {
			await pending;

			pending = this.inflight === pending ? null : this.inflight;
		}
	}

	private onSession(session: ProtectSession | null, reason: ProtectSessionEnd | null): void {
		if (session === null) {
			this.endSession(reason ?? 'lost');

			return;
		}

		this.teardown();
		this.stopPolling();
		this.generation += 1;
		this.session = session;
		this.consecutiveFailures = 0;
		this.startCycle(this.generation);
	}

	/** Idempotent: closes sockets and timers; only a connector stop (or module destroy) resets the synchronizer. */
	private endSession(reason: ProtectSessionEnd): void {
		this.generation += 1;
		this.teardown();
		this.stopPolling();
		this.session = null;
		this.consecutiveFailures = 0;
		this.cycle = 'stopped';

		if (reason === 'stopped') {
			this.synchronizer.reset();
			void this.resolveIssue();
		}
	}

	/** Closes sockets, aborts pending opens and clears every timer; does not touch the generation. */
	private teardown(): void {
		this.abort?.abort();
		this.abort = null;

		for (const socket of this.sockets.values()) {
			this.closeSocket(socket);
		}

		this.sockets.clear();
		this.buffer = [];
		this.streamingSince = null;
		this.awaitingPong.clear();
		this.clearTimer('reconnectTimer');
		this.clearTimer('pingTimer');
		this.clearTimer('pongTimer');
		this.clearTimer('stableTimer');
	}

	private closeSocket(socket: ProtectSubscription): void {
		try {
			socket.close();
		} catch {
			this.logger.warn('UniFi Protect realtime socket close failed');
		}
	}

	private startCycle(generation: number): void {
		const work: Promise<void> = this.runCycle(generation).finally(() => {
			if (this.inflight === work) {
				this.inflight = null;
			}
		});

		this.inflight = work;
	}

	private isStale(generation: number): boolean {
		return generation !== this.generation;
	}

	private async runCycle(generation: number): Promise<void> {
		const session = this.session;

		if (session === null) {
			return;
		}

		this.cycle = 'connecting';
		this.buffer = [];

		const abort = new AbortController();

		this.abort = abort;

		try {
			const results = await Promise.allSettled(
				PROTECT_SUBSCRIPTION_TOPICS.map((topic) => this.openSocket(session, topic, generation, abort)),
			);

			if (this.isStale(generation)) {
				return;
			}

			// The first failure aborts its sibling, which then rejects as cancelled: keep the original failure (and its
			// Retry-After), and fall back to a cancellation only when every rejection is one.
			const rejections = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
			const rejected =
				rejections.find(
					(result) => toProtectApiError(result.reason, 'system').category !== ProtectErrorCategory.CANCELLED,
				) ?? rejections[0];

			if (rejected !== undefined) {
				throw rejected.reason;
			}

			this.cycle = 'priming';

			const snapshot = await readConsoleSnapshot(session.client);

			if (this.isStale(generation)) {
				return;
			}

			if (!snapshot.complete) {
				throw snapshot.failure ?? new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'system');
			}

			await this.synchronizer.applySnapshot(session.identity, { complete: true, entries: snapshot.entries });

			if (this.isStale(generation)) {
				return;
			}

			// Frames that arrived while the snapshot was applied are drained in the same tick the state flips, so
			// no frame can fall between the buffer and the live path.
			while (this.buffer.length > 0) {
				const frame = this.buffer.shift();

				if (!this.synchronizer.enqueueFrame(session.identity, frame)) {
					this.fail(generation, new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'subscribe/events'));

					return;
				}
			}

			// consecutiveFailures is reset only by a session that streams for PROTECT_STABLE_STREAM_MS.
			this.cycle = 'streaming';
			this.streamingSince = Date.now();
			this.stopPolling();
			this.scheduleStable(generation);
			this.schedulePing(generation);
		} catch (error) {
			if (!this.isStale(generation)) {
				this.fail(generation, error);
			}
		}
	}

	private async openSocket(
		session: ProtectSession,
		topic: ProtectSubscriptionTopic,
		generation: number,
		abort: AbortController,
	): Promise<void> {
		try {
			const socket = await session.client.openSubscription(topic, this.handlersFor(session, topic, generation), {
				signal: abort.signal,
			});

			if (this.isStale(generation) || abort.signal.aborted) {
				this.closeSocket(socket);

				return;
			}

			this.sockets.set(topic, socket);
		} catch (error) {
			// The first failure fails the cycle: the other open is cancelled and its socket, if any, is closed.
			abort.abort();

			throw error;
		}
	}

	private handlersFor(
		session: ProtectSession,
		topic: ProtectSubscriptionTopic,
		generation: number,
	): ProtectSubscriptionHandlers {
		const guarded =
			(run: () => void): (() => void) =>
			() => {
				if (this.isStale(generation)) {
					return;
				}

				try {
					run();
				} catch {
					// Handlers run inside socket event listeners, where a throw would be an uncaught exception.
					this.logger.warn('UniFi Protect realtime handler failed');
				}
			};

		return {
			message: (text) => guarded(() => this.onMessage(session, text, generation))(),
			pong: guarded(() => this.onPong(topic, generation)),
			closed: (failure) => guarded(() => this.onClosed(failure, generation))(),
		};
	}

	private onMessage(session: ProtectSession, text: string, generation: number): void {
		const parsed = parseProtectFrame(text);

		if (!('frame' in parsed)) {
			this.synchronizer.countIgnoredFrame();

			return;
		}

		if (this.cycle === 'streaming') {
			if (!this.synchronizer.enqueueFrame(session.identity, parsed.frame)) {
				this.restart(generation);
			}

			return;
		}

		// Buffered from the moment the handler exists, so a frame that beats the other socket's upgrade is kept.
		if (this.buffer.length >= PROTECT_MAX_BUFFERED_FRAMES) {
			this.fail(generation, new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'subscribe/events'));

			return;
		}

		this.buffer.push(parsed.frame);
	}

	private onPong(topic: ProtectSubscriptionTopic, generation: number): void {
		if (!this.awaitingPong.delete(topic) || this.awaitingPong.size > 0) {
			return;
		}

		this.clearTimer('pongTimer');
		this.schedulePing(generation);
	}

	private onClosed(failure: ProtectApiError, generation: number): void {
		if (this.cycle === 'streaming') {
			this.logger.warn(`UniFi Protect realtime socket closed (${failure.category})`);
			this.restart(generation);

			return;
		}

		this.fail(generation, failure);
	}

	/** The realtime issue resolves only once the session has streamed for a while, so a flapping console does not toggle it. */
	private scheduleStable(generation: number): void {
		this.clearTimer('stableTimer');
		this.stableTimer = this.unref(
			setTimeout(() => {
				this.stableTimer = null;

				if (!this.isStale(generation)) {
					void this.resolveIssue();
				}
			}, PROTECT_STABLE_STREAM_MS),
		);
	}

	private schedulePing(generation: number): void {
		this.clearTimer('pingTimer');
		this.pingTimer = this.unref(
			setTimeout(() => {
				this.pingTimer = null;

				if (this.isStale(generation)) {
					return;
				}

				try {
					this.awaitingPong = new Set(this.sockets.keys());

					for (const socket of this.sockets.values()) {
						socket.ping();
					}
				} catch {
					this.logger.warn('UniFi Protect realtime ping failed');
					this.restart(generation);

					return;
				}

				this.pongTimer = this.unref(
					setTimeout(() => {
						this.pongTimer = null;

						if (!this.isStale(generation)) {
							this.logger.warn('UniFi Protect realtime pong timed out');
							this.restart(generation);
						}
					}, this.timings.pongTimeoutMs),
				);
			}, this.timings.pingIntervalMs),
		);
	}

	/**
	 * A streaming session was lost (drop, missed pong, full queue): re-prime from attempt 0 when it had streamed for
	 * a while, otherwise it counts as a failed cycle so a flapping console reaches degraded polling.
	 */
	private restart(generation: number): void {
		if (this.isStale(generation)) {
			return;
		}

		if (this.streamingSince !== null && Date.now() - this.streamingSince < PROTECT_STABLE_STREAM_MS) {
			this.fail(generation, new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'subscribe/events'));

			return;
		}

		this.generation += 1;
		this.teardown();
		this.consecutiveFailures = 0;
		this.scheduleCycle(this.timings.reconnectDelay(0));
	}

	/** The cycle failed before streaming: back off, raised to the console's Retry-After for a rate limit. */
	private fail(generation: number, error: unknown): void {
		if (this.isStale(generation)) {
			return;
		}

		const apiError = toProtectApiError(error, 'system');

		this.generation += 1;
		this.teardown();
		this.consecutiveFailures += 1;

		if (!this.polling && this.consecutiveFailures >= this.timings.degradedAfterFailures) {
			this.startPolling();
		} else if (this.polling) {
			// A warning that could not be stored is retried on every further failed cycle (no-op while it is active).
			void this.raiseIssue();
		}

		let delay = this.timings.reconnectDelay(this.consecutiveFailures - 1);

		if (apiError.category === ProtectErrorCategory.RATE_LIMITED && apiError.retryAfterMs !== null) {
			delay = Math.max(delay, Math.min(apiError.retryAfterMs, PROTECT_MAX_RETRY_AFTER_MS));
		}

		this.logger.warn(`UniFi Protect realtime cycle failed (${apiError.category}); retry in ${delay} ms`);
		this.scheduleCycle(delay);
	}

	private scheduleCycle(delay: number): void {
		const generation = this.generation;

		this.cycle = 'connecting';
		this.clearTimer('reconnectTimer');
		this.reconnectTimer = this.unref(
			setTimeout(() => {
				this.reconnectTimer = null;

				if (!this.isStale(generation)) {
					this.startCycle(generation);
				}
			}, delay),
		);
	}

	private startPolling(): void {
		this.polling = true;
		this.pollEpoch += 1;
		void this.raiseIssue();
		this.schedulePoll(this.pollEpoch);
	}

	private stopPolling(): void {
		this.polling = false;
		this.pollEpoch += 1;
		this.clearTimer('pollTimer');
	}

	private readPollInterval(): number {
		try {
			return (
				this.configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).pollIntervalMs ??
				PROTECT_DEFAULT_POLL_INTERVAL_MS
			);
		} catch {
			return PROTECT_DEFAULT_POLL_INTERVAL_MS;
		}
	}

	/** The interval is read every time a poll is scheduled, so a changed setting applies without a restart. */
	private schedulePoll(epoch: number): void {
		this.clearTimer('pollTimer');
		this.pollTimer = this.unref(
			setTimeout(() => {
				this.pollTimer = null;

				if (epoch === this.pollEpoch) {
					void this.poll(epoch).finally(() => {
						if (epoch === this.pollEpoch) {
							this.schedulePoll(epoch);
						}
					});
				}
			}, this.readPollInterval()),
		);
	}

	private async poll(epoch: number): Promise<void> {
		const session = this.session;
		const sequence = this.synchronizer.getSnapshotSequence();

		if (session === null) {
			return;
		}

		try {
			const snapshot = await readConsoleSnapshot(session.client);

			// A result is stale once polling stopped, streaming took over or a newer snapshot was applied (a prime
			// that began meanwhile counts). A failed reconnect attempt alone does not make the read stale.
			if (
				epoch !== this.pollEpoch ||
				this.cycle === 'streaming' ||
				sequence !== this.synchronizer.getSnapshotSequence()
			) {
				return;
			}

			if (!snapshot.complete) {
				this.logger.warn(
					`UniFi Protect poll failed (${snapshot.failure?.category ?? ProtectErrorCategory.UNAVAILABLE})`,
				);
			}

			await this.synchronizer.applySnapshot(session.identity, {
				complete: snapshot.complete,
				entries: snapshot.entries,
			});
		} catch {
			this.logger.warn('UniFi Protect poll could not be applied');
		}
	}

	/**
	 * Raises the `realtime` issue once; a no-op while it is already open. The flag is set before the await so concurrent
	 * calls return early, and cleared again when the notification was not stored (notify() returns null) so the next
	 * call retries. Raise and resolve run on one chain, so they never overlap.
	 */
	private raiseIssue(): Promise<void> {
		if (this.issueActive) {
			return Promise.resolve();
		}

		this.issueActive = true;

		return this.enqueueIssue(() => this.sendIssue());
	}

	/** Idempotent. A rejected resolve keeps the flag so the next recovery or stop retries it (the HA rule). */
	private resolveIssue(): Promise<void> {
		return this.enqueueIssue(async () => {
			if (!this.issueActive) {
				return;
			}

			try {
				await this.notifications.resolve(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, PROTECT_REALTIME_NOTIFICATION_KEY);

				this.issueActive = false;
			} catch {
				this.logger.warn('UniFi Protect real-time notification could not be resolved');

				return;
			}

			// Polling may have resumed while the resolve was pending; that outage's raise returned early on the flag.
			if (this.polling) {
				this.issueActive = true;
				await this.sendIssue();
			}
		});
	}

	private enqueueIssue(operation: () => Promise<void>): Promise<void> {
		const next = this.issueChain.then(operation);

		this.issueChain = next;

		return next;
	}

	/** Never throws; the caller has already set `issueActive`. */
	private async sendIssue(): Promise<void> {
		try {
			const notification = await this.notifications.notify({
				source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
				kind: NotificationKind.ISSUE,
				key: PROTECT_REALTIME_NOTIFICATION_KEY,
				severity: NotificationSeverity.WARNING,
				title: 'UniFi Protect real-time updates unavailable',
				message:
					'Smart Panel cannot keep the UniFi Protect event connection open and is polling device state instead. ' +
					'Motion, smart detections and doorbell rings are not received until the connection recovers.',
				actions: [
					{
						type: NotificationActionType.SERVICE,
						label: 'Restart service',
						extension_kind: 'plugin',
						extension_type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
						service_id: DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID,
						operation: 'restart',
						primary: true,
					},
					{
						type: NotificationActionType.LINK,
						label: 'Open UniFi Protect settings',
						url: `/extensions/${DEVICES_UNIFI_PROTECT_PLUGIN_NAME}`,
					},
				],
			});

			if (notification === null) {
				this.issueActive = false;
			}
		} catch {
			this.issueActive = false;
			this.logger.warn('UniFi Protect real-time notification could not be raised');
		}
	}

	private clearTimer(name: 'reconnectTimer' | 'pingTimer' | 'pongTimer' | 'pollTimer' | 'stableTimer'): void {
		const timer = this[name];

		if (timer !== null) {
			clearTimeout(timer);
			this[name] = null;
		}
	}

	/** A pending timer never keeps the process alive. */
	private unref(timer: NodeJS.Timeout): NodeJS.Timeout {
		timer.unref?.();

		return timer;
	}
}
