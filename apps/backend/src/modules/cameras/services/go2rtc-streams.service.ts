import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_MODULE_NAME, GO2RTC_STREAM_IDLE_GRACE_MS } from '../cameras.constants';
import {
	CameraUpstreamException,
	CamerasNotFoundException,
	Go2rtcApiError,
	Go2rtcUnavailableException,
	errorName,
} from '../cameras.exceptions';
import { ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CamerasService } from './cameras.service';
import { Go2rtcApiClient } from './go2rtc-api.client';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';
import { go2rtcStreamName, go2rtcStreamPrefix, toGo2rtcSource } from './go2rtc-source';
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
	/** The relay this entry was registered on: its DELETE, and the secrets it retains, belong to that relay. */
	readonly relay: Relay;
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
 * A relay a stream was PUT to and is DELETEd from. `key` identifies it: the managed process by its relay generation (a
 * new spawn is a new relay), an external instance by its normalized base url (it outlives this backend). `external`
 * relays outlive our process.
 */
interface Relay {
	readonly client: Go2rtcApiClient;
	readonly external: boolean;
	readonly key: string;
	/** The relay generation of a managed process (`null` for an external instance). */
	readonly generation: number | null;
}

/** Secret handles of a stream whose DELETE failed or is uncertain: it may still exist, so its source stays redactable. */
interface RetainedSecrets {
	handles: Array<() => void>;
	relay: Relay;
}

