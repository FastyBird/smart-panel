import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { DerivedPropertyPublication } from '../models/property-sample.model';
import {
	PropertyProducerState,
	PropertyValueState,
	clonePropertyValueState,
} from '../models/property-value-state.model';

export interface PropertyProducerLease {
	readonly propertyId: string;
	readonly revision: number;
}

interface ProducerEntry {
	readonly property: ChannelPropertyEntity;
	lease: PropertyProducerLease;
	state: PropertyValueState;
	epoch: number;
	watermark: number | null;
}

/** Owns process-local live authority. Persisted history is never restart evidence. */
@Injectable()
export class PropertyProducerRegistryService implements OnModuleInit, OnModuleDestroy {
	private readonly entries = new Map<string, ProducerEntry>();
	private timer: NodeJS.Timeout | null = null;

	constructor(@Optional() private readonly events?: EventEmitter2) {}

	onModuleInit(): void {
		if (this.timer) return;
		this.timer = setInterval(() => this.sweep(), 1_000);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.entries.clear();
	}

	register(property: ChannelPropertyEntity, revision: number): PropertyProducerLease {
		if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid producer revision');
		const lease = Object.freeze({ propertyId: property.id, revision });
		const previous = this.entries.get(property.id);
		const state = this.unavailable(revision, ['initializing'], new Date());
		this.entries.set(property.id, { property, lease, state, epoch: (previous?.epoch ?? 0) + 1, watermark: null });
		this.emit(property, state);
		return lease;
	}

	owns(propertyId: string): boolean {
		return this.entries.has(propertyId);
	}

	isCurrent(lease: PropertyProducerLease): boolean {
		return this.entries.get(lease.propertyId)?.lease === lease;
	}

	version(lease: PropertyProducerLease): number | null {
		const entry = this.entries.get(lease.propertyId);
		return entry?.lease === lease ? entry.epoch : null;
	}

	canCommit(lease: PropertyProducerLease, publication: DerivedPropertyPublication, epoch: number | null): boolean {
		const entry = this.entries.get(lease.propertyId);
		if (!entry || entry.lease !== lease || epoch !== entry.epoch || !['good', 'degraded'].includes(publication.quality))
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
			evaluated >= Date.parse(entry.state.producer.evaluatedAt) &&
			(entry.watermark === null || sampled >= entry.watermark)
		);
	}

	commit(
		lease: PropertyProducerLease,
		state: PropertyValueState,
		publication: DerivedPropertyPublication,
		epoch: number | null,
	): boolean {
		if (!this.canCommit(lease, publication, epoch)) return false;
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
		entry.watermark = publication.sampledAt.getTime();
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
			evaluatedAt.getTime() < Date.parse(entry.state.producer.evaluatedAt)
		)
			return false;
		entry.epoch++;
		entry.state = this.unavailable(lease.revision, reasons, evaluatedAt);
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

	read(propertyId: string): PropertyValueState | null {
		const entry = this.entries.get(propertyId);
		if (!entry) return null;
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
