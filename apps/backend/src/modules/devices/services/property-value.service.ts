import { Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	type ControllerStorageWriteCapture,
	type StorageBackendBinding,
	StorageService,
} from '../../storage/services/storage.service';
import { StoragePoint } from '../../storage/storage.types';
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

import { ControllerPublicationContext, ownControllerEffectValue } from './controller-publication-context';
import {
	PropertyProducerEvaluation,
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from './property-producer.registry.service';
import { PropertyValueLease, PropertyValueLockService } from './property-value-lock.service';
import {
	PropertyReadSourceCapture,
	PropertyValueSourceRegistryService,
} from './property-value-source.registry.service';

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

interface BoundedPropertyValueReadEntry {
	resultVersion?: number;
	capture: PropertyReadSourceCapture;
	input: Readonly<ChannelPropertyEntity>;
	key: string;
	reason: string | null;
}

interface BoundedPropertyValueSourceGroup {
	indexes: number[];
	version: number;
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

interface OwnedPropertyHistory {
	readonly timestamp: Date;
	readonly point: StoragePoint | undefined;
	readonly storage: ControllerStorageWriteCapture;
}

@Injectable()
export class PropertyValueService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueService');

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

	/**
	 * Write property value to storage
	 * @returns true if value changed, false if value was the same or invalid
	 */
	async write(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		valueTimestamp?: Date,
	): Promise<boolean> {
		const publication = ControllerPublicationContext.current();
		if (publication) {
			const input = ownControllerEffectValue(property);
			const timestamp = valueTimestamp ? new Date(valueTimestamp) : undefined;
			const capture = this.valueSourceRegistry.captureReadSource(input);
			try {
				const key = this.valueSourceRegistry.readSourceKey(capture);
				const eligible = () => publication.isEligible() && this.valueSourceRegistry.isReadSourceCurrent(capture);
				return (
					await ControllerPublicationContext.effect('property.value', () => {
						const fields = this.storageFields(input.dataType, value);
						const pointTimestamp = timestamp ?? new Date();
						const point = fields
							? {
									measurement: 'property_value',
									tags: { propertyId: key },
									fields,
									timestamp: pointTimestamp,
								}
							: undefined;
						const history: OwnedPropertyHistory = {
							timestamp: pointTimestamp,
							point,
							storage: this.storageService.captureControllerWrite(point ? [point] : []),
						};
						return this.withValueLock(key, () =>
							this.writeInternal(input, key, value, false, undefined, timestamp, false, false, eligible, history),
						);
					})
				).changed;
			} finally {
				this.valueSourceRegistry.closeReadSource(capture);
			}
		}
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
		return this.overlaySource(produced, reason, state);
	}

	private overlaySource(
		produced: PropertyValueState | null | undefined,
		reason: string | null,
		state: PropertyValueState | null,
	): PropertyValueState | null {
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

	private storageFields(
		dataType: DataTypeType,
		value: string | boolean | number | null,
	): { stringValue?: string; numberValue?: number } | undefined {
		switch (dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				return { stringValue: String(value) };
			case DataTypeType.BOOL:
				return { stringValue: String(value ? 'true' : 'false') };
			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT:
				return { numberValue: Number(value) };
			default:
				return undefined;
		}
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
		ownedCurrent?: () => boolean,
		ownedHistory?: OwnedPropertyHistory,
	): Promise<PropertyValueWriteResult> {
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

		const cached = this.valuesMap.get(key);
		if (!strict && cached && cached.value === value) {
			if (ownedCurrent && !ownedCurrent()) return { changed: false, state: clonePropertyValueState(cached) };
			// no change → skip storage write, but refresh lastUpdated so freshness stays accurate
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

		const formattedValue = ownedHistory ? ownedHistory.point?.fields : this.storageFields(property.dataType, value);
		if (!formattedValue) {
			this.logger.error(`Unsupported data type dataType=${property.dataType} id=${property.id}`);
			return { changed: false, state: null };
		}

		const timestamp = ownedHistory?.timestamp ?? valueTimestamp ?? new Date();
		const now = timestamp.toISOString();
		const point = ownedHistory?.point ?? {
			measurement: 'property_value',
			tags: { propertyId: key },
			fields: formattedValue,
			timestamp,
		};

		const cacheVersionAtWriteStart = this.cacheVersion(key);

		if (strict) {
			await this.storageService.writePointsStrict([point], storageBinding);

			if (this.cacheVersion(key) !== cacheVersionAtWriteStart || (ownedCurrent && !ownedCurrent())) {
				return { changed: true, state: new PropertyValueState(value, now) };
			}
		}

		// Update recent values cache for trend computation
		if (
			(!ownedCurrent || ownedCurrent()) &&
			(typeof value === 'number' ||
				(typeof value === 'string' && !isNaN(Number(value)) && this.isNumericDataType(property.dataType)))
		) {
			const numValue = Number(value);
			const recent = this.recentValuesMap.get(key) ?? [];
			recent.push(numValue);
			if (recent.length > TREND_POINTS_COUNT) {
				recent.shift();
			}
			this.recentValuesMap.set(key, recent);
		}

		const trend = this.computeTrend(property, key);
		const state = new PropertyValueState(value, now, trend);

		// Update local cache regardless of storage availability
		if (!ownedCurrent || ownedCurrent()) this.setCachedState(key, state);

		if (strict) {
			return { changed: true, state };
		}

		if (!(ownedHistory ? ownedHistory.storage.connection() : this.storageService.isConnected())) {
			return { changed: true, state }; // Value changed in cache
		}

		try {
			if (deferHistory) {
				await this.storageService.enqueueWritePoint(point);
			} else if (ownedHistory) {
				await ownedHistory.storage.write();
			} else {
				await this.storageService.writePoints([point]);
			}

			this.logger.debug(`Value ${deferHistory ? 'queued' : 'saved'} id=${property.id} dataType=${property.dataType}`);
		} catch (error) {
			if (ownedHistory) {
				try {
					const message = error instanceof Error ? error.message : String(error);
					this.logger.error(`Failed to write original property history id=${property.id} error=${message}`);
				} catch {
					// Optional diagnostics cannot turn best-effort history into a new failure.
				}
				return { changed: true, state };
			}
			const err = error as Error;

			this.logger.error(
				`Failed to write value to storage id=${property.id} dataType=${property.dataType} error=${err.message}`,
				err.stack,
			);
		}

		return { changed: true, state }; // Value changed
	}

	async readLatest(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		return (await this.readSingleProperty(property, false)).state;
	}

	async readLatestStrict(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		return (await this.readSingleProperty(property, true)).state;
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
		const result = await this.readSingleProperty(property, true, true);
		if (!result.storageBinding) {
			throw new Error('Persisted property value read did not bind a storage backend');
		}
		return { state: result.state, storageBinding: result.storageBinding };
	}

	/** One issued single-property read, including history drain and error fallback. */
	private async readSingleProperty(
		property: ChannelPropertyEntity,
		strict: boolean,
		persisted = false,
	): Promise<InternalPropertyValueReadResult> {
		let capture: PropertyReadSourceCapture;
		try {
			capture = this.valueSourceRegistry.captureReadSource(property);
		} catch (error) {
			if (strict) throw error;
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to capture property value source error=${err.message}`, err.stack);
			return { state: null };
		}
		try {
			const input = this.valueSourceRegistry.readSourceInput(capture);
			const key = this.valueSourceRegistry.readSourceKey(capture);
			const reason = this.valueSourceRegistry.readSourceUnavailableReason(capture);
			const overlay = (state: PropertyValueState | null) => {
				this.assertReadSourceCurrent(capture);
				return this.overlaySource(this.producers?.read(key), reason, state);
			};
			if (!persisted) {
				const produced = overlay(null);
				if (produced) return { state: produced };
			}
			try {
				// Only history already admitted at this boundary must be visible. Later
				// writes stay concurrent and retain the existing cache-version fence.
				if (persisted) {
					await this.flushHistory();
					this.assertReadSourceCurrent(capture);
				}
				const result = await this.readLatestInternal(input, strict, persisted, persisted, capture);
				return { ...result, state: overlay(result.state) };
			} catch (error) {
				// A replacement route cannot supply fallback for the original request.
				// Never replace the primary rejection (including falsy thrown values).
				try {
					if (!persisted && this.valueSourceRegistry.isReadSourceCurrent(capture)) {
						const produced = overlay(null);
						if (produced) return { state: produced };
					}
				} catch {
					// Failed fallback must preserve the original storage rejection.
				}
				throw error;
			}
		} catch (error) {
			if (strict) throw error;
			return { state: null };
		} finally {
			this.valueSourceRegistry.closeReadSource(capture);
		}
	}

	private assertReadSourceCurrent(capture: PropertyReadSourceCapture): void {
		if (!this.valueSourceRegistry.isReadSourceCurrent(capture)) {
			throw new Error('Property value source changed during read');
		}
	}

	async readLatestManyStrict(
		properties: ChannelPropertyEntity[],
	): Promise<Map<ChannelPropertyEntity['id'], PropertyValueState | null>> {
		const captures: PropertyReadSourceCapture[] = [];
		try {
			// Keep every requested route, even when several projections share a series.
			// Capture all inputs before consulting cache/producer state or awaiting storage.
			const entries = properties.map((property) => {
				const capture = this.valueSourceRegistry.captureReadSource(property);
				captures.push(capture);
				return {
					capture,
					input: this.valueSourceRegistry.readSourceInput(capture),
					key: this.valueSourceRegistry.readSourceKey(capture),
					reason: this.valueSourceRegistry.readSourceUnavailableReason(capture),
				};
			});
			const overlay = (entry: (typeof entries)[number], state: PropertyValueState | null) => {
				this.assertReadSourceCurrent(entry.capture);
				return this.overlaySource(this.producers?.read(entry.key), entry.reason, state);
			};
			const cachedStates = new Map<PropertyReadSourceCapture, PropertyValueState>();
			const missingByKey = new Map<ChannelPropertyEntity['id'], (typeof entries)[number]>();
			const versions = new Map<ChannelPropertyEntity['id'], number>();
			for (const entry of entries) {
				const state = overlay(entry, null) ?? this.valuesMap.get(entry.key);
				if (state) {
					cachedStates.set(entry.capture, state);
				} else if (!missingByKey.has(entry.key)) {
					missingByKey.set(entry.key, entry);
					versions.set(entry.key, this.cacheVersion(entry.key));
				}
			}

			const rowsByKey = new Map<ChannelPropertyEntity['id'], PropertyValueRow[]>();
			if (missingByKey.size > 0) {
				if (!this.storageService.isConnected()) {
					throw new Error('Property value storage is unavailable');
				}
				const query = this.buildBoundedPropertyValueQuery([...missingByKey.keys()]);
				const rows = await this.storageService.queryStrict<PropertyValueRow>(query);
				for (const row of rows) {
					rowsByKey.set(row.propertyId, [...(rowsByKey.get(row.propertyId) ?? []), row]);
				}
			}

			// Strict batches fail as a whole. Check cached/produced routes too, before
			// admitting any queried series or trend into shared cache.
			for (const entry of entries) this.assertReadSourceCurrent(entry.capture);
			const admitted = new Set<ChannelPropertyEntity['id']>();
			for (const [key, entry] of missingByKey) {
				if (this.cacheVersion(key) !== versions.get(key)) continue;
				const propertyRows = rowsByKey.get(key) ?? [];
				admitted.add(key);
				this.updateRecentValuesFromRows(entry.input, key, propertyRows);
				if (propertyRows[0]) {
					this.setCachedState(key, this.toState(entry.input, key, propertyRows[0]));
				}
			}

			const states = new Map<ChannelPropertyEntity['id'], PropertyValueState | null>();
			for (const entry of entries) {
				const row = rowsByKey.get(entry.key)?.[0];
				// Conversion belongs to the requested projection's captured input.
				// A later write still wins over queried rows for both cache and result.
				const state =
					cachedStates.get(entry.capture) ??
					(row && admitted.has(entry.key)
						? this.toState(entry.input, entry.key, row)
						: (this.valuesMap.get(entry.key) ?? null));
				states.set(entry.input.id, overlay(entry, state));
			}
			return states;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to batch read latest property values from storage error=${err.message}`, err.stack);
			throw error;
		} finally {
			for (const capture of captures) this.valueSourceRegistry.closeReadSource(capture);
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
		if (properties.length > BOUNDED_READ_MAX_PROPERTIES) {
			throw new RangeError(`At most ${BOUNDED_READ_MAX_PROPERTIES} property values may be read at once`);
		}

		const startedAt = Date.now();
		const requestedDeadlineAt = options.deadlineAt?.getTime() ?? startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS;

		if (!Number.isFinite(requestedDeadlineAt)) {
			throw new RangeError('Property value read deadline must be a valid date');
		}

		const deadlineAt = Math.min(requestedDeadlineAt, startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS);

		const items = new Array<BoundedPropertyValueItem | undefined>(properties.length);
		const captures: PropertyReadSourceCapture[] = [];
		const entries: Array<BoundedPropertyValueReadEntry | undefined> = [];
		const unresolvedBySource = new Map<string, BoundedPropertyValueSourceGroup>();
		let sourceResolutionFailed = false;
		try {
			// Capture every logical route before any cache/producer work, including duplicates.
			for (const [index, property] of properties.entries()) {
				// Preserve a safe logical ID even if the provider changes it during capture.
				let id: unknown = '';
				try {
					id = Object.getOwnPropertyDescriptor(property, 'id')?.value;
					const capture = this.valueSourceRegistry.captureReadSource(property);
					captures.push(capture);
					entries[index] = {
						capture,
						input: this.valueSourceRegistry.readSourceInput(capture),
						key: this.valueSourceRegistry.readSourceKey(capture),
						reason: this.valueSourceRegistry.readSourceUnavailableReason(capture),
					};
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					this.logger.error(`Failed to capture bounded property value source error=${err.message}`, err.stack);
					sourceResolutionFailed = true;
					// A refused accessor must not execute even to construct diagnostics/results.
					items[index] = {
						propertyId: typeof id === 'string' ? id : '',
						sourcePropertyId: null,
						status: 'unprocessed',
						source: null,
						state: null,
					};
				}
			}
			for (const [index, entry] of entries.entries()) {
				if (!entry || !this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) continue;
				const produced = this.overlaySource(this.producers?.read(entry.key), entry.reason, null);
				if (!this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) continue;
				const state = produced ?? this.valuesMap.get(entry.key);
				if (state) {
					items[index] = this.toBoundedItem(entry.input.id, entry.key, state, 'cache');
					entry.resultVersion = this.cacheVersion(entry.key);
					continue;
				}
				const group = unresolvedBySource.get(entry.key);
				if (group) group.indexes.push(index);
				else unresolvedBySource.set(entry.key, { indexes: [index], version: this.cacheVersion(entry.key) });
			}
			const finish = (status: BoundedPropertyValueStorageStatus) => {
				this.refreshBoundedItemsFromCache(items, entries);
				this.overlayBoundedItems(items, entries);
				return this.buildBoundedResult(items, status);
			};
			if (unresolvedBySource.size === 0) return finish(sourceResolutionFailed ? 'failed' : 'not_needed');
			if (Date.now() >= deadlineAt) return finish('timed_out');
			if (!this.storageService.isConnected()) return finish('disconnected');

			const sourceEntries = [...unresolvedBySource.entries()];
			let storageStatus: BoundedPropertyValueStorageStatus = sourceResolutionFailed ? 'failed' : 'available';
			for (let offset = 0; offset < sourceEntries.length; offset += BOUNDED_READ_SOURCE_CHUNK_SIZE) {
				if (Date.now() >= deadlineAt) {
					storageStatus = 'timed_out';
					break;
				}
				const chunk = sourceEntries.slice(offset, offset + BOUNDED_READ_SOURCE_CHUNK_SIZE);
				const query = this.buildBoundedPropertyValueQuery(chunk.map(([key]) => key));
				try {
					const rows = await this.queryPropertyValuesBeforeDeadline(query, deadlineAt);
					if (rows === null) {
						storageStatus = 'timed_out';
						break;
					}
					this.applyBoundedStorageRows(items, entries, chunk, rows);
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					this.logger.error(`Failed to bounded-batch read latest property values error=${err.message}`, err.stack);
					storageStatus = 'failed';
					break;
				}
			}
			return finish(storageStatus);
		} finally {
			for (const capture of captures) this.valueSourceRegistry.closeReadSource(capture);
		}
	}

	private overlayBoundedItems(
		items: Array<BoundedPropertyValueItem | undefined>,
		entries: Array<BoundedPropertyValueReadEntry | undefined>,
	): void {
		for (const [index, entry] of entries.entries()) {
			if (!entry) continue;
			// Stale routes are unprocessed, never a completed storage miss or successor value.
			// Storage status still describes the attempt; valid siblings retain partial success.
			if (!this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) {
				items[index] = undefined;
			} else {
				const produced = this.overlaySource(this.producers?.read(entry.key), entry.reason, null);
				if (!this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) items[index] = undefined;
				else if (produced)
					items[index] = this.toBoundedItem(entry.input.id, entry.key, produced, items[index]?.source ?? 'cache');
			}
		}
		// Producer callbacks above may invalidate an earlier route. Finish all provider
		// checks before the final structural pass, which dispatches no provider methods.
		for (const [index, entry] of entries.entries()) {
			if (entry && !this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) items[index] = undefined;
		}
		for (const [index, entry] of entries.entries()) {
			if (!entry) continue;
			if (!this.valueSourceRegistry.isReadSourceStructurallyCurrent(entry.capture)) items[index] = undefined;
			items[index] ??= {
				propertyId: entry.input.id,
				sourcePropertyId: entry.key,
				status: 'unprocessed',
				source: null,
				state: null,
			};
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
	): Promise<PropertyValueRow[] | null> {
		const remainingMs = deadlineAt - Date.now();

		if (remainingMs <= 0) {
			return null;
		}

		const controller = new AbortController();
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const expired = (): null => {
			controller.abort(new Error('Property value storage query timed out'));
			return null;
		};
		try {
			// Abort is advisory to plugins. Bound the response even if the issued backend
			// ignores it; Promise.race also observes late rejections without admitting rows.
			const deadline = new Promise<null>((resolve) => {
				timeout = setTimeout(() => resolve(expired()), remainingMs);
			});
			const result = await Promise.race([
				this.storageService.queryStrict<PropertyValueRow>(query, { signal: controller.signal }),
				deadline,
			]);
			return Date.now() >= deadlineAt ? expired() : result;
		} catch (error) {
			if (Date.now() >= deadlineAt || controller.signal.aborted) return expired();
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	private applyBoundedStorageRows(
		items: Array<BoundedPropertyValueItem | undefined>,
		entries: Array<BoundedPropertyValueReadEntry | undefined>,
		chunk: Array<[string, BoundedPropertyValueSourceGroup]>,
		rows: PropertyValueRow[],
	): void {
		const rowsBySource = new Map<string, PropertyValueRow[]>();
		for (const row of rows) rowsBySource.set(row.propertyId, [...(rowsBySource.get(row.propertyId) ?? []), row]);
		for (const [key, group] of chunk) {
			const currentEntries = group.indexes.flatMap((index) => {
				const entry = entries[index];
				return entry && this.valueSourceRegistry.isReadSourceCurrent(entry.capture) ? [{ index, entry }] : [];
			});
			// Group checks can invalidate an earlier member. The selected representative's
			// full check is the last provider dispatch before shared cache/trend writes.
			const representative = currentEntries.find(({ entry }) =>
				this.valueSourceRegistry.isReadSourceCurrent(entry.capture),
			)?.entry;
			if (!representative) continue;
			const sourceRows = rowsBySource.get(key) ?? [];
			const firstRow = sourceRows[0];
			const storedState = firstRow ? this.toState(representative.input, key, firstRow) : null;
			const cached = this.valuesMap.get(key);
			const changed = this.cacheVersion(key) !== group.version;
			const useCache = changed || (cached !== undefined && this.isStateNewerOrEqual(cached, storedState));
			if (!useCache) {
				this.updateRecentValuesFromRows(representative.input, key, sourceRows);
				if (firstRow) this.setCachedState(key, this.toState(representative.input, key, firstRow));
			}
			for (const { index, entry } of currentEntries) {
				// A deletion during the query cannot be resurrected by its old result.
				if (changed && !cached) continue;
				const state = useCache ? (cached ?? null) : firstRow ? this.toState(entry.input, key, firstRow) : null;
				items[index] = this.toBoundedItem(entry.input.id, key, state, useCache ? 'cache' : 'storage');
				entry.resultVersion = this.cacheVersion(key);
			}
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
		this.cacheVersions.set(key, this.cacheVersion(key) + 1);
	}

	private setCachedState(key: ChannelPropertyEntity['id'], state: PropertyValueState): void {
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

	private updateRecentValuesFromRows(
		property: ChannelPropertyEntity,
		sourcePropertyId: ChannelPropertyEntity['id'],
		rows: PropertyValueRow[],
	): void {
		if (!this.isNumericDataType(property.dataType)) {
			return;
		}

		this.recentValuesMap.set(
			sourcePropertyId,
			rows
				.map((row) => row.numberValue)
				.filter((value): value is number => value !== undefined)
				.reverse(),
		);
	}

	private toBoundedItem(
		propertyId: ChannelPropertyEntity['id'],
		sourcePropertyId: ChannelPropertyEntity['id'],
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

	private refreshBoundedItemsFromCache(
		items: Array<BoundedPropertyValueItem | undefined>,
		entries: Array<BoundedPropertyValueReadEntry | undefined>,
	): void {
		for (const [index, entry] of entries.entries()) {
			if (!entry || !this.valueSourceRegistry.isReadSourceCurrent(entry.capture)) continue;
			const cached = this.valuesMap.get(entry.key);
			const current = items[index];
			if (entry.resultVersion !== undefined && this.cacheVersion(entry.key) !== entry.resultVersion) {
				items[index] = cached ? this.toBoundedItem(entry.input.id, entry.key, cached, 'cache') : undefined;
				continue;
			}
			if (!cached || current?.state === cached) continue;
			// Preserve each cold projection's own conversion at the same observation.
			if (current?.state && this.isStateNewerOrEqual(current.state, cached)) continue;
			items[index] = this.toBoundedItem(entry.input.id, entry.key, cached, 'cache');
		}
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

	private async readLatestInternal(
		property: ChannelPropertyEntity,
		strict: boolean,
		bypassCache = false,
		activeBackendOnly = false,
		capture?: PropertyReadSourceCapture,
	): Promise<InternalPropertyValueReadResult> {
		const publication = ControllerPublicationContext.current();
		const health = publication ? this.storageService.captureControllerReadHealth() : null;
		let key: string;
		try {
			if (capture) this.assertReadSourceCurrent(capture);
			key = capture ? this.valueSourceRegistry.readSourceKey(capture) : this.valueSourceRegistry.resolve(property);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to resolve property value source id=${property.id} error=${err.message}`, err.stack);
			if (strict) throw error;
			return { state: null };
		}
		const cacheVersionAtQueryStart = this.cacheVersion(key);

		// Check local cache first
		const cached = this.valuesMap.get(key);
		if (!bypassCache && cached) {
			this.logger.debug(`Loaded cached value for property id=${property.id}, value=${cached.value}`);

			return { state: cached };
		}

		// Return null if storage not connected
		if (!this.storageService.isConnected()) {
			if (strict) {
				throw new Error('Property value storage is unavailable');
			}

			return { state: null };
		}

		try {
			const query = `
        SELECT * FROM property_value
        WHERE propertyId = '${key}'
        ORDER BY time DESC
        LIMIT ${TREND_POINTS_COUNT}
      `;

			this.logger.debug(`Fetching latest value id=${property.id}`);

			const boundResult = activeBackendOnly
				? await this.storageService.queryActiveStrictBound<PropertyValueRow>(query)
				: null;
			const result = boundResult
				? boundResult.rows
				: strict
					? await this.storageService.queryStrict<PropertyValueRow>(query)
					: await this.storageService.query<PropertyValueRow>(query);

			// Admit neither rows nor empty-result invalidations after routing changed.
			if (capture) this.assertReadSourceCurrent(capture);
			if (publication && (!publication.isEligible() || !health())) {
				const current = this.valuesMap.get(key);
				return { state: current ? clonePropertyValueState(current) : null, storageBinding: boundResult?.binding };
			}

			if (!result.length) {
				this.logger.debug(`No stored value found for id=${property.id}`);
				if (bypassCache && this.cacheVersion(key) === cacheVersionAtQueryStart) {
					this.valuesMap.delete(key);
					this.recentValuesMap.delete(key);
					this.bumpCacheVersion(key);
				}

				return { state: null, storageBinding: boundResult?.binding };
			}

			// Results are ordered DESC, so first = latest
			const latest = result[0];

			const cacheUnchanged = this.cacheVersion(key) === cacheVersionAtQueryStart;

			if (cacheUnchanged) {
				// Build recent values cache from query results (for trend computation)
				if (this.isNumericDataType(property.dataType) && result.length >= 1) {
					// Results are DESC, reverse to get ASC order for trend
					const recentValues: number[] = [];
					for (let i = result.length - 1; i >= 0; i--) {
						const val = result[i].numberValue;
						if (val != null) {
							recentValues.push(val);
						}
					}
					this.recentValuesMap.set(key, recentValues);
				}
			}

			const state = this.toState(property, key, latest);

			this.logger.debug(`Read latest value id=${property.id} dataType=${property.dataType} value=${state.value}`);

			if (cacheUnchanged) {
				this.setCachedState(key, state);
			}

			return { state, storageBinding: boundResult?.binding };
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));

			this.logger.error(`Failed to read latest value from storage id=${property.id} error=${err.message}`, err.stack);
			if (strict) {
				throw error;
			}

			return { state: null };
		}
	}

	private toState(property: ChannelPropertyEntity, key: string, latest: PropertyValueRow): PropertyValueState {
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

		return new PropertyValueState(parsedValue, lastUpdated, this.computeTrend(property, key));
	}

	private escapeTagValue(value: string): string {
		return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
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
		if (!this.isNumericDataType(property.dataType)) {
			return null;
		}

		const recent = this.recentValuesMap.get(key);
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
