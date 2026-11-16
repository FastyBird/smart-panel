import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NotificationsService } from '../../../modules/notifications/services/notifications.service';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_FAILURE_LOG_INTERVAL_MS,
	PROTECT_MAX_PENDING_FRAMES,
} from '../devices-unifi-protect.constants';
import { ProtectChannelPropertyEntity, ProtectDeviceEntity } from '../entities/devices-unifi-protect.entity';
import { ProtectMappedDevice, evaluateProtectMapping, toProtectDeviceName } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { PROTECT_MODEL_KEYS, ProtectMappingScalar, ProtectResolvedMappings } from '../mappings/mapping.types';

import { ProtectConsoleIdentity } from './protect-connector.service';
import { ProtectEventEffect, ProtectEventTracker, ProtectTargetWrite } from './protect-event-tracker';
import {
	ProtectFrame,
	diffMappedValues,
	mappedConnectionState,
	mergeProtectItem,
	syncableMappingNames,
} from './protect-frame-merge';
import { ProtectInventoryEntry } from './protect-inventory.service';

export interface ProtectSnapshot {
	/** True when all three console lists were read. */
	complete: boolean;
	entries: ProtectInventoryEntry[];
}

export interface ProtectSyncCounters {
	framesIgnored: number;
	writesFailed: number;
	ignoredEventCount: number;
	ignoredEventTypes: ReadonlyMap<string, number>;
}

interface IndexedProperty {
	id: string;
	channelId: string;
	channelIdentifier: string;
	mappingName: string;
}

interface IndexedDevice {
	panelId: string;
	protectDeviceId: string;
	modelKey: string | null;
	name: string;
	properties: Map<string, IndexedProperty>;
}

type RetryEntry =
	| { kind: 'write'; key: string; propertyId: string; value: string | boolean; attempts: number; dueAt: number }
	| {
			kind: 'ring';
			key: string;
			deviceId: string;
			channelId: string;
			propertyId: string;
			eventId: string;
			startedAt: number | null;
			attempts: number;
			dueAt: number;
	  };

type SyncMode = 'snapshot' | 'frame';

const RING_FAILURE_TEXT = 'UniFi Protect ring could not be published';
/** The first retry lies outside the core's 5 s duplicate window, so a retried ring is never swallowed as a duplicate. */
const RETRY_DELAYS_MS: readonly number[] = [6000, 15000, 45000];
const RETRY_MIN_RESCHEDULE_MS = 1000;
const MAX_RETRY_ENTRIES = 32;
const MAX_IGNORED_EVENT_NAMES = 32;
const MAX_DROPPED_EVENT_IDS = 1024;
const INVALID_EVENT_NAME = 'invalid';
const DOORBELL_CHANNEL = 'doorbell';
const DOORBELL_MAPPING = 'doorbell_event';
const FAILURE_TEXT = 'UniFi Protect property update failed';
const MAX_CACHED_DEVICES = 4096;
const TAMPER_MAPPINGS: ReadonlySet<string> = new Set(['contact_tampered', 'sensor_motion_tampered']);
const STALE_DETECTIONS: ReadonlySet<string> = new Set([
	'camera_motion_detected',
	'object_detected',
	'smoke_alarm_sound_detected',
	'co_alarm_sound_detected',
	'sound_detected',
	'sensor_smoke_detected',
	'leak_detected',
]);

const propertyKey = (channelIdentifier: string, mappingName: string): string =>
	`${channelIdentifier}\u0000${mappingName}`;

const cacheKey = (modelKey: string, id: string): string => `${modelKey}\u0000${id}`;

const removalKey = (protectDeviceId: string): string => `device_removed:${protectDeviceId}`;

@Injectable()
export class ProtectSynchronizerService {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectSynchronizerService');
	private readonly tracker = new ProtectEventTracker();

	private cache = new Map<string, Readonly<Record<string, unknown>>>();
	private index = new Map<string, IndexedDevice>();
	private indexNvrId: string | null = null;
	private indexDirty = true;
	private indexGeneration = 0;
	private indexRefresh: Promise<void> | null = null;

	/** Last successfully persisted value per property id. */
	private readonly lastWritten = new Map<string, ProtectMappingScalar>();
	/** Devices whose removal was handled (state write and notification attempted) since the last reset. */
	private readonly removed = new Set<string>();
	/** Removed devices whose `disconnected` write has not succeeded yet, and whose notification has not been sent. */
	private readonly removalNotifyPending = new Set<string>();
	/** Last Protect name successfully propagated (or seen before any change) per device id; a failed rename retries. */
	private readonly propagatedNames = new Map<string, string>();
	/** Devices whose `device_removed` issue was already settled since the last reset (bounded by adopted devices). */
	private readonly removalChecked = new Set<string>();
	/** Failed event effects per Protect device id, oldest first. */
	private readonly retries = new Map<string, RetryEntry[]>();
	/** Per device: property keys whose last successful write came from an event effect (start/end write or retry). */
	private readonly eventOwned = new Map<string, Set<string>>();
	private eventTimer: NodeJS.Timeout | null = null;
	private retryTimer: NodeJS.Timeout | null = null;
	/** Ids of events dropped for devices Smart Panel has not adopted (LRU), so their updates are not counted. */
	private readonly droppedEventIds = new Map<string, true>();
	private eventIdentity: ProtectConsoleIdentity | null = null;

