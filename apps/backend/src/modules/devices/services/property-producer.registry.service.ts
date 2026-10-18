import { instanceToInstance } from 'class-transformer';

import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { DerivedPropertyPublication, IncorporatedPropertySample } from '../models/property-sample.model';
import {
	PropertyProducerState,
	PropertyValueState,
	clonePropertyValueState,
} from '../models/property-value-state.model';
import { resolvePropertyUnit } from '../utils/property-metadata.utils';

export interface PropertyProducerLease {
	readonly propertyId: string;
	readonly revision: number;
}

export interface PropertyProducerEvaluation {
	readonly epoch: number;
	readonly generation: number;
}

export interface PropertyProducerGuard {
	/** Lifecycle authority captured when a producer lease is installed. */
	readonly isCurrent: () => boolean;
	/** Unavailability reason exposed when the captured lifecycle closes. */
	readonly reason: string;
}

interface ProducerEntry {
	owner?: OwnedPublisherRecord;
	mask?: boolean;
	property: ChannelPropertyEntity;
	lease: PropertyProducerLease;
	state: PropertyValueState;
	epoch: number;
	generation: number;
	sourceSample?: IncorporatedPropertySample;
	sourceSamples?: readonly IncorporatedPropertySample[];
	publication: number;
	guard?: PropertyProducerGuard;
}

/** Data-descriptor inspection only: never invoke a replaced method getter. Trusted class/prototypes, not Proxies. */
export function ownedProducerMethodCurrent(receiver: object, key: string, original: unknown): boolean {
	let current: object | null = receiver;
	while (current) {
		const descriptor = Object.getOwnPropertyDescriptor(current, key);
		if (descriptor)
			return descriptor.get === undefined && descriptor.set === undefined && descriptor.value === original;
		const parent: unknown = Object.getPrototypeOf(current);
		current = typeof parent === 'object' && parent !== null ? parent : null;
	}
	return false;
}
type OwnedProducerMethods = Pick<
	PropertyProducerRegistryService,
	| 'acquireOwnedPublisher'
	| 'isOwnedPublisherCurrent'
	| 'disposeOwnedPublisher'
	| 'readOwnedView'
	| 'owns'
	| 'isCurrent'
	| 'invalidateObservedId'
	| 'ownedPropertyIds'
	| 'retiredSameKeyPropertyIds'
	| 'beginObservedBatch'
	| 'captureExpectedSlot'
	| 'isObservedBatchCurrent'
	| 'prepareOwnedBatch'
	| 'validatePreparedBatch'
	| 'installPreparedNoEvents'
	| 'isInstalledBatchCurrent'
	| 'ownedNotificationCount'
	| 'notifyInstalled'
	| 'readInstalledReport'
	| 'closeObservedBatch'
	| 'finishPublication'
	| 'isOwnedEngineCurrent'
>;
/** Erased view of the SAME callable object and native call property; no wrapper or rebinding. */
export type OwnedReceiverFunction<Receiver, Args extends unknown[], Result> = {
	(...args: Args): Result;
	readonly call: (receiver: Receiver, ...args: Args) => Result;
};
export type OwnedProducerEngine = {
	readonly [K in keyof OwnedProducerMethods]: OwnedReceiverFunction<
		PropertyProducerRegistryService,
		Parameters<OwnedProducerMethods[K]>,
		ReturnType<OwnedProducerMethods[K]>
	>;
};
type OwnedProducerMethodReferences = {
	readonly [K in keyof OwnedProducerEngine]: (
		...args: Parameters<OwnedProducerEngine[K]>
	) => ReturnType<OwnedProducerEngine[K]>;
};
export class OwnedProducerPublisher {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class ExpectedProducerSlot {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class ObservedProducerBatch {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class PreparedProducerBatch {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export interface OwnedProducerView {
	readonly revision: number;
	readonly configurationRevisions: readonly Readonly<{ propertyId: string; revision: number }>[];
	readonly quarantineLeases: readonly Readonly<{ propertyId: string; lease: PropertyProducerLease }>[];
}
export type OwnedProducerOperation = Readonly<{ expected: ExpectedProducerSlot }> &
	(
		| Readonly<{ kind: 'retain'; propertyId: string }>
		| Readonly<{
				kind: 'fallback-unavailable';
				propertyId: string;
				property: ChannelPropertyEntity;
				revision: number;
				reason: 'runtime_unavailable';
		  }>
		| Readonly<{
				kind: 'replace-retired-unavailable';
				propertyId: string;
				property: ChannelPropertyEntity;
				revision: number;
				reason: 'runtime_unavailable';
		  }>
		| Readonly<{
				kind: 'unavailable';
				propertyId: string;
				property: ChannelPropertyEntity;
				revision: number;
				reason: 'runtime_unavailable' | 'graph_quarantined';
		  }>
		| Readonly<{ kind: 'retire-alias-mask'; propertyId: string; property: ChannelPropertyEntity }>
		| Readonly<{ kind: 'retire-deleted-owned-overlay'; propertyId: string }>
	);
export interface OwnedProducerPlan {
	readonly revision: number;
	readonly configurationRevisions: readonly Readonly<{ propertyId: string; revision: number }>[];
	readonly operations: readonly OwnedProducerOperation[];
}
export type OwnedPublicationTerminal =
	| 'prepared'
	| 'installed'
	| 'complete'
	| 'superseded'
	| 'notification_rejected'
	| 'preinstall_refused'
	| 'legacy_rejected'
	| 'activation_rejected';
export interface OwnedPublicationReport {
	readonly installed: boolean;
	readonly attempted: number;
	readonly completed: number;
	readonly terminal: OwnedPublicationTerminal;
}
interface OwnedPublisherRecord {
	active: boolean;
	readonly key: string;
	readonly events: EventEmitter2;
	readonly emit: EventEmitter2['emit'];
	view: OwnedProducerView;
	readonly emptyView: OwnedProducerView;
	readonly batches: Set<ObservedBatchRecord>;
}
interface ProducerObservation {
	readonly token: ExpectedProducerSlot;
	readonly entry: ProducerEntry | undefined;
	readonly lease: PropertyProducerLease | undefined;
}
interface ObservedBatchRecord {
	readonly owner: OwnedPublisherRecord;
	view: OwnedProducerView;
	observations: ReadonlyMap<string, ProducerObservation>;
	readonly guard: PropertyProducerGuard;
	open: boolean;
	dirty: boolean;
	prepared?: PreparedProducerBatch;
}
interface PreparedBatchRecord {
	readonly batch: ObservedBatchRecord;
	readonly writes: readonly Readonly<{ propertyId: string; entry: ProducerEntry | undefined }>[];
	readonly retiredSources: readonly Readonly<{ propertyId: string; observation: ProducerObservation }>[];
	readonly fallbackSources: readonly Readonly<{ propertyId: string; observation: ProducerObservation }>[];
	readonly anchors: ReadonlyMap<string, ProducerObservation>;
	readonly view: OwnedProducerView;
	readonly notifications: readonly Readonly<{
		batch: ObservedBatchRecord;
		emitter: EventEmitter2 | undefined;
		emit: EventEmitter2['emit'] | undefined;
		kind: EventType;
		snapshot: ChannelPropertyEntity;
	}>[];
	readonly report: { installed: boolean; attempted: number; completed: number; terminal: OwnedPublicationTerminal };
	nextNotification: number;
}

/** Opaque read-only evidence. Never a producer, publisher or write capability. */
export class CreationProducerObservation {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
interface CreationProducerObservationRecord {
	active: boolean;
	readonly slots: Map<string, Readonly<{ entry: ProducerEntry | undefined; lease: PropertyProducerLease | undefined }>>;
}

/** Owns process-local live authority. Persisted history is never restart evidence. */
@Injectable()
export class PropertyProducerRegistryService implements OnModuleInit, OnModuleDestroy {
	private notifying?: PreparedBatchRecord['notifications'][number];
	private destroyed = false;
	private readonly ownedPublishers = new Map<string, OwnedPublisherRecord>();
	private readonly publishers = new WeakMap<OwnedProducerPublisher, OwnedPublisherRecord>();
	private readonly observations = new WeakMap<ObservedProducerBatch, ObservedBatchRecord>();
	private readonly prepared = new WeakMap<PreparedProducerBatch, PreparedBatchRecord>();
	private readonly observingIds = new Map<string, Set<ObservedBatchRecord>>();
	private readonly creationObservations = new WeakMap<CreationProducerObservation, CreationProducerObservationRecord>();
	private readonly creationObservingIds = new Map<string, Set<CreationProducerObservationRecord>>();
	private readonly entries = new Map<string, ProducerEntry>();
	private timer: NodeJS.Timeout | null = null;
	private publicationSequence = 0;
	private evidenceValidator?: (sources: readonly IncorporatedPropertySample[]) => boolean;

