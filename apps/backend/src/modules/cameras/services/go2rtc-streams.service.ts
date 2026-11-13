import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import {
	CAMERAS_MODULE_NAME,
	GO2RTC_STREAM_IDLE_GRACE_MS,
	GO2RTC_STREAM_NAME_PREFIX,
	Go2rtcMode,
} from '../cameras.constants';
import {
	CameraUpstreamException,
	CamerasNotFoundException,
	Go2rtcUnavailableException,
	errorName,
} from '../cameras.exceptions';
import { ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CamerasService } from './cameras.service';
import { Go2rtcApiClient } from './go2rtc-api.client';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';
import { go2rtcStreamName, toGo2rtcSource } from './go2rtc-source';
import { Go2rtcRelayStatus, Go2rtcService } from './go2rtc.service';

/** Upper bound for the best-effort cleanup on module destroy. */
const DESTROY_DELETE_TIMEOUT_MS = 2_000;

const MIN_SECRET_LENGTH = 8;

export interface Go2rtcStreamLease {
	readonly streamName: string;
	/** go2rtc `/api/ws` url for this stream. */
	readonly wsUrl: string;
	readonly authorization: string | null;
	/** Idempotent; a no-op once the stream entry was dropped. */
	release(): void;
}

interface StreamEntry {
	readonly name: string;
	readonly deviceId: string;
	/** Viewers (and joiners of an in-flight registration) that hold a lease. */
	count: number;
	/** Settles when the registration finished; rejects for every joiner when it failed or was dropped. */
	registration: Promise<void>;
	/** Rejects an in-flight registration. */
	abort: (error: Error) => void;
	graceTimer: NodeJS.Timeout | null;
	/** Registry handles of the secrets of this registration: exactly these are released when the entry is dropped. */
	secretHandles: Array<() => void>;
	dropped: boolean;
}

/**
 * Registers one go2rtc stream per camera profile while someone watches it. Registration is lazy (first viewer), shared
 * (one `resolveSource` and one `PUT` for concurrent viewers) and reference counted: the stream is deleted
 * `GO2RTC_STREAM_IDLE_GRACE_MS` after the last viewer leaves, so a page reload reuses it.
 *
 * The source url is a secret: it lives in the go2rtc process and in the secrets registry, never in a log line, an
 * error message or a lease.
 */
