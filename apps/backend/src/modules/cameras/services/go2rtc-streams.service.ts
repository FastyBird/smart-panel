import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_MODULE_NAME, GO2RTC_STREAM_IDLE_GRACE_MS } from '../cameras.constants';
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

/** The relay a DELETE goes to, and whether it is an external one (which outlives this backend and our process). */
interface DeleteTarget {
	readonly client: Go2rtcApiClient;
	readonly external: boolean;
}

/** Secret handles of a stream whose DELETE failed: it may still exist, so its source stays redactable. */
interface RetainedSecrets {
	handles: Array<() => void>;
	external: boolean;
}

/**
 * Registers one go2rtc stream per camera profile while someone watches it. Registration is lazy (first viewer), shared
 * (one `resolveSource` and one `PUT` for concurrent viewers) and reference counted: the stream is deleted
 * `GO2RTC_STREAM_IDLE_GRACE_MS` after the last viewer leaves, so a page reload reuses it.
 *
 * The source url is a secret: it lives in the go2rtc process and in the secrets registry, never in a log line, an
 * error message or a lease. A stream that could not be deleted keeps its secrets registered (`retained`) until a later
 * DELETE of that name succeeds, the managed process (and its config file) is gone, or the module is destroyed.
 *
 * An external go2rtc outlives the relay state: it persists registered streams to its own config file and stays
 * reachable after this backend stops using it. The client last seen while the relay was external and running is
 * therefore remembered, so the streams can still be DELETEd when the relay stops, is switched to another mode or is
 * disabled (all of which clear `Go2rtcService.getClient()` first).
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

	/** Handles of streams whose DELETE failed, by stream name. */
	private readonly retained = new Map<string, RetainedSecrets>();
	/** Entry deletions in flight, so that module destroy can wait (bounded) for them. */
	private readonly settling = new Set<Promise<void>>();

	/** The client of the external relay, remembered while it was running. `null` for any other state or mode. */
	private externalClient: Go2rtcApiClient | null = null;
	private lastStatus: Go2rtcRelayStatus | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly go2rtc: Go2rtcService,
		private readonly cameras: CamerasService,
		private readonly secrets: Go2rtcSecretsRegistry,
	) {}

	onModuleInit(): void {
		this.lastStatus = this.go2rtc.getStatus();
		this.rememberExternalClient(this.lastStatus);
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

			if (client) {
				pending.push(...entries.map((entry) => this.deleteTracked(client, entry.name)));
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
		const client = this.go2rtc.getClient();

		if (!client) {
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
			entry = this.createEntry(name, device, provider, profileId, client);
		}

		await entry.registration;

		return this.createLease(entry, client);
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	removeDevice(payload: { id: string }): void {
		for (const entry of [...this.entries.values()]) {
			if (entry.deviceId === payload.id) {
				void this.deleteEntry(entry, this.currentTarget(), new CamerasNotFoundException('Camera not found'));
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
							void this.deleteEntry(entry, this.currentTarget());
						}
					}, GO2RTC_STREAM_IDLE_GRACE_MS);
					entry.graceTimer.unref();
				}
			},
		};
	}

	private currentTarget(): DeleteTarget | null {
		const client = this.go2rtc.getClient();

		return client ? { client, external: this.go2rtc.getStatus().mode === 'external' } : null;
	}

	/** Drops the entry, deletes its stream (best effort) and only then forgets its secrets, or retains them. */
	private deleteEntry(entry: StreamEntry, target: DeleteTarget | null, error?: Error): Promise<void> {
		const run = this.dropAndDelete(entry, target, error);

		this.settling.add(run);
		void run.finally(() => this.settling.delete(run));

		return run;
	}

	private async dropAndDelete(entry: StreamEntry, target: DeleteTarget | null, error?: Error): Promise<void> {
		if (entry.dropped) {
			return;
		}

		// The secrets stay registered until the DELETE is done.
		const handles = entry.secretHandles;

		entry.secretHandles = [];
		this.discard(entry, error);

		if (!target) {
			for (const release of handles) {
				release();
			}

			return;
		}

		if (await this.deleteTracked(target.client, entry.name)) {
			for (const release of handles) {
				release();
			}
		} else {
			this.retain(entry.name, handles, target);
		}
	}

	/** Keeps the secrets of a stream that may still exist, unless the relay holding it is already gone. */
	private retain(name: string, handles: Array<() => void>, target: DeleteTarget): void {
		if (handles.length === 0) {
			return;
		}

		if (!target.external && this.go2rtc.getClient() !== target.client) {
			// A managed process that is gone took its streams (and config file) with it.
			for (const release of handles) {
				release();
			}

			return;
		}

		const held = this.retained.get(name);

		if (held) {
			held.handles.push(...handles);
			held.external = held.external || target.external;
		} else {
			this.retained.set(name, { handles, external: target.external });
		}
	}

	/** Releases the retained secrets of the given kind (`true` external, `false` managed) or all of them (`null`). */
	private releaseRetained(external: boolean | null): void {
		for (const [name, held] of [...this.retained]) {
			if (external !== null && held.external !== external) {
				continue;
			}

			this.retained.delete(name);

			for (const release of held.handles) {
				release();
			}
		}
	}

	/** Resolves `true` when the stream is gone from the relay. */
	private deleteTracked(client: Go2rtcApiClient, name: string): Promise<boolean> {
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

	/** Never throws. A successful DELETE also releases the secrets retained for an earlier failed one. */
	private async safeDelete(client: Go2rtcApiClient, name: string): Promise<boolean> {
		try {
			await client.deleteStream(name);

			this.logger.log(`go2rtc stream removed name=${name}`);
		} catch (error) {
			this.logger.warn(`go2rtc stream remove failed name=${name} error=${errorName(error)}`);

			return false;
		}

		const held = this.retained.get(name);

		if (held) {
			this.retained.delete(name);

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

	private rememberExternalClient(status: Go2rtcRelayStatus): void {
		this.externalClient = status.state === 'running' && status.mode === 'external' ? this.go2rtc.getClient() : null;
	}

	private onRelayStatus(status: Go2rtcRelayStatus): void {
		const previous = this.lastStatus;
		// What `getClient()` returned while the relay was external and running: it is already `null` for the status
		// that ends that (`stop`, a mode change and a disable clear the service's client before they publish).
		const external = this.externalClient;

		this.lastStatus = status;
		this.rememberExternalClient(status);

		const lost = status.state !== 'running' || previous === null || status.generation !== previous.generation;

		if (lost) {
			if (previous?.mode === 'managed') {
				// The process is gone, and the config file that persisted its streams with it.
				this.releaseRetained(false);
			}

			if (this.entries.size > 0) {
				this.dropAll(previous?.mode === 'external' ? external : null);
			}
		}

		const cameUp = status.state === 'running' && status.mode === 'external';
		const wasUp = previous !== null && previous.state === 'running' && previous.generation === status.generation;

		if (cameUp && !wasUp) {
			void this.sweepOrphans();
		}
	}

	/**
	 * The relay lost its streams (managed: the process is gone and its config file with it) or may still hold them
	 * (external, which persists them to its own config file). Managed entries are dropped without a DELETE; external
	 * ones get a best-effort DELETE through the remembered client.
	 */
	private dropAll(externalClient: Go2rtcApiClient | null): void {
		for (const entry of [...this.entries.values()]) {
			if (externalClient) {
				void this.deleteEntry(entry, { client: externalClient, external: true });
			} else {
				this.discard(entry);
			}
		}
	}

	/** Deletes every stream of this installation on an external relay that this table does not know (previous run). */
	private async sweepOrphans(): Promise<void> {
		const client = this.go2rtc.getClient();

		if (!client) {
			return;
		}

		const prefix = go2rtcStreamPrefix(this.go2rtc.getInstallationId());

		try {
			const names = await client.listStreamNames();

			for (const name of names) {
				// Re-checked per name: a viewer may have registered it while the list was in flight.
				if (name.startsWith(prefix) && !this.entries.has(name) && this.go2rtc.getClient() === client) {
					await this.deleteTracked(client, name);
				}
			}
		} catch (error) {
			this.logger.warn(`go2rtc orphan sweep failed error=${errorName(error)}`);
		}
	}
}
