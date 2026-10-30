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

import { captureCreation, snapshotCreation } from './creation-capture';

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

export interface ProducerRuntimeSlot {
	readonly toJSON: () => object;
}

export interface ProducerStateOwner {
	readonly toJSON: () => object;
}
export interface ProducerStateBatch {
	readonly toJSON: () => object;
}
export interface ProducerStatePlan {
	readonly toJSON: () => object;
}
export interface ProducerStateIntent {
	readonly property: ChannelPropertyEntity;
	readonly revision: number;
	readonly reason: 'runtime_unavailable' | 'graph_quarantined';
}
export interface ProducerStatePublicationReport {
	readonly attempted: number;
	readonly installed: number;
	readonly submitted: number;
	readonly settled: number;
	readonly failed: number;
	readonly retired: boolean;
	readonly terminal: 'prepared' | 'installed' | 'complete' | 'refused' | 'partial';
}
interface StateOwnerRecord {
	readonly family: string;
	readonly lifecycle: number;
	active: boolean;
	readonly slots: Map<string, ProducerEntry>;
}
interface StateBatchRecord {
	readonly owner: StateOwnerRecord;
	readonly entries: Map<string, ProducerEntry>;
	readonly versions: Map<string, number>;
	readonly removalEpoch: object;
	readonly current: () => boolean;
	readonly ready: () => boolean;
	readonly emit: (property: ChannelPropertyEntity, state: PropertyValueState) => void;
	active: boolean;
}
interface StatePlanRecord {
	readonly batch: StateBatchRecord;
	readonly operations: readonly { id: string; previous?: ProducerEntry; next?: ProducerEntry }[];
	readonly restore?: (id: string) => Promise<void>;
	readonly report: { -readonly [K in keyof ProducerStatePublicationReport]: ProducerStatePublicationReport[K] };
	published: boolean;
	removalEpoch?: object;
}
function privateStateToken() {
	return Object.freeze({ toJSON: () => ({}) });
}
function detachedStateValue<T>(value: T): T {
	const owned = snapshotCreation(value);
	const seen = new Set<object>();
	const freeze = (item: unknown): void => {
		if (!item || typeof item !== 'object' || seen.has(item)) return;
		seen.add(item);
		for (const key of Object.keys(item)) freeze(Reflect.get(item, key));
		Object.freeze(item);
	};
	freeze(owned);
	return owned;
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
	ownedState?: StateOwnerRecord;
	retiredByUnregister?: true;
}

/** Owns process-local live authority. Persisted history is never restart evidence. */
@Injectable()
export class PropertyProducerRegistryService implements OnModuleInit, OnModuleDestroy {
	private readonly entries = new Map<string, ProducerEntry>();
	private timer: NodeJS.Timeout | null = null;
	private publicationSequence = 0;
	private stateLifecycle = 0;
	private readonly stateOwners = new WeakMap<ProducerStateOwner, StateOwnerRecord>();
	private readonly stateBatches = new WeakMap<ProducerStateBatch, StateBatchRecord>();
	private readonly statePlans = new WeakMap<ProducerStatePlan, StatePlanRecord>();
	private readonly slotVersions = new Map<string, number>();
	private removalEpoch: object = {};
	private readonly runtimeSlots = new WeakMap<
		ProducerRuntimeSlot,
		{
			id: string;
			previous?: ProducerEntry;
			version: number;
			removalEpoch: object;
			eligible: boolean;
			used: boolean;
			current: () => boolean;
			emit: (property: ChannelPropertyEntity, state: PropertyValueState) => void;
		}
	>();
	private advanceSlot(id: string): void {
		this.slotVersions.set(id, (this.slotVersions.get(id) ?? 0) + 1);
	}
	private forgetSlot(id: string): void {
		// Conservatively expire pending absence captures on any removal. Concrete live slots retain per-ID fences.
		this.removalEpoch = {};
		this.slotVersions.delete(id);
	}