	private chain: Promise<void> = Promise.resolve();
	private pending = 0;
	private snapshotSequence = 0;
	private generation = 0;
	/** Generation of the task now running (tasks are serial); a mismatch with `generation` means a reset happened. */
	private taskGeneration = 0;

	private syncable: { mappings: ProtectResolvedMappings; names: ReadonlySet<string> } | null = null;
	private sources: { mappings: ProtectResolvedMappings; names: ReadonlyMap<string, ReadonlySet<string>> } | null = null;
	private lastFailureLogAt: number | null = null;
	private suppressedFailures = 0;

	private framesIgnored = 0;
	private writesFailed = 0;
	private ignoredEventCount = 0;
	private readonly ignoredEventTypes = new Map<string, number>();

	constructor(
		private readonly mappingLoader: ProtectMappingLoaderService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly connectivity: DeviceConnectivityService,
		private readonly propertyValue: PropertyValueService,
		private readonly notifications: NotificationsService,
		private readonly occurrences: ChannelInputOccurrencesService,
	) {}

	/** Serial; resolves when applied. Replaces the cache, diffs against stored values, reconciles removals. */
	applySnapshot(identity: ProtectConsoleIdentity, snapshot: ProtectSnapshot): Promise<void> {
		// Bumped when the snapshot is enqueued: a poll that read the console before this call is older than it.
		this.snapshotSequence++;

		return this.run(() => this.applySnapshotNow(identity, snapshot));
	}

	/** Enqueued on the serial queue; never throws. Returns false when the queue was full (caller re-primes). */
	enqueueFrame(identity: ProtectConsoleIdentity, frame: ProtectFrame): boolean {
		if (this.pending >= PROTECT_MAX_PENDING_FRAMES) {
			return false;
		}

		void this.run(() => this.applyFrameNow(identity, frame));

		return true;
	}

	/** Number of snapshots enqueued so far; a reader that captured an older value read stale data. */
	getSnapshotSequence(): number {
		return this.snapshotSequence;
	}

	/** Counts a frame the parser rejected. */
	countIgnoredFrame(): void {
		this.framesIgnored++;
	}

	/** Resolves when the queue is empty. */
	async idle(): Promise<void> {
		let tail: Promise<void>;

		do {
			tail = this.chain;
			await tail;
		} while (tail !== this.chain);
	}

	getCounters(): ProtectSyncCounters {
		return {
			framesIgnored: this.framesIgnored,
			writesFailed: this.writesFailed,
			ignoredEventCount: this.ignoredEventCount,
			ignoredEventTypes: new Map(this.ignoredEventTypes),
		};
	}

	/** Plugin stop: drops queue, caches and tracker; writes nothing. */
	reset(): void {
		this.generation++;
		this.pending = 0;
		this.cache = new Map();
		this.index = new Map();
		this.indexNvrId = null;
		this.indexDirty = true;
		this.indexGeneration++;
		this.lastWritten.clear();
		this.removed.clear();
		this.removalNotifyPending.clear();
		this.propagatedNames.clear();
		this.removalChecked.clear();
		this.tracker.clear();
		this.retries.clear();
		this.eventOwned.clear();
		this.droppedEventIds.clear();
		this.eventIdentity = null;
		this.clearTimer('eventTimer');
		this.clearTimer('retryTimer');
		this.lastFailureLogAt = null;
		this.suppressedFailures = 0;
		this.framesIgnored = 0;
		this.writesFailed = 0;
		this.ignoredEventCount = 0;
		this.ignoredEventTypes.clear();
	}

