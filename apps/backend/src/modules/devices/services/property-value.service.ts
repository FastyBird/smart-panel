import { Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	type CreationStorageDestinations,
	type StorageBackendBinding,
	StorageService,
} from '../../storage/services/storage.service';
import { DEVICES_MODULE_NAME, DataTypeType, EventType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import {
	AcceptedPropertySample,
	DerivedPropertyPublication,
	IncorporatedPropertySample,
	PropertySampleEvidence,
	QualifiedPropertySample,
} from '../models/property-sample.model';
import {
	PropertyProducerState,
	PropertyValueState,
	type PropertyValueTrend,
	clonePropertyValueState,
} from '../models/property-value-state.model';
import { validatePropertyCommandValue } from '../utils/property-command-value.utils';

import {
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	originalReadCacheApi,
	ReadCacheObservation,
	creationHasDataMethod,
	creationMethodCurrent,
} from './device-creation-context';
import {
	PropertyProducerEvaluation,
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from './property-producer.registry.service';
import { PropertyValueLease, PropertyValueLockService } from './property-value-lock.service';
import { StorageQueryOptions } from '../../storage/storage.types';

import { PropertyReadSourceCapture, PropertyValueSourceRegistryService } from './property-value-source.registry.service';

/**
 * Number of recent data points used for trend computation.
 */
const TREND_POINTS_COUNT = 5;
const BOUNDED_READ_MAX_PROPERTIES = 500;
const BOUNDED_READ_SOURCE_CHUNK_SIZE = 50;
const BOUNDED_READ_DEFAULT_DEADLINE_MS = 750;

interface PropertyValueRow {
	time?: Date | string;
	stringValue?: string;
	numberValue?: number;
	propertyId: ChannelPropertyEntity['id'];
}

export type BoundedPropertyValueSource = 'cache' | 'storage';
export type BoundedPropertyValueStorageStatus = 'not_needed' | 'available' | 'disconnected' | 'failed' | 'timed_out';

interface BoundedPropertyValueItemBase {
	propertyId: ChannelPropertyEntity['id'];
	sourcePropertyId: ChannelPropertyEntity['id'] | null;
}

export type BoundedPropertyValueItem =
	| (BoundedPropertyValueItemBase & {
			status: 'available';
			source: BoundedPropertyValueSource;
			state: PropertyValueState & { value: string | number | boolean };
	  })
	| (BoundedPropertyValueItemBase & {
			status: 'missing';
			source: BoundedPropertyValueSource;
			state: PropertyValueState | null;
	  })
	| (BoundedPropertyValueItemBase & {
			status: 'unprocessed';
			source: null;
			state: null;
	  });

export interface BoundedPropertyValueReadOptions {
	deadlineAt?: Date;
}

export interface BoundedPropertyValueReadResult {
	items: BoundedPropertyValueItem[];
	requestedCount: number;
	availableCount: number;
	unknownCount: number;
	complete: boolean;
	storageStatus: BoundedPropertyValueStorageStatus;
	cacheCount: number;
	storageCount: number;
	missingCount: number;
	unprocessedCount: number;
	oldestLastUpdated: string | null;
	newestLastUpdated: string | null;
	freshnessUnknownCount: number;
}

export interface PersistedPropertyValueSnapshot {
	readonly state: PropertyValueState | null;
	readonly storageBinding: StorageBackendBinding;
}

export interface PropertyValueWriteResult {
	readonly changed: boolean;
	readonly state: PropertyValueState | null;
}

interface InternalPropertyValueReadResult {
	readonly state: PropertyValueState | null;
	readonly storageBinding?: StorageBackendBinding;
}

const propertyReadSourceMethods = Object.freeze({
	capture: PropertyValueSourceRegistryService.prototype.captureReadSource,
	key: PropertyValueSourceRegistryService.prototype.readSourceKey,
	input: PropertyValueSourceRegistryService.prototype.readSourceInput,
	check: PropertyValueSourceRegistryService.prototype.isReadSourceCurrent,
	structural: PropertyValueSourceRegistryService.prototype.isReadSourceStructurallyCurrent,
	reason: PropertyValueSourceRegistryService.prototype.unavailableReason,
	close: PropertyValueSourceRegistryService.prototype.closeReadSource,
});
const propertyReadInvalidate = DeviceCreationPublicationEngine.invalidateIds;
const propertyStorageReadMethods = Object.freeze({ capture: StorageService.prototype.captureCreationDestinations, check: StorageService.prototype.areCreationDestinationsCurrent });
interface PropertyReadAlias {
	readonly id: string;
	readonly source: PropertyReadSourceCapture;
	readonly key: string;
	readonly input: Readonly<ChannelPropertyEntity>;
	readonly current: () => boolean;
	readonly structuralCurrent: () => boolean;
}
interface PropertyReadQueries {
	readonly query: (query: string, options?: StorageQueryOptions) => Promise<PropertyValueRow[]>;
	readonly queryStrict: (query: string, options?: StorageQueryOptions) => Promise<PropertyValueRow[]>;
	readonly queryActiveStrictBound: (query: string) => Promise<Readonly<{ rows: PropertyValueRow[]; binding: StorageBackendBinding }>>;
}
interface PropertyReadKey {
	readonly queries: PropertyReadQueries;
	readonly token: ReadCacheObservation;
	readonly current: () => boolean;
}
interface PreparedPropertyRead {
	readonly state: PropertyValueState | null;
	readonly recent: number[];
	readonly numeric: boolean;
}
interface PropertyCacheProvenance {
	readonly state: PropertyValueState;
	readonly kind: 'reported' | 'historical' | 'owned';
	readonly lease?: DeviceCreationPublicationLease;
}
interface PropertyBatchKey {
	readonly token: ReadCacheObservation;
	readonly initialState: PropertyValueState | undefined;
	readonly initialProvenance: PropertyCacheProvenance | undefined;
	backend?: PropertyReadKey;
}
interface PropertyBatchEntry {
	readonly index: number;
	readonly alias: PropertyReadAlias;
	readonly cachedAtEntry: boolean;
	prepared?: PreparedPropertyRead;
}
interface PropertyBatchResult {
	readonly state: PropertyValueState | null;
	readonly source: BoundedPropertyValueSource;
	readonly processed: boolean;
}
@Injectable()
export class PropertyValueService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueService');

	private readonly cacheProvenance = new Map<string, PropertyCacheProvenance>();

	private valuesMap: Map<ChannelPropertyEntity['id'], PropertyValueState> = new Map();

	/**
	 * Cache of recent values for trend computation.
	 * Stores last N numeric values per property.
	 */
	private recentValuesMap: Map<ChannelPropertyEntity['id'], number[]> = new Map();
	private readonly cacheVersions = new Map<ChannelPropertyEntity['id'], number>();
	private readonly valueTails = new Map<ChannelPropertyEntity['id'], Promise<void>>();

	private sampleGeneration = 0;
	private readonly liveEpochs = new Set<string>();
	private readonly samples = new Map<string, QualifiedPropertySample & Pick<PropertySampleEvidence, 'isCurrent'>>();
	private readonly liveWatermarks = new Map<string, { sampledAt: number; invalid: boolean }>();

	constructor(
		private readonly storageService: StorageService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly valueLock: PropertyValueLockService,
		@Optional() private readonly producers?: PropertyProducerRegistryService,
		@Optional() private readonly events?: EventEmitter2,
	) {
		this.producers?.setEvidenceValidator((sources) => this.incorporatedEvidenceCurrent(sources));
	}

	private captureReadAlias(property: ChannelPropertyEntity): PropertyReadAlias {
		const names = { capture: 'captureReadSource', key: 'readSourceKey', input: 'readSourceInput', check: 'isReadSourceCurrent', structural: 'isReadSourceStructurallyCurrent', reason: 'unavailableReason', close: 'closeReadSource' };
		const methodsCurrent = () => Object.entries(names).every(([key, name]) => creationMethodCurrent(this.valueSourceRegistry, name, Reflect.get(propertyReadSourceMethods, key)));
		if (!methodsCurrent()) throw new Error('Original read source API unavailable');
		const source = propertyReadSourceMethods.capture.call(this.valueSourceRegistry, property);
		try {
			const input = propertyReadSourceMethods.input.call(this.valueSourceRegistry, source);
			return { source, id: input.id, key: propertyReadSourceMethods.key.call(this.valueSourceRegistry, source), input,
				current: () => methodsCurrent() && propertyReadSourceMethods.check.call(this.valueSourceRegistry, source),
				structuralCurrent: () => methodsCurrent() && propertyReadSourceMethods.structural.call(this.valueSourceRegistry, source) };
		} catch (cause) { propertyReadSourceMethods.close.call(this.valueSourceRegistry, source); throw cause; }
	}
	private closeReadAlias(alias: PropertyReadAlias): void { propertyReadSourceMethods.close.call(this.valueSourceRegistry, alias.source); }
	private observeReadKey(key: string): PropertyReadKey {
		if (!['query', 'queryStrict', 'queryActiveStrictBound'].every((name) => creationHasDataMethod(this.storageService, name))) throw new Error('Original backend read methods unavailable');
		const methods: PropertyReadQueries = { query: this.storageService.query, queryStrict: this.storageService.queryStrict, queryActiveStrictBound: this.storageService.queryActiveStrictBound };
		let destinations: CreationStorageDestinations | undefined;
		if (creationMethodCurrent(this.storageService, 'captureCreationDestinations', propertyStorageReadMethods.capture) && creationMethodCurrent(this.storageService, 'areCreationDestinationsCurrent', propertyStorageReadMethods.check)) destinations = propertyStorageReadMethods.capture.call(this.storageService);
		const token = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, key);
		return { token, queries: methods, current: () => originalReadCacheApi.current() && destinations !== undefined &&
			creationMethodCurrent(this.storageService, 'captureCreationDestinations', propertyStorageReadMethods.capture) && creationMethodCurrent(this.storageService, 'areCreationDestinationsCurrent', propertyStorageReadMethods.check) &&
			Object.entries(methods).every(([name, method]) => creationMethodCurrent(this.storageService, name, method)) && propertyStorageReadMethods.check.call(this.storageService, destinations) };
	}
	private readCachedData(alias: PropertyReadAlias, cached: PropertyValueState): PropertyValueState | null {
		// No backend query/await occurs on this data-only hit; no storage binding is claimed.
		const token = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, alias.key);
		try {
			const current = alias.current() && originalReadCacheApi.current();
			const owned = this.cacheProvenance.get(alias.key)?.kind === 'owned';
			const reported = this.reportedReadState(alias.key);
			const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, token);
			return !current || !alias.structuralCurrent() ? null : decision === 'publish' ? cached : owned ? reported : null;
		} finally { originalReadCacheApi.close.call(originalReadCacheApi.receiver, token); }
	}

	private reportedReadState(key: string): PropertyValueState | null {
		const state = this.valuesMap.get(key);
		const provenance = this.cacheProvenance.get(key);
		if (!state || provenance?.state !== state || provenance.kind === 'historical') return null;
		if (provenance.kind === 'owned') {
			try { if (!provenance.lease || !originalReadCacheApi.createdCurrent.call(originalReadCacheApi.receiver, provenance.lease)) return null; } catch { return null; }
		}
		return state;
	}
	private beginBatchReadKey(key: string): PropertyBatchKey {
		return { token: originalReadCacheApi.observe.call(originalReadCacheApi.receiver, key), initialState: this.valuesMap.get(key), initialProvenance: this.cacheProvenance.get(key) };
	}
	private closeBatchReadKeys(keys: ReadonlyMap<string, PropertyBatchKey>): void {
		for (const key of keys.values()) {
			originalReadCacheApi.close.call(originalReadCacheApi.receiver, key.token);
			if (key.backend) originalReadCacheApi.close.call(originalReadCacheApi.receiver, key.backend.token);
		}
	}
	/** Uses the original key, never a fresh resolver. Policy/producer callbacks precede final checks. */
	private overlayReadAlias(alias: PropertyReadAlias): PropertyValueState | null {
		const produced = this.producers?.read(alias.key);
		const reason = propertyReadSourceMethods.reason.call(this.valueSourceRegistry, alias.input);
		if (!reason) return produced ?? null;
		const blocked = new PropertyValueState();
		blocked.producer = Object.assign(new PropertyProducerState(), {
			quality: 'unavailable', reasons: [reason], sampledAt: null, evaluatedAt: new Date().toISOString(), expiresAt: null,
			revision: produced?.producer?.revision ?? 0,
		});
		return blocked;
	}
	/** All row/trend preparation is complete before this finite callback/check/effect boundary. */
	private finishBatchRead(entries: readonly PropertyBatchEntry[], keys: ReadonlyMap<string, PropertyBatchKey>, preferNewerCache: boolean, refreshEmptyTrend: boolean): Map<number, PropertyBatchResult> {
		const proposals = entries.map((entry) => {
			const cached = this.valuesMap.get(entry.alias.key);
			const preferCache = cached !== undefined && (entry.prepared === undefined || (preferNewerCache && this.isStateNewerOrEqual(cached, entry.prepared.state)));
			return { entry, cached, preferCache, produced: this.overlayReadAlias(entry.alias) };
		});
		// Pure provider callbacks may run only here, before every final structural check.
		const policies = proposals.map(({ entry }) => entry.alias.current());
		const reports = proposals.map(({ entry }) => ({ state: this.reportedReadState(entry.alias.key), provenance: this.cacheProvenance.get(entry.alias.key) }));
		const structures = proposals.map(({ entry }) => entry.alias.structuralCurrent());
		const backends = new Map([...keys].map(([key, observation]) => [key, observation.backend?.current() !== false]));
		const effectCurrent = creationMethodCurrent(DeviceCreationPublicationEngine, 'invalidateIds', propertyReadInvalidate);
		const decisions = new Map([...keys].map(([key, observation]) => [key, originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation.token)]));
		const results = new Map<number, PropertyBatchResult>();
		const publications = new Map<string, PreparedPropertyRead>();
		// No row/provider getter/callback, await or event from here through all cache effects.
		for (const [index, proposal] of proposals.entries()) {
			const { entry, cached, preferCache, produced } = proposal;
			const reported = reports[index]?.state ?? null;
			const provenance = reports[index]?.provenance;
			const key = keys.get(entry.alias.key);
			if (!key) throw new Error('Original batch read observation unavailable');
			const valid = policies[index] === true && structures[index] === true && backends.get(entry.alias.key) === true;
			const publish = decisions.get(entry.alias.key) === 'publish';
			const sameReport = reported !== null && this.valuesMap.get(entry.alias.key) === reported && this.cacheProvenance.get(entry.alias.key) === provenance;
			const replacement = sameReport && provenance !== undefined && (provenance.kind === 'owned' || (provenance.kind === 'reported' && provenance !== key.initialProvenance));
			const state = !valid ? null : produced ?? (publish ? preferCache ? cached ?? null : entry.prepared?.state ?? null : replacement ? reported : null);
			const source: BoundedPropertyValueSource = !valid ? null : produced !== null || (!publish && replacement) || (publish && preferCache) ? 'cache' : publish && entry.prepared !== undefined ? 'storage' : null;
			results.set(entry.index, { state, source, processed: entry.cachedAtEntry || cached !== undefined || entry.prepared !== undefined || produced !== null });
			if (effectCurrent && valid && publish && entry.prepared && !preferCache && !publications.has(entry.alias.key)) publications.set(entry.alias.key, entry.prepared);
		}
		for (const [key, prepared] of publications) this.publishReadState(key, prepared, false, refreshEmptyTrend);
		return results;
	}
	private readRowsState(property: ChannelPropertyEntity, key: string, rows: PropertyValueRow[]): Readonly<{ state: PropertyValueState | null; recent: number[]; numeric: boolean }> {
		const recent = rows.map((row) => row.numberValue).filter((value): value is number => value !== undefined).reverse();
		const trend = this.computeTrendFrom(property, recent);
		return { state: rows[0] ? this.toState(property, key, rows[0], trend) : null, recent, numeric: this.isNumericDataType(property.dataType) };
	}
	private publishReadState(key: string, prepared: Readonly<{ state: PropertyValueState | null; recent: number[]; numeric: boolean }>, authoritativeMiss = false, refreshEmptyTrend = false): void {
		if ((prepared.state !== null || refreshEmptyTrend) && prepared.numeric) {
			propertyReadInvalidate.call(DeviceCreationPublicationEngine, [key]);
			this.recentValuesMap.set(key, prepared.recent);
		}
		if (prepared.state) {
			propertyReadInvalidate.call(DeviceCreationPublicationEngine, [key]);
			this.setCachedState(key, prepared.state, 'historical');
		} else if (authoritativeMiss) {
			originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
			this.valuesMap.delete(key);
			this.cacheProvenance.delete(key);
			this.recentValuesMap.delete(key);
			this.bumpCacheVersion(key);
		}
	}
	captureCreatedMethodGuard(): () => boolean {
		const holders = [
			{
				receiver: this,
				keys: [
					'writeCreatedWithState',
					'writeInternal',
					'withCreatedValueLock',
					'withValueLock',
					'flushHistory',
					'validateValue',
					'isInvalidValue',
					'setCachedState',
					'computeTrend',
					'computeTrendFrom',
					'bumpCacheVersion',
				],
			},
			{ receiver: this.storageService, keys: ['writeCreatedPoints'] },
			{ receiver: this.valueLock, keys: ['runExclusive'] },
		];
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];
		for (const { receiver, keys } of holders)
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) throw new Error('Original value pipeline unavailable');
				const method: unknown = Reflect.get(receiver, key);
				pins.push(Object.freeze({ receiver, key, method }));
			}
		return () => pins.every(({ receiver, key, method }) => creationMethodCurrent(receiver, key, method));
	}

	/** Exact LOCAL creation snapshot; no alias resolution, replay, late hydration or history buffering. */
	async writeCreatedWithState(
		lease: DeviceCreationPublicationLease,
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		destinations: CreationStorageDestinations,
	): Promise<PropertyValueWriteResult> {
		DeviceCreationPublicationEngine.assert(lease);
		const key = property.id;
		DeviceCreationPublicationEngine.assert(lease, key);
		DeviceCreationPublicationEngine.assertProperty(lease, property);
		const child = DeviceCreationPublicationEngine.beginChild(lease, 'value', key);
		const writeInternalProperty: Readonly<{
			get: (owner: PropertyValueService, key: 'writeInternal') => PropertyValueService['writeInternal'];
		}> = Reflect;
		const writeInternal = writeInternalProperty.get(this, 'writeInternal');
		const write: Readonly<{
			call: (
				receiver: PropertyValueService,
				...args: Parameters<PropertyValueService['writeInternal']>
			) => ReturnType<PropertyValueService['writeInternal']>;
		}> = writeInternal;
		let failure: { cause: unknown } | undefined;
		try {
			return await this.withCreatedValueLock(key, lease, async (valueLease) => {
				DeviceCreationPublicationEngine.assertProperty(lease, property);
				await valueLease.assertOwned();
				DeviceCreationPublicationEngine.assertProperty(lease, property);
				await DeviceCreationPublicationEngine.probe(lease, key);
				DeviceCreationPublicationEngine.assertProperty(lease, property);
				return write.call(this, property, key, value, false, undefined, undefined, false, false, {
					lease,
					destinations,
				});
			});
		} catch (cause) {
			failure = { cause };
			throw cause;
		} finally {
			child.finish(failure);
		}
	}

	/**
	 * Write property value to storage
	 * @returns true if value changed, false if value was the same or invalid
	 */
	async write(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		valueTimestamp?: Date,
	): Promise<boolean> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.resolveBestEffort(property, 'write');
		if (key === null) return false;

		return (
			await this.withValueLock(key, () => this.writeInternal(property, key, value, false, undefined, valueTimestamp))
		).changed;
	}

	/**
	 * Normal (best-effort) value write with the exact cache/storage state selected by the write.
	 *
	 * High-level callers use this to publish an immutable event snapshot without a second entity
	 * read. `write()` remains the compatibility API for existing boolean-only callers.
	 */
	async writeWithState(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		valueTimestamp?: Date,
	): Promise<PropertyValueWriteResult> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.resolveBestEffort(property, 'write');
		if (key === null) return { changed: false, state: null };

		return this.withValueLock(key, () => this.writeInternal(property, key, value, false, undefined, valueTimestamp));
	}

	/** Publishable live state after history admission, without waiting for best-effort I/O. */
	async writeLiveWithState(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		valueTimestamp?: Date,
	): Promise<PropertyValueWriteResult> {
		// A shared-writer lease must cover actual persistence, not just local buffer admission.
		if (this.valueLock.isEnabled()) {
			return this.writeWithState(property, value, valueTimestamp);
		}
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.resolveBestEffort(property, 'write');
		if (key === null) return { changed: false, state: null };
		return this.withValueLock(
			key,
			() => this.writeInternal(property, key, value, false, undefined, valueTimestamp, true),
			false,
		);
	}

	/** Called only by admitted provider report writers; never by optimistic command writes. */
	async writeSampleWithState(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		evidence: PropertySampleEvidence,
	): Promise<PropertyValueWriteResult> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.resolveBestEffort(property, 'sample');
		if (key === null || key !== property.id || this.producers?.owns(key)) return { changed: false, state: null };
		return this.withValueLock(
			key,
			async () => {
				if (this.producers?.owns(key) || evidence.isCurrent?.() === false || evidence.sourceIsCurrent?.() === false)
					return { changed: false, state: null };
				const sampledAt = evidence.sampledAt.getTime();
				const receivedAt = evidence.receivedAt.getTime();
				const watermark = this.liveWatermarks.get(key);
				const live = evidence.provenance === 'live';
				// A non-live startup replay can populate ordinary display state, never the live epoch.
				if (!live && this.liveEpochs.has(key)) return { changed: false, state: null };
				if (watermark && (sampledAt < watermark.sampledAt || (sampledAt === watermark.sampledAt && watermark.invalid)))
					return { changed: false, state: null };
				const validClock =
					Number.isFinite(sampledAt) &&
					Number.isFinite(receivedAt) &&
					sampledAt <= receivedAt &&
					receivedAt <= Date.now();
				if (!validClock || !this.isSampleValueValid(property, value)) {
					if (live) {
						this.liveEpochs.add(key);
						// An invalid clock revokes eligibility, but supplies no trusted ordering evidence.
						// Preserve the previous watermark (including any genuine value-fault tombstone)
						// so corrected clocks can recover without waiting for a rejected future timestamp.
						if (validClock) this.liveWatermarks.set(key, { sampledAt, invalid: true });
						this.samples.delete(key);
						this.events?.emit(
							EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
							Object.freeze({ propertyId: key, evidence: this.cloneEvidence(evidence) }),
						);
					}
					return { changed: false, state: null };
				}
				const result = await this.writeInternal(
					property,
					key,
					value,
					false,
					undefined,
					evidence.sampledAt,
					!this.valueLock.isEnabled(),
				);
				// A generation may change while history I/O is pending. It cannot regain live authority.
				if (evidence.isCurrent?.() === false || evidence.sourceIsCurrent?.() === false)
					return { changed: false, state: null };
				if (result.state !== null) {
					const sample: AcceptedPropertySample = Object.freeze({
						propertyId: key,
						value: result.state.value,
						sampledAt: new Date(sampledAt),
						receivedAt: new Date(receivedAt),
						provenance: evidence.provenance,
						...(evidence.semanticOrigin ? { semanticOrigin: evidence.semanticOrigin } : {}),
						...(evidence.nativeCoverTagPresent !== undefined
							? { nativeCoverTagPresent: evidence.nativeCoverTagPresent }
							: {}),
						...(evidence.commandObservation ? { commandObservation: evidence.commandObservation } : {}),
						...(live ? { acceptanceGeneration: ++this.sampleGeneration } : {}),
						quality: 'good',
						reasons: Object.freeze([]),
					});
					if (live) {
						this.liveEpochs.add(key);
						this.liveWatermarks.set(key, { sampledAt, invalid: false });
						this.samples.set(key, {
							...sample,
							provenance: 'live',
							isCurrent: evidence.sourceIsCurrent ?? evidence.isCurrent,
						});
					}
					const snapshot = Object.assign(
						Object.create(Object.getPrototypeOf(property) as object) as ChannelPropertyEntity,
						property,
					);
					snapshot.value = clonePropertyValueState(result.state);
					this.events?.emit(
						EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
						Object.freeze({ propertyId: key, property: snapshot, sample: this.cloneSample(sample, false) }),
					);
				}
				return result;
			},
			this.valueLock.isEnabled(),
		);
	}

	/** Captures the live acceptance boundary for new process-local producer admission. */
	currentSampleGeneration(): number {
		return this.sampleGeneration;
	}

	/** Diagnostics use only process-local accepted evidence, never stored history or property.value. */
	readSampleFreshness(property: ChannelPropertyEntity, maxAgeMs: number, now = new Date()) {
		const key = this.resolveBestEffort(property, 'sample freshness');
		const unavailable = this.valueSourceRegistry.unavailableReason(property);
		const produced = key === null ? null : this.producers?.readDiagnosticState(key)?.producer;
		const physical = key === null ? null : this.samples.get(key);
		const incorporated = key === null ? null : this.producers?.readIncorporatedSamples(key);
		const current =
			!unavailable &&
			(produced ? !incorporated || this.incorporatedEvidenceCurrent(incorporated) : physical?.isCurrent?.() !== false);
		const timestamp = produced?.sampledAt ?? physical?.sampledAt.toISOString() ?? null;
		const sampled = timestamp === null ? NaN : Date.parse(timestamp);
		const clockValid =
			Number.isFinite(now.getTime()) &&
			sampled <= now.getTime() &&
			(produced
				? Date.parse(produced.evaluatedAt) <= now.getTime()
				: (physical?.receivedAt.getTime() ?? Infinity) <= now.getTime());
		const evidence =
			Number.isFinite(maxAgeMs) &&
			maxAgeMs >= 0 &&
			current &&
			clockValid &&
			(!produced || produced.quality !== 'unavailable');
		const age = evidence ? now.getTime() - sampled : null;
		const expiry = evidence
			? Math.min(sampled + maxAgeMs, produced?.expiresAt ? Date.parse(produced.expiresAt) : Infinity)
			: null;
		const reasons = unavailable ? [unavailable] : [...(produced?.reasons ?? [])];
		const stale =
			(age !== null &&
				(age > maxAgeMs ||
					(produced?.expiresAt !== null &&
						produced?.expiresAt !== undefined &&
						Date.parse(produced.expiresAt) <= now.getTime()))) ||
			reasons.some((reason) => ['expired', 'stale'].includes(reason));
		return {
			status: stale ? ('stale' as const) : evidence ? ('fresh' as const) : ('unavailable' as const),
			quality: evidence ? (produced?.quality ?? physical?.quality ?? 'unavailable') : ('unavailable' as const),
			sampled_at: evidence ? timestamp : null,
			age_seconds: age === null ? null : age / 1000,
			expires_at:
				expiry !== null && Number.isFinite(new Date(expiry).getTime()) ? new Date(expiry).toISOString() : null,
			reasons,
		};
	}

	/** Captures physical source-lease continuity without treating later packets as new authority. */
	captureSampleSourceGuard(property: ChannelPropertyEntity): () => boolean {
		const key = this.resolveBestEffort(property, 'sample source lease');
		const sample = key === null ? null : this.samples.get(key);
		const guard = sample?.isCurrent;
		return () => !!sample && guard?.() !== false;
	}

	/** Qualifies current live evidence; derived samples must still incorporate the current source acceptance. */
	readQualifiedSample(
		property: ChannelPropertyEntity,
		maxAgeMs: number,
		now = new Date(),
	): QualifiedPropertySample | null {
		return this.qualifySample(property, maxAgeMs, now, false);
	}

	/** Same admission checks as live reads, without expiring producer leases or publishing corrections. */
	readQualifiedSampleSnapshot(
		property: ChannelPropertyEntity,
		maxAgeMs: number,
		now: Date,
	): QualifiedPropertySample | null {
		return this.qualifySample(property, maxAgeMs, now, true);
	}

	private qualifySample(
		property: ChannelPropertyEntity,
		maxAgeMs: number,
		now: Date,
		detached: boolean,
	): QualifiedPropertySample | null {
		if (
			!Number.isFinite(maxAgeMs) ||
			maxAgeMs < 0 ||
			!Number.isFinite(now.getTime()) ||
			this.valueSourceRegistry.unavailableReason(property) !== null
		)
			return null;
		const key = this.resolveBestEffort(property, 'qualified sample');
		if (key === null) return null;
		const produced = detached ? this.producers?.readDiagnosticState(key) : this.producers?.read(key);
		if (produced) {
			if (
				produced.value === null ||
				produced.producer.quality === 'unavailable' ||
				produced.producer.sampledAt === null
			)
				return null;
			const incorporated = this.producers.readIncorporatedSamples(key);
			if (incorporated && !this.incorporatedEvidenceCurrent(incorporated)) return null;

			const sampledAt = new Date(produced.producer.sampledAt);
			if (
				!Number.isFinite(sampledAt.getTime()) ||
				!Number.isFinite(Date.parse(produced.producer.evaluatedAt)) ||
				Date.parse(produced.producer.evaluatedAt) < sampledAt.getTime() ||
				sampledAt.getTime() > now.getTime() ||
				Date.parse(produced.producer.evaluatedAt) > now.getTime() ||
				now.getTime() - sampledAt.getTime() > maxAgeMs ||
				(produced.producer.expiresAt !== null && Date.parse(produced.producer.expiresAt) <= now.getTime())
			)
				return null;
			return Object.freeze({
				propertyId: key,
				value: produced.value,
				sampledAt,
				receivedAt: new Date(produced.producer.evaluatedAt),
				provenance: 'live',
				quality: produced.producer.quality,
				reasons: Object.freeze([...produced.producer.reasons]),
				revision: produced.producer.revision,
			});
		}
		const sample = this.samples.get(key);
		if (
			!sample ||
			sample.isCurrent?.() === false ||
			sample.sampledAt.getTime() > now.getTime() ||
			sample.receivedAt.getTime() > now.getTime() ||
			now.getTime() - sample.sampledAt.getTime() > maxAgeMs
		)
			return null;
		return this.cloneSample(sample);
	}

	/** Captures the resolved physical acceptance or exact recursive producer publication. */
	captureIncorporatedSample(property: ChannelPropertyEntity): IncorporatedPropertySample | null {
		const key = this.resolveBestEffort(property, 'incorporated evidence');
		if (!key || this.valueSourceRegistry.unavailableReason(property) !== null) return null;
		if (this.producers?.owns(key)) return this.producers.captureEvidence(key);
		const sample = this.samples.get(key);
		if (!sample || sample.quality !== 'good' || sample.isCurrent?.() === false) return null;
		return Object.freeze({ propertyId: key, acceptanceGeneration: sample.acceptanceGeneration });
	}

	/** Bounded, fail-closed walk. Duplicates include shared leaves: protective evidence must be unambiguous. */
	incorporatedEvidenceCurrent(sources: readonly IncorporatedPropertySample[]): boolean {
		const visited = new Set<string>();
		const visit = (items: readonly IncorporatedPropertySample[], depth: number): boolean => {
			const evidence: readonly IncorporatedPropertySample[] = items;
			if (!Array.isArray(items) || !items.length || items.length > 32 || depth > 16) return false;
			for (const item of evidence) {
				if (!item || visited.has(item.propertyId) || visited.size >= 256) return false;
				visited.add(item.propertyId);
				if (item.producer) {
					if (!this.producers?.isPublicationCurrent(item) || !visit(item.sources, depth + 1)) return false;
				} else {
					const sample = this.samples.get(item.propertyId);
					if (
						item.sources ||
						!Number.isSafeInteger(item.acceptanceGeneration) ||
						!sample ||
						sample.acceptanceGeneration !== item.acceptanceGeneration ||
						sample.isCurrent?.() === false ||
						sample.quality !== 'good' ||
						sample.receivedAt.getTime() > Date.now() ||
						sample.sampledAt.getTime() > Date.now()
					)
						return false;
				}
			}
			return true;
		};
		return visit(sources, 0);
	}

	async publishDerived(
		property: ChannelPropertyEntity,
		lease: PropertyProducerLease,
		value: string | boolean | number | null,
		publication: DerivedPropertyPublication,
		evaluation?: PropertyProducerEvaluation,
	): Promise<PropertyValueWriteResult> {
		// Reject ambiguous/unbounded lineage before recursively copying internal evidence.
		if (
			(publication.sourceSample && publication.sourceSamples) ||
			(publication.sourceSamples && !this.incorporatedEvidenceCurrent(publication.sourceSamples)) ||
			(publication.sourceSample && !this.incorporatedEvidenceCurrent([publication.sourceSample]))
		)
			return { changed: false, state: null };
		// Capture evaluation evidence before queuing: callers cannot revise pending work in place.
		publication = Object.freeze({
			...publication,
			reasons: Object.freeze([...publication.reasons]),
			sampledAt: new Date(publication.sampledAt),
			evaluatedAt: new Date(publication.evaluatedAt),
			expiresAt: new Date(publication.expiresAt),
			sourceSample: publication.sourceSample
				? this.freezeIncorporatedEvidence([publication.sourceSample])[0]
				: undefined,
			sourceSamples: publication.sourceSamples ? this.freezeIncorporatedEvidence(publication.sourceSamples) : undefined,
		});

		const key = this.valueSourceRegistry.resolve(property);
		const epoch = evaluation?.epoch ?? this.producers?.version(lease) ?? null;
		if (
			key !== property.id ||
			this.valueSourceRegistry.unavailableReason(property) !== null ||
			lease.propertyId !== key ||
			!this.producers?.canCommit(lease, publication, epoch, evaluation?.generation)
		)
			return { changed: false, state: null };
		return this.withValueLock(key, async () => {
			if (
				this.valueSourceRegistry.unavailableReason(property) !== null ||
				!this.producers.canCommit(lease, publication, epoch, evaluation?.generation)
			)
				return { changed: false, state: null };
			if (!this.isSampleValueValid(property, value)) {
				this.producers.invalidate(lease, ['invalid_value'], publication.evaluatedAt);
				return { changed: false, state: this.producers.read(key) };
			}
			const result = await this.writeInternal(
				property,
				key,
				value,
				false,
				undefined,
				publication.sampledAt,
				false,
				true,
			);
			if (!result.state || !this.producers.commit(lease, result.state, publication, epoch, evaluation?.generation))
				return { changed: false, state: this.producers.read(key) };
			return { changed: result.changed, state: this.producers.read(key) };
		});
	}

	private freezeIncorporatedEvidence(
		sources: readonly IncorporatedPropertySample[],
		depth = 0,
	): readonly IncorporatedPropertySample[] {
		const evidence: readonly IncorporatedPropertySample[] = sources;
		if (!Array.isArray(sources) || !sources.length || sources.length > 32 || depth > 16)
			return Object.freeze<IncorporatedPropertySample[]>([]);
		return Object.freeze(
			evidence.map((source) =>
				Object.freeze({
					...source,
					producer: source.producer ? Object.freeze({ ...source.producer }) : undefined,
					sources: source.sources ? this.freezeIncorporatedEvidence(source.sources, depth + 1) : undefined,
				}),
			),
		);
	}

	invalidateDerived(
		property: ChannelPropertyEntity,
		lease: PropertyProducerLease,
		reasons: readonly string[],
		evaluatedAt = new Date(),
	): boolean {
		return (
			lease.propertyId === property.id &&
			this.valueSourceRegistry.resolve(property) === property.id &&
			(this.producers?.invalidate(lease, reasons, evaluatedAt) ?? false)
		);
	}

	private cloneEvidence(evidence: PropertySampleEvidence): PropertySampleEvidence {
		return Object.freeze({
			sampledAt: new Date(evidence.sampledAt),
			receivedAt: new Date(evidence.receivedAt),
			provenance: evidence.provenance,
			...(evidence.semanticOrigin ? { semanticOrigin: evidence.semanticOrigin } : {}),
			...(evidence.observedAt ? { observedAt: new Date(evidence.observedAt) } : {}),
		});
	}

	private cloneSample<T extends AcceptedPropertySample>(sample: T, includeCommandProof = true): T {
		const { commandObservation, ...ordinary } = sample;
		return Object.freeze({
			...ordinary,
			...(includeCommandProof && commandObservation ? { commandObservation } : {}),
			sampledAt: new Date(sample.sampledAt),
			receivedAt: new Date(sample.receivedAt),
			reasons: Object.freeze([...sample.reasons]),
		}) as T;
	}

	private isSampleValueValid(property: ChannelPropertyEntity, value: string | boolean | number | null): boolean {
		// A reporting sensor's display/control step is not its measurement precision.
		return validatePropertyCommandValue(
			{ ...property, invalid: property.invalid ?? null, step: null } as ChannelPropertyEntity,
			value,
		).valid;
	}

	private overlay(property: ChannelPropertyEntity, state: PropertyValueState | null): PropertyValueState | null {
		const key = this.resolveBestEffort(property, 'producer overlay');
		const produced = key === null ? null : this.producers?.read(key);
		const reason = this.valueSourceRegistry.unavailableReason(property);
		if (reason) {
			const blocked = new PropertyValueState();
			blocked.producer = Object.assign(new PropertyProducerState(), {
				quality: 'unavailable',
				reasons: [reason],
				sampledAt: null,
				evaluatedAt: new Date().toISOString(),
				expiresAt: null,
				revision: produced?.producer?.revision ?? 0,
			});
			return blocked;
		}
		return produced ?? state;
	}

	flushHistory(): Promise<void> {
		return this.storageService.flushQueuedWrites();
	}

	/**
	 * Persist a value to at least one storage backend before publishing it to the
	 * process-local cache. Reconciliation callers can then retry a failed write
	 * without the cache falsely claiming that the measurement already exists.
	 */
	async writeStrict(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		storageBinding?: StorageBackendBinding,
	): Promise<boolean> {
		return (await this.writeStrictWithState(property, value, storageBinding)).changed;
	}

	async writeStrictWithState(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		storageBinding?: StorageBackendBinding,
		valueTimestamp?: Date,
	): Promise<PropertyValueWriteResult> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.valueSourceRegistry.resolve(property);

		return this.withValueLock(key, () =>
			this.writeInternal(property, key, value, true, storageBinding, valueTimestamp),
		);
	}

	async writeStrictIfPersistedDifferent(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		expectedPersistedState: PropertyValueState | null,
		beforeWrite?: () => Promise<void>,
		valueTimestamp?: Date,
	): Promise<PropertyValueWriteResult> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.valueSourceRegistry.resolve(property);

		return this.withValueLock(key, async (valueLease) => {
			const latest = await this.readLatestInternal(property, true, true, true);
			await beforeWrite?.();

			if (latest.state?.value === value) {
				return { changed: false, state: latest.state };
			}
			if (!this.samePersistedState(latest.state, expectedPersistedState)) {
				return { changed: false, state: latest.state };
			}
			if (!latest.storageBinding) {
				throw new Error('Persisted property value read did not bind a storage backend');
			}
			await valueLease.assertOwned();

			return this.writeInternal(property, key, value, true, latest.storageBinding, valueTimestamp);
		});
	}

	private async writeInternal(
		property: ChannelPropertyEntity,
		key: ChannelPropertyEntity['id'],
		value: string | boolean | number | null,
		strict: boolean,
		storageBinding?: StorageBackendBinding,
		valueTimestamp?: Date,
		deferHistory = false,
		producerWrite = false,
		creation?: Readonly<{ lease: DeviceCreationPublicationLease; destinations: CreationStorageDestinations }>,
	): Promise<PropertyValueWriteResult> {
		if (creation) DeviceCreationPublicationEngine.assert(creation.lease, key);
		// A projected property owns no series — the value belongs to its source, and only the source's
		// own reports may write it. This is the exact mirror of delete()'s guard below, and exists for
		// the same reason: dereferencing here would persist the supplied value as a real measurement of
		// a device that was never commanded and never reported it, corrupting the source's latest value,
		// its trend cache and its stored history with a number no hardware produced.
		//
		// Nothing legitimate is lost, because no write ever legitimately arrives *through* a projection:
		//
		// - A source device reports on its own property, where the key already is that property's id.
		// - A command issued against a projection is forwarded to the source device's own platform
		//   (VirtualDevicePlatform), which makes the source report it back as above. The value the
		//   caller asked for still reaches the hardware; what is dropped is only the optimistic local
		//   echo, which for a projection would land in somebody else's series ahead of — or instead of —
		//   the hardware ever confirming it.
		// - A value supplied while *creating* a projection (POST with `value`) has no reporter behind it
		//   at all, and no command either. ChannelsPropertiesService.create() refuses that outright
		//   rather than letting it fall through to here, so the caller is told it was not stored.
		//
		// Past this point `key` is provably `property.id`; it stays named for the storage tag, so this
		// method and readLatest() keep resolving the series the same way.
		if (!producerWrite && this.producers?.owns(key)) return { changed: false, state: null };
		if (key !== property.id) {
			this.logger.debug(
				`Skipping write for projected property id=${property.id}: its value belongs to source property id=${key}`,
			);

			return { changed: false, state: null };
		}

		// Skip null values - device hasn't reported this property yet
		if (value === null || value === undefined) {
			return { changed: false, state: null };
		}

		// Skip invalid/sentinel values (e.g., -1 when sensor is off)
		// These are defined in the property's invalid field
		if (property.invalid !== null && this.isInvalidValue(property.invalid, value)) {
			this.logger.debug(`Skipping invalid/sentinel value for property id=${property.id}: value=${value}`);
			return { changed: false, state: null };
		}

		const cached = creation ? undefined : this.valuesMap.get(key);
		if (!strict && cached && cached.value === value) {
			// no change → skip storage write, but refresh lastUpdated so freshness stays accurate
			if (creation) DeviceCreationPublicationEngine.assert(creation.lease, key);
			originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
			this.cacheProvenance.set(key, { state: cached, kind: 'reported' });
			cached.lastUpdated = (valueTimestamp ?? new Date()).toISOString();
			this.bumpCacheVersion(key);
			return { changed: false, state: cached };
		}

		// Validate value against format constraints
		const validationError = this.validateValue(property, value);
		if (validationError) {
			this.logger.warn(
				`Invalid value for property id=${property.id}: ${validationError}. Value=${JSON.stringify(value)}`,
			);
			return { changed: false, state: null };
		}

		const formattedValue: { stringValue?: string; numberValue?: number } = {};

		switch (property.dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				formattedValue.stringValue = String(value);
				break;

			case DataTypeType.BOOL:
				formattedValue.stringValue = String(value ? 'true' : 'false');
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT:
				formattedValue.numberValue = Number(value);
				break;

			default:
				this.logger.error(`Unsupported data type dataType=${property.dataType} id=${property.id}`);

				return { changed: false, state: null };
		}

		const timestamp = valueTimestamp ?? new Date();
		const now = timestamp.toISOString();
		const point = {
			measurement: 'property_value',
			tags: { propertyId: key },
			fields: formattedValue,
			timestamp,
		};

		const cacheVersionAtWriteStart = this.cacheVersion(key);

		if (strict) {
			await this.storageService.writePointsStrict([point], storageBinding);

			if (this.cacheVersion(key) !== cacheVersionAtWriteStart) {
				return { changed: true, state: new PropertyValueState(value, now) };
			}
		}

		// Update recent values cache for trend computation
		if (
			typeof value === 'number' ||
			(typeof value === 'string' && !isNaN(Number(value)) && this.isNumericDataType(property.dataType))
		) {
			const numValue = Number(value);
			if (creation) DeviceCreationPublicationEngine.assert(creation.lease, key);
			originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
			const recent = creation ? [] : (this.recentValuesMap.get(key) ?? []);
			recent.push(numValue);
			if (recent.length > TREND_POINTS_COUNT) {
				recent.shift();
			}
			this.recentValuesMap.set(key, recent);
		}

		const trend = this.computeTrend(property, key);
		const state = new PropertyValueState(value, now, trend);

		// Update local cache regardless of storage availability
		if (creation) DeviceCreationPublicationEngine.assert(creation.lease, key);
		this.setCachedState(key, state, creation ? 'owned' : 'reported', creation?.lease);

		if (strict) {
			return { changed: true, state };
		}

		if (creation) {
			DeviceCreationPublicationEngine.assert(creation.lease, key);
			await this.storageService.writeCreatedPoints(creation.lease, creation.destinations, [point]);
			DeviceCreationPublicationEngine.assert(creation.lease, key);
			return { changed: true, state };
		}

		if (!this.storageService.isConnected()) {
			return { changed: true, state }; // Value changed in cache
		}

		try {
			if (deferHistory) {
				await this.storageService.enqueueWritePoint(point);
			} else {
				await this.storageService.writePoints([point]);
			}

			this.logger.debug(`Value ${deferHistory ? 'queued' : 'saved'} id=${property.id} dataType=${property.dataType}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to write value to storage id=${property.id} dataType=${property.dataType} error=${err.message}`,
				err.stack,
			);
		}

		return { changed: true, state }; // Value changed
	}

	async readLatest(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		const produced = this.overlay(property, null);
		if (produced) return produced;
		return this.overlay(property, (await this.readLatestInternal(property, false)).state);
	}

	async readLatestStrict(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		const produced = this.overlay(property, null);
		if (produced) return produced;
		try {
			return this.overlay(property, (await this.readLatestInternal(property, true)).state);
		} catch (error) {
			const concurrentProducer = this.overlay(property, null);
			if (concurrentProducer) return concurrentProducer;
			throw error;
		}
	}

	/**
	 * Read the latest durable measurement without trusting this process's cache.
	 * Cross-process reconciliation uses this to compare against the shared source
	 * of truth, then refreshes the local cache from the authoritative result.
	 */
	async readLatestPersisted(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		return (await this.readLatestPersistedSnapshot(property)).state;
	}

	async readLatestPersistedSnapshot(property: ChannelPropertyEntity): Promise<PersistedPropertyValueSnapshot> {
		// Keep reads concurrent with later writes. readLatestInternal fences cache refresh by version;
		// only history already admitted at this boundary must be visible to the durable read.
		await this.flushHistory();
		const result = await this.readLatestInternal(property, true, true, true);

		if (!result.storageBinding) {
			throw new Error('Persisted property value read did not bind a storage backend');
		}

		return { state: result.state, storageBinding: result.storageBinding };
	}

	async readLatestManyStrict(properties: ChannelPropertyEntity[]): Promise<Map<ChannelPropertyEntity['id'], PropertyValueState | null>> {
		const entries: PropertyBatchEntry[] = [];
		const keys = new Map<string, PropertyBatchKey>();
		try {
			const missing = new Map<string, PropertyBatchEntry[]>();
			for (const [index, property] of properties.entries()) {
				const alias = this.captureReadAlias(property);
				const entry = { index, alias, cachedAtEntry: this.valuesMap.has(alias.key) };
				entries.push(entry);
				if (!keys.has(alias.key)) keys.set(alias.key, this.beginBatchReadKey(alias.key));
				if (this.overlayReadAlias(alias) || entry.cachedAtEntry) continue;
				const group = missing.get(alias.key) ?? [];
				group.push(entry); missing.set(alias.key, group);
			}
			if (missing.size) {
				if (!this.storageService.isConnected()) throw new Error('Property value storage is unavailable');
				const predicate = [...missing.keys()].map((key) => `propertyId = '${this.escapeTagValue(key)}'`).join(' OR ');
				const query = `
        SELECT *
        FROM property_value
        WHERE (${predicate})
		GROUP BY "propertyId"
		ORDER BY time DESC
		LIMIT ${TREND_POINTS_COUNT}
      `;
				let originalQuery: PropertyReadKey | undefined;
				for (const key of missing.keys()) {
					const observation = keys.get(key);
					if (!observation) throw new Error('Original strict read unavailable');
					observation.backend = this.observeReadKey(key);
					originalQuery ??= observation.backend;
				}
				if (!originalQuery) throw new Error('Original property query unavailable');
				const rows = await originalQuery.queries.queryStrict.call(this.storageService, query);
				for (const [key, group] of missing) {
					const propertyRows = rows.filter((row) => row.propertyId === key);
					for (const entry of group) entry.prepared = this.readRowsState(entry.alias.input, key, propertyRows);
				}
			}
			const results = this.finishBatchRead(entries, keys, false, true);
			return new Map(entries.map((entry) => [entry.alias.id, results.get(entry.index)?.state ?? null]));
		} finally {
			this.closeBatchReadKeys(keys);
			for (const entry of entries) this.closeReadAlias(entry.alias);
		}
	}

	/**
	 * Reconciles a bounded property set against the live cache and cold storage without discarding cache hits when
	 * storage is unavailable. Counts are per logical property; projected properties share one source lookup but retain
	 * separate ordered result items. The optional deadline may tighten, but never extend, the 750 ms response ceiling.
	 */
	async readLatestManyBounded(
		properties: ChannelPropertyEntity[],
		options: BoundedPropertyValueReadOptions = {},
	): Promise<BoundedPropertyValueReadResult> {
		const entries: PropertyBatchEntry[] = [];
		const keys = new Map<string, PropertyBatchKey>();
		try {
			if (properties.length > BOUNDED_READ_MAX_PROPERTIES) throw new RangeError(`At most ${BOUNDED_READ_MAX_PROPERTIES} property values may be read at once`);
			const startedAt = Date.now();
			const requestedDeadlineAt = options.deadlineAt?.getTime() ?? startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS;
			if (!Number.isFinite(requestedDeadlineAt)) throw new RangeError('Property value read deadline must be a valid date');
			const deadlineAt = Math.min(requestedDeadlineAt, startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS);
			const items = new Array<BoundedPropertyValueItem | undefined>(properties.length);
			const unresolved = new Map<string, PropertyBatchEntry[]>();
			let sourceResolutionFailed = false;
			for (const [index, property] of properties.entries()) {
				let alias: PropertyReadAlias;
				try { alias = this.captureReadAlias(property); } catch {
					sourceResolutionFailed = true;
					items[index] = { propertyId: property.id, sourcePropertyId: null, status: 'unprocessed', source: null, state: null };
					continue;
				}
				const entry = { index, alias, cachedAtEntry: this.valuesMap.has(alias.key) };
				entries.push(entry);
				if (!keys.has(alias.key)) keys.set(alias.key, this.beginBatchReadKey(alias.key));
				if (this.overlayReadAlias(alias) || entry.cachedAtEntry) continue;
				const group = unresolved.get(alias.key) ?? [];
				group.push(entry); unresolved.set(alias.key, group);
			}
			const finish = (storageStatus: BoundedPropertyValueStorageStatus): BoundedPropertyValueReadResult => {
				const results = this.finishBatchRead(entries, keys, true, false);
				for (const entry of entries) {
					const result = results.get(entry.index);
					if (!result) throw new Error('Original bounded result unavailable');
					items[entry.index] = result.processed ? this.toBoundedItem(entry.alias.id, entry.alias.key, result.state, result.source) :
						{ propertyId: entry.alias.id, sourcePropertyId: entry.alias.key, status: 'unprocessed', source: null, state: null };
				}
				return this.buildBoundedResult(items, storageStatus);
			};
			if (unresolved.size === 0) return finish(sourceResolutionFailed ? 'failed' : 'not_needed');
			if (Date.now() >= deadlineAt) return finish('timed_out');
			if (!this.storageService.isConnected()) return finish('disconnected');
			const sourceEntries = [...unresolved.entries()];
			let storageStatus: BoundedPropertyValueStorageStatus = sourceResolutionFailed ? 'failed' : 'available';
			for (let offset = 0; offset < sourceEntries.length; offset += BOUNDED_READ_SOURCE_CHUNK_SIZE) {
				if (Date.now() >= deadlineAt) { storageStatus = 'timed_out'; break; }
				const chunk = sourceEntries.slice(offset, offset + BOUNDED_READ_SOURCE_CHUNK_SIZE);
				const query = this.buildBoundedPropertyValueQuery(chunk.map(([key]) => key));
				try {
					let originalQuery: PropertyReadKey | undefined;
					for (const [key] of chunk) {
						const observation = keys.get(key);
						if (!observation) throw new Error('Original bounded read unavailable');
						observation.backend = this.observeReadKey(key);
						originalQuery ??= observation.backend;
					}
					const rows = await this.queryPropertyValuesBeforeDeadline(query, deadlineAt, originalQuery);
					if (rows === null) { storageStatus = 'timed_out'; break; }
					const prepared = chunk.flatMap(([key, group]) => {
						const sourceRows = rows.filter((row) => row.propertyId === key);
						return group.map((entry) => ({ entry, value: this.readRowsState(entry.alias.input, key, sourceRows) }));
					});
					for (const item of prepared) item.entry.prepared = item.value;
				} catch (error) {
					const err = error as Error;
					this.logger.error(`Failed to bounded-batch read latest property values error=${err.message}`, err.stack);
					storageStatus = 'failed'; break;
				}
			}
			return finish(storageStatus);
		} finally {
			this.closeBatchReadKeys(keys);
			for (const entry of entries) this.closeReadAlias(entry.alias);
		}
	}

	private buildBoundedPropertyValueQuery(sourcePropertyIds: ChannelPropertyEntity['id'][]): string {
		const predicate = sourcePropertyIds
			.map((sourcePropertyId) => `propertyId = '${this.escapeTagValue(sourcePropertyId)}'`)
			.join(' OR ');

		return `
	        SELECT *
	        FROM property_value
	        WHERE (${predicate})
			GROUP BY "propertyId"
			ORDER BY time DESC
			LIMIT ${TREND_POINTS_COUNT}
	      `;
	}

	private async queryPropertyValuesBeforeDeadline(
		query: string,
		deadlineAt: number,
		observation: PropertyReadKey | undefined,
	): Promise<PropertyValueRow[] | null> {
		const remainingMs = deadlineAt - Date.now();

		if (remainingMs <= 0) {
			return null;
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(new Error('Property value storage query timed out')),
			remainingMs,
		);

		try {
			if (!observation) throw new Error('Original bounded query unavailable');
			return await observation.queries.queryStrict.call(this.storageService, query, { signal: controller.signal });
		} catch (error) {
			if (controller.signal.aborted) {
				return null;
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	private isStateNewerOrEqual(cached: PropertyValueState, stored: PropertyValueState | null): boolean {
		if (!stored) {
			return true;
		}

		const cachedTime = cached.lastUpdated === null ? null : Date.parse(cached.lastUpdated);
		const storedTime = stored.lastUpdated === null ? null : Date.parse(stored.lastUpdated);

		if (cachedTime === null || Number.isNaN(cachedTime)) {
			return storedTime === null || Number.isNaN(storedTime);
		}
		if (storedTime === null || Number.isNaN(storedTime)) {
			return true;
		}

		return cachedTime >= storedTime;
	}

	private cacheVersion(key: ChannelPropertyEntity['id']): number {
		return this.cacheVersions.get(key) ?? 0;
	}

	private bumpCacheVersion(key: ChannelPropertyEntity['id']): void {
		originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
		this.cacheVersions.set(key, this.cacheVersion(key) + 1);
	}

	private setCachedState(key: ChannelPropertyEntity['id'], state: PropertyValueState, kind: 'reported' | 'historical' | 'owned' = 'reported', lease?: DeviceCreationPublicationLease): void {
		originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
		this.cacheProvenance.set(key, { state, kind, lease });
		this.valuesMap.set(key, state);
		this.bumpCacheVersion(key);
	}

	private resolveBestEffort(property: ChannelPropertyEntity, operation: string): string | null {
		try {
			return this.valueSourceRegistry.resolve(property);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(
				`Failed to resolve property value source during ${operation} id=${property.id} error=${err.message}`,
				err.stack,
			);

			return null;
		}
	}

	private samePersistedState(left: PropertyValueState | null, right: PropertyValueState | null): boolean {
		return left?.value === right?.value && left?.lastUpdated === right?.lastUpdated;
	}

	private withValueLock<T>(
		key: ChannelPropertyEntity['id'],
		operation: (lease: PropertyValueLease) => Promise<T>,
		drainHistory = true,
	): Promise<T> {
		const previous = this.valueTails.get(key) ?? Promise.resolve();
		let release: () => void = () => {};
		const ticket = new Promise<void>((resolve) => {
			release = resolve;
		});
		const tail = previous.then(
			() => ticket,
			() => ticket,
		);
		this.valueTails.set(key, tail);

		const runOperation = (): Promise<T> =>
			this.valueLock.runExclusive(key, async (lease) => {
				if (drainHistory) await this.flushHistory();
				return operation(lease);
			});

		return previous.then(runOperation, runOperation).finally(() => {
			release();
			if (this.valueTails.get(key) === tail) {
				this.valueTails.delete(key);
			}
		});
	}

	private withCreatedValueLock<T>(
		key: string,
		creation: DeviceCreationPublicationLease,
		operation: (lease: PropertyValueLease) => Promise<T>,
	): Promise<T> {
		DeviceCreationPublicationEngine.assert(creation, key);
		const runExclusiveOriginalMethods: Readonly<{ runExclusive: PropertyValueService['valueLock']['runExclusive'] }> =
			this.valueLock;
		const { runExclusive } = runExclusiveOriginalMethods;
		const flushHistoryOriginalMethods = (owner: Readonly<{ flushHistory: PropertyValueService['flushHistory'] }>) =>
			owner;
		const { flushHistory } = flushHistoryOriginalMethods(this);
		const flush: Readonly<{ call: (receiver: PropertyValueService) => Promise<void> }> = flushHistory;
		const run: Readonly<{
			call: (
				receiver: PropertyValueLockService,
				key: string,
				operation: (lease: PropertyValueLease) => Promise<T>,
			) => Promise<T>;
		}> = runExclusive;
		const previous = this.valueTails.get(key) ?? Promise.resolve();
		let release: () => void = () => {};
		const ticket = new Promise<void>((resolve) => {
			release = resolve;
		});
		const tail = previous.then(
			() => ticket,
			() => ticket,
		);
		this.valueTails.set(key, tail);
		const enter = (): Promise<T> => {
			DeviceCreationPublicationEngine.assert(creation, key);
			return run.call(this.valueLock, key, async (lease) => {
				DeviceCreationPublicationEngine.assert(creation, key);
				await flush.call(this);
				DeviceCreationPublicationEngine.assert(creation, key);
				return operation(lease);
			});
		};
		return previous.then(enter, enter).finally(() => {
			release();
			if (this.valueTails.get(key) === tail) this.valueTails.delete(key);
		});
	}


	private toBoundedItem(
		propertyId: ChannelPropertyEntity['id'],
		sourcePropertyId: ChannelPropertyEntity['id'] | null,
		state: PropertyValueState | null,
		source: BoundedPropertyValueSource,
	): BoundedPropertyValueItem {
		if (state === null || state.value === null) {
			return { propertyId, sourcePropertyId, status: 'missing', source, state };
		}

		return {
			propertyId,
			sourcePropertyId,
			status: 'available',
			source,
			state: state as PropertyValueState & { value: string | number | boolean },
		};
	}

	private buildBoundedResult(
		items: Array<BoundedPropertyValueItem | undefined>,
		storageStatus: BoundedPropertyValueStorageStatus,
	): BoundedPropertyValueReadResult {
		const resolvedItems = items.filter((item): item is BoundedPropertyValueItem => item !== undefined);
		const cacheCount = resolvedItems.filter((item) => item.source === 'cache').length;
		const storageCount = resolvedItems.filter((item) => item.source === 'storage').length;
		const missingCount = resolvedItems.filter((item) => item.status === 'missing').length;
		const unprocessedCount = resolvedItems.filter((item) => item.status === 'unprocessed').length;
		const availableCount = resolvedItems.filter((item) => item.status === 'available').length;
		const unknownCount = missingCount + unprocessedCount;
		const freshnessUnknownCount = resolvedItems.filter(
			(item) =>
				item.status === 'available' &&
				(item.state.lastUpdated === null || Number.isNaN(Date.parse(item.state.lastUpdated))),
		).length;
		const timestamps = resolvedItems
			.filter((item) => item.status === 'available' && item.state?.lastUpdated !== null)
			.map((item) => item.state?.lastUpdated)
			.filter((timestamp): timestamp is string => timestamp !== undefined && !Number.isNaN(Date.parse(timestamp)))
			.sort((left, right) => Date.parse(left) - Date.parse(right));

		return {
			items: resolvedItems,
			requestedCount: items.length,
			availableCount,
			unknownCount,
			complete: unknownCount === 0,
			storageStatus,
			cacheCount,
			storageCount,
			missingCount,
			unprocessedCount,
			oldestLastUpdated: timestamps[0] ?? null,
			newestLastUpdated: timestamps[timestamps.length - 1] ?? null,
			freshnessUnknownCount,
		};
	}

	private async readLatestInternal(property: ChannelPropertyEntity, strict: boolean, bypassCache = false, activeBackendOnly = false): Promise<InternalPropertyValueReadResult> {
		let alias: PropertyReadAlias;
		try { alias = this.captureReadAlias(property); } catch (error) { if (strict) throw error; return { state: null }; }
		const key = alias.key;
		let observation: PropertyReadKey | undefined;
		try {
			const cached = this.valuesMap.get(key);
			if (!bypassCache && cached) return { state: this.readCachedData(alias, cached) };
			if (!this.storageService.isConnected()) { if (strict) throw new Error('Property value storage is unavailable'); return { state: null }; }
			const version = this.cacheVersion(key);
			observation = this.observeReadKey(key);
			const query = `
        SELECT * FROM property_value
        WHERE propertyId = '${key}'
        ORDER BY time DESC
        LIMIT ${TREND_POINTS_COUNT}
      `;
			const boundResult = activeBackendOnly ? await observation.queries.queryActiveStrictBound.call(this.storageService, query) : null;
			const rows = boundResult ? boundResult.rows : strict ? await observation.queries.queryStrict.call(this.storageService, query) : await observation.queries.query.call(this.storageService, query);
			const prepared = this.readRowsState(alias.input, key, rows);
			const produced = activeBackendOnly ? this.overlayReadAlias(alias) : null;
			const reported = this.reportedReadState(key);
			const sourceCurrent = alias.current();
			const structuralCurrent = alias.structuralCurrent();
			const backendCurrent = observation.current();
			const unchanged = this.cacheVersion(key) === version;
			const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation.token);
			if (sourceCurrent && structuralCurrent && backendCurrent && unchanged && decision === 'publish' && creationMethodCurrent(DeviceCreationPublicationEngine, 'invalidateIds', propertyReadInvalidate)) this.publishReadState(key, prepared, bypassCache && !rows.length);
			// An explicit bound persisted read is historical data, never refreshed live authority on veto.
			if (activeBackendOnly) return { state: sourceCurrent && structuralCurrent && backendCurrent ? produced ?? prepared.state : prepared.state, storageBinding: boundResult?.binding };
			if (!sourceCurrent || !structuralCurrent || !backendCurrent) return { state: null };
			return { state: unchanged && decision === 'publish' ? prepared.state : reported };
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to read latest value from storage id=${property.id} error=${err.message}`, err.stack);
			if (strict) throw error;
			return { state: null };
		} finally {
			if (observation) originalReadCacheApi.close.call(originalReadCacheApi.receiver, observation.token);
			this.closeReadAlias(alias);
		}
	}

	private toState(property: ChannelPropertyEntity, key: string, latest: PropertyValueRow, trend: PropertyValueTrend | null = this.computeTrend(property, key)): PropertyValueState {
		let parsedValue: string | number | boolean | null;

		switch (property.dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				parsedValue = latest.stringValue ?? null;
				break;
			case DataTypeType.BOOL:
				parsedValue = latest.stringValue != null ? latest.stringValue === 'true' : null;
				break;
			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
				parsedValue = latest.numberValue != null ? Math.round(latest.numberValue) : null;
				break;
			case DataTypeType.FLOAT:
				parsedValue = latest.numberValue ?? null;
				break;
			default:
				parsedValue = null;
		}

		const lastUpdated = latest.time
			? latest.time instanceof Date
				? latest.time.toISOString()
				: String(latest.time)
			: null;

		return new PropertyValueState(parsedValue, lastUpdated, trend);
	}

	private escapeTagValue(value: string): string {
		return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.resolveBestEffort(property, 'delete');
		if (key === null) return;

		return this.withValueLock(key, () => this.deleteInternal(property, key));
	}

	private async deleteInternal(property: ChannelPropertyEntity, key: ChannelPropertyEntity['id']): Promise<void> {
		// A projected property owns no series — the value belongs to its source. Deleting here would
		// destroy the source device's entire history, so bail out before clearing caches or storage.
		if (key !== property.id) {
			return;
		}

		// Always clear local cache
		this.liveEpochs.delete(property.id);
		this.samples.delete(property.id);
		this.liveWatermarks.delete(property.id);
		this.producers?.remove(property.id);
		this.cacheProvenance.delete(property.id);
		this.valuesMap.delete(property.id);
		this.recentValuesMap.delete(property.id);
		this.bumpCacheVersion(property.id);

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM property_value WHERE propertyId = '${property.id}'`;

			await this.storageService.query(query);

			this.logger.log(`Deleted all stored values for id=${property.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to delete property data from storage propertyId=${property.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	async deleteSinceStrict(property: ChannelPropertyEntity, since: Date): Promise<void> {
		DeviceCreationPublicationEngine.invalidateIds([property.id]);
		const key = this.valueSourceRegistry.resolve(property);

		return this.withValueLock(key, () => this.deleteSinceStrictInternal(property, since, key));
	}

	private async deleteSinceStrictInternal(
		property: ChannelPropertyEntity,
		since: Date,
		key: ChannelPropertyEntity['id'],
	): Promise<void> {
		if (key !== property.id) {
			return;
		}
		if (!this.storageService.isConnected()) {
			throw new Error('Property value storage is unavailable');
		}

		originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [key]);
		this.cacheProvenance.delete(key);
		this.valuesMap.delete(key);
		this.recentValuesMap.delete(key);
		this.bumpCacheVersion(key);
		const firstTransientMillisecond = new Date(since.getTime() + 1);
		await this.storageService.queryStrict(
			`DELETE FROM property_value WHERE propertyId = '${this.escapeTagValue(key)}' AND time >= '${firstTransientMillisecond.toISOString()}'`,
		);
	}

	/**
	 * Compute trend direction from recent cached values.
	 * Returns null for non-numeric types or insufficient data.
	 */
	private computeTrend(property: ChannelPropertyEntity, key: string): PropertyValueTrend | null {
		return this.computeTrendFrom(property, this.recentValuesMap.get(key));
	}

	private computeTrendFrom(property: ChannelPropertyEntity, recent: number[] | undefined): PropertyValueTrend | null {
		if (!this.isNumericDataType(property.dataType)) return null;

		if (!recent || recent.length < 2) {
			return null;
		}

		const first = recent[0];
		const last = recent[recent.length - 1];
		const delta = last - first;

		// Compute threshold: 0.5% of range if format provides min/max, else absolute 0.01
		let threshold = 0.01;
		if (property.format && property.format.length >= 2) {
			const min = typeof property.format[0] === 'number' ? property.format[0] : null;
			const max = typeof property.format[1] === 'number' ? property.format[1] : null;
			if (min !== null && max !== null && max > min) {
				threshold = (max - min) * 0.005;
			}
		}

		if (delta > threshold) {
			return 'rising';
		}
		if (delta < -threshold) {
			return 'falling';
		}
		return 'stable';
	}

	/**
	 * Check if a data type is numeric
	 */
	private isNumericDataType(dataType: DataTypeType): boolean {
		return [
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
			DataTypeType.FLOAT,
		].includes(dataType);
	}

	/**
	 * Validate value against property format constraints
	 * @returns error message if invalid, null if valid
	 */
	private validateValue(property: ChannelPropertyEntity, value: string | boolean | number): string | null {
		const { dataType, format } = property;

		// No format constraints defined - allow any value
		if (!format || format.length === 0) {
			return null;
		}

		switch (dataType) {
			case DataTypeType.ENUM:
				// For ENUM, format should be string[] of allowed values
				if (format.every((item): item is string => typeof item === 'string')) {
					const stringValue = String(value);
					if (!format.includes(stringValue)) {
						return `Value "${stringValue}" not in allowed values: [${format.join(', ')}]`;
					}
				}
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT: {
				// For numeric types, format can be [min, max], [min, null], [null, max], or [min]
				const numValue = Number(value);

				if (isNaN(numValue)) {
					return `Value "${value}" is not a valid number`;
				}

				const min = format.length >= 1 && typeof format[0] === 'number' ? format[0] : null;
				const max = format.length >= 2 && typeof format[1] === 'number' ? format[1] : null;

				if (min !== null && numValue < min) {
					return `Value ${numValue} below minimum ${min}`;
				}

				if (max !== null && numValue > max) {
					return `Value ${numValue} above maximum ${max}`;
				}
				break;
			}

			case DataTypeType.STRING:
			case DataTypeType.BOOL:
				// STRING and BOOL don't have format-based validation
				break;

			default:
				// Unknown data type - skip validation
				break;
		}

		return null;
	}

	/**
	 * Check if value matches the property's invalid/sentinel value
	 * Handles string↔number conversion (e.g., -1 as number vs "-1" as string)
	 */
	private isInvalidValue(invalidValue: string | boolean | number, value: string | boolean | number): boolean {
		// Direct equality check
		if (invalidValue === value) {
			return true;
		}

		// Handle string↔number conversion explicitly
		// Avoid loose equality (==) which has unintended side effects:
		// 0 == false, 1 == true, "" == 0, "1" == true all evaluate to true
		if (typeof invalidValue === 'number' && typeof value === 'string') {
			const numValue = Number(value);
			if (!Number.isNaN(numValue) && invalidValue === numValue) {
				return true;
			}
		}

		if (typeof invalidValue === 'string' && typeof value === 'number') {
			const numInvalid = Number(invalidValue);
			if (!Number.isNaN(numInvalid) && numInvalid === value) {
				return true;
			}
		}

		return false;
	}
}