	setEvidenceValidator(validator: (sources: readonly IncorporatedPropertySample[]) => boolean): void {
		if (this.evidenceValidator !== validator) {
			for (const records of this.creationObservingIds.values())
				for (const record of records) this.closeCreationRecord(record);
			for (const [id, batches] of this.observingIds) {
				if (batches.size) this.dirtyObserved(id);
			}
		}
		this.evidenceValidator = validator;
	}

	readIncorporatedSamples(propertyId: string): readonly IncorporatedPropertySample[] | null {
		const entry = this.entries.get(propertyId);
		return entry?.sourceSamples ?? (entry?.sourceSample ? [entry.sourceSample] : null);
	}

	captureEvidence(propertyId: string): IncorporatedPropertySample | null {
		const state = this.read(propertyId);
		const entry = this.entries.get(propertyId);
		const sources = this.readIncorporatedSamples(propertyId);
		if (!entry || !sources?.length || state?.producer.quality !== 'good') return null;
		return Object.freeze({
			propertyId,
			acceptanceGeneration: 0,
			producer: Object.freeze({
				lease: entry.lease,
				publication: entry.publication,
				revision: entry.lease.revision,
				expiresAt: Date.parse(state.producer.expiresAt),
				quality: 'good' as const,
			}),
			sources,
		});
	}

	isPublicationCurrent(evidence: IncorporatedPropertySample): boolean {
		const entry = this.entries.get(evidence.propertyId);
		return (
			!!entry &&
			entry.lease === evidence.producer?.lease &&
			entry.publication === evidence.producer.publication &&
			entry.lease.revision === evidence.producer.revision &&
			entry.guard?.isCurrent() !== false &&
			entry.state.producer.quality === evidence.producer.quality &&
			Date.parse(entry.state.producer.evaluatedAt) <= Date.now() &&
			Date.parse(entry.state.producer.expiresAt) === evidence.producer.expiresAt &&
			evidence.producer.expiresAt > Date.now()
		);
	}

	private evidenceCurrent(publication: Pick<DerivedPropertyPublication, 'sourceSample' | 'sourceSamples'>): boolean {
		if (publication.sourceSample && publication.sourceSamples) return false;
		const sources = publication.sourceSamples ?? (publication.sourceSample ? [publication.sourceSample] : undefined);
		return !sources || (!!this.evidenceValidator && this.evidenceValidator(sources));
	}
	private readonly refreshPropertyMetadata = (property: ChannelPropertyEntity): void => {
		const entry = this.entries.get(property.id);
		const notification = this.notifying;
		if (notification?.snapshot === property) {
			// A prior listener may have installed B during THIS event. Never rehydrate B with A's snapshot.
			if (!this.batchCurrent(notification.batch)) return;
			if (notification.kind === EventType.CHANNEL_PROPERTY_UPDATED && !entry) return;
		}
		if (entry) {
			this.dirtyObserved(property.id);
			entry.property = property;
		} else {
			// A no-entry hint changes no producer/lease/metadata. Preserve publisher invalidation,
			// while the separate read-only absence observation remains exactly its original absence.
			this.dirtyPublisherObserved(property.id);
		}
	};

	constructor(@Optional() private readonly events?: EventEmitter2) {}