	/** Private fallback ownership; ordinary runtime registration deliberately remains independent. */
	createStateOwner(family: string): ProducerStateOwner {
		const token = privateStateToken();
		this.stateOwners.set(token, { family, lifecycle: this.stateLifecycle, active: true, slots: new Map() });
		return token;
	}
	beginStateBatch(owner: ProducerStateOwner, current: () => boolean, ready: () => boolean): ProducerStateBatch {
		const record = this.stateOwners.get(owner);
		const lifecycle = this.stateLifecycle;
		if (!record?.active || record.lifecycle !== this.stateLifecycle) throw new Error('Producer state owner is closed');
		const pins = captureCreation(this, [
			'createStateOwner',
			'beginStateBatch',
			'prepareStateBatch',
			'installStatePlan',
			'publishStatePlan',
			'disposeStateOwner',
			'validateStatePlan',
			'readStatePlan',
			'closeStateBatch',
			'register',
			'owns',
			'isCurrent',
		]);
		const eventPins = this.events && captureCreation(this.events, ['emit']);
		const originalEmit = this.emit.bind(this) as PropertyProducerRegistryService['emit'];
		const dispatch = eventPins
			? (property: ChannelPropertyEntity) => {
					eventPins.values.emit.call(eventPins.receiver, EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, property);
				}
			: null;
		const emission = (property: ChannelPropertyEntity, state: PropertyValueState) =>
			originalEmit(property, state, dispatch);
		const token = privateStateToken();
		this.stateBatches.set(token, {
			owner: record,
			entries: new Map(this.entries),
			versions: new Map(this.slotVersions),
			removalEpoch: this.removalEpoch,
			current: () =>
				lifecycle === this.stateLifecycle &&
				record.active &&
				pins.current() &&
				(!eventPins || eventPins.current()) &&
				current(),
			ready,
			emit: emission,
			active: true,
		});
		return token;
	}
	prepareStateBatch(
		token: ProducerStateBatch,
		intents: readonly ProducerStateIntent[],
		removeMissing = true,
		replaceOwned = true,
		restore?: (id: string) => Promise<void>,
		replaceOriginalConfigurationSlots: ReadonlySet<string> = new Set(),
		allowAbsent: true | ReadonlySet<string> = true,
	): ProducerStatePlan {
		const batch = this.stateBatches.get(token);
		if (!batch?.active || !batch.current()) throw new Error('Producer state batch expired');
		const owned = detachedStateValue(intents);
		const ids = new Set<string>();
		const operations: StatePlanRecord['operations'][number][] = [];
		for (const intent of owned) {
			const id = intent.property.id;
			if (!id || ids.has(id) || !Number.isSafeInteger(intent.revision) || intent.revision < 0)
				throw new Error('Invalid producer state intent');
			ids.add(id);
			const previous = batch.entries.get(id);
			if (!previous && intent.reason === 'runtime_unavailable' && allowAbsent !== true && !allowAbsent.has(id))
				continue;
			if (previous && !replaceOwned && !previous.retiredByUnregister) continue;
			// Independent runtime authority is never replaced by a state fallback or quarantine mask.
			if (
				previous &&
				previous.ownedState !== batch.owner &&
				!previous.retiredByUnregister &&
				!replaceOriginalConfigurationSlots.has(id) &&
				!(previous.ownedState?.family === batch.owner.family && !previous.ownedState.active)
			)
				continue;
			const state = this.unavailable(intent.revision, [intent.reason], new Date());
			operations.push({
				id,
				previous,
				next: {
					property: intent.property,
					lease: Object.freeze({ propertyId: id, revision: intent.revision }),
					state,
					epoch: (previous?.epoch ?? 0) + 1,
					generation: 0,
					publication: 0,
					ownedState: batch.owner,
					guard: Object.freeze({
						isCurrent: () => batch.owner.active && batch.ready(),
						reason: 'graph_validation_pending',
					}),
				},
			});
		}
		if (removeMissing)
			for (const [id, previous] of batch.owner.slots)
				if (!ids.has(id) && batch.entries.get(id) === previous) operations.push({ id, previous });
		const plan = privateStateToken();
		this.statePlans.set(plan, {
			batch,
			operations: Object.freeze(operations),
			restore,
			published: false,
			report: {
				attempted: operations.length,
				installed: 0,
				submitted: 0,
				settled: 0,
				failed: 0,
				retired: false,
				terminal: 'prepared',
			},
		});
		return plan;
	}
	validateStatePlan(token: ProducerStatePlan): boolean {
		const plan = this.statePlans.get(token);
		if (!plan || !plan.batch.current()) return false;
		if (plan.report.terminal === 'prepared')
			return (
				plan.batch.active &&
				plan.operations.every(
					({ id, previous }) =>
						this.entries.get(id) === previous &&
						(previous !== undefined || plan.batch.removalEpoch === this.removalEpoch) &&
						(this.slotVersions.get(id) ?? 0) === (plan.batch.versions.get(id) ?? 0),
				)
			);
		return (
			(plan.report.terminal === 'installed' || plan.report.terminal === 'complete') &&
			plan.report.failed === 0 &&
			plan.operations.every(
				({ id, next }) =>
					this.entries.get(id) === next &&
					(next === undefined
						? plan.removalEpoch === this.removalEpoch
						: (this.slotVersions.get(id) ?? 0) === (plan.batch.versions.get(id) ?? 0) + 1),
			)
		);
	}
	installStatePlan(token: ProducerStatePlan): boolean {
		const plan = this.statePlans.get(token);
		if (!plan || plan.report.terminal !== 'prepared') return false;
		if (!this.validateStatePlan(token)) {
			plan.report.retired = true;
			plan.report.terminal = 'refused';
			plan.batch.active = false;
			return false;
		}
		// Synchronous identity CAS, with no plugin/event callbacks between validation and map installation.
		for (const { id, next } of plan.operations) {
			if (next) {
				this.entries.set(id, next);
				plan.batch.owner.slots.set(id, next);
				this.advanceSlot(id);
			} else {
				this.entries.delete(id);
				plan.batch.owner.slots.delete(id);
				this.forgetSlot(id);
			}
			plan.report.installed++;
		}
		plan.removalEpoch = this.removalEpoch;
		plan.report.terminal = 'installed';
		return true;
	}
	publishStatePlan(token: ProducerStatePlan): void | Promise<void> {
		const plan = this.statePlans.get(token);
		if (!plan || plan.report.terminal !== 'installed' || plan.published)
			throw new Error('Producer state publication is closed');
		plan.published = true;
		let failure: { cause: unknown } | undefined;
		const failed = (cause: unknown) => {
			plan.report.failed++;
			failure ??= { cause };
		};
		const finish = () => {
			plan.report.retired ||= !plan.batch.current();
			plan.report.terminal = failure ? 'partial' : 'complete';
			plan.batch.active = false;
			if (failure) throw failure.cause;
		};
		const run = (start: number): void | Promise<void> => {
			for (let index = start; index < plan.operations.length; index++) {
				const { id, next } = plan.operations[index];
				if (!next && !plan.restore) continue;
				plan.report.retired ||= !plan.batch.current() || this.entries.get(id) !== next;
				plan.report.submitted++;
				if (!next) {
					// The exact original hydration/event operation is issued here, once. Its completion
					// remains owed after observation expiry; it never installs a successor registry slot.
					let original: Promise<void>;
					try {
						original = plan.restore(id);
					} catch (cause: unknown) {
						failed(cause);
						plan.report.settled++;
						continue;
					}
					return original.catch(failed).then(() => {
						plan.report.settled++;
						return run(index + 1);
					});
				}
				try {
					plan.batch.emit(next.property, next.state);
				} catch (cause: unknown) {
					failed(cause);
				} finally {
					plan.report.settled++;
				}
			}
			return finish();
		};
		return run(0);
	}

