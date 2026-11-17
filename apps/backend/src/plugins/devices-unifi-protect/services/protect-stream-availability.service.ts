import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ProtectRtspsStreams } from '../client/protect-api.types';
import { parseProtectStreamUrl } from '../client/protect-stream-url';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_RTSPS_QUALITIES,
	PROTECT_STREAM_AVAILABILITY_TTL_MS,
	PROTECT_STREAM_READ_DEADLINE_MS,
	PROTECT_STREAM_REFRESH_MAX_QUEUED,
	ProtectRtspsQuality,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { toStreamAvailability } from '../mappings/mapping-evaluator';

import { ProtectConnectorService } from './protect-connector.service';
import { ProtectFailureLogLimiter } from './protect-failure-log-limiter';
import { ProtectStreamAvailabilityEntry, ProtectStreamAvailabilityStore } from './protect-stream-availability.store';
import { ProtectSynchronizerService } from './protect-synchronizer.service';

/** A reconnect read is skipped while the camera's entry is younger than this (anti-flap). */
const RECONNECT_MIN_ENTRY_AGE_MS = 10_000;

/** Console port of each enabled quality; ports are not secret, the aliases are never kept. */
export type ProtectStreamPorts = Readonly<Partial<Record<ProtectRtspsQuality, number>>>;

const toPorts = (streams: ProtectRtspsStreams): ProtectStreamPorts => {
	const ports: Partial<Record<ProtectRtspsQuality, number>> = {};

	for (const quality of PROTECT_RTSPS_QUALITIES) {
		const parsed = parseProtectStreamUrl(streams[quality]);

		if (parsed !== null) {
			ports[quality] = parsed.port;
		}
	}

	return Object.freeze(ports);
};

/** A category or an error class name: never a message, which can carry an address. */
const describeFailure = (error: unknown): string => {
	if (error instanceof ProtectApiError) {
		return error.category;
	}

	return error instanceof Error && /^\w{1,64}$/.test(error.constructor.name) ? error.constructor.name : 'unknown';
};

/**
 * Which RTSPS streams each adopted camera has enabled. Reads go through the paced client; only booleans reach the store
 * and only ports are kept next to them (never an address or alias). One background read at a time, never a retry storm.
 */