	onModuleInit(): void {
		if (this.destroyed || this.timer) return;
		// Metadata changes must take effect synchronously before another live-state event can be emitted.
		this.events?.on(EventType.CHANNEL_PROPERTY_UPDATED, this.refreshPropertyMetadata);
		this.timer = setInterval(() => this.sweep(), 1_000);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		for (const records of this.creationObservingIds.values())
			for (const record of records) this.closeCreationRecord(record);
		this.creationObservingIds.clear();
		for (const owner of this.ownedPublishers.values()) this.disposeOwner(owner);
		this.ownedPublishers.clear();
		this.observingIds.clear();
		if (this.timer) clearInterval(this.timer);
		this.events?.off(EventType.CHANNEL_PROPERTY_UPDATED, this.refreshPropertyMetadata);
		this.timer = null;
		this.entries.clear();
	}

	/** Explicit finite observation admission; no registry authority or epoch is minted by a check. */
	beginCreationObservation(ids: readonly string[]): CreationProducerObservation {
		if (this.destroyed) throw new Error('Producer registry destroyed');
		const arrays: Readonly<{ isArray: (value: unknown) => value is readonly unknown[] }> = Array;
		if (!arrays.isArray(ids)) throw new Error('Invalid creation observation');
		const fixedIds = [...ids];
		if (
			fixedIds.length === 0 ||
			new Set(fixedIds).size !== fixedIds.length ||
			fixedIds.some((id) => typeof id !== 'string' || id.length === 0)
		)
			throw new Error('Invalid creation observation');
		// Read all input before installing any membership; input getters cannot partially admit a token.
		const slots = new Map<
			string,
			Readonly<{ entry: ProducerEntry | undefined; lease: PropertyProducerLease | undefined }>
		>(
			fixedIds.map(
				(id): [string, Readonly<{ entry: ProducerEntry | undefined; lease: PropertyProducerLease | undefined }>] => {
					const entry = this.entries.get(id);
					return [id, Object.freeze({ entry, lease: entry?.lease })];
				},
			),
		);
		if (this.destroyed) throw new Error('Producer registry destroyed');
		const token = Object.freeze(new CreationProducerObservation());
		const record: CreationProducerObservationRecord = { active: true, slots };
		this.creationObservations.set(token, record);
		for (const id of fixedIds) {
			const records = this.creationObservingIds.get(id) ?? new Set<CreationProducerObservationRecord>();
			records.add(record);
			this.creationObservingIds.set(id, records);
		}
		return token;
	}

	isCreationObservationCurrent(token: CreationProducerObservation): boolean {
		const record = this.creationObservations.get(token);
		if (this.destroyed || !record?.active) return false;
		for (const [id, slot] of record.slots) {
			const entry = this.entries.get(id);
			if (entry !== slot.entry || entry?.lease !== slot.lease) return false;
		}
		return true;
	}

	closeCreationObservation(token: CreationProducerObservation): void {
		const record = this.creationObservations.get(token);
		if (record) this.closeCreationRecord(record);
		this.creationObservations.delete(token);
	}

	private closeCreationRecord(record: CreationProducerObservationRecord): void {
		record.active = false;
		for (const id of record.slots.keys()) {
			const records = this.creationObservingIds.get(id);
			records?.delete(record);
			if (!records?.size) this.creationObservingIds.delete(id);
		}
		record.slots.clear();
	}

	readCreationObservationCounts(): Readonly<{ active: number; observedIds: number }> {
		const active = new Set<CreationProducerObservationRecord>();
		for (const records of this.creationObservingIds.values()) for (const record of records) active.add(record);
		return Object.freeze({ active: active.size, observedIds: this.creationObservingIds.size });
	}

	/** Installs a live lease, optionally bounded by its owner's captured validation lifecycle. */
	register(property: ChannelPropertyEntity, revision: number, guard?: PropertyProducerGuard): PropertyProducerLease {
		if (this.destroyed) throw new Error('Producer registry destroyed');
		if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid producer revision');
		const lease = Object.freeze({ propertyId: property.id, revision });
		const previous = this.entries.get(property.id);
		const state = this.unavailable(revision, ['initializing'], new Date());
		this.dirtyObserved(property.id);
		if (previous?.owner) this.forgetOwnedMetadata(previous.owner, property.id);
		this.entries.set(property.id, {
			property,
			lease,
			state,
			epoch: (previous?.epoch ?? 0) + 1,
			generation: 0,
			publication: 0,
			guard: guard ? Object.freeze({ ...guard }) : undefined,
		});
		this.emit(property, state);
		return lease;
	}

	owns(propertyId: string): boolean {
		return this.entries.has(propertyId);
	}

	isCurrent(lease: PropertyProducerLease): boolean {
		return this.entries.get(lease.propertyId)?.lease === lease;
	}

	/** Identity and external lifecycle must both remain available before a runtime reuses a lease. */
	isAvailable(lease: PropertyProducerLease): boolean {
		const entry = this.entries.get(lease.propertyId);
		return entry?.lease === lease && (entry.guard?.isCurrent() ?? true);
	}

	version(lease: PropertyProducerLease): number | null {
		const entry = this.entries.get(lease.propertyId);
		return entry?.lease === lease ? entry.epoch : null;
	}

	/** Returns immutable process-local source incorporation evidence for the current live publication. */
	readIncorporatedSample(propertyId: string): IncorporatedPropertySample | null {
		const entry = this.entries.get(propertyId);
		return entry && (entry.guard?.isCurrent() ?? true) && entry.state.producer.quality !== 'unavailable'
			? (entry?.sourceSample ?? null)
			: null;
	}

	beginEvaluation(lease: PropertyProducerLease): PropertyProducerEvaluation | null {
		const entry = this.entries.get(lease.propertyId);
		if (!entry || entry.lease !== lease) return null;
		this.dirtyObserved(lease.propertyId);
		return Object.freeze({ epoch: entry.epoch, generation: ++entry.generation });
	}

	isEvaluationCurrent(lease: PropertyProducerLease, evaluation: PropertyProducerEvaluation): boolean {
		const entry = this.entries.get(lease.propertyId);
		return (
			!!entry &&
			entry.lease === lease &&
			entry.epoch === evaluation?.epoch &&
			entry.generation === evaluation?.generation
		);
	}