	readStatePlan(token: ProducerStatePlan): ProducerStatePublicationReport | undefined {
		const plan = this.statePlans.get(token);
		return plan && Object.freeze({ ...plan.report, retired: plan.report.retired || !plan.batch.current() });
	}
	closeStateBatch(token: ProducerStateBatch): void {
		const batch = this.stateBatches.get(token);
		if (batch) batch.active = false;
	}
	removeOwnedState(owner: ProducerStateOwner, id: string): boolean {
		const record = this.stateOwners.get(owner),
			entry = this.entries.get(id);
		if (!record?.active || !entry || entry.ownedState !== record || record.slots.get(id) !== entry) return false;
		this.entries.delete(id);
		record.slots.delete(id);
		this.forgetSlot(id);
		return true;
	}
	disposeStateOwner(owner: ProducerStateOwner): void {
		const record = this.stateOwners.get(owner);
		if (!record?.active) return;
		record.active = false;
		// Retained unavailable overlays carry original provenance for a fresh same-family owner.
		for (const [id, entry] of record.slots)
			if (this.entries.get(id) === entry) {
				entry.epoch++;
				this.advanceSlot(id);
			}
		record.slots.clear();
	}

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
		this.stateLifecycle++;
		if (this.timer) clearInterval(this.timer);
		this.events?.off(EventType.CHANNEL_PROPERTY_UPDATED, this.refreshPropertyMetadata);
		this.timer = null;
		this.entries.clear();
		this.slotVersions.clear();
		this.removalEpoch = {};
	}

	/** Capture an actual runtime's original slot before property/configuration awaits. */
	captureRuntimeSlot(propertyId: string, originalLease?: PropertyProducerLease): ProducerRuntimeSlot {
		const previous = this.entries.get(propertyId),
			lifecycle = this.stateLifecycle;
		const methods = captureCreation(this, [
			'captureRuntimeSlot',
			'registerRuntime',
			'register',
			'isAvailable',
			'isCurrent',
		]);
		const event = this.events && captureCreation(this.events, ['emit']);
		const emit = this.emit.bind(this) as PropertyProducerRegistryService['emit'];
		const dispatch = event
			? (property: ChannelPropertyEntity) => {
					event.values.emit.call(event.receiver, EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, property);
				}
			: null;
		const token = privateStateToken();
		this.runtimeSlots.set(token, {
			id: propertyId,
			previous,
			version: this.slotVersions.get(propertyId) ?? 0,
			removalEpoch: this.removalEpoch,
			eligible:
				!previous ||
				previous.lease === originalLease ||
				previous.ownedState?.active === true ||
				previous.retiredByUnregister === true,
			used: false,
			current: () => lifecycle === this.stateLifecycle && methods.current() && (!event || event.current()),
			emit: (property, state) => emit(property, state, dispatch),
		});
		return token;
	}
	registerRuntime(
		property: ChannelPropertyEntity,
		revision: number,
		token: ProducerRuntimeSlot,
		guard?: PropertyProducerGuard,
	): PropertyProducerLease | null {
		const slot = this.runtimeSlots.get(token);
		if (!slot || slot.used) return null;
		slot.used = true;
		if (
			!slot.eligible ||
			!slot.current() ||
			slot.id !== property.id ||
			this.entries.get(slot.id) !== slot.previous ||
			(slot.previous === undefined && slot.removalEpoch !== this.removalEpoch) ||
			(this.slotVersions.get(slot.id) ?? 0) !== slot.version
		)
			return null;
		if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid producer revision');
		const lease = Object.freeze({ propertyId: property.id, revision });
		const state = this.unavailable(revision, ['initializing'], new Date());
		this.advanceSlot(property.id);
		const entry: ProducerEntry = {
			property,
			lease,
			state,
			epoch: (slot.previous?.epoch ?? 0) + 1,
			generation: 0,
			publication: 0,
			guard: guard ? Object.freeze({ ...guard }) : undefined,
		};
		this.entries.set(property.id, entry);
		try {
			slot.emit(property, state);
		} catch (cause: unknown) {
			// A reentrant listener may already have installed a successor. Only undo this exact entry.
			if (this.entries.get(property.id) === entry) {
				if (slot.previous) {
					this.entries.set(property.id, slot.previous);
					this.advanceSlot(property.id);
				} else {
					this.entries.delete(property.id);
					this.forgetSlot(property.id);
				}
			}
			throw cause;
		}
		return lease;
	}

	/** Installs a live lease, optionally bounded by its owner's captured validation lifecycle. */
	register(property: ChannelPropertyEntity, revision: number, guard?: PropertyProducerGuard): PropertyProducerLease {
		if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid producer revision');
		const lease = Object.freeze({ propertyId: property.id, revision });
		const previous = this.entries.get(property.id);
		const state = this.unavailable(revision, ['initializing'], new Date());
		this.advanceSlot(property.id);
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
		const entry = this.entries.get(lease.propertyId);
		if (!entry || entry.lease !== lease) return false;
		// Retire the original owner before synchronous listeners can publish, replace it or throw.
		this.advanceSlot(lease.propertyId);
		entry.epoch++;
		entry.lease = Object.freeze({ propertyId: lease.propertyId, revision: lease.revision });
		entry.retiredByUnregister = true;
		entry.state = this.unavailable(lease.revision, ['producer_disposed'], new Date());
		entry.sourceSample = undefined;
		entry.sourceSamples = undefined;
		this.emit(entry.property, entry.state);
		return true;
	}

	remove(propertyId: string): void {
		this.entries.delete(propertyId);
		this.forgetSlot(propertyId);
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

	private emit(
		property: ChannelPropertyEntity,
		state: PropertyValueState,
		dispatch?: ((property: ChannelPropertyEntity) => void) | null,
	): void {
		const snapshot = Object.assign(
			Object.create(Object.getPrototypeOf(property) as object) as ChannelPropertyEntity,
			property,
		);
		snapshot.value = clonePropertyValueState(state);
		Object.freeze(snapshot.value.producer.reasons);
		Object.freeze(snapshot.value.producer);
		Object.freeze(snapshot.value);
		Object.freeze(snapshot);
		if (dispatch === undefined) this.events?.emit(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, snapshot);
		else dispatch?.(snapshot);
	}
}
