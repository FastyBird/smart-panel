import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ProtectApiClient } from '../client/protect-api.client';
import { ProtectSubscription, ProtectSubscriptionHandlers } from '../client/protect-subscription';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_DEGRADED_AFTER_FAILURES,
	PROTECT_MAX_BUFFERED_FRAMES,
	PROTECT_MAX_RETRY_AFTER_MS,
	PROTECT_SUBSCRIPTION_TOPICS,
	PROTECT_WS_PING_INTERVAL_MS,
	PROTECT_WS_PONG_TIMEOUT_MS,
	ProtectRealtimeState,
	ProtectSubscriptionTopic,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';
import { ProtectModelKey } from '../mappings/mapping.types';

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
	private state: ProtectRealtimeState = 'stopped';
	private generation = 0;
	private consecutiveFailures = 0;
	private readonly sockets = new Map<ProtectSubscriptionTopic, ProtectSubscription>();
	private buffer: ProtectFrame[] = [];
	private abort: AbortController | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingTimer: NodeJS.Timeout | null = null;
	private pongTimer: NodeJS.Timeout | null = null;
	private awaitingPong = new Set<ProtectSubscriptionTopic>();
	private inflight: Promise<void> | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly synchronizer: ProtectSynchronizerService,
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
		return this.state;
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
		this.generation += 1;
		this.session = session;
		this.consecutiveFailures = 0;
		this.startCycle(this.generation);
	}

	/** Idempotent: closes sockets and timers; only a connector stop (or module destroy) resets the synchronizer. */
	private endSession(reason: ProtectSessionEnd): void {
		this.generation += 1;
		this.teardown();
		this.session = null;
		this.consecutiveFailures = 0;
		this.state = 'stopped';

		if (reason === 'stopped') {
			this.synchronizer.reset();
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
		this.awaitingPong.clear();
		this.clearTimer('reconnectTimer');
		this.clearTimer('pingTimer');
		this.clearTimer('pongTimer');
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

		this.state = 'connecting';
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

			const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

			if (rejected !== undefined) {
				throw rejected.reason;
			}

			this.state = 'priming';

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
					this.restart(generation);

					return;
				}
			}

			this.state = 'streaming';
			this.consecutiveFailures = 0;
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

		if (this.state === 'streaming') {
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
		if (this.state === 'streaming') {
			this.logger.warn(`UniFi Protect realtime socket closed (${failure.category})`);
			this.restart(generation);

			return;
		}

		this.fail(generation, failure);
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

	/** A healthy session was lost (drop, missed pong, full queue): re-prime from attempt 0. */
	private restart(generation: number): void {
		if (this.isStale(generation)) {
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

		let delay = this.timings.reconnectDelay(this.consecutiveFailures - 1);

		if (apiError.category === ProtectErrorCategory.RATE_LIMITED && apiError.retryAfterMs !== null) {
			delay = Math.max(delay, Math.min(apiError.retryAfterMs, PROTECT_MAX_RETRY_AFTER_MS));
		}

		this.logger.warn(`UniFi Protect realtime cycle failed (${apiError.category}); retry in ${delay} ms`);
		this.scheduleCycle(delay);
	}

	private scheduleCycle(delay: number): void {
		const generation = this.generation;

		this.state = 'connecting';
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

	private clearTimer(name: 'reconnectTimer' | 'pingTimer' | 'pongTimer'): void {
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