	canCommit(
		lease: PropertyProducerLease,
		publication: DerivedPropertyPublication,
		epoch: number | null,
		generation?: number,
	): boolean {
		const entry = this.entries.get(lease.propertyId);
		if (
			!entry ||
			entry.guard?.isCurrent() === false ||
			entry.lease !== lease ||
			epoch !== entry.epoch ||
			!['good', 'degraded'].includes(publication.quality) ||
			!this.evidenceCurrent(publication) ||
			(generation !== undefined && generation !== entry.generation)
		)
			return false;
		const sampled = publication.sampledAt.getTime();
		const evaluated = publication.evaluatedAt.getTime();
		const expiry = publication.expiresAt.getTime();
		return (
			Number.isFinite(sampled) &&
			Number.isFinite(evaluated) &&
			Number.isFinite(expiry) &&
			sampled <= evaluated &&
			evaluated <= Date.now() &&
			expiry > Date.now() &&
			expiry > evaluated &&
			evaluated >= Date.parse(entry.state.producer.evaluatedAt)
		);
	}

	commit(
		lease: PropertyProducerLease,
		state: PropertyValueState,
		publication: DerivedPropertyPublication,
		epoch: number | null,
		generation?: number,
	): boolean {
		if (!this.canCommit(lease, publication, epoch, generation)) return false;
		const entry = this.entries.get(lease.propertyId);
		const next = clonePropertyValueState(state);
		next.lastUpdated = publication.sampledAt.toISOString();
		next.producer = Object.assign(new PropertyProducerState(), {
			quality: publication.quality,
			reasons: [...publication.reasons],
			sampledAt: publication.sampledAt.toISOString(),
			evaluatedAt: publication.evaluatedAt.toISOString(),
			expiresAt: publication.expiresAt.toISOString(),
			revision: lease.revision,
		});
		this.dirtyObserved(lease.propertyId);
		entry.state = next;
		entry.sourceSample = publication.sourceSample ? Object.freeze({ ...publication.sourceSample }) : undefined;
		entry.sourceSamples = publication.sourceSamples;
		entry.publication = ++this.publicationSequence;
		// Successful publications do not change the lifecycle epoch: queued newer evaluations remain valid.
		this.emit(entry.property, next);
		return true;
	}

	invalidate(lease: PropertyProducerLease, reasons: readonly string[], evaluatedAt = new Date()): boolean {
		const entry = this.entries.get(lease.propertyId);
		if (
			!entry ||
			entry.lease !== lease ||
			!Number.isFinite(evaluatedAt.getTime()) ||
			evaluatedAt.getTime() > Date.now() ||
			(evaluatedAt.getTime() < Date.parse(entry.state.producer.evaluatedAt) && entry.guard?.isCurrent() !== false)
		)
			return false;
		// A closed lifecycle must notify dependents even after a clock rollback; lease identity still fences old owners.
		this.dirtyObserved(lease.propertyId);
		entry.epoch++;
		entry.state = this.unavailable(lease.revision, reasons, evaluatedAt);
		entry.sourceSample = undefined;
		entry.sourceSamples = undefined;
		this.emit(entry.property, entry.state);
		return true;
	}

	unregister(lease: PropertyProducerLease): boolean {
		// Keep a tombstone overlay so history cannot resurrect after disposal.
		const entry = this.entries.get(lease.propertyId);
		if (!entry || entry.lease !== lease || !this.invalidate(lease, ['producer_disposed'])) return false;
		// invalidate emits synchronously: never mutate a replacement installed by its listeners.
		if (this.entries.get(lease.propertyId) !== entry || entry.lease !== lease) return false;
		this.dirtyObserved(lease.propertyId);
		entry.epoch++;
		entry.lease = Object.freeze({ propertyId: lease.propertyId, revision: lease.revision });
		return true;
	}

	remove(propertyId: string): void {
		const previous = this.entries.get(propertyId);
		if (previous) this.dirtyObserved(propertyId);
		if (previous?.owner) this.forgetOwnedMetadata(previous.owner, propertyId);
		this.entries.delete(propertyId);
	}

	/** Detached diagnostic snapshot; does not expire publications or emit events. Never admission authority. */
	readDiagnosticState(propertyId: string): PropertyValueState | null {
		const entry = this.entries.get(propertyId);
		if (!entry) return null;
		return entry.guard?.isCurrent() === false || !this.evidenceCurrent(entry)
			? this.unavailable(entry.lease.revision, [entry.guard?.reason ?? 'source_changed'], new Date())
			: clonePropertyValueState(entry.state);
	}

	read(propertyId: string): PropertyValueState | null {
		const entry = this.entries.get(propertyId);
		if (!entry) return null;
		if (entry.guard?.isCurrent() === false || !this.evidenceCurrent(entry)) {
			const state = this.unavailable(entry.lease.revision, [entry.guard?.reason ?? 'source_changed'], new Date());
			return clonePropertyValueState(state);
		}
		const now = Date.now();
		if (
			entry.state.producer.quality !== 'unavailable' &&
			(Date.parse(entry.state.producer.evaluatedAt) > now ||
				(entry.state.producer.sampledAt !== null && Date.parse(entry.state.producer.sampledAt) > now))
		) {
			// A backwards server clock makes formerly admitted evidence temporally ineligible.
			// This read boundary owns the correction; an old evaluator cannot gain the same authority.
			this.dirtyObserved(propertyId);
			entry.epoch++;
			entry.state = this.unavailable(entry.lease.revision, ['clock_invalid'], new Date(now));
			entry.sourceSample = undefined;
			entry.sourceSamples = undefined;
			this.emit(entry.property, entry.state);
		}
		if (
			entry.state.producer.quality !== 'unavailable' &&
			entry.state.producer.expiresAt !== null &&
			Date.parse(entry.state.producer.expiresAt) <= Date.now()
		)
			this.invalidate(entry.lease, ['expired']);
		return clonePropertyValueState(entry.state);
	}

	sweep(): void {
		for (const propertyId of this.entries.keys()) this.read(propertyId);
	}