@Injectable()
export class Go2rtcStreamsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'Go2rtcStreamsService');

	private readonly entries = new Map<string, StreamEntry>();
	/**
	 * Per stream name, the tail of the PUT/DELETE calls sent for it. Every call for a name runs after the previous one
	 * settled, so the final go2rtc state of a name is always that of the last call queued. Never rejects.
	 */
	private readonly queues = new Map<string, Promise<void>>();

	private lastStatus: Go2rtcRelayStatus | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly go2rtc: Go2rtcService,
		private readonly cameras: CamerasService,
		private readonly secrets: Go2rtcSecretsRegistry,
	) {}

	onModuleInit(): void {
		this.lastStatus = this.go2rtc.getStatus();
		this.unsubscribe = this.go2rtc.subscribe((status) => this.onRelayStatus(status));

		if (this.lastStatus.state === 'running' && this.lastStatus.mode === 'external') {
			void this.sweepOrphans();
		}
	}

	async onModuleDestroy(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;

		const client = this.go2rtc.getClient();
		const entries = [...this.entries.values()];

		for (const entry of entries) {
			this.discard(entry, new Go2rtcUnavailableException('Camera relay is not running'));
		}

		if (!client || entries.length === 0) {
			return;
		}

		let timer: NodeJS.Timeout | undefined;

		try {
			await Promise.race([
				Promise.allSettled(entries.map((entry) => client.deleteStream(entry.name))),
				new Promise<void>((resolve) => {
					timer = setTimeout(resolve, DESTROY_DELETE_TIMEOUT_MS);
					timer.unref();
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	async acquire(device: DeviceEntity, provider: ICameraStreamProvider, profileId: string): Promise<Go2rtcStreamLease> {
		const client = this.go2rtc.getClient();

		if (!client) {
			throw new Go2rtcUnavailableException('Camera relay is not running');
		}

		const name = go2rtcStreamName(device.id, profileId);

		let entry = this.entries.get(name);

		if (entry) {
			entry.count++;

			if (entry.graceTimer) {
				clearTimeout(entry.graceTimer);
				entry.graceTimer = null;
			}
		} else {
			entry = this.createEntry(name, device, provider, profileId, client);
		}

		await entry.registration;

		return this.createLease(entry, client);
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	removeDevice(payload: { id: string }): void {
		for (const entry of [...this.entries.values()]) {
			if (entry.deviceId === payload.id) {
				void this.deleteEntry(entry, new CamerasNotFoundException('Camera not found'));
			}
		}
	}

	private createEntry(
		name: string,
		device: DeviceEntity,
		provider: ICameraStreamProvider,
		profileId: string,
		client: Go2rtcApiClient,
	): StreamEntry {
		let abort!: (error: Error) => void;

		const aborted = new Promise<never>((_, reject) => {
			abort = reject;
		});

		// The race below attaches a handler to `aborted`; without joiners the rejection must still not go unhandled.
		aborted.catch(() => undefined);

		const entry: StreamEntry = {
			name,
			deviceId: device.id,
			count: 1,
			registration: Promise.resolve(),
			abort,
			graceTimer: null,
			secretHandles: [],
			dropped: false,
		};

		this.entries.set(name, entry);

		const registration = Promise.race([this.register(entry, device, provider, profileId, client), aborted]);

		entry.registration = registration;

		registration.catch(() => {
			// Whoever rejected the registration (failure or drop) already discarded the entry; this only covers the
			// failure path where `register` itself threw.
			this.discard(entry);
		});

		return entry;
	}

	private async register(
		entry: StreamEntry,
		device: DeviceEntity,
		provider: ICameraStreamProvider,
		profileId: string,
		client: Go2rtcApiClient,
	): Promise<void> {
		const source = await this.cameras.resolveSource(device, provider, profileId);
		const src = toGo2rtcSource(source);

		this.throwIfDropped(entry);

		this.holdSecrets(entry, src, source.url);

		await this.enqueue(entry.name, async () => {
			// Dropped while it waited for an earlier call of the same name: nothing to register.
			this.throwIfDropped(entry);

			try {
				await client.putStream(entry.name, src);
			} catch (error) {
				this.logger.warn(`go2rtc stream register failed name=${entry.name} error=${errorName(error)}`);

				throw new CameraUpstreamException('Live stream could not be started');
			}

			if (entry.dropped) {
				// Dropped while the PUT was in flight: the stream may now exist on a relay that outlives the drop. The
				// DELETE belongs to this call, so a registration queued behind it cannot be hit by it.
				if (this.go2rtc.getClient() === client) {
					await this.safeDelete(client, entry.name);
				}

				throw new Go2rtcUnavailableException('Camera relay is not running');
			}
		});

		this.logger.log(`go2rtc stream registered name=${entry.name}`);
	}

	private throwIfDropped(entry: StreamEntry): void {
		if (entry.dropped) {
			throw new Go2rtcUnavailableException('Camera relay is not running');
		}
	}

	/** One registry handle per literal; a literal the registry cannot hold is skipped, never thrown. */
	private holdSecrets(entry: StreamEntry, ...urls: string[]): void {
		const literals = new Set<string>();

		for (const url of urls) {
			literals.add(url);

			try {
				literals.add(new URL(url).pathname);
			} catch {
				// Not a parsable url: the url itself is still registered.
			}
		}

		for (const literal of literals) {
			if (literal.length < MIN_SECRET_LENGTH) {
				continue;
			}

			try {
				entry.secretHandles.push(this.secrets.add(literal));
			} catch {
				// Never let the registry turn a viewer's request into a 500.
			}
		}
	}

	private createLease(entry: StreamEntry, client: Go2rtcApiClient): Go2rtcStreamLease {
		let released = false;

		return {
			streamName: entry.name,
			wsUrl: client.wsUrl(entry.name),
			authorization: client.authorization,
			release: () => {
				if (released) {
					return;
				}

				released = true;

				if (entry.dropped) {
					return;
				}

				entry.count = Math.max(0, entry.count - 1);

				if (entry.count === 0 && !entry.graceTimer) {
					entry.graceTimer = setTimeout(() => {
						entry.graceTimer = null;

						if (!entry.dropped && entry.count === 0) {
							void this.deleteEntry(entry);
						}
					}, GO2RTC_STREAM_IDLE_GRACE_MS);
					entry.graceTimer.unref();
				}
			},
		};
	}

	/** Drops the entry, deletes its stream (best effort) and only then forgets its secrets. */
	private async deleteEntry(entry: StreamEntry, error?: Error): Promise<void> {
		const client = this.go2rtc.getClient();

		if (entry.dropped) {
			return;
		}

		// The secrets stay registered until the DELETE is done.
		const handles = entry.secretHandles;

		entry.secretHandles = [];
		this.discard(entry, error);

		if (client) {
			await this.deleteTracked(client, entry.name);
		}

		for (const release of handles) {
			release();
		}
	}

	private deleteTracked(client: Go2rtcApiClient, name: string): Promise<void> {
		return this.enqueue(name, () => this.safeDelete(client, name));
	}

	/** Runs `call` once every earlier call queued for `name` has settled. The result is `call`'s own. */
	private enqueue<T>(name: string, call: () => Promise<T>): Promise<T> {
		const previous = this.queues.get(name) ?? Promise.resolve<void>(undefined);
		const run = previous.then<T>(call);
		const tail = run.then<void, void>(
			() => undefined,
			() => undefined,
		);

		this.queues.set(name, tail);

		void tail.then(() => {
			if (this.queues.get(name) === tail) {
				this.queues.delete(name);
			}
		});

		return run;
	}

	private async safeDelete(client: Go2rtcApiClient, name: string): Promise<void> {
		try {
			await client.deleteStream(name);

			this.logger.log(`go2rtc stream removed name=${name}`);
		} catch (error) {
			this.logger.warn(`go2rtc stream remove failed name=${name} error=${errorName(error)}`);
		}
	}

	/**
	 * Forgets the entry without a DELETE: stops its timer, rejects an in-flight registration, releases its secrets. A
	 * lease of a dropped entry becomes a no-op.
	 */
	private discard(entry: StreamEntry, error?: Error): void {
		if (entry.dropped) {
			return;
		}

		entry.dropped = true;

		if (entry.graceTimer) {
			clearTimeout(entry.graceTimer);
			entry.graceTimer = null;
		}

		if (this.entries.get(entry.name) === entry) {
			this.entries.delete(entry.name);
		}

		entry.abort(error ?? new Go2rtcUnavailableException('Camera relay is not running'));

		for (const release of entry.secretHandles) {
			release();
		}

		entry.secretHandles = [];
	}

	private onRelayStatus(status: Go2rtcRelayStatus): void {
		const previous = this.lastStatus;

		this.lastStatus = status;

		const lost = status.state !== 'running' || previous === null || status.generation !== previous.generation;

		if (lost && this.entries.size > 0) {
			this.dropAll(previous, status);
		}

		const cameUp = status.state === 'running' && status.mode === 'external';
		const wasUp = previous !== null && previous.state === 'running' && previous.generation === status.generation;

		if (cameUp && !wasUp) {
			void this.sweepOrphans();
		}
	}

	/**
	 * The relay lost its streams (managed: the process is gone and its config file with it) or may still hold them
	 * (external). Managed entries are dropped without a DELETE; external ones get a best-effort DELETE while the same
	 * external relay is reachable.
	 */
	private dropAll(previous: Go2rtcRelayStatus | null, status: Go2rtcRelayStatus): void {
		const mode: Go2rtcMode | null = previous?.mode ?? null;
		const client = mode === 'external' && status.mode === 'external' ? this.go2rtc.getClient() : null;

		for (const entry of [...this.entries.values()]) {
			if (client) {
				void this.deleteEntry(entry);
			} else {
				this.discard(entry);
			}
		}
	}

	/** Deletes every `smart-panel_*` stream of an external relay that this table does not know (previous backend run). */
	private async sweepOrphans(): Promise<void> {
		const client = this.go2rtc.getClient();

		if (!client) {
			return;
		}

		try {
			const names = await client.listStreamNames();

			for (const name of names) {
				// Re-checked per name: a viewer may have registered it while the list was in flight.
				if (
					name.startsWith(GO2RTC_STREAM_NAME_PREFIX) &&
					!this.entries.has(name) &&
					this.go2rtc.getClient() === client
				) {
					await this.deleteTracked(client, name);
				}
			}
		} catch (error) {
			this.logger.warn(`go2rtc orphan sweep failed error=${errorName(error)}`);
		}
	}
}
