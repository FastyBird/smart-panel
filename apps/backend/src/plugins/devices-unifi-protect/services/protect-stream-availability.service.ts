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
	private readonly tracked = new Set<string>();
	private readonly deferred = new Map<string, NodeJS.Timeout>();
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
	 * SECRET result. One paced GET `rtsps-stream` (deadline 8 000 ms, the caller's signal); stores the booleans and ports
	 * and, when the presence changed, queues a status refresh. Throws ProtectApiError (`unavailable` without a client).
	 */
	async readStreams(cameraId: string, options: { signal?: AbortSignal } = {}): Promise<ProtectRtspsStreams> {
		const client = this.connector.getClient();

		if (client === null) {
			throw new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'cameras/{id}/rtsps-stream');
		}

		const generation = this.generation;

		this.attemptedAt.set(cameraId, Date.now());

		const streams = await client.getRtspsStreams(cameraId, {
			signal: options.signal ?? this.sessionAbort.signal,
			deadlineMs: PROTECT_STREAM_READ_DEADLINE_MS,
		});

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
				if (Date.now() - entry.readAt >= PROTECT_STREAM_AVAILABILITY_TTL_MS && !this.attemptedRecently(cameraId)) {
					this.enqueue(cameraId);
				}

				return entry;
			}

			await this.read(cameraId, options.signal);
		} catch {
			// The failure is the caller's "no availability"; nothing of it is kept.
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
		const age = entry === null ? Infinity : Date.now() - entry.readAt;

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

				try {
					await this.read(id);
				} catch (error) {
					if (generation === this.generation) {
						const category = error instanceof ProtectApiError ? error.category : 'unknown';

						this.logLimited(`UniFi Protect stream availability read failed (${category})`);
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

	/** One read per camera and session, joined by every caller; rejects with the read's error. */
	private read(cameraId: string, signal?: AbortSignal): Promise<void> {
		const key = `${this.generation}:${cameraId}`;
		let pending = this.inflight.get(key);

		if (pending === undefined) {
			// Reduced to booleans and ports inside readStreams; nothing secret leaves it through this promise.
			pending = this.readStreams(cameraId, { signal }).then((): void => undefined);
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

	private record(generation: number, cameraId: string, streams: ProtectRtspsStreams): void {
		if (generation !== this.generation) {
			return;
		}

		const changed = this.store.set(cameraId, toStreamAvailability(streams));

		this.ports.set(cameraId, toPorts(streams));

		if (!changed) {
			return;
		}

		const identity = this.connector.getConsoleIdentity();

		if (identity !== null) {
			// A false answer does not say why (not adopted yet, queue full, write failed); the next frame re-syncs.
			this.synchronizer.refreshDevice(identity, 'camera', cameraId).catch(() => undefined);
		}
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
		this.tracked.clear();
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