	captureOwnedEngine(): OwnedProducerEngine {
		const methods: OwnedProducerMethodReferences = this satisfies OwnedProducerMethodReferences;
		return Object.freeze({
			acquireOwnedPublisher: methods.acquireOwnedPublisher,
			isOwnedPublisherCurrent: methods.isOwnedPublisherCurrent,
			disposeOwnedPublisher: methods.disposeOwnedPublisher,
			readOwnedView: methods.readOwnedView,
			owns: methods.owns,
			isCurrent: methods.isCurrent,
			invalidateObservedId: methods.invalidateObservedId,
			ownedPropertyIds: methods.ownedPropertyIds,
			retiredSameKeyPropertyIds: methods.retiredSameKeyPropertyIds,
			beginObservedBatch: methods.beginObservedBatch,
			captureExpectedSlot: methods.captureExpectedSlot,
			isObservedBatchCurrent: methods.isObservedBatchCurrent,
			prepareOwnedBatch: methods.prepareOwnedBatch,
			validatePreparedBatch: methods.validatePreparedBatch,
			installPreparedNoEvents: methods.installPreparedNoEvents,
			isInstalledBatchCurrent: methods.isInstalledBatchCurrent,
			ownedNotificationCount: methods.ownedNotificationCount,
			notifyInstalled: methods.notifyInstalled,
			readInstalledReport: methods.readInstalledReport,
			closeObservedBatch: methods.closeObservedBatch,
			finishPublication: methods.finishPublication,
			isOwnedEngineCurrent: methods.isOwnedEngineCurrent,
		});
	}
	isOwnedEngineCurrent(engine: OwnedProducerEngine): boolean {
		const keys: readonly (keyof OwnedProducerEngine)[] = [
			'acquireOwnedPublisher',
			'isOwnedPublisherCurrent',
			'disposeOwnedPublisher',
			'readOwnedView',
			'owns',
			'isCurrent',
			'invalidateObservedId',
			'ownedPropertyIds',
			'retiredSameKeyPropertyIds',
			'beginObservedBatch',
			'captureExpectedSlot',
			'isObservedBatchCurrent',
			'prepareOwnedBatch',
			'validatePreparedBatch',
			'installPreparedNoEvents',
			'isInstalledBatchCurrent',
			'ownedNotificationCount',
			'notifyInstalled',
			'readInstalledReport',
			'closeObservedBatch',
			'finishPublication',
			'isOwnedEngineCurrent',
		];
		return keys.every((key) => ownedProducerMethodCurrent(this, key, engine[key]));
	}

	acquireOwnedPublisher(key: 'virtual-producer-state:v1', events: EventEmitter2): OwnedProducerPublisher | null {
		if (key !== 'virtual-producer-state:v1') throw new Error('Invalid owned producer key');
		if (this.destroyed || this.ownedPublishers.has(key)) return null;
		const handle = Object.freeze(new OwnedProducerPublisher());
		const emptyView: OwnedProducerView = Object.freeze({
			revision: -1,
			configurationRevisions: Object.freeze([]),
			quarantineLeases: Object.freeze([]),
		});
		const eventMethods: Readonly<{
			emit: OwnedReceiverFunction<EventEmitter2, Parameters<EventEmitter2['emit']>, ReturnType<EventEmitter2['emit']>>;
		}> = events;
		const owner: OwnedPublisherRecord = {
			active: true,
			key,
			events,
			emit: eventMethods.emit,
			view: emptyView,
			emptyView,
			batches: new Set(),
		};
		this.publishers.set(handle, owner);
		this.ownedPublishers.set(key, owner);
		return handle;
	}

	isOwnedPublisherCurrent(handle: OwnedProducerPublisher): boolean {
		const owner = this.publishers.get(handle);
		return !this.destroyed && !!owner?.active && this.ownedPublishers.get(owner.key) === owner;
	}

	disposeOwnedPublisher(handle: OwnedProducerPublisher): void {
		const owner = this.publishers.get(handle);
		if (owner) this.disposeOwner(owner);
	}

	readOwnedView(handle: OwnedProducerPublisher): OwnedProducerView {
		return this.requireOwner(handle).view;
	}

	ownedPropertyIds(handle: OwnedProducerPublisher): readonly string[] {
		const owner = this.requireOwner(handle);
		return Object.freeze(
			[...this.entries]
				.filter(([, entry]) => entry.owner === owner)
				.map(([id]) => id)
				.sort(),
		);
	}

	/** Candidate discovery only. Replacement still requires the exact admitted slot and closed operation. */
	retiredSameKeyPropertyIds(handle: OwnedProducerPublisher): readonly string[] {
		const owner = this.requireOwner(handle);
		return Object.freeze(
			[...this.entries]
				.filter(
					([, entry]) =>
						entry.owner !== undefined && entry.owner !== owner && !entry.owner.active && entry.owner.key === owner.key,
				)
				.map(([id]) => id)
				.sort(),
		);
	}

	beginObservedBatch(
		handle: OwnedProducerPublisher,
		ids: readonly string[],
		originalGuard: PropertyProducerGuard,
	): ObservedProducerBatch {
		const owner = this.requireOwner(handle);
		const guardCurrent: OwnedReceiverFunction<PropertyProducerGuard, [], boolean> = originalGuard.isCurrent;
		const reason = originalGuard.reason;
		const fixedIds = [...ids];
		if (new Set(fixedIds).size !== fixedIds.length || fixedIds.some((id) => typeof id !== 'string' || !id))
			throw new Error('Invalid owned producer batch');
		const observations = new Map<string, ProducerObservation>();
		for (const id of fixedIds) {
			const entry = this.entries.get(id);
			observations.set(id, { token: Object.freeze(new ExpectedProducerSlot()), entry, lease: entry?.lease });
		}
		const batch: ObservedBatchRecord = {
			owner,
			view: owner.view,
			observations,
			open: true,
			dirty: false,
			// Captured BEFORE install; pending may open only this original graph generation.
			guard: Object.freeze({ isCurrent: () => owner.active && guardCurrent.call(originalGuard), reason }),
		};
		const handleBatch = Object.freeze(new ObservedProducerBatch());
		this.observations.set(handleBatch, batch);
		owner.batches.add(batch);
		for (const id of fixedIds) {
			const observers = this.observingIds.get(id) ?? new Set<ObservedBatchRecord>();
			observers.add(batch);
			this.observingIds.set(id, observers);
		}
		return handleBatch;
	}