/**
 * Registers one go2rtc stream per camera profile while someone watches it. Registration is lazy (first viewer), shared
 * (one `resolveSource` and one `PUT` for concurrent viewers) and reference counted: the stream is deleted
 * `GO2RTC_STREAM_IDLE_GRACE_MS` after the last viewer leaves, so a page reload reuses it.
 *
 * The source url is a secret: it lives in the go2rtc process and in the secrets registry, never in a log line, an
 * error message or a lease. A stream that could not be deleted, or whose PUT failed without an HTTP answer (it may have
 * been created), keeps its secrets registered (`retained`, by relay and name) until a later DELETE of that name on that
 * same relay succeeds, the managed process is confirmed gone (`Go2rtcService.onManagedRunEnded`: exited and its output
 * drained, which the relay status does not prove: a child whose stop could not be confirmed may still print a source),
 * or the module is destroyed. The entries of a managed relay that stopped being available are dropped from the table at
 * once (nothing is registered on it any more), but their secrets are retained under that process until it has ended.
 *
 * An external go2rtc outlives the relay state: it persists registered streams to its own config file and stays
 * reachable after this backend stops using it. Every entry therefore remembers the relay it was registered on, so its
 * stream can still be DELETEd when the relay stops, is switched to another mode or is disabled (all of which clear
 * `Go2rtcService.getClient()` first).
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

	/** Handles of streams whose DELETE failed or is uncertain, by relay key and stream name. */
	private readonly retained = new Map<string, RetainedSecrets>();
	/** Entry deletions in flight, so that module destroy can wait (bounded) for them. */
	private readonly settling = new Set<Promise<unknown>>();

	/** The newest managed relay generation whose process was confirmed gone; secrets of older ones need no retention. */
	private endedManagedGeneration = 0;

	private lastStatus: Go2rtcRelayStatus | null = null;
	private unsubscribe: (() => void) | null = null;
	private unsubscribeRunEnded: (() => void) | null = null;

	constructor(
		private readonly go2rtc: Go2rtcService,
		private readonly cameras: CamerasService,
		private readonly secrets: Go2rtcSecretsRegistry,
	) {}

	onModuleInit(): void {
		this.lastStatus = this.go2rtc.getStatus();
		this.unsubscribe = this.go2rtc.subscribe((status) => this.onRelayStatus(status));
		this.unsubscribeRunEnded = this.go2rtc.onManagedRunEnded((generation) => this.onManagedRunEnded(generation));

		if (this.lastStatus.state === 'running' && this.lastStatus.mode === 'external') {
			void this.sweepOrphans();
		}
	}

	async onModuleDestroy(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.unsubscribeRunEnded?.();
		this.unsubscribeRunEnded = null;

		const relay = this.currentRelay();
		const entries = [...this.entries.values()];
		const held: Array<() => void> = [];

		// The secrets stay registered until the DELETEs below are done.
		for (const entry of entries) {
			held.push(...entry.secretHandles);
			entry.secretHandles = [];
			this.discard(entry, new Go2rtcUnavailableException('Camera relay is not running'));
		}

		let timer: NodeJS.Timeout | undefined;

		try {
			// Deletions a relay status change already started (the relay may have stopped first) are awaited too.
			const pending: Array<Promise<unknown>> = [...this.settling];

			if (relay) {
				pending.push(...entries.map((entry) => this.deleteTracked(relay, entry.name)));
			}

			if (pending.length > 0) {
				await Promise.race([
					Promise.allSettled(pending),
					new Promise<void>((resolve) => {
						timer = setTimeout(resolve, DESTROY_DELETE_TIMEOUT_MS);
						timer.unref();
					}),
				]);
			}
		} finally {
			if (timer) clearTimeout(timer);

			// Nothing will register or delete after this, so whatever is still held is released.
			for (const release of held) {
				release();
			}

			this.releaseRetained(null);
		}
	}

	async acquire(device: DeviceEntity, provider: ICameraStreamProvider, profileId: string): Promise<Go2rtcStreamLease> {
		const relay = this.currentRelay();

		if (!relay) {
			throw new Go2rtcUnavailableException('Camera relay is not running');
		}

		const name = go2rtcStreamName(this.go2rtc.getInstallationId(), device.id, profileId);

		let entry = this.entries.get(name);

		if (entry) {
			entry.count++;

			if (entry.graceTimer) {
				clearTimeout(entry.graceTimer);
				entry.graceTimer = null;
			}
		} else {
			entry = this.createEntry(name, device, provider, profileId, relay);
		}

		await entry.registration;

		return this.createLease(entry, relay.client);
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	removeDevice(payload: { id: string }): void {
		for (const entry of [...this.entries.values()]) {
			if (entry.deviceId === payload.id) {
				void this.deleteEntry(entry, this.currentRelay(), new CamerasNotFoundException('Camera not found'));
			}
		}
	}

	private createEntry(
		name: string,
		device: DeviceEntity,
		provider: ICameraStreamProvider,
		profileId: string,
		relay: Relay,
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
			relay,
			count: 1,
			registration: Promise.resolve(),
			abort,
			graceTimer: null,
			secretHandles: [],
			dropped: false,
		};

		this.entries.set(name, entry);

		const registration = Promise.race([this.register(entry, device, provider, profileId), aborted]);

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
	): Promise<void> {
		const { relay } = entry;
		const source = await this.cameras.resolveSource(device, provider, profileId);
		const src = toGo2rtcSource(source);

		this.throwIfDropped(entry);

		this.holdSecrets(entry, src, source.url);

		await this.enqueue(entry.name, async () => {
			// Dropped while it waited for an earlier call of the same name: nothing to register.
			this.throwIfDropped(entry);

			try {
				await relay.client.putStream(entry.name, src);
			} catch (error) {
				this.logger.warn(`go2rtc stream register failed name=${entry.name} error=${errorName(error)}`);

				if (!(error instanceof Go2rtcApiError) || error.status === null) {
					// No answer (timeout, reset): go2rtc may have created the stream anyway.
					this.compensateUncertainPut(entry);
				}

				throw new CameraUpstreamException('Live stream could not be started');
			}

			if (entry.dropped) {
				// Dropped while the PUT was in flight: the stream may now exist on a relay that outlives the drop. The
				// DELETE belongs to this call, so a registration queued behind it cannot be hit by it.
				if (this.go2rtc.getClient() === relay.client) {
					await this.safeDelete(relay, entry.name);
				}

				throw new Go2rtcUnavailableException('Camera relay is not running');
			}
		});

		this.logger.log(`go2rtc stream registered name=${entry.name}`);
	}

	/**
	 * A PUT that ended without an HTTP status may have created the stream. A DELETE is queued behind the failed call
	 * (the same name queue, so a later registration cannot be hit by it), and the secrets stay retained, and so
	 * redactable, unless that DELETE is confirmed. An entry that was dropped meanwhile already has its DELETE queued.
	 */
	private compensateUncertainPut(entry: StreamEntry): void {
		if (entry.dropped) {
			return;
		}

		const handles = entry.secretHandles;

		entry.secretHandles = [];
		this.retain(entry.name, handles, entry.relay);
		void this.track(this.deleteTracked(entry.relay, entry.name));
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
							void this.deleteEntry(entry, this.currentRelay());
						}
					}, GO2RTC_STREAM_IDLE_GRACE_MS);
					entry.graceTimer.unref();
				}
			},
		};
	}

	private currentRelay(): Relay | null {
		const client = this.go2rtc.getClient();

		if (!client) {
			return null;
		}

		const status = this.go2rtc.getStatus();

		return status.mode === 'external'
			? { client, external: true, key: `external:${client.baseUrl}`, generation: null }
			: { client, external: false, key: `managed:${status.generation}`, generation: status.generation };
	}

	/** Drops the entry, deletes its stream (best effort) and only then forgets its secrets, or retains them. */
	private deleteEntry(entry: StreamEntry, relay: Relay | null, error?: Error): Promise<void> {
		return this.track(this.dropAndDelete(entry, relay, error));
	}

	/** Remembers a deletion in flight so that module destroy can wait (bounded) for it. */
	private track<T>(run: Promise<T>): Promise<T> {
		this.settling.add(run);
		void run.finally(() => this.settling.delete(run));

		return run;
	}

	private async dropAndDelete(entry: StreamEntry, relay: Relay | null, error?: Error): Promise<void> {
		if (entry.dropped) {
			return;
		}

		// The secrets stay registered until the DELETE is done.
		const handles = entry.secretHandles;

		entry.secretHandles = [];
		this.discard(entry, error);

		if (!relay) {
			if (entry.relay.external) {
				for (const release of handles) {
					release();
				}
			} else {
				// No relay to DELETE from, but a managed child that has not been confirmed gone may still print the source.
				this.retain(entry.name, handles, entry.relay);
			}

			return;
		}

		if (await this.deleteTracked(relay, entry.name)) {
			for (const release of handles) {
				release();
			}
		} else {
			this.retain(entry.name, handles, relay);
		}
	}

	private retainedKey(relay: Relay, name: string): string {
		return JSON.stringify([relay.key, name]);
	}

	/**
	 * Keeps the secrets of a stream that may still exist, unless the relay holding it is confirmed gone: a managed process
	 * that has ended took its streams (and config file) with it. A merely unavailable one has not ended.
	 */
	private retain(name: string, handles: Array<() => void>, relay: Relay): void {
		if (handles.length === 0) {
			return;
		}

		if (relay.generation !== null && relay.generation <= this.endedManagedGeneration) {
			for (const release of handles) {
				release();
			}

			return;
		}

		const key = this.retainedKey(relay, name);
		const held = this.retained.get(key);

		if (held) {
			held.handles.push(...handles);
		} else {
			this.retained.set(key, { handles, relay });
		}
	}

	/** Releases what was retained for one relay (by its key), or everything (`null`). */
	private releaseRetained(relayKey: string | null): void {
		for (const [key, held] of [...this.retained]) {
			if (relayKey !== null && held.relay.key !== relayKey) {
				continue;
			}

			this.retained.delete(key);

			for (const release of held.handles) {
				release();
			}
		}
	}

	/** Resolves `true` when the stream is gone from the relay. */
	private deleteTracked(relay: Relay, name: string): Promise<boolean> {
		return this.enqueue(name, () => this.safeDelete(relay, name));
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

	/**
	 * Never throws. A successful DELETE on `relay` also releases the secrets retained for an earlier failed one on that
	 * same relay; the retention of another relay is untouched.
	 */
	private async safeDelete(relay: Relay, name: string): Promise<boolean> {
		try {
			await relay.client.deleteStream(name);

			this.logger.log(`go2rtc stream removed name=${name}`);
		} catch (error) {
			this.logger.warn(`go2rtc stream remove failed name=${name} error=${errorName(error)}`);

			return false;
		}

		const key = this.retainedKey(relay, name);
		const held = this.retained.get(key);

		if (held) {
			this.retained.delete(key);

			for (const release of held.handles) {
				release();
			}
		}

		return true;
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

		if (lost) {
			if (this.entries.size > 0) {
				this.dropAll();
			}
		}

		const cameUp = status.state === 'running' && status.mode === 'external';
		const wasUp = previous !== null && previous.state === 'running' && previous.generation === status.generation;

		if (cameUp && !wasUp) {
			void this.sweepOrphans();
		}
	}

	/**
	 * The relay is no longer available. Managed: nothing can be registered on it or DELETEd from it any more, so its
	 * entries are dropped without a DELETE; the process itself may still be alive, so their secrets move to the
	 * retention of that process until `onManagedRunEnded`. External (persists its streams to its own config file): a
	 * best-effort DELETE through the client they were registered on.
	 */
	private dropAll(): void {
		for (const entry of [...this.entries.values()]) {
			if (entry.relay.external) {
				void this.deleteEntry(entry, entry.relay);
			} else {
				const handles = entry.secretHandles;

				entry.secretHandles = [];
				this.discard(entry);
				this.retain(entry.name, handles, entry.relay);
			}
		}
	}

	/** The managed process of `generation` is confirmed gone: it can print nothing more, so what it retained is released. */
	private onManagedRunEnded(generation: number): void {
		this.endedManagedGeneration = Math.max(this.endedManagedGeneration, generation);
		this.releaseRetained(`managed:${generation}`);
	}

	/** Deletes every stream of this installation on an external relay that this table does not know (previous run). */
	private async sweepOrphans(): Promise<void> {
		const relay = this.currentRelay();

		if (!relay) {
			return;
		}

		const prefix = go2rtcStreamPrefix(this.go2rtc.getInstallationId());

		try {
			const names = await relay.client.listStreamNames();

			for (const name of names) {
				// Re-checked per name: a viewer may have registered it while the list was in flight.
				if (name.startsWith(prefix) && !this.entries.has(name) && this.go2rtc.getClient() === relay.client) {
					await this.deleteTracked(relay, name);
				}
			}
		} catch (error) {
			this.logger.warn(`go2rtc orphan sweep failed error=${errorName(error)}`);
		}
	}
}