@Injectable()
export class ProtectStreamAvailabilityService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(
		DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
		'ProtectStreamAvailabilityService',
	);
	private readonly failureLog = new ProtectFailureLogLimiter();

	/** Bumped when a session ends; whatever a read started under an older generation produces is dropped. */
	private generation = 0;
	private sessionAbort = new AbortController();
	private readonly lastState = new Map<string, unknown>();
	private readonly attemptedAt = new Map<string, number>();
	private readonly ports = new Map<string, ProtectStreamPorts>();
	/** Keyed `<generation>:<camera>`; joined by every caller of that camera in that session. */
	private readonly inflight = new Map<string, Promise<void>>();
	private readonly waiting: string[] = [];
	/** When each waiting camera was queued; a read newer than this makes the queued one redundant. */
	private readonly queuedAt = new Map<string, number>();
	private readonly tracked = new Set<string>();
	private readonly deferred = new Map<string, NodeJS.Timeout>();
	/** Cameras whose status refresh did not happen after a presence change; retried on their next read. */
	private readonly needsRefresh = new Set<string>();
	private pumping = false;

	private unsubscribeObserver: (() => void) | null = null;
	private unsubscribeSession: (() => void) | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly synchronizer: ProtectSynchronizerService,
		private readonly store: ProtectStreamAvailabilityStore,
	) {}

	onModuleInit(): void {
		this.unsubscribeObserver ??= this.synchronizer.observeDevices((modelKey, id, raw) => {
			this.observe(modelKey, id, raw);
		});
		this.unsubscribeSession ??= this.connector.onSessionChange(() => {
			this.endSession();
		});
	}

	onModuleDestroy(): void {
		this.unsubscribeObserver?.();
		this.unsubscribeObserver = null;
		this.unsubscribeSession?.();
		this.unsubscribeSession = null;
		this.endSession();
	}

	/**
	 * SECRET result. One paced GET `rtsps-stream` (deadline at most 8 000 ms, the caller's signal); stores the booleans
	 * and ports and, when the presence changed, queues a status refresh. Throws ProtectApiError (`unavailable` without a
	 * client).
	 */
	async readStreams(
		cameraId: string,
		options: { signal?: AbortSignal; deadlineMs?: number } = {},
	): Promise<ProtectRtspsStreams> {
		const client = this.connector.getClient();

		if (client === null) {
			throw new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'cameras/{id}/rtsps-stream');
		}

		const generation = this.generation;
		const previousAttempt = this.attemptedAt.get(cameraId);

		const stamp = Date.now();

		this.attemptedAt.set(cameraId, stamp);

		let streams: ProtectRtspsStreams;

		try {
			streams = await client.getRtspsStreams(cameraId, {
				signal: options.signal ?? this.sessionAbort.signal,
				deadlineMs: Math.min(options.deadlineMs ?? PROTECT_STREAM_READ_DEADLINE_MS, PROTECT_STREAM_READ_DEADLINE_MS),
			});
		} catch (error) {
			// A caller that gave up says nothing about the camera.
			if (error instanceof ProtectApiError && error.category === ProtectErrorCategory.CANCELLED) {
				this.restoreAttempt(generation, cameraId, previousAttempt, stamp);
			}

			throw error;
		}

		this.record(generation, cameraId, streams);

		return streams;
	}

	/**
	 * The store's entry. A stale entry is returned at once and refreshed in the background; one read is awaited only
	 * when the camera has no entry. A failed read leaves the last entry (or null). Never throws.
	 */
	async getAvailability(
		cameraId: string,
		options: { signal?: AbortSignal } = {},
	): Promise<ProtectStreamAvailabilityEntry | null> {
		try {
			const entry = this.store.get(cameraId);

			if (entry !== null) {
				if (
					// A camera adopted since its last frame has no state yet; only a known disconnect skips the refresh.
					this.lastState.get(cameraId) !== 'DISCONNECTED' &&
					Date.now() - entry.readAt >= PROTECT_STREAM_AVAILABILITY_TTL_MS &&
					!this.attemptedRecently(cameraId)
				) {
					this.enqueue(cameraId);
				}

				return entry;
			}

			// A camera that just failed is not read again by every listing; a read in flight is joined.
			if (this.inflight.has(`${this.generation}:${cameraId}`) || !this.attemptedRecently(cameraId)) {
				await this.waitFor(this.read(cameraId), options.signal);
			}
		} catch (error) {
			// A caller's own abort is not the camera's failure; a failed read is the caller's "no availability".
			if (!(error instanceof ProtectApiError)) {
				this.logLimited(`UniFi Protect stream availability read failed (${describeFailure(error)})`);
			}
		}

		return this.store.get(cameraId);
	}

	/** Ports of the camera's enabled streams from its latest read; null when it was not read this session. */
	getStreamPorts(cameraId: string): ProtectStreamPorts | null {
		return this.ports.get(cameraId) ?? null;
	}

	private observe(modelKey: string, id: string, raw: Readonly<Record<string, unknown>>): void {
		if (modelKey !== 'camera' || !this.synchronizer.isAdopted(modelKey, id)) {
			return;
		}

		const state = raw.state;
		const previous = this.lastState.get(id);

		this.lastState.set(id, state);

		if (state !== 'CONNECTED') {
			return;
		}

		const entry = this.store.get(id);

		if (previous !== undefined && previous !== 'CONNECTED') {
			this.onReconnect(id, entry);
		} else if (entry === null && !this.attemptedRecently(id)) {
			this.enqueue(id);
		}
	}

	private onReconnect(id: string, entry: ProtectStreamAvailabilityEntry | null): void {
		// A read that failed counts like one that worked: the camera is not read again within the window.
		const lastRead = Math.max(entry?.readAt ?? -Infinity, this.attemptedAt.get(id) ?? -Infinity);
		const age = Date.now() - lastRead;

		if (age >= RECONNECT_MIN_ENTRY_AGE_MS) {
			this.enqueue(id);

			return;
		}

		if (this.deferred.has(id)) {
			return;
		}

		const generation = this.generation;
		const timer = setTimeout(
			() => {
				this.deferred.delete(id);

				if (generation === this.generation && this.lastState.get(id) === 'CONNECTED') {
					this.enqueue(id);
				}
			},
			Math.max(0, RECONNECT_MIN_ENTRY_AGE_MS - age),
		);

		timer.unref();
		this.deferred.set(id, timer);
	}

	private attemptedRecently(id: string): boolean {
		const at = this.attemptedAt.get(id);

		return at !== undefined && Date.now() - at < PROTECT_STREAM_AVAILABILITY_TTL_MS;
	}

	private enqueue(id: string): void {
		if (this.tracked.has(id)) {
			return;
		}

		// The read in progress counts: at most PROTECT_STREAM_REFRESH_MAX_QUEUED reads are queued or running.
		if (this.tracked.size >= PROTECT_STREAM_REFRESH_MAX_QUEUED) {
			this.logLimited('UniFi Protect stream availability queue is full');

			return;
		}

		this.tracked.add(id);
		this.waiting.push(id);
		this.queuedAt.set(id, Date.now());
		void this.pump();
	}

	private async pump(): Promise<void> {
		if (this.pumping) {
			return;
		}

		const generation = this.generation;

		this.pumping = true;

		try {
			while (generation === this.generation && this.waiting.length > 0) {
				const id = this.waiting.shift();
				const queued = this.queuedAt.get(id) ?? -Infinity;

				this.queuedAt.delete(id);

				try {
					if (!this.readSince(id, queued)) {
						await this.read(id);
					}
				} catch (error) {
					if (generation === this.generation) {
						this.logLimited(`UniFi Protect stream availability read failed (${describeFailure(error)})`);
					}
				}

				if (generation === this.generation) {
					this.tracked.delete(id);
				}
			}
		} finally {
			if (generation === this.generation) {
				this.pumping = false;
			}
		}
	}

	/** True when the camera was read, or a read was tried, after `since`. */
	private readSince(id: string, since: number): boolean {
		return (this.store.get(id)?.readAt ?? -Infinity) > since || (this.attemptedAt.get(id) ?? -Infinity) > since;
	}

	/** One read per camera and session, joined by every caller; rejects with the read's error. */
	private read(cameraId: string): Promise<void> {
		const key = `${this.generation}:${cameraId}`;
		let pending = this.inflight.get(key);

		if (pending === undefined) {
			// Reduced to booleans and ports inside readStreams; nothing secret leaves it through this promise.
			// The shared read runs on the session's signal only: no caller's abort can fail the others.
			pending = this.readStreams(cameraId).then((): void => undefined);
			this.inflight.set(key, pending);

			const forget = (): void => {
				if (this.inflight.get(key) === pending) {
					this.inflight.delete(key);
				}
			};

			pending.then(forget, forget);
		}

		return pending;
	}

	/** Resolves with the promise; rejects alone when the caller's signal aborts first. */
	private waitFor(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
		if (signal === undefined) {
			return promise;
		}

		return new Promise<void>((resolve, reject) => {
			const onAbort = (): void =>
				reject(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'cameras/{id}/rtsps-stream'));

			if (signal.aborted) {
				onAbort();

				return;
			}

			signal.addEventListener('abort', onAbort, { once: true });
			promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
		});
	}

	/** Restores only while the stamp is still this call's: a later read's stamp is not undone by an earlier cancel. */
	private restoreAttempt(generation: number, cameraId: string, previous: number | undefined, stamp: number): void {
		if (generation !== this.generation || this.attemptedAt.get(cameraId) !== stamp) {
			return;
		}

		if (previous === undefined) {
			this.attemptedAt.delete(cameraId);
		} else {
			this.attemptedAt.set(cameraId, previous);
		}
	}

	private record(generation: number, cameraId: string, streams: ProtectRtspsStreams): void {
		if (generation !== this.generation) {
			return;
		}

		const changed = this.store.set(cameraId, toStreamAvailability(streams));

		this.ports.set(cameraId, toPorts(streams));

		if (!changed && !this.needsRefresh.has(cameraId)) {
			return;
		}

		const identity = this.connector.getConsoleIdentity();

		if (identity === null) {
			this.needsRefresh.add(cameraId);

			return;
		}

		// A false answer does not say why (not adopted yet, queue full, write failed): try again on the next read.
		const settled = (done: boolean): void => {
			if (generation !== this.generation) {
				return;
			}

			if (done) {
				this.needsRefresh.delete(cameraId);
			} else {
				this.needsRefresh.add(cameraId);
			}
		};

		this.synchronizer.refreshDevice(identity, 'camera', cameraId).then(settled, () => settled(false));
	}

	private endSession(): void {
		this.generation += 1;
		this.sessionAbort.abort();
		this.sessionAbort = new AbortController();
		this.store.clear();
		this.lastState.clear();
		this.attemptedAt.clear();
		this.ports.clear();
		this.inflight.clear();
		this.waiting.length = 0;
		this.queuedAt.clear();
		this.tracked.clear();
		this.needsRefresh.clear();
		this.pumping = false;

		for (const timer of this.deferred.values()) {
			clearTimeout(timer);
		}

		this.deferred.clear();
	}

	/** One line per fixed text and `PROTECT_FAILURE_LOG_INTERVAL_MS`. */
	private logLimited(text: string): void {
		const decision = this.failureLog.consume(text);

		if (decision.log) {
			this.logger.warn(decision.suppressed > 0 ? `${text} (${decision.suppressed} similar suppressed)` : text);
		}
	}
}