	captureExpectedSlot(handle: ObservedProducerBatch, id: string): ExpectedProducerSlot {
		const batch = this.requireBatch(handle);
		const observation = batch.observations.get(id);
		if (!observation) throw new Error('Invalid owned producer observation');
		return observation.token;
	}

	isObservedBatchCurrent(handle: ObservedProducerBatch): boolean {
		const batch = this.observations.get(handle);
		return !!batch && this.batchCurrent(batch);
	}

	prepareOwnedBatch(handle: ObservedProducerBatch, plan: OwnedProducerPlan): PreparedProducerBatch {
		const batch = this.requireBatch(handle);
		try {
			if (batch.prepared) throw new Error('Owned producer batch already prepared');
			if (Object.keys(plan).some((key) => !['revision', 'operations', 'configurationRevisions'].includes(key)))
				throw new Error('Unknown owned producer plan field');
			const { revision, operations, configurationRevisions } = plan;
			if (!Number.isSafeInteger(revision) || revision < -1) throw new Error('Invalid owned producer revision');
			const hints = configurationRevisions
				.map(({ propertyId, revision: value }) => {
					if (typeof propertyId !== 'string' || !propertyId || !Number.isSafeInteger(value) || value < 0)
						throw new Error('Invalid owned producer revision hint');
					return Object.freeze({ propertyId, revision: value });
				})
				.sort((a, b) => a.propertyId.localeCompare(b.propertyId));
			if (new Set(hints.map((hint) => hint.propertyId)).size !== hints.length)
				throw new Error('Duplicate owned revision hint');
			const writes: { propertyId: string; entry: ProducerEntry | undefined }[] = [];
			const retiredSources: { propertyId: string; observation: ProducerObservation }[] = [];
			const fallbackSources: { propertyId: string; observation: ProducerObservation }[] = [];
			const notifications: PreparedBatchRecord['notifications'][number][] = [];
			const eventMethods:
				| Readonly<{
						emit: OwnedReceiverFunction<
							EventEmitter2,
							Parameters<EventEmitter2['emit']>,
							ReturnType<EventEmitter2['emit']>
						>;
				  }>
				| undefined = this.events;
			const anchors = new Map(batch.observations);
			const masks = new Map(
				batch.view.quarantineLeases
					.filter(({ propertyId, lease }) => {
						const entry = this.entries.get(propertyId);
						return entry?.owner === batch.owner && entry.lease === lease;
					})
					.map(({ propertyId, lease }) => [propertyId, lease]),
			);
			const seen = new Set<string>();
			const now = new Date();
			for (const operation of operations) {
				const { propertyId, expected, kind } = operation;
				const allowed = [
					'kind',
					'propertyId',
					'expected',
					...(kind === 'unavailable' || kind === 'replace-retired-unavailable' || kind === 'fallback-unavailable'
						? ['property', 'revision', 'reason']
						: kind === 'retire-alias-mask'
							? ['property']
							: []),
				];
				if (Object.keys(operation).some((key) => !allowed.includes(key)))
					throw new Error('Unknown owned producer operation field');
				const observation = batch.observations.get(propertyId);
				if (!observation || observation.token !== expected || seen.has(propertyId))
					throw new Error('Invalid owned producer slot');
				seen.add(propertyId);
				if (kind === 'retain') continue;
				if (kind === 'unavailable' || kind === 'replace-retired-unavailable' || kind === 'fallback-unavailable') {
					if (kind === 'fallback-unavailable') {
						if (
							!this.fallbackObservationCurrent(batch, propertyId, observation) ||
							operation.reason !== 'runtime_unavailable'
						)
							throw new Error('Foreign fallback producer replacement');
						fallbackSources.push(Object.freeze({ propertyId, observation }));
					}
					if (kind === 'replace-retired-unavailable') {
						if (
							!this.retiredSameKeyObservationCurrent(batch, propertyId, observation) ||
							operation.reason !== 'runtime_unavailable'
						)
							throw new Error('Foreign retired producer replacement');
						retiredSources.push(Object.freeze({ propertyId, observation }));
					}
					const { property: originalProperty, revision: value, reason } = operation;
					const property = instanceToInstance(originalProperty, { ignoreDecorators: true, enableCircularCheck: true });
					if (
						property.id !== propertyId ||
						!Number.isSafeInteger(value) ||
						value < 0 ||
						!['runtime_unavailable', 'graph_quarantined'].includes(reason)
					)
						throw new Error('Invalid owned producer replacement');
					const lease = Object.freeze({ propertyId, revision: value });
					const initial = this.unavailable(value, ['initializing'], now);
					const final = this.unavailable(value, [reason], now);
					const metadata = this.preparedSnapshot(property, final);
					const epoch = (observation.entry?.epoch ?? 0) + 2;
					if (!Number.isSafeInteger(epoch)) throw new Error('Owned producer epoch overflow');
					const entry: ProducerEntry = {
						property: metadata,
						lease,
						state: final,
						epoch,
						generation: 0,
						publication: 0,
						guard: batch.guard,
						owner: batch.owner,
						mask: reason === 'graph_quarantined',
					};
					writes.push({ propertyId, entry });
					anchors.set(propertyId, { token: observation.token, entry, lease });
					if (entry.mask) masks.set(propertyId, lease);
					else masks.delete(propertyId);
					for (const state of [initial, final])
						notifications.push({
							batch,
							emitter: this.events,
							emit: eventMethods?.emit,
							kind: EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
							snapshot: this.preparedSnapshot(property, state),
						});
				} else if (kind === 'retire-alias-mask' || kind === 'retire-deleted-owned-overlay') {
					if (observation.entry?.owner !== batch.owner || (kind === 'retire-alias-mask' && !observation.entry.mask))
						throw new Error('Foreign owned producer removal');
					writes.push({ propertyId, entry: undefined });
					anchors.set(propertyId, { token: observation.token, entry: undefined, lease: undefined });
					masks.delete(propertyId);
					if (kind === 'retire-alias-mask') {
						const snapshot = this.preparedSnapshot(
							operation.property,
							this.unavailable(0, ['graph_validation_pending'], now),
						);
						if (snapshot.id !== propertyId) throw new Error('Foreign owned producer metadata');
						notifications.push({
							batch,
							emitter: batch.owner.events,
							emit: batch.owner.emit,
							kind: EventType.CHANNEL_PROPERTY_UPDATED,
							snapshot,
						});
					}
				} else throw new Error('Unknown owned producer operation');
			}
			if (seen.size !== batch.observations.size) throw new Error('Incomplete owned producer batch');
			const quarantineLeases = Object.freeze(
				[...masks]
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([propertyId, lease]) => Object.freeze({ propertyId, lease })),
			);
			// Hints describe CURRENT owned entries, not a history of every catalog ID ever seen.
			const ownedIds = new Set([...this.entries].filter(([, entry]) => entry.owner === batch.owner).map(([id]) => id));
			for (const write of writes) {
				if (write.entry?.owner === batch.owner) ownedIds.add(write.propertyId);
				else ownedIds.delete(write.propertyId);
			}
			const ownedHints = hints.filter((hint) => ownedIds.has(hint.propertyId));
			const sameView =
				revision === batch.view.revision &&
				ownedHints.length === batch.view.configurationRevisions.length &&
				ownedHints.every(
					(hint, i) =>
						hint.propertyId === batch.view.configurationRevisions[i].propertyId &&
						hint.revision === batch.view.configurationRevisions[i].revision,
				) &&
				quarantineLeases.length === batch.view.quarantineLeases.length &&
				quarantineLeases.every((mask, i) => mask.lease === batch.view.quarantineLeases[i].lease);
			const view = sameView
				? batch.view
				: Object.freeze({ revision, configurationRevisions: Object.freeze(ownedHints), quarantineLeases });
			const prepared = Object.freeze(new PreparedProducerBatch());
			this.prepared.set(prepared, {
				batch,
				writes,
				retiredSources: Object.freeze(retiredSources),
				fallbackSources: Object.freeze(fallbackSources),
				anchors,
				view,
				notifications,
				report: { installed: false, attempted: 0, completed: 0, terminal: 'prepared' },
				nextNotification: 0,
			});
			batch.prepared = prepared;
			if (!this.batchCurrent(batch)) throw new Error('Stale owned producer batch');
			return prepared;
		} catch (error) {
			batch.dirty = true;
			this.closeBatch(batch);
			throw error;
		}
	}

