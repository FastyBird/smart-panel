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

/** Owns process-local live authority. Persisted history is never restart evidence. */
@Injectable()
export class PropertyProducerRegistryService implements OnModuleInit, OnModuleDestroy {
	private readonly entries = new Map<string, ProducerEntry>();
	private timer: NodeJS.Timeout | null = null;
	private publicationSequence = 0;
	private evidenceValidator?: (sources: readonly IncorporatedPropertySample[]) => boolean;

	setEvidenceValidator(validator: (sources: readonly IncorporatedPropertySample[]) => boolean): void {
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
		if (entry) entry.property = property;
	};

	constructor(@Optional() private readonly events?: EventEmitter2) {}

	onModuleInit(): void {
		if (this.timer) return;
		// Metadata changes must take effect synchronously before another live-state event can be emitted.
		this.events?.on(EventType.CHANNEL_PROPERTY_UPDATED, this.refreshPropertyMetadata);
		this.timer = setInterval(() => this.sweep(), 1_000);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.events?.off(EventType.CHANNEL_PROPERTY_UPDATED, this.refreshPropertyMetadata);
		this.timer = null;
		this.entries.clear();
	}

	/** Installs a live lease, optionally bounded by its owner's captured validation lifecycle. */
	register(property: ChannelPropertyEntity, revision: number, guard?: PropertyProducerGuard): PropertyProducerLease {
		if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid producer revision');
		const lease = Object.freeze({ propertyId: property.id, revision });
		const previous = this.entries.get(property.id);
		const state = this.unavailable(revision, ['initializing'], new Date());
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
		entry.epoch++;
		entry.state = this.unavailable(lease.revision, reasons, evaluatedAt);
		entry.sourceSample = undefined;
		entry.sourceSamples = undefined;
		this.emit(entry.property, entry.state);
		return true;
	}

	unregister(lease: PropertyProducerLease): boolean {
		// Keep a tombstone overlay so history cannot resurrect after disposal.
		if (!this.invalidate(lease, ['producer_disposed'])) return false;
		const entry = this.entries.get(lease.propertyId);
		entry.epoch++;
		entry.lease = Object.freeze({ propertyId: lease.propertyId, revision: lease.revision });
		return true;
	}

	remove(propertyId: string): void {
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