	@OnEvent(EventType.DEVICE_CREATED)
	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.CHANNEL_CREATED)
	@OnEvent(EventType.CHANNEL_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	invalidateIndex(payload?: { type?: string }): void {
		// An undefined type is not proof of another plugin: spread copies lose the entity's `type` getter.
		if (payload?.type !== undefined && payload.type !== DEVICES_UNIFI_PROTECT_TYPE) {
			return;
		}

		this.markIndexDirty();
	}

	/** The core emits `{ ...entity }` copies on delete, so `type` is gone: every delete refreshes the index. */
	@OnEvent(EventType.CHANNEL_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	invalidateIndexOnDelete(): void {
		this.markIndexDirty();
	}

	private markIndexDirty(): void {
		this.indexDirty = true;
		this.indexGeneration++;
	}

	/** Keeps the written-value baseline in step with values other writers (adoption) persist. */
	@OnEvent(EventType.CHANNEL_PROPERTY_VALUE_SET)
	recordPersistedValue(property: ProtectChannelPropertyEntity): void {
		if (property?.type !== DEVICES_UNIFI_PROTECT_TYPE || !this.lastWritten.has(property.id)) {
			return;
		}

		const value = property.value?.value;

		if (value !== undefined) {
			this.lastWritten.set(property.id, value);
		}
	}

	private clearTimer(name: 'eventTimer' | 'retryTimer'): void {
		if (this[name] !== null) {
			clearTimeout(this[name]);
			this[name] = null;
		}
	}

	private aborted(): boolean {
		return this.generation !== this.taskGeneration;
	}

	private run(task: () => Promise<void>): Promise<void> {
		const generation = this.generation;

		this.pending++;

		const next = this.chain.then(async () => {
			try {
				if (generation === this.generation) {
					this.taskGeneration = generation;
					await task();
				}
			} catch {
				this.logger.warn('UniFi Protect synchronization step failed');
			} finally {
				if (generation === this.generation) {
					this.pending = Math.max(0, this.pending - 1);
				}
			}
		});

		this.chain = next;

		return next;
	}

	private async applySnapshotNow(identity: ProtectConsoleIdentity, snapshot: ProtectSnapshot): Promise<void> {
		const previous = this.cache;
		const next = new Map<string, Readonly<Record<string, unknown>>>();

		await this.ensureIndex(identity);

		if (this.aborted()) {
			return;
		}

		// Removal reconciliation uses the snapshot's full membership; the bounded cache only limits memory.
		const members = new Set<string>();

		for (const entry of snapshot.entries) {
			members.add(cacheKey(entry.modelKey, entry.id));
		}

		const isAdopted = (entry: ProtectInventoryEntry): boolean => {
			const device = this.index.get(entry.id);

			return device !== undefined && (device.modelKey === null || device.modelKey === entry.modelKey);
		};

		// Adopted devices are cached first so the cap can never evict a device the console lists.
		for (const adoptedFirst of [true, false]) {
			for (const entry of snapshot.entries) {
				const key = cacheKey(entry.modelKey, entry.id);

				if (isAdopted(entry) === adoptedFirst && !next.has(key) && (adoptedFirst || next.size < MAX_CACHED_DEVICES)) {
					next.set(key, mergeProtectItem({}, entry.raw));
				}
			}
		}

		this.cache = next;

		for (const device of [...this.index.values()]) {
			if (this.aborted()) {
				return;
			}

			// A device without a stored model key is looked up under every model key.
			const modelKey = ((device.modelKey === null ? PROTECT_MODEL_KEYS : [device.modelKey]) as readonly string[]).find(
				(candidate) => members.has(cacheKey(candidate, device.protectDeviceId)),
			);
			const key = modelKey === undefined ? null : cacheKey(modelKey, device.protectDeviceId);

			if (modelKey !== undefined && key !== null) {
				await this.syncDevice(identity, device, modelKey, next.get(key), previous.get(key) ?? null, 'snapshot', null);
			} else if (snapshot.complete) {
				await this.markRemoved(device);
			}
		}
	}

	private async applyFrameNow(identity: ProtectConsoleIdentity, frame: ProtectFrame): Promise<void> {
		if (frame.modelKey === 'event') {
			await this.applyEventFrame(identity, frame);

			return;
		}

		if (!(PROTECT_MODEL_KEYS as readonly string[]).includes(frame.modelKey)) {
			this.framesIgnored++;

			return;
		}

		const key = cacheKey(frame.modelKey, frame.id);
		const cached = this.cache.get(key) ?? null;

		if (frame.action === 'update' && cached === null) {
			this.framesIgnored++;

			return;
		}

		await this.ensureIndex(identity);

		if (this.aborted()) {
			return;
		}

		const device = this.adopted(frame);

		if (frame.action === 'add' && cached === null && this.cache.size >= MAX_CACHED_DEVICES) {
			// Adopted devices outrank unadopted ones at the cap, as in a snapshot; the excess is bounded by the index.
			if (device === undefined) {
				this.framesIgnored++;

				return;
			}

			this.evictUnadopted();
		}

		if (frame.action === 'remove') {
			this.cache.delete(key);

			if (device !== undefined) {
				await this.markRemoved(device);
			}

			return;
		}

		const raw = mergeProtectItem(frame.action === 'add' ? {} : (cached as Record<string, unknown>), frame.item);

		if (this.aborted()) {
			return;
		}

		this.cache.set(key, raw);

		if (device !== undefined) {
			await this.syncDevice(
				identity,
				device,
				frame.modelKey,
				raw,
				cached,
				frame.action === 'add' ? 'snapshot' : 'frame',
				frame.action === 'add' ? null : frame.item,
			);
		}
	}

	private async applyEventFrame(identity: ProtectConsoleIdentity, frame: ProtectFrame): Promise<void> {
		await this.ensureIndex(identity);

		if (this.aborted()) {
			return;
		}

		const eventDevice = frame.action === 'add' ? frame.item.device : undefined;

		if (frame.action !== 'add' && this.droppedEventIds.has(frame.id)) {
			return;
		}

		// Events of devices Smart Panel has not adopted are not tracked at all.
		if (typeof eventDevice === 'string' && !this.index.has(eventDevice)) {
			this.droppedEventIds.delete(frame.id);
			this.droppedEventIds.set(frame.id, true);

			while (this.droppedEventIds.size > MAX_DROPPED_EVENT_IDS) {
				this.droppedEventIds.delete(this.droppedEventIds.keys().next().value as string);
			}

			return;
		}

		this.eventIdentity = identity;

		const outcome = this.tracker.apply(frame, Date.now());

		for (const ignored of outcome.ignored) {
			if (ignored.reason === 'unknown_type' || ignored.reason === 'unknown_detection_type') {
				this.countIgnoredEvent(ignored.name);
			} else if (ignored.reason === 'invalid' || ignored.reason === 'unknown_event') {
				this.framesIgnored++;
			}
		}

		await this.applyEffects(outcome.effects, typeof eventDevice === 'string' ? [eventDevice] : []);
		this.scheduleEventTimer();
	}

	private countIgnoredEvent(name: string | null): void {
		this.ignoredEventCount++;

		const key =
			name !== null && (this.ignoredEventTypes.has(name) || this.ignoredEventTypes.size < MAX_IGNORED_EVENT_NAMES)
				? name
				: INVALID_EVENT_NAME;

		if (key !== INVALID_EVENT_NAME && !this.ignoredEventTypes.has(key)) {
			// The tracker only hands out names that match its safe-name pattern (letters, digits, underscore).
			this.logger.debug(`UniFi Protect ignored event type ${key}`);
		}

		this.ignoredEventTypes.set(key, (this.ignoredEventTypes.get(key) ?? 0) + 1);
	}

	/** Retries earlier failures of the touched devices first, then applies the new effects. */
	private async applyEffects(effects: readonly ProtectEventEffect[], extraDevices: readonly string[]): Promise<void> {
		for (const protectDeviceId of new Set([...extraDevices, ...effects.map((effect) => effect.protectDeviceId)])) {
			await this.retryDevice(protectDeviceId);
		}

		for (const effect of effects) {
			if (this.aborted()) {
				return;
			}

			const device = this.index.get(effect.protectDeviceId);

			if (device === undefined) {
				continue;
			}

			if (effect.kind === 'write') {
				for (const entry of effect.writes) {
					await this.applyTargetWrite(device, entry);
				}
			} else {
				await this.publishRing(device, effect.eventId, effect.startedAt, null);
			}
		}
	}

	private async applyTargetWrite(device: IndexedDevice, target: ProtectTargetWrite): Promise<void> {
		const key = propertyKey(target.channelIdentifier, target.mappingName);
		const property = device.properties.get(key);

		if (property === undefined) {
			return;
		}

		// A newer value for the property supersedes a queued failure of an older one.
		this.dropRetry(device.protectDeviceId, key);

		if (this.lastWritten.get(property.id) === target.value) {
			// Already persisted, but the event is still the newest word: a stale cached field must not undo it.
			this.markEventOwned(device.protectDeviceId, key);

			return;
		}

		if (await this.writeProperty(property.id, target.value)) {
			this.markEventOwned(device.protectDeviceId, key);
		} else if (!this.aborted()) {
			this.queueRetry(device.protectDeviceId, {
				kind: 'write',
				key,
				propertyId: property.id,
				value: target.value,
				attempts: 0,
				dueAt: 0,
			});
		}
	}

	/** `existing` is the retry entry being re-attempted, or null for a first attempt. */
	private async publishRing(
		device: IndexedDevice,
		eventId: string,
		startedAt: number | null,
		existing: RetryEntry | null,
	): Promise<boolean> {
		const bell = device.properties.get(propertyKey(DOORBELL_CHANNEL, DOORBELL_MAPPING));

		if (bell === undefined || this.aborted()) {
			return true;
		}

		let sourceTimestamp: string | undefined;

		try {
			sourceTimestamp = startedAt === null ? undefined : new Date(startedAt).toISOString();
		} catch {
			sourceTimestamp = undefined;
		}

		try {
			await this.occurrences.publishOccurrence({
				deviceId: device.panelId,
				channelId: bell.channelId,
				propertyId: bell.id,
				event: 'single_press',
				nativeEventType: 'ring',
				sourceOccurrenceId: eventId,
				sourceTimestamp,
			});

			return true;
		} catch {
			if (this.aborted()) {
				return false;
			}

			this.writesFailed++;
			this.logger.warn(RING_FAILURE_TEXT);

			if (existing === null) {
				this.queueRetry(device.protectDeviceId, {
					kind: 'ring',
					key: `ring\u0000${eventId}`,
					deviceId: device.panelId,
					channelId: bell.channelId,
					propertyId: bell.id,
					eventId,
					startedAt,
					attempts: 0,
					dueAt: 0,
				});
			}

			return false;
		}
	}

	private queueRetry(protectDeviceId: string, entry: RetryEntry): void {
		const entries = this.retries.get(protectDeviceId) ?? [];

		entry.dueAt = Date.now() + RETRY_DELAYS_MS[entry.attempts];
		entries.push(entry);

		while (entries.length > MAX_RETRY_ENTRIES) {
			entries.shift();
		}

		this.retries.set(protectDeviceId, entries);
		this.scheduleRetryTimer();
	}

	private dropRetry(protectDeviceId: string, key: string): void {
		const entries = this.retries.get(protectDeviceId);

		if (entries === undefined) {
			return;
		}

		const kept = entries.filter((entry) => entry.key !== key);

		if (kept.length === 0) {
			this.retries.delete(protectDeviceId);
		} else {
			this.retries.set(protectDeviceId, kept);
		}
	}

	/** Re-attempts the queued failures of one device (`onlyDue` limits it to the entries whose time has come). */
	private async retryDevice(protectDeviceId: string, onlyDue = false): Promise<void> {
		const entries = this.retries.get(protectDeviceId);

		if (entries === undefined) {
			return;
		}

		this.retries.delete(protectDeviceId);

		const now = Date.now();
		const survivors: RetryEntry[] = [];

		for (const entry of entries) {
			if (this.aborted()) {
				return;
			}

			// A ring keeps its schedule on every path (an early retry would hit the core's de-dup window and look done).
			if ((onlyDue || entry.kind === 'ring') && entry.dueAt > now) {
				survivors.push(entry);
				continue;
			}

			const device = this.index.get(protectDeviceId);
			let done = device === undefined;

			if (device !== undefined) {
				if (entry.kind === 'write') {
					// A property that left the index (channel removed) has nothing to write any more.
					if (device.properties.get(entry.key)?.id !== entry.propertyId) {
						done = true;
					} else if (this.lastWritten.get(entry.propertyId) === entry.value) {
						// Another writer persisted it, but the event is still the newest word: a stale cached field must not undo it.
						done = true;
						this.markEventOwned(protectDeviceId, entry.key);
					} else {
						done = await this.writeProperty(entry.propertyId, entry.value);

						if (done) {
							this.markEventOwned(protectDeviceId, entry.key);
						}
					}
				} else {
					done = await this.publishRing(device, entry.eventId, entry.startedAt, entry);
				}
			}

			if (this.aborted()) {
				return;
			}

			if (!done) {
				entry.attempts++;

				if (entry.attempts < RETRY_DELAYS_MS.length) {
					entry.dueAt = Date.now() + RETRY_DELAYS_MS[entry.attempts];
					survivors.push(entry);
				}
			}
		}

		if (survivors.length > 0) {
			// Entries queued meanwhile (a newer failure) keep their place after the survivors.
			this.retries.set(
				protectDeviceId,
				[...survivors, ...(this.retries.get(protectDeviceId) ?? [])].slice(-MAX_RETRY_ENTRIES),
			);
		}

		this.scheduleRetryTimer();
	}

	private chargeDueRetries(): void {
		const now = Date.now();

		for (const [protectDeviceId, entries] of [...this.retries]) {
			const kept: RetryEntry[] = [];

			for (const entry of entries) {
				if (entry.dueAt > now) {
					kept.push(entry);
					continue;
				}

				entry.attempts++;

				if (entry.attempts < RETRY_DELAYS_MS.length) {
					entry.dueAt = now + RETRY_DELAYS_MS[entry.attempts];
					kept.push(entry);
				}
			}

			if (kept.length === 0) {
				this.retries.delete(protectDeviceId);
			} else {
				this.retries.set(protectDeviceId, kept);
			}
		}
	}

	private scheduleRetryTimer(): void {
		this.clearTimer('retryTimer');

		let next: number | null = null;

		for (const entries of this.retries.values()) {
			for (const entry of entries) {
				next = next === null ? entry.dueAt : Math.min(next, entry.dueAt);
			}
		}

		if (next === null) {
			return;
		}

		this.retryTimer = setTimeout(
			() => {
				this.retryTimer = null;
				void this.run(async () => {
					try {
						if (this.eventIdentity !== null) {
							try {
								await this.ensureIndex(this.eventIdentity);
							} catch (error) {
								// A failed rebuild counts as an attempt, so a persistent failure reaches the cap.
								this.chargeDueRetries();
								throw error;
							}
						}

						for (const protectDeviceId of [...this.retries.keys()]) {
							await this.retryDevice(protectDeviceId, true);
						}
					} finally {
						// A failed index rebuild must not drop the queued retries.
						this.scheduleRetryTimer();
					}
				});
			},
			Math.max(RETRY_MIN_RESCHEDULE_MS, next - Date.now()),
		);
		this.retryTimer.unref();
	}

	private scheduleEventTimer(minDelayMs = 0): void {
		this.clearTimer('eventTimer');

		const deadline = this.tracker.nextDeadline();

		if (deadline === null) {
			return;
		}

		this.eventTimer = setTimeout(
			() => {
				this.eventTimer = null;
				void this.run(async () => {
					try {
						await this.expireEvents();
					} catch (error) {
						// A failed index rebuild must not leave open detections without a timer; the minimum delay keeps a
						// past deadline from looping at zero delay.
						if (!this.aborted()) {
							this.scheduleEventTimer(RETRY_MIN_RESCHEDULE_MS);
						}

						throw error;
					}
				});
			},
			Math.max(minDelayMs, deadline - Date.now()),
		);
		this.eventTimer.unref();
	}

	/** Safety tick: closes events past their deadline and retries every queued failure. */
	private async expireEvents(): Promise<void> {
		const identity = this.eventIdentity;

		if (identity === null) {
			return;
		}

		await this.ensureIndex(identity);

		if (this.aborted()) {
			return;
		}

		const effects = this.tracker.expire(Date.now());

		await this.applyEffects(effects, [...this.retries.keys()]);
		this.scheduleEventTimer();
	}

	private evictUnadopted(): void {
		for (const key of this.cache.keys()) {
			const [modelKey, id] = key.split('\u0000');
			const device = this.index.get(id);

			if (device === undefined || (device.modelKey !== null && device.modelKey !== modelKey)) {
				this.cache.delete(key);

				return;
			}
		}
	}

	private adopted(frame: ProtectFrame): IndexedDevice | undefined {
		const device = this.index.get(frame.id);

		return device !== undefined && (device.modelKey === null || device.modelKey === frame.modelKey)
			? device
			: undefined;
	}

	private async syncDevice(
		identity: ProtectConsoleIdentity,
		device: IndexedDevice,
		modelKey: string,
		raw: Readonly<Record<string, unknown>>,
		previousRaw: Readonly<Record<string, unknown>> | null,
		mode: SyncMode,
		partial: Readonly<Record<string, unknown>> | null,
	): Promise<void> {
		const mappings = this.mappingLoader.getMappings();
		const result = evaluateProtectMapping(mappings, {
			nvr: { id: identity.nvrId, macKey: identity.nvrMacKey },
			modelKey: modelKey as 'camera' | 'sensor' | 'light',
			device: raw,
			streams: null,
		});

		if (result.ok && mode === 'snapshot') {
			// A snapshot is authoritative: queued event values it contradicts must not be written after it.
			this.dropSupersededRetries(device, result.device, mappings, raw, null);
		} else if (result.ok && partial !== null) {
			// An update is authoritative only for what it carries.
			this.dropSupersededRetries(device, result.device, mappings, raw, {
				carried: this.carriedProperties(device, mappings, partial),
				tamperCleared: partial.tamperingDetectedAt === null,
			});
		}

		await this.retryDevice(device.protectDeviceId);

		if (!result.ok) {
			return;
		}

		const mapped = result.device;

		await this.resolveRemoval(device);
		await this.writeChanges(device, mapped, mappings, partial);
		await this.writeConnectionState(device, mapped);

		const tamperCleared =
			mode === 'snapshot' ? raw.tamperingDetectedAt === null : partial !== null && partial.tamperingDetectedAt === null;

		if (tamperCleared) {
			await this.clearMappings(device, TAMPER_MAPPINGS);
		}

		if (mode === 'snapshot') {
			await this.resetStaleDetections(device);
		}

		await this.propagateRename(device, modelKey, raw, previousRaw);
	}

	/** The property keys of a device whose value source reads a field the update frame carries. */
	private carriedProperties(
		device: IndexedDevice,
		mappings: ProtectResolvedMappings,
		partial: Readonly<Record<string, unknown>>,
	): ReadonlySet<string> {
		const syncable = this.syncableNames(mappings);
		const fields = this.sourceFields(mappings);
		const carried = new Set<string>();

		for (const [key, property] of device.properties) {
			if (!syncable.has(property.mappingName)) {
				continue;
			}

			for (const field of fields.get(property.mappingName) ?? []) {
				if (field in partial) {
					carried.add(key);
					break;
				}
			}
		}

		return carried;
	}

	/** Top-level device fields of the value source paths per mapping name (cached per loaded mappings). */
	private sourceFields(mappings: ProtectResolvedMappings): ReadonlyMap<string, ReadonlySet<string>> {
		if (this.sources?.mappings !== mappings) {
			const names = new Map<string, Set<string>>();

			for (const property of mappings.properties) {
				if (property.value !== null && 'path' in property.value) {
					const fields = names.get(property.name) ?? new Set<string>();

					fields.add(property.value.path.split(/[.[]/)[0]);
					names.set(property.name, fields);
				}
			}

			this.sources = { mappings, names };
		}

		return this.sources.names;
	}

	private markEventOwned(protectDeviceId: string, key: string): void {
		const owned = this.eventOwned.get(protectDeviceId) ?? new Set<string>();

		owned.add(key);
		this.eventOwned.set(protectDeviceId, owned);
	}

	/**
	 * Drops the queued property writes whose value the snapshot contradicts: a syncable property whose snapshot value
	 * differs, a tamper flag the console reports cleared, and a detection (with its leak level) without an open event.
	 * An update frame (`scope`) contradicts only the properties it carries and the tamper flags it clears.
	 */
	private dropSupersededRetries(
		device: IndexedDevice,
		mapped: ProtectMappedDevice,
		mappings: ProtectResolvedMappings,
		raw: Readonly<Record<string, unknown>>,
		scope: { carried: ReadonlySet<string>; tamperCleared: boolean } | null,
	): void {
		const entries = this.retries.get(device.protectDeviceId);

		if (entries === undefined) {
			return;
		}

		const authoritative = new Map<string, ProtectMappingScalar>();
		const open = this.tracker.openTargets(device.protectDeviceId);

		for (const change of diffMappedValues(null, mapped, this.syncableNames(mappings))) {
			const key = propertyKey(change.channelIdentifier, change.mappingName);

			if (scope === null || scope.carried.has(key)) {
				authoritative.set(key, change.value);
			}
		}

		for (const [key, property] of device.properties) {
			if (
				TAMPER_MAPPINGS.has(property.mappingName) &&
				(scope === null ? raw.tamperingDetectedAt === null : scope.tamperCleared)
			) {
				authoritative.set(key, false);
			} else if (scope !== null) {
				continue;
			} else if (STALE_DETECTIONS.has(property.mappingName) && !open.has(property.channelIdentifier)) {
				authoritative.set(key, false);
			} else if (property.mappingName === 'leak_level' && !open.has(property.channelIdentifier)) {
				authoritative.set(key, 'low');
			}
		}

		const kept = entries.filter(
			(entry) =>
				entry.kind !== 'write' || !authoritative.has(entry.key) || authoritative.get(entry.key) === entry.value,
		);

		if (kept.length === 0) {
			this.retries.delete(device.protectDeviceId);
		} else if (kept.length !== entries.length) {
			this.retries.set(device.protectDeviceId, kept);
		}
	}

	private syncableNames(mappings: ProtectResolvedMappings): ReadonlySet<string> {
		if (this.syncable?.mappings !== mappings) {
			this.syncable = { mappings, names: syncableMappingNames(mappings) };
		}

		return this.syncable.names;
	}

	private async writeChanges(
		device: IndexedDevice,
		mapped: ProtectMappedDevice,
		mappings: ProtectResolvedMappings,
		partial: Readonly<Record<string, unknown>> | null,
	): Promise<void> {
		// A snapshot or an add frame is authoritative; an update frame is so only for the fields it carries.
		const owned = this.eventOwned.get(device.protectDeviceId);

		if (owned !== undefined) {
			if (partial === null) {
				this.eventOwned.delete(device.protectDeviceId);
			} else {
				for (const key of this.carriedProperties(device, mappings, partial)) {
					owned.delete(key);
				}
			}
		}

		const stored = new Map<string, ProtectMappingScalar>();

		for (const [key, property] of device.properties) {
			const value = this.lastWritten.get(property.id);

			if (value !== undefined && value !== null) {
				stored.set(key, value);
			}
		}

		for (const change of diffMappedValues(stored, mapped, this.syncableNames(mappings))) {
			const key = propertyKey(change.channelIdentifier, change.mappingName);
			const property = device.properties.get(key);

			// An event wrote this value; the cached field it reads was not refreshed by this frame, so it is stale.
			if (property !== undefined && !this.eventOwned.get(device.protectDeviceId)?.has(key)) {
				await this.writeProperty(property.id, change.value);
			}
		}
	}

	private async writeConnectionState(device: IndexedDevice, mapped: ProtectMappedDevice): Promise<void> {
		const state = mappedConnectionState(mapped);

		if (state === null || !(Object.values(ConnectionState) as string[]).includes(state)) {
			return;
		}

		await this.setConnectionState(device, state as ConnectionState);
	}

	private async setConnectionState(device: IndexedDevice, state: ConnectionState): Promise<boolean> {
		// No local cache: the connectivity service compares against the persisted state and is a no-op when equal,
		// so a state changed by another writer (e.g. re-adoption) is repaired by the next frame or snapshot.
		if (this.aborted()) {
			return false;
		}

		return this.connectivity.trySetConnectionState(device.panelId, { state }).catch(() => false);
	}

	private async clearMappings(device: IndexedDevice, mappingNames: ReadonlySet<string>): Promise<void> {
		for (const property of device.properties.values()) {
			if (mappingNames.has(property.mappingName) && this.lastWritten.get(property.id) === true) {
				await this.writeProperty(property.id, false);
			}
		}
	}

	private async resetStaleDetections(device: IndexedDevice): Promise<void> {
		const open = this.tracker.openTargets(device.protectDeviceId);

		for (const property of device.properties.values()) {
			if (open.has(property.channelIdentifier)) {
				continue;
			}

			if (STALE_DETECTIONS.has(property.mappingName) && this.lastWritten.get(property.id) === true) {
				await this.writeProperty(property.id, false);
			} else if (property.mappingName === 'leak_level') {
				// Independent of `leak_detected`: a level whose write failed after the flag was cleared is repaired here.
				const written = this.lastWritten.get(property.id);

				if (written !== undefined && written !== null && written !== 'low') {
					await this.writeProperty(property.id, 'low');
				}
			}
		}
	}

	private async propagateRename(
		device: IndexedDevice,
		modelKey: string,
		raw: Readonly<Record<string, unknown>>,
		previousRaw: Readonly<Record<string, unknown>> | null,
	): Promise<void> {
		if (this.aborted()) {
			return;
		}

		const id = device.protectDeviceId;
		const before =
			this.propagatedNames.get(id) ?? (previousRaw === null ? null : toProtectDeviceName(previousRaw, modelKey, id));
		const after = toProtectDeviceName(raw, modelKey, id);

		if (before === null || before === after) {
			return;
		}

		if (device.name !== before) {
			// The user's own name wins; stop tracking this change.
			this.propagatedNames.set(id, after);

			return;
		}

		try {
			await this.devicesService.update(device.panelId, { type: DEVICES_UNIFI_PROTECT_TYPE, name: after } as never);
			if (!this.aborted()) {
				device.name = after;
				this.propagatedNames.set(id, after);
			}
		} catch {
			if (this.aborted()) {
				return;
			}

			// The last propagated name stays, so the next frame or snapshot retries the rename.
			if (!this.propagatedNames.has(id)) {
				this.propagatedNames.set(id, before);
			}

			this.logger.warn('UniFi Protect device rename failed');
		}
	}

	/**
	 * Marks a device the console no longer lists: `disconnected` plus one issue. The state write and the notification
	 * are separate steps; the state is re-asserted and a failed notification retried each time the removal is seen
	 * (next snapshot or remove frame).
	 */
	private async markRemoved(device: IndexedDevice): Promise<void> {
		const id = device.protectDeviceId;

		if (this.aborted()) {
			return;
		}

		if (!this.removed.has(id)) {
			this.removed.add(id);
			this.removalNotifyPending.add(id);
		}

		// Asserted on every confirmed removal: the connectivity service compares against the persisted state and writes
		// nothing when equal, so this also undoes another writer (an in-flight adoption) reconnecting the device.
		await this.setConnectionState(device, ConnectionState.DISCONNECTED);

		if (this.aborted() || !this.removalNotifyPending.has(id)) {
			return;
		}

		let stored: unknown;

		try {
			stored = await this.notifications.notify({
				source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
				kind: NotificationKind.ISSUE,
				key: removalKey(id),
				severity: NotificationSeverity.WARNING,
				title: 'UniFi Protect device removed',
				message:
					`${device.name} is no longer adopted on the UniFi Protect console. Smart Panel keeps the device and ` +
					'shows it as disconnected; delete it in Smart Panel if it is no longer needed.',
				data: { device_id: device.panelId, protect_device_id: id },
			});
		} catch {
			// The marker stays, so the next removal snapshot or remove frame retries the notification.
			this.logger.warn('UniFi Protect removal notification could not be raised');

			return;
		}

		// `notify` returns null for rate limiting and storage failures: keep the marker so the next removal retries.
		// A completion after a reset belongs to the previous session and must not touch the new state.
		if (stored !== null && stored !== undefined && !this.aborted()) {
			this.removalNotifyPending.delete(id);
		}
	}

	/**
	 * Resolves `device_removed:<id>` when the device is listed again. After a reset the in-memory `removed` set is
	 * gone, so the first successful sync of each device resolves the issue unconditionally (a no-op when none is open).
	 */
	private async resolveRemoval(device: IndexedDevice): Promise<void> {
		const id = device.protectDeviceId;

		if (this.aborted() || (!this.removed.has(id) && this.removalChecked.has(id))) {
			return;
		}

		try {
			await this.notifications.resolve(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, removalKey(id));

			if (this.aborted()) {
				return;
			}

			this.removed.delete(id);
			this.removalNotifyPending.delete(id);
			this.removalChecked.add(id);
		} catch {
			this.logger.warn('UniFi Protect removal notification could not be resolved');
		}
	}

	/** Writes a console-read value; a failure keeps `lastWritten` so the next frame or snapshot retries it. */
	private async writeProperty(propertyId: string, value: string | number | boolean): Promise<boolean> {
		if (this.aborted()) {
			return false;
		}

		try {
			await this.channelsPropertiesService.update(propertyId, { type: DEVICES_UNIFI_PROTECT_TYPE, value } as never);

			if (!this.aborted()) {
				this.lastWritten.set(propertyId, value);
			}

			return true;
		} catch {
			if (this.aborted()) {
				return false;
			}

			this.writesFailed++;
			this.logWriteFailure();

			return false;
		}
	}

	private logWriteFailure(): void {
		const now = Date.now();

		if (this.lastFailureLogAt !== null && now - this.lastFailureLogAt < PROTECT_FAILURE_LOG_INTERVAL_MS) {
			this.suppressedFailures++;

			return;
		}

		this.logger.warn(
			this.suppressedFailures > 0 ? `${FAILURE_TEXT} (${this.suppressedFailures} similar suppressed)` : FAILURE_TEXT,
		);
		this.lastFailureLogAt = now;
		this.suppressedFailures = 0;
	}

	private async ensureIndex(identity: ProtectConsoleIdentity): Promise<void> {
		if (this.indexNvrId !== identity.nvrId) {
			this.indexDirty = true;
		}

		while (this.indexDirty && !this.aborted()) {
			if (this.indexRefresh === null) {
				this.indexRefresh = this.rebuildIndex(identity).finally(() => {
					this.indexRefresh = null;
				});
			}

			await this.indexRefresh;
		}
	}

	private async rebuildIndex(identity: ProtectConsoleIdentity): Promise<void> {
		const generation = this.indexGeneration;
		const resetGeneration = this.generation;
		const devices = await this.devicesService.findAll<ProtectDeviceEntity>(DEVICES_UNIFI_PROTECT_TYPE);
		const index = new Map<string, IndexedDevice>();

		for (const device of [...devices].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
			if (
				!device.enabled ||
				device.protectNvrId !== identity.nvrId ||
				typeof device.protectDeviceId !== 'string' ||
				index.has(device.protectDeviceId)
			) {
				continue;
			}

			const properties = new Map<string, IndexedProperty>();

			for (const channel of device.channels ?? []) {
				for (const candidate of channel.properties ?? []) {
					const property = candidate as ProtectChannelPropertyEntity;

					if (typeof property.protectMappingName !== 'string') {
						continue;
					}

					properties.set(propertyKey(channel.identifier, property.protectMappingName), {
						id: property.id,
						channelId: channel.id,
						channelIdentifier: channel.identifier,
						mappingName: property.protectMappingName,
					});

					if (!this.lastWritten.has(property.id)) {
						await this.seed(property, resetGeneration);
					}
				}
			}

			index.set(device.protectDeviceId, {
				panelId: device.id,
				protectDeviceId: device.protectDeviceId,
				modelKey: device.protectModelKey,
				name: device.name,
				properties,
			});
		}

		if (resetGeneration !== this.generation) {
			return;
		}

		this.index = index;
		this.indexNvrId = identity.nvrId;
		this.indexDirty = this.indexGeneration !== generation;
	}

	private async seed(property: ProtectChannelPropertyEntity, resetGeneration: number): Promise<void> {
		try {
			const state = await this.propertyValue.readLatestPersisted(property);

			if (resetGeneration === this.generation) {
				this.lastWritten.set(property.id, state?.value ?? null);
			}
		} catch {
			// Unknown stored value: the next frame writes it.
		}
	}
}