	validatePreparedBatch(handle: PreparedProducerBatch): boolean {
		const prepared = this.prepared.get(handle);
		return (
			!!prepared &&
			!prepared.report.installed &&
			prepared.report.terminal === 'prepared' &&
			this.batchCurrent(prepared.batch) &&
			prepared.fallbackSources.every(({ propertyId, observation }) =>
				this.fallbackObservationCurrent(prepared.batch, propertyId, observation),
			) &&
			prepared.retiredSources.every(({ propertyId, observation }) =>
				this.retiredSameKeyObservationCurrent(prepared.batch, propertyId, observation),
			) &&
			prepared.notifications.every(
				(event) => !event.emitter || ownedProducerMethodCurrent(event.emitter, 'emit', event.emit),
			)
		);
	}

	/** Last validation then ONLY private/native bookkeeping and preallocated reference assignments. */
	installPreparedNoEvents(handle: PreparedProducerBatch): boolean {
		const prepared = this.prepared.get(handle);
		if (!prepared || !this.validatePreparedBatch(handle)) return false;
		const batch = prepared.batch;
		for (const other of batch.owner.batches)
			if (other !== batch && prepared.view !== batch.owner.view) this.closeBatch(other);
		for (const write of prepared.writes) {
			this.dirtyObserved(write.propertyId, batch);
			if (write.entry) this.entries.set(write.propertyId, write.entry);
			else this.entries.delete(write.propertyId);
		}
		batch.owner.view = prepared.view;
		batch.view = prepared.view;
		batch.observations = prepared.anchors;
		prepared.report.installed = true;
		prepared.report.terminal = 'installed';
		return true;
	}

	isInstalledBatchCurrent(handle: PreparedProducerBatch): boolean {
		const prepared = this.prepared.get(handle);
		return !!prepared?.report.installed && this.batchCurrent(prepared.batch);
	}

	ownedNotificationCount(handle: PreparedProducerBatch): number {
		return this.prepared.get(handle)?.notifications.length ?? 0;
	}

	notifyInstalled(handle: PreparedProducerBatch, index: number): 'completed' | 'superseded' | 'rejected' {
		const prepared = this.prepared.get(handle);
		if (prepared && prepared.report.terminal !== 'installed') return 'superseded';
		if (
			!prepared ||
			!prepared.report.installed ||
			index !== prepared.nextNotification ||
			!this.batchCurrent(prepared.batch)
		) {
			if (prepared) prepared.report.terminal = 'superseded';
			return 'superseded';
		}
		const event = prepared.notifications[index];
		if (!event) return 'superseded';
		prepared.nextNotification++;
		if (event.emitter && event.emit) {
			if (!ownedProducerMethodCurrent(event.emitter, 'emit', event.emit)) {
				prepared.report.terminal = 'superseded';
				return 'superseded';
			}
			prepared.report.attempted++;
			const previousNotification = this.notifying;
			this.notifying = event;
			try {
				event.emit.call(event.emitter, event.kind, event.snapshot);
			} catch {
				prepared.report.terminal = 'notification_rejected';
				return 'rejected';
			} finally {
				this.notifying = previousNotification;
			}
			prepared.report.completed++;
		}
		if (prepared.nextNotification === prepared.notifications.length) prepared.report.terminal = 'complete';
		return 'completed';
	}

	finishPublication(handle: PreparedProducerBatch, terminal: OwnedPublicationTerminal): void {
		const prepared = this.prepared.get(handle);
		if (prepared && prepared.report.terminal !== 'notification_rejected') prepared.report.terminal = terminal;
	}

	readInstalledReport(handle: PreparedProducerBatch): OwnedPublicationReport {
		const prepared = this.prepared.get(handle);
		return Object.freeze(
			prepared ? { ...prepared.report } : { installed: false, attempted: 0, completed: 0, terminal: 'superseded' },
		);
	}

	closeObservedBatch(handle: ObservedProducerBatch): void {
		const batch = this.observations.get(handle);
		if (batch) this.closeBatch(batch);
	}

	invalidateObservedId(id: string): void {
		this.dirtyObserved(id);
	}

	readOwnedOperationCounts(): Readonly<{ activeBatches: number; observedIds: number }> {
		let activeBatches = 0;
		for (const owner of this.ownedPublishers.values()) activeBatches += owner.batches.size;
		return Object.freeze({ activeBatches, observedIds: this.observingIds.size });
	}

	private requireOwner(handle: OwnedProducerPublisher): OwnedPublisherRecord {
		const owner = this.publishers.get(handle);
		if (!owner || !this.isOwnedPublisherCurrent(handle)) throw new Error('Owned producer unavailable');
		return owner;
	}
	private requireBatch(handle: ObservedProducerBatch): ObservedBatchRecord {
		const batch = this.observations.get(handle);
		if (!batch || !this.batchCurrent(batch)) throw new Error('Owned producer batch unavailable');
		return batch;
	}
	private fallbackObservationCurrent(
		batch: ObservedBatchRecord,
		propertyId: string,
		observation: ProducerObservation,
	): boolean {
		const entry = this.entries.get(propertyId);
		return (
			entry === observation.entry &&
			entry?.lease === observation.lease &&
			(!entry || (entry.owner === batch.owner && batch.owner.active && entry.state.producer.quality === 'unavailable'))
		);
	}

	private retiredSameKeyObservationCurrent(
		batch: ObservedBatchRecord,
		propertyId: string,
		observation: ProducerObservation,
	): boolean {
		const entry = observation.entry;
		return (
			!!entry &&
			this.entries.get(propertyId) === entry &&
			entry.lease === observation.lease &&
			entry.owner !== undefined &&
			entry.owner !== batch.owner &&
			!entry.owner.active &&
			entry.owner.key === batch.owner.key
		);
	}

	private batchCurrent(batch: ObservedBatchRecord): boolean {
		if (this.destroyed || !batch.open || batch.dirty || !batch.owner.active || batch.owner.view !== batch.view)
			return false;
		for (const [id, observation] of batch.observations) {
			const entry = this.entries.get(id);
			if (entry !== observation.entry || entry?.lease !== observation.lease) return false;
		}
		return true;
	}
	private dirtyObserved(id: string, except?: ObservedBatchRecord): void {
		// A publisher's self-exemption NEVER exempts independent creation observations.
		this.dirtyCreationObserved(id);
		this.dirtyPublisherObserved(id, except);
	}
	private dirtyPublisherObserved(id: string, except?: ObservedBatchRecord): void {
		const observers = this.observingIds.get(id);
		if (!observers) return;
		for (const batch of observers)
			if (batch !== except) {
				batch.dirty = true;
				this.closeBatch(batch);
			}
	}
	private dirtyCreationObserved(id: string): void {
		const records = this.creationObservingIds.get(id);
		if (records) for (const record of records) this.closeCreationRecord(record);
	}
	private closeBatch(batch: ObservedBatchRecord): void {
		batch.open = false;
		batch.owner.batches.delete(batch);
		for (const id of batch.observations.keys()) {
			const observers = this.observingIds.get(id);
			observers?.delete(batch);
			if (!observers?.size) this.observingIds.delete(id);
		}
	}
	private forgetOwnedMetadata(owner: OwnedPublisherRecord, id: string): void {
		if (!owner.active) return;
		const hints = owner.view.configurationRevisions.filter((row) => row.propertyId !== id);
		const masks = owner.view.quarantineLeases.filter((row) => row.propertyId !== id);
		if (
			hints.length === owner.view.configurationRevisions.length &&
			masks.length === owner.view.quarantineLeases.length
		)
			return;
		for (const batch of owner.batches) this.closeBatch(batch);
		owner.view = Object.freeze({
			revision: owner.view.revision,
			configurationRevisions: Object.freeze(hints),
			quarantineLeases: Object.freeze(masks),
		});
	}
	private disposeOwner(owner: OwnedPublisherRecord): void {
		for (const [id, entry] of this.entries) if (entry.owner === owner) this.dirtyCreationObserved(id);
		owner.active = false;
		for (const batch of owner.batches) this.closeBatch(batch);
		owner.view = owner.emptyView;
		if (this.ownedPublishers.get(owner.key) === owner) this.ownedPublishers.delete(owner.key);
	}
	private preparedSnapshot(property: ChannelPropertyEntity, state: PropertyValueState): ChannelPropertyEntity {
		const copy = instanceToInstance(property, { ignoreDecorators: true, enableCircularCheck: true });
		copy.unit = resolvePropertyUnit(copy);
		copy.value = clonePropertyValueState(state);
		const producer = copy.value.producer;
		if (!producer) throw new Error('Missing prepared producer state');
		Object.freeze(producer.reasons);
		Object.freeze(producer);
		Object.freeze(copy.value);
		return Object.freeze(copy);
	}

	private unavailable(revision: number, reasons: readonly string[], evaluatedAt: Date): PropertyValueState {
		const state = new PropertyValueState();
		state.producer = Object.assign(new PropertyProducerState(), {
			quality: 'unavailable',
			reasons: [...reasons],
			sampledAt: null,
			evaluatedAt: evaluatedAt.toISOString(),
			expiresAt: null,
			revision,
		});
		return state;
	}

	private emit(property: ChannelPropertyEntity, state: PropertyValueState): void {
		const snapshot = Object.assign(
			Object.create(Object.getPrototypeOf(property) as object) as ChannelPropertyEntity,
			property,
		);
		snapshot.value = clonePropertyValueState(state);
		Object.freeze(snapshot.value.producer.reasons);
		Object.freeze(snapshot.value.producer);
		Object.freeze(snapshot.value);
		Object.freeze(snapshot);
		this.events?.emit(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, snapshot);
	}
}
